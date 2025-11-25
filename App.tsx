import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Activity, Wallet, Sun, Moon, ChevronDown, LineChart, BarChart2, RefreshCw, TrendingUp, BrainCircuit, X, ArrowUp, ArrowDown, Zap, MessageSquare, Trophy } from 'lucide-react';
import { Button } from './components/ui/Button';
import { PredictionCard } from './components/PredictionCard';
import { ChatRoom } from './components/ChatRoom';
import { PriceChart } from './components/PriceChart';
import { getMarketAnalysis } from './services/geminiService';
import { fetchRealPrice } from './services/priceService';
import { fetchLeaderboard, LeaderboardEntry } from './services/leaderboardService';
import { getRoundResult, RoundResult } from './services/predictionService';
import { ASSETS, TIMEFRAMES, RPC_URL, CELO_SEPOLIA_CHAIN_ID, TOAST_DURATION } from './constants';
import { PREDICTION_MARKET_ABI, PREDICTION_MARKET_ADDRESS } from './contracts/PredictionMarketABI';
import { Asset, PredictionDirection, Round, RoundStatus, UserPrediction, PricePoint, TimeframeConfig } from './types';

declare global {
  interface Window {
    ethereum: any;
  }
}

export default function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [userBalance, setUserBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<'trade' | 'leaderboard'>('trade');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [activeAsset, setActiveAsset] = useState<Asset>(Asset.CELO);
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeConfig>(TIMEFRAMES[1]); // Default 5M
  const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ sentiment: string, reasoning: string } | null>(null);
  const [predictions, setPredictions] = useState<(UserPrediction & { result?: RoundResult | null })[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);

  const checkAndSwitchNetwork = async (provider: ethers.BrowserProvider) => {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CELO_SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + CELO_SEPOLIA_CHAIN_ID.toString(16) }],
        });
        return true;
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + CELO_SEPOLIA_CHAIN_ID.toString(16),
                chainName: 'Celo Sepolia Testnet',
                nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ['https://sepolia.celoscan.io/'],
              }],
            });
            return true;
          } catch (addError) {
            console.error("Failed to add network", addError);
            return false;
          }
        }
        console.error("Failed to switch network", switchError);
        return false;
      }
    }
    return true;
  };

  const updateBalance = async (address: string) => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        if (Number(network.chainId) === CELO_SEPOLIA_CHAIN_ID) {
          const balance = await provider.getBalance(address);
          setUserBalance(parseFloat(ethers.formatEther(balance)));
        }
      } catch (error) {
        console.error("Failed to update balance", error);
      }
    }
  };

  const handleConnectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const isNetworkCorrect = await checkAndSwitchNetwork(provider);

      if (!isNetworkCorrect) return;

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

      if (accounts.length > 0) {
        setUserAddress(accounts[0]);
        setWalletConnected(true);
        updateBalance(accounts[0]);
      }
    } catch (error) {
      console.error("Connection failed", error);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);

      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          setWalletConnected(true);
          updateBalance(accounts[0]);
        } else {
          setWalletConnected(false);
          setUserAddress('');
          setUserBalance(0);
        }
      });

      window.ethereum.on('chainChanged', () => window.location.reload());

      window.ethereum.request({ method: 'eth_accounts' }).then(async (accounts: string[]) => {
        if (accounts.length > 0) {
          const network = await provider.getNetwork();
          if (Number(network.chainId) === CELO_SEPOLIA_CHAIN_ID) {
            setUserAddress(accounts[0]);
            setWalletConnected(true);
            updateBalance(accounts[0]);
          }
        }
      });
    }
  }, []);

  const handleTimeframeChange = (tf: TimeframeConfig) => {
    setSelectedTimeframe(tf);
  };

  const fetchContractData = async () => {
    try {
      // Use a read-only provider for fetching data to ensure we are on the right network
      const readProvider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, readProvider);

      const currentEpochBigInt = await contract.currentEpoch();
      const currentEpoch = Number(currentEpochBigInt);

      // Fetch current round data
      const roundData = await contract.rounds(currentEpoch);

      const now = Date.now() / 1000;
      let status = RoundStatus.OPEN;
      if (now >= Number(roundData.lockTimestamp) && now < Number(roundData.closeTimestamp)) {
        status = RoundStatus.LOCKED;
      } else if (now >= Number(roundData.closeTimestamp)) {
        status = RoundStatus.ENDED;
      }

      const mappedRound: Round = {
        id: Number(roundData.epoch),
        asset: Asset.CELO,
        startTimestamp: Number(roundData.startTimestamp) * 1000,
        lockTimestamp: Number(roundData.lockTimestamp) * 1000,
        closeTimestamp: Number(roundData.closeTimestamp) * 1000,
        startPrice: 0,
        lockPrice: Number(roundData.lockPrice) > 0 ? Number(roundData.lockPrice) / 1e8 : null,
        closePrice: Number(roundData.closePrice) > 0 ? Number(roundData.closePrice) / 1e8 : null,
        totalPool: parseFloat(ethers.formatEther(roundData.totalAmount)),
        status: status,
        winner: null,
        upPool: parseFloat(ethers.formatEther(roundData.upAmount)),
        downPool: parseFloat(ethers.formatEther(roundData.downAmount))
      };

      setCurrentRound(mappedRound);

    } catch (error) {
      console.error("Failed to fetch contract data:", error);
    }
  };

  const handlePredict = async (direction: PredictionDirection, amount: number) => {
    if (!walletConnected) {
      handleConnectWallet();
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, signer);

      const currentEpochBigInt = await contract.currentEpoch();
      const tx = direction === PredictionDirection.UP
        ? await contract.betUp(currentEpochBigInt, { value: ethers.parseEther(amount.toString()) })
        : await contract.betDown(currentEpochBigInt, { value: ethers.parseEther(amount.toString()) });

      await tx.wait();
      alert("Prediction placed successfully!");
      updateBalance(userAddress);
      fetchContractData(); // Refresh round data
      // Refresh predictions list (mock for now or fetch from contract)
      setPredictions(prev => [...prev, { roundId: Number(currentEpochBigInt), direction, amount, claimed: false }]);

    } catch (error) {
      console.error("Prediction failed", error);
      alert("Prediction failed: " + (error as any).message);
    }
  };

  const handleClaim = async () => {
    if (!walletConnected) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, signer);
      const currentEpochBigInt = await contract.currentEpoch();
      const currentEpoch = Number(currentEpochBigInt);

      const epochsToClaim: number[] = [];
      // Check last 10 epochs
      for (let i = 1; i <= 10; i++) {
        const epochToCheck = currentEpoch - i;
        if (epochToCheck < 0) continue;

        const betInfo = await contract.ledger(epochToCheck, userAddress);
        if (betInfo.amount > 0n && !betInfo.claimed) {
          epochsToClaim.push(epochToCheck);
        }
      }

      if (epochsToClaim.length > 0) {
        const tx = await contract.claim(epochsToClaim);
        await tx.wait();
        alert(`Claimed winnings for epochs: ${epochsToClaim.join(', ')}`);
        updateBalance(userAddress);
      } else {
        alert("No winnings to claim from the last 10 rounds.");
      }

    } catch (error) {
      console.error("Claim failed", error);
      alert("Claim failed: " + (error as any).message);
    }
  };

  // Real price updates with Jitter and Seeding
  useEffect(() => {
    const initHistory = async () => {
      const price = await fetchRealPrice(activeAsset);
      if (price) {
        setCurrentPrice(price);
        // Seed history with 50 points of "fake" volatility ending at current price
        const now = Date.now();
        const seededHistory: PricePoint[] = [];
        let tempPrice = price;
        for (let i = 50; i > 0; i--) {
          const volatility = price * 0.002; // 0.2% volatility
          const change = (Math.random() - 0.5) * volatility;
          tempPrice -= change;
          seededHistory.unshift({
            timestamp: now - (i * 10000), // 10s intervals
            price: tempPrice
          });
        }
        setPriceHistory(seededHistory);
      }
    };

    initHistory();

    const getPrice = async () => {
      let price = await fetchRealPrice(activeAsset);
      if (price) {
        // Add micro-jitter to simulate live order book movement
        const jitter = price * 0.0005 * (Math.random() - 0.5);
        price += jitter;

        setCurrentPrice(price);
        setPriceHistory(prev => {
          const newHistory = [...prev, { timestamp: Date.now(), price: price! }];
          return newHistory.slice(-50); // Keep last 50 points
        });
      }
    };

    const interval = setInterval(getPrice, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [activeAsset]);

  // Poll for round data
  useEffect(() => {
    fetchContractData();
    const interval = setInterval(fetchContractData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  // Poll for prediction results
  useEffect(() => {
    const updateResults = async () => {
      if (predictions.length === 0) return;

      const updatedPredictions = await Promise.all(predictions.map(async (p) => {
        if (p.result && p.result.status === RoundStatus.ENDED) return p; // Already final
        const result = await getRoundResult(p.roundId);
        return { ...p, result };
      }));

      setPredictions(updatedPredictions);
    };

    const interval = setInterval(updateResults, 10000); // Check results every 10s
    updateResults(); // Initial check
    return () => clearInterval(interval);
  }, [predictions.length]);

  // Fetch leaderboard when tab is active
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard().then(setLeaderboardData);
    }
  }, [activeTab]);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    setShowAiModal(true);
    const result = await getMarketAnalysis(activeAsset, priceHistory);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const isDark = theme === 'dark';

  // --- RENDERS ---

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0f172a] text-slate-200 selection:bg-indigo-500/30' : 'bg-slate-100 text-slate-800 selection:bg-indigo-200'}`}>

      {/* Header */}
      <nav className={`border-b backdrop-blur-md sticky top-0 z-50 transition-colors duration-300 ${isDark ? 'border-white/5 bg-[#0f172a]/80' : 'border-slate-200 bg-white/80'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center neon-glow-purple">
                <Activity className="text-white w-5 h-5" />
              </div>
              <span className={`font-display font-bold text-xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Celo<span className="text-indigo-500">Pulse</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {['trade', 'leaderboard'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`text-sm font-medium transition-colors capitalize ${activeTab === tab
                    ? (isDark ? 'text-white' : 'text-indigo-600')
                    : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-indigo-600')
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className={`p-2 rounded-full transition-colors ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-yellow-400' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {walletConnected ? (
                <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border ${isDark ? 'bg-slate-800/50 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <span className="text-emerald-500 font-bold text-sm">{userBalance.toFixed(2)} CELO</span>
                  <div className={`h-4 w-[1px] ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`}></div>
                  <span className={`text-sm truncate w-24 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
                  <button
                    onClick={handleClaim}
                    className={`ml-2 p-1.5 rounded-full transition-colors ${isDark ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                    title="Claim Winnings"
                  >
                    <Trophy size={14} />
                  </button>
                </div>
              ) : (
                <Button variant="primary" size="sm" onClick={handleConnectWallet} className="neon-glow-purple">
                  <Wallet className="w-4 h-4 mr-2" /> Connect
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Left Column: Chart & Asset Info */}
        {activeTab === 'trade' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">

              {/* Asset Selector & Chart Controls */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between relative z-20">

                {/* Asset Dropdown */}
                <div className="relative w-full md:w-auto">
                  <button
                    onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl border shadow-lg transition-all w-full md:w-auto min-w-[240px] justify-between ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border-white/5' : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500 font-bold text-xs border border-indigo-500/30">
                        {activeAsset.substring(0, 1)}
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Selected Asset</div>
                        <div className="text-lg font-bold font-display">{activeAsset} / USD</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 transition-transform ${isDark ? 'text-slate-400' : 'text-slate-500'} ${isAssetDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isAssetDropdownOpen && (
                    <div className={`absolute top-full mt-2 w-full md:w-64 backdrop-blur-xl border rounded-xl shadow-2xl p-2 grid grid-cols-1 gap-1 max-h-[400px] overflow-y-auto ${isDark ? 'bg-slate-800/90 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                      {ASSETS.map((asset) => (
                        <button
                          key={asset}
                          onClick={() => {
                            setActiveAsset(asset);
                            setIsAssetDropdownOpen(false);
                          }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeAsset === asset ? 'bg-indigo-600 text-white' : (isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100')}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${activeAsset === asset ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                          <span className="font-medium">{asset}</span>
                          {[Asset.PEPE, Asset.DOGE, Asset.SHIB, Asset.WIF, Asset.BONK].includes(asset) && (
                            <span className="ml-auto text-[10px] font-bold bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded">MEME</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Graph Controls & Timeframes */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Timeframe Selector */}
                  <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-slate-800 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf.label}
                        onClick={() => handleTimeframeChange(tf)}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${selectedTimeframe.label === tf.label
                          ? (isDark ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-100 text-indigo-700')
                          : (isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')
                          }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>

                  <div className={`flex items-center p-1 rounded-lg border ${isDark ? 'bg-slate-800 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <button
                      onClick={() => setChartMode('line')}
                      className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${chartMode === 'line' ? (isDark ? 'bg-slate-700 text-white' : 'bg-indigo-50 text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}
                    >
                      <LineChart size={18} />
                    </button>
                    <button
                      onClick={() => setChartMode('candle')}
                      className={`p-2 rounded flex items-center gap-2 text-sm font-medium transition-colors ${chartMode === 'candle' ? (isDark ? 'bg-slate-700 text-white' : 'bg-indigo-50 text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}
                    >
                      <BarChart2 size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Chart Card */}
              <div className={`rounded-2xl p-6 relative transition-colors duration-300 ${isDark ? 'glass-panel-dark' : 'glass-panel-light'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className={`font-medium text-sm mb-1 flex items-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Current Price <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '15s' }} />
                    </div>
                    <div className={`text-4xl font-display font-bold flex items-center gap-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      <span className="text-lg font-sans font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded flex items-center">
                        <TrendingUp className="w-4 h-4 mr-1" /> Live
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAIAnalysis}
                    className="border-purple-500/50 text-purple-500 hover:bg-purple-500/10"
                  >
                    <BrainCircuit className="w-4 h-4 mr-2" />
                    Ask AI Oracle
                  </Button>
                </div>

                <PriceChart
                  data={priceHistory}
                  color="#6366f1"
                  currentPrice={currentPrice}
                  mode={chartMode}
                  theme={theme}
                />
              </div>

              {/* AI Analysis Modal */}
              {showAiModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className={`border rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden ${isDark ? 'bg-slate-900 border-purple-500/30' : 'bg-white border-purple-200'}`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    <button onClick={() => setShowAiModal(false)} className={`absolute top-4 right-4 hover:text-red-500 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><X size={20} /></button>

                    <h3 className={`text-xl font-display font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <BrainCircuit className="text-purple-500" /> Gemini Oracle
                    </h3>

                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-purple-500 animate-pulse">Analyzing {activeAsset} market patterns...</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className={`text-center p-4 rounded-xl border ${aiAnalysis?.sentiment === 'BULLISH' ? 'bg-emerald-500/10 border-emerald-500/50' : aiAnalysis?.sentiment === 'BEARISH' ? 'bg-rose-500/10 border-rose-500/50' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')}`}>
                          <div className="text-sm uppercase tracking-widest text-slate-500 mb-1">Sentiment</div>
                          <div className={`text-3xl font-bold ${aiAnalysis?.sentiment === 'BULLISH' ? 'text-emerald-500' : aiAnalysis?.sentiment === 'BEARISH' ? 'text-rose-500' : 'text-slate-500'}`}>
                            {aiAnalysis?.sentiment}
                          </div>
                        </div>
                        <div className={`p-4 rounded-xl text-sm leading-relaxed border ${isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          "{aiAnalysis?.reasoning}"
                        </div>
                        <Button onClick={() => setShowAiModal(false)} className="w-full mt-2">Close</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent History List */}
              <div className="space-y-4">
                <h3 className={`font-display text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>Your Recent Predictions</h3>
                {predictions.length === 0 ? (
                  <div className={`text-center py-8 rounded-lg border ${isDark ? 'text-slate-500 bg-slate-800/30 border-white/5' : 'text-slate-400 bg-slate-50 border-slate-200'}`}>
                    No predictions yet. Join the next round!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {predictions.slice().reverse().map((p, i) => {
                      const isWinner = p.result?.winner === p.direction;
                      const isEnded = p.result?.status === RoundStatus.ENDED;

                      return (
                        <div key={i} className={`p-4 rounded-lg flex items-center justify-between border ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${p.direction === PredictionDirection.UP ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                              {p.direction === PredictionDirection.UP ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                            </div>
                            <div>
                              <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Round #{p.roundId}</div>
                              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.amount} {activeAsset}</div>
                            </div>
                          </div>

                          {isEnded ? (
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full font-bold text-xs ${isWinner ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                              {isWinner ? (
                                <>
                                  <Trophy size={12} />
                                  WON
                                </>
                              ) : (
                                <>
                                  <X size={12} />
                                  LOST
                                </>
                              )}
                            </div>
                          ) : (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>PENDING</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Game Interface */}
            <div className="space-y-6">
              {currentRound?.id === 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/50 text-amber-500">
                  <h3 className="font-bold flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4" /> Market Not Started
                  </h3>
                  <p className="text-sm mb-3">The prediction market has not been initialized yet.</p>
                  <Button
                    onClick={async () => {
                      if (!walletConnected) {
                        handleConnectWallet();
                        return;
                      }
                      try {
                        const provider = new ethers.BrowserProvider(window.ethereum);
                        const signer = await provider.getSigner();
                        const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, signer);
                        const tx = await contract.genesisStartRound();
                        await tx.wait();
                        alert("Market started successfully!");
                        fetchContractData();
                      } catch (e: any) {
                        console.error(e);
                        alert("Failed to start market: " + e.message);
                      }
                    }}
                    className="w-full"
                  >
                    Start Market
                  </Button>
                </div>
              )}

              {currentRound?.status === RoundStatus.ENDED && (
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/50 text-indigo-500">
                  <h3 className="font-bold flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4" /> Round Ended
                  </h3>
                  <p className="text-sm mb-3">The current round has ended. Start the next round to continue.</p>
                  <Button
                    onClick={async () => {
                      if (!walletConnected) {
                        handleConnectWallet();
                        return;
                      }
                      try {
                        const provider = new ethers.BrowserProvider(window.ethereum);
                        const signer = await provider.getSigner();
                        const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, signer);
                        const tx = await contract.executeRound();
                        await tx.wait();
                        alert("Next round started successfully!");
                        fetchContractData();
                      } catch (e: any) {
                        console.error(e);
                        alert("Failed to start next round: " + e.message);
                      }
                    }}
                    className="w-full"
                  >
                    Start Next Round
                  </Button>
                </div>
              )}

              <PredictionCard
                round={currentRound}
                assetSymbol={activeAsset}
                onPredict={handlePredict}
                userBalance={userBalance}
              />

              <ChatRoom userAddress={userAddress} />

              <div className={`p-6 rounded-xl border transition-colors ${isDark ? 'glass-panel-dark' : 'glass-panel-light'}`}>
                <h3 className="text-indigo-500 font-bold mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> How to Play
                </h3>
                <ul className={`space-y-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <li className="flex gap-2">
                    <span className="bg-slate-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs text-slate-700 dark:text-white shrink-0">1</span>
                    Select timeframe ({selectedTimeframe.label}) and predict UP/DOWN.
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-slate-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs text-slate-700 dark:text-white shrink-0">2</span>
                    Betting closes {selectedTimeframe.lockOffsetSec}s before round ends (Lock Phase).
                  </li>
                  <li className="flex gap-2">
                    <span className="bg-slate-200 dark:bg-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs text-slate-700 dark:text-white shrink-0">3</span>
                    Winners share the losers' pool pro-rata.
                  </li>
                </ul>
              </div>
            </div>

          </div>
        )}

        {/* Leaderboard Tab (Real) */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-3xl mx-auto">
            <h2 className={`text-2xl font-display font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Top Traders</h2>
            <div className="space-y-3">
              {leaderboardData.length === 0 ? (
                <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No claims found yet. Be the first to win!</div>
              ) : (
                leaderboardData.map((entry, i) => (
                  <div key={i} className={`p-4 rounded-lg flex items-center justify-between transition-transform hover:scale-[1.01] ${isDark ? 'glass-panel-dark' : 'glass-panel-light'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-900 ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-slate-300' : i === 2 ? 'bg-amber-600' : 'bg-slate-200 dark:bg-slate-700 dark:text-white'}`}>
                        {i + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{entry.address.slice(0, 6)}...{entry.address.slice(-4)}</span>
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{entry.roundsWon} Claims</span>
                      </div>
                    </div>
                    <div className="text-emerald-500 font-bold">
                      +{(entry.totalWinnings || 0).toFixed(4)} CELO
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>
    </div >
  );
};