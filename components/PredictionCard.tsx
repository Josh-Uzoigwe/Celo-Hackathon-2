import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Lock, Timer, TrendingUp, Wallet, Clock } from 'lucide-react';
import { Round, RoundStatus, PredictionDirection } from '../types';
import { Button } from './ui/Button';
import { formatEther } from 'ethers';

interface PredictionCardProps {
  round: Round | undefined;
  assetSymbol: string;
  onPredict: (direction: PredictionDirection, amount: number) => void;
  userBalance: number;
}

export const PredictionCard: React.FC<PredictionCardProps> = ({ 
  round, 
  assetSymbol, 
  onPredict, 
  userBalance 
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [phaseLabel, setPhaseLabel] = useState<string>('');
  const [betAmount, setBetAmount] = useState<string>('10');

  useEffect(() => {
    if (!round) return;

    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      let target = 0;
      
      if (round.status === RoundStatus.OPEN) {
        target = round.lockTimestamp;
        setPhaseLabel('BETTING CLOSES IN');
      } else if (round.status === RoundStatus.LOCKED) {
        target = round.closeTimestamp;
        setPhaseLabel('ROUND ENDS IN');
      }
      
      const diff = Math.max(0, target - now);
      setTimeLeft(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [round]);

  const formatTime = (seconds: number) => {
    // Handle larger formats for Days/Hours
    if (seconds > 86400) {
        const d = Math.floor(seconds / 86400);
        return `${d}d ${Math.floor((seconds % 86400) / 3600)}h`;
    }
    if (seconds > 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!round) return <div className="glass-panel p-6 rounded-xl animate-pulse h-96">Loading Round...</div>;

  const totalPool = round.totalPool;
  const upPct = totalPool === 0 ? 50 : Math.round((round.upPool / totalPool) * 100);
  const downPct = totalPool === 0 ? 50 : Math.round((round.downPool / totalPool) * 100);

  const payoutUp = totalPool === 0 ? 2 : (totalPool / (round.upPool || 1));
  const payoutDown = totalPool === 0 ? 2 : (totalPool / (round.downPool || 1));

  return (
    <div className="glass-panel p-1 rounded-2xl relative overflow-hidden group">
      {/* Decorative Glow - changes based on phase */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${round.status === RoundStatus.OPEN ? 'from-emerald-400 via-emerald-500 to-emerald-400' : 'from-amber-400 via-orange-500 to-amber-400'}`} />
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            {round.status === RoundStatus.OPEN ? (
              <span className="flex items-center gap-2 text-emerald-400 font-bold tracking-wider">
                <Timer className="w-5 h-5" /> LIVE
              </span>
            ) : (
              <span className="flex items-center gap-2 text-amber-400 font-bold tracking-wider">
                <Lock className="w-5 h-5" /> LOCKED
              </span>
            )}
            <span className="text-slate-400 text-sm">#{round.id}</span>
          </div>
          <div className="text-right">
             <div className="text-xs text-slate-500 font-bold tracking-widest mb-1">{phaseLabel}</div>
             <div className={`text-2xl font-display font-bold ${round.status === RoundStatus.OPEN ? 'text-white' : 'text-amber-400'}`}>
                {formatTime(timeLeft)}
             </div>
          </div>
        </div>

        {/* Multiplier / Pool Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-emerald-500/20 text-center">
            <div className="text-emerald-400 text-sm font-bold mb-1">UP POOL</div>
            <div className="text-2xl font-bold text-white">{payoutUp.toFixed(2)}x</div>
            <div className="text-xs text-slate-400">{round.upPool.toFixed(0)} {assetSymbol}</div>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-lg border border-rose-500/20 text-center">
            <div className="text-rose-400 text-sm font-bold mb-1">DOWN POOL</div>
            <div className="text-2xl font-bold text-white">{payoutDown.toFixed(2)}x</div>
            <div className="text-xs text-slate-400">{round.downPool.toFixed(0)} {assetSymbol}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-slate-800 rounded-full mb-8 flex overflow-hidden">
          <div style={{ width: `${upPct}%` }} className="bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <div style={{ width: `${downPct}%` }} className="bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.5)]" />
        </div>

        {/* Inputs */}
        {round.status === RoundStatus.OPEN ? (
          <div className="space-y-4">
             <div className="flex items-center justify-between bg-slate-900/50 rounded-lg p-2 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400">
                    <Wallet size={16} />
                    <span className="text-sm">Balance: {userBalance.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        className="bg-transparent text-right text-white font-bold focus:outline-none w-24"
                    />
                    <span className="text-sm text-slate-500 font-bold">{assetSymbol}</span>
                </div>
             </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="success" 
                className="h-16 text-lg"
                onClick={() => onPredict(PredictionDirection.UP, Number(betAmount))}
              >
                <div className="flex flex-col items-center leading-tight">
                  <span className="flex items-center gap-1">ENTER UP <ArrowUp className="w-4 h-4" /></span>
                </div>
              </Button>
              <Button 
                variant="danger" 
                className="h-16 text-lg"
                onClick={() => onPredict(PredictionDirection.DOWN, Number(betAmount))}
              >
                <div className="flex flex-col items-center leading-tight">
                  <span className="flex items-center gap-1">ENTER DOWN <ArrowDown className="w-4 h-4" /></span>
                </div>
              </Button>
            </div>
            <div className="text-center text-xs text-slate-500 mt-2">
               Positions locked in <Clock size={10} className="inline mx-1"/> 
               {formatTime(timeLeft)}
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/80 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-4 border border-slate-700 h-48">
             <div className="relative">
                <div className="absolute inset-0 bg-amber-500 blur-xl opacity-20 rounded-full"></div>
                <Lock className="w-12 h-12 text-amber-500 relative z-10" />
             </div>
             
             <div>
                <h3 className="text-white font-bold text-lg">Predictions Locked</h3>
                <p className="text-slate-400 text-sm">
                   Waiting for final settlement price...
                </p>
             </div>
             
             <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-amber-500 h-full w-full animate-progress-indeterminate"></div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};