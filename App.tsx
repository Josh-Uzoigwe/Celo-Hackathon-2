import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TrendingUp, Activity, Trophy, History, Wallet, 
  Menu, X, ExternalLink, Zap, BrainCircuit, Play,
  ArrowUp, ArrowDown, ChevronDown, RefreshCw,
  Sun, Moon, BarChart2, LineChart, Clock
} from 'lucide-react';
import { Asset, Round, RoundStatus, PredictionDirection, PricePoint, UserPrediction } from './types';
import { ASSETS, MOCK_PRICES, TIMEFRAMES, TimeframeConfig } from './constants';
import { 
  simulatePriceMovement, createRound, updateRounds, getLatestRound, placeBet, 
  getCurrentPrice, setAssetPrice, setRoundConfig, resetRounds 
} from './services/marketEngine';
import { getMarketAnalysis } from './services/geminiService';
import { fetchRealPrice } from './services/priceService';
import { Button } from './components/ui/Button';
import { PriceChart } from './components/PriceChart';
import { PredictionCard } from './components/PredictionCard';
import { SOLIDITY_CODE } from './contracts/PredictionMarket.sol';

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  // Global State
  const [activeAsset, setActiveAsset] = useState<Asset>(Asset.CELO);
  const [currentPrice, setCurrentPrice] = useState<number>(MOCK_PRICES[Asset.CELO]);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | undefined>(undefined);
  const [walletConnected, setWalletConnected] = useState(false);
  const [userBalance, setUserBalance] = useState(1000);
  const [predictions, setPredictions] = useState<UserPrediction[]>([]);
  
  // Timeframe State
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeConfig>(TIMEFRAMES[0]); // Default 1M

  // UI State
  const [activeTab, setActiveTab] = useState<'trade' | 'contracts' | 'leaderboard'>('trade');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{ sentiment: string; reasoning: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false);
  
  // New UI State for Graph Improvements
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [chartMode, setChartMode] = useState<'line' | 'candle'>('line');
  
  // Refs for intervals
  const marketInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceSyncInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFetchedRealPrice = useRef<boolean>(false);

  // Helper to generate realistic-looking history
  const generateHistory = useCallback((endPrice: number, points: number = 60) => {
    const history: PricePoint[] = [];
    let tempPrice = endPrice;
    const now = Date.now();

    // Walk backwards from the end price
    for (let i = 0; i < points; i++) {
        // Higher volatility for "past" data to look interesting on load
        const volatility = 0.003; 
        // Random walk: previous price = current / (1 + change)
        // effectively: current = prev * (1 + change)
        const changePct = (Math.random() * volatility * 2 - volatility);
        
        // Push to front since we are going backwards in time
        history.unshift({
            timestamp: now - i * 1000,
            price: tempPrice
        });
        
        // Calculate the "previous" price (which is next in our loop)
        tempPrice = tempPrice / (1 + changePct);
    }
    return history;
  }, []);
  
  // Handle Timeframe Change
  const handleTimeframeChange = (tf: TimeframeConfig) => {
    setSelectedTimeframe(tf);
    setRoundConfig(tf.durationSec, tf.lockOffsetSec);
    resetRounds(); // Clear old rounds
    createRound(activeAsset); // Force start new round immediately
  };

  // Initialize Game Loop
  useEffect(() => {
    // 1. Reset State on Asset Change
    hasFetchedRealPrice.current = false;
    const basePrice = MOCK_PRICES[activeAsset];
    
    // Set engine config
    setRoundConfig(selectedTimeframe.durationSec, selectedTimeframe.lockOffsetSec);

    // Initial history based on Mock price (placeholder until real price loads)
    const initialHistory = generateHistory(basePrice);
    setPriceHistory(initialHistory);
    setCurrentPrice(basePrice);
    setAssetPrice(activeAsset, basePrice);
    
    // Ensure a round exists
    if (!getLatestRound(activeAsset)) {
      createRound(activeAsset);
    }

    // 2. Game Tick (1s) - Simulates micro-movements and handles rounds
    marketInterval.current = setInterval(() => {
      // Update Price (Simulated micro-movements on top of base price)
      const newPrice = simulatePriceMovement(activeAsset);
      setCurrentPrice(newPrice);
      
      setPriceHistory(prev => {
        const newHistory = [...prev, { timestamp: Date.now(), price: newPrice }];
        return newHistory.slice(-100); // Keep last 100 points
      });

      // Update Rounds
      updateRounds(activeAsset);
      
      // Check for new round requirement
      const latest = getLatestRound(activeAsset);
      if (latest) {
        if (latest.status === RoundStatus.LOCKED && latest.lockPrice === newPrice) { 
           // Hack: detecting the exact tick it locked to spawn next
           createRound(activeAsset);
        }
        
        const openRound = updateRounds(activeAsset).find(r => r.status === RoundStatus.OPEN);
        const lockedRound = updateRounds(activeAsset).find(r => r.status === RoundStatus.LOCKED);
        
        // If we are in transition where OPEN just closed but new OPEN hasn't spawned in list yet, fallback to locked
        setCurrentRound(openRound || lockedRound);
      } else {
        createRound(activeAsset);
      }
    }, 1000);

    // 3. Real Price Sync (15s) - Fetches actual price from CoinGecko
    const syncPrice = async () => {
      const realPrice = await fetchRealPrice(activeAsset);
      if (realPrice) {
        // If this is the first real fetch, REGENERATE history to match this price
        // This prevents the "Cliff" effect where chart drops from Mock 0.85 to Real 0.16
        if (!hasFetchedRealPrice.current) {
          console.log(`Initial price fetch for ${activeAsset}: ${realPrice}. Regenerating history.`);
          const adjustedHistory = generateHistory(realPrice);
          setPriceHistory(adjustedHistory);
          setCurrentPrice(realPrice);
          setAssetPrice(activeAsset, realPrice); // Update engine base
          hasFetchedRealPrice.current = true;
        } else {
           // Standard sync: just update the engine's base price
           setAssetPrice(activeAsset, realPrice);
        }
      }
    };
    
    syncPrice(); // Initial sync
    priceSyncInterval.current = setInterval(syncPrice, 15000);

    return () => {
      if (marketInterval.current) clearInterval(marketInterval.current);
      if (priceSyncInterval.current) clearInterval(priceSyncInterval.current);
    };
  }, [activeAsset, generateHistory, selectedTimeframe]); // Re-run when timeframe changes


  const handlePredict = (direction: PredictionDirection, amount: number) => {
    if (!walletConnected) {
      alert("Please connect wallet first");
      return;
    }
    if (userBalance < amount) {
      alert("Insufficient Balance");
      return;
    }
    if (currentRound && currentRound.status === RoundStatus.OPEN) {
      placeBet(currentRound.id, direction, amount);
      setUserBalance(prev => prev - amount);
      setPredictions(prev => [...prev, {
        roundId: currentRound.id,
        direction,
        amount,
        claimed: false
      }]);
    }
  };

  const handleConnectWallet = () => {
    setWalletConnected(true);
  };

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
              {['trade', 'leaderboard', 'contracts'].map(tab => (
                 <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                    className={`text-sm font-medium transition-colors capitalize ${
                        activeTab === tab 
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
                    <span className={`text-sm truncate w-24 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>0x71C...9A21</span>
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
        
        {activeTab === 'trade' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Chart & Asset Info */}
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
                            className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                selectedTimeframe.label === tf.label
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
                    <button onClick={() => setShowAiModal(false)} className={`absolute top-4 right-4 hover:text-red-500 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}><X size={20}/></button>
                    
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
                    {predictions.slice().reverse().map((p, i) => (
                      <div key={i} className={`p-4 rounded-lg flex items-center justify-between border ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-full ${p.direction === PredictionDirection.UP ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                              {p.direction === PredictionDirection.UP ? <ArrowUp size={16}/> : <ArrowDown size={16}/>}
                           </div>
                           <div>
                             <div className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Round #{p.roundId}</div>
                             <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.amount} {activeAsset}</div>
                           </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>PENDING</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Game Interface */}
            <div className="space-y-6">
              <PredictionCard 
                round={currentRound} 
                assetSymbol={activeAsset} 
                onPredict={handlePredict}
                userBalance={userBalance}
              />
              
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

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <div className="max-w-4xl mx-auto">
             <div className="flex items-center justify-between mb-6">
               <h2 className={`text-2xl font-display font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Smart Contract Source</h2>
               <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(SOLIDITY_CODE)}>Copy Code</Button>
             </div>
             <div className="bg-[#1e1e1e] rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
               <div className="flex items-center px-4 py-2 bg-[#252526] border-b border-black">
                 <div className="flex gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-500"></div>
                   <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                 </div>
                 <span className="ml-4 text-xs text-slate-400 font-mono">PredictionMarket.sol</span>
               </div>
               <pre className="p-4 text-xs md:text-sm font-mono text-blue-200 overflow-x-auto">
                 <code>{SOLIDITY_CODE}</code>
               </pre>
             </div>
          </div>
        )}

        {/* Leaderboard Tab (Mock) */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-3xl mx-auto">
            <h2 className={`text-2xl font-display font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Top Traders</h2>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`p-4 rounded-lg flex items-center justify-between transition-transform hover:scale-[1.01] ${isDark ? 'glass-panel-dark' : 'glass-panel-light'}`}>
                   <div className="flex items-center gap-4">
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-900 ${i === 1 ? 'bg-yellow-400' : i === 2 ? 'bg-slate-300' : i === 3 ? 'bg-amber-600' : 'bg-slate-200 dark:bg-slate-700 dark:text-white'}`}>
                       {i}
                     </div>
                     <div className="flex flex-col">
                       <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>0x{Math.random().toString(16).slice(2, 8)}...{Math.random().toString(16).slice(2, 6)}</span>
                       <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{Math.floor(Math.random() * 50) + 10} Rounds Won</span>
                     </div>
                   </div>
                   <div className="text-emerald-500 font-bold">
                     +{(Math.random() * 5000).toFixed(2)} CELO
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;