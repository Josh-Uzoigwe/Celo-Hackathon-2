export enum Asset {
  CELO = 'CELO',
  ETH = 'ETH',
  BTC = 'BTC',
  DOGE = 'DOGE',
  PEPE = 'PEPE',
  SHIB = 'SHIB',
  WIF = 'WIF',
  BONK = 'BONK'
}

export enum PredictionDirection {
  UP = 'UP',
  DOWN = 'DOWN',
}

export enum RoundStatus {
  OPEN = 'OPEN',     // Accepting bets
  LOCKED = 'LOCKED', // Betting closed, waiting for end time
  ENDED = 'ENDED',   // Round finished, winners calculated
}

export interface Round {
  id: number;
  asset: Asset;
  startTimestamp: number;
  lockTimestamp: number;
  closeTimestamp: number;
  startPrice: number;
  lockPrice: number | null;
  closePrice: number | null;
  totalPool: number;
  status: RoundStatus;
  winner: PredictionDirection | null;
  upPool: number;
  downPool: number;
}

export interface UserPrediction {
  roundId: number;
  direction: PredictionDirection;
  amount: number;
  claimed: boolean;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}