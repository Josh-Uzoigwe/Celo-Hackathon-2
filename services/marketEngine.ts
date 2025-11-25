import { Asset, Round, RoundStatus, PredictionDirection } from '../types';
import { MOCK_PRICES, TIMEFRAMES } from '../constants';

// This service mocks what the Smart Contract + Chainlink Oracle would do
// It maintains the "Server State" in memory for the frontend to consume.

let currentPrices = { ...MOCK_PRICES };
let rounds: Round[] = [];
let nextRoundId = 1;

// Default configuration (starts at 1M)
let activeDuration = TIMEFRAMES[0].durationSec;
let activeLockOffset = TIMEFRAMES[0].lockOffsetSec;

export const setAssetPrice = (asset: Asset, price: number) => {
  currentPrices[asset] = price;
  return price;
};

// Allow changing the global round configuration
export const setRoundConfig = (durationSec: number, lockOffsetSec: number) => {
  activeDuration = durationSec;
  activeLockOffset = lockOffsetSec;
};

// Simulate price volatility
export const simulatePriceMovement = (asset: Asset) => {
  // Degens love volatility: Meme coins move more
  const isMeme = [Asset.PEPE, Asset.DOGE, Asset.SHIB, Asset.WIF, Asset.BONK].includes(asset);
  // INCREASED VOLATILITY for better chart visuals
  // Normal: 0.3% variance per tick, Meme: 0.8% variance
  const volatility = isMeme ? 0.008 : 0.003; 
  
  const current = currentPrices[asset];
  const change = current * (Math.random() * volatility * 2 - volatility);
  currentPrices[asset] = current + change;
  return currentPrices[asset];
};

export const getCurrentPrice = (asset: Asset) => currentPrices[asset];

export const createRound = (asset: Asset): Round => {
  const now = Math.floor(Date.now() / 1000);
  
  // Logic: Betting Window = Total Duration - Lock Offset
  const bettingWindow = activeDuration - activeLockOffset;

  const round: Round = {
    id: nextRoundId++,
    asset,
    startTimestamp: now,
    lockTimestamp: now + bettingWindow, // Time when betting stops
    closeTimestamp: now + activeDuration, // Time when round ends
    startPrice: currentPrices[asset],
    lockPrice: null,
    closePrice: null,
    totalPool: 0,
    status: RoundStatus.OPEN,
    winner: null,
    upPool: 0,
    downPool: 0,
  };
  rounds.push(round);
  return round;
};

export const updateRounds = (asset: Asset): Round[] => {
  const now = Math.floor(Date.now() / 1000);
  const price = currentPrices[asset];

  // Check active rounds
  rounds = rounds.map(r => {
    if (r.asset !== asset) return r;

    // Transition: OPEN -> LOCKED
    if (r.status === RoundStatus.OPEN && now >= r.lockTimestamp) {
      return { ...r, status: RoundStatus.LOCKED, lockPrice: price };
    }

    // Transition: LOCKED -> ENDED
    if (r.status === RoundStatus.LOCKED && now >= r.closeTimestamp) {
      const lockP = r.lockPrice || price; // Fallback
      let winner: PredictionDirection | null = null;
      
      if (price > lockP) winner = PredictionDirection.UP;
      else if (price < lockP) winner = PredictionDirection.DOWN;
      // else House wins (or refund, keeping simple for demo)

      return { ...r, status: RoundStatus.ENDED, closePrice: price, winner };
    }

    return r;
  });

  return rounds;
};

export const getLatestRound = (asset: Asset): Round | undefined => {
  return rounds.filter(r => r.asset === asset).sort((a, b) => b.id - a.id)[0];
};

// Helper to clear rounds when switching timeframes so UI doesn't show old duration rounds
export const resetRounds = () => {
  rounds = [];
};

export const placeBet = (roundId: number, direction: PredictionDirection, amount: number) => {
  const round = rounds.find(r => r.id === roundId);
  if (round && round.status === RoundStatus.OPEN) {
    round.totalPool += amount;
    if (direction === PredictionDirection.UP) round.upPool += amount;
    else round.downPool += amount;
    return true;
  }
  return false;
};