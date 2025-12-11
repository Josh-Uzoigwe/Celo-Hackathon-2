import { Asset, TimeframeConfig } from './types.ts';

export const ASSETS = [
  Asset.CELO,
  Asset.ETH,
  Asset.BTC,
  Asset.DOGE,
  Asset.PEPE,
  Asset.SHIB,
  Asset.WIF,
  Asset.BONK
];

export const COINGECKO_IDS: Record<Asset, string> = {
  [Asset.CELO]: 'celo',
  [Asset.ETH]: 'ethereum',
  [Asset.BTC]: 'bitcoin',
  [Asset.DOGE]: 'dogecoin',
  [Asset.PEPE]: 'pepe',
  [Asset.SHIB]: 'shiba-inu',
  [Asset.WIF]: 'dogwifhat',
  [Asset.BONK]: 'bonk',
};

export const MOCK_PRICES: Record<Asset, number> = {
  [Asset.CELO]: 0.85,
  [Asset.ETH]: 3200,
  [Asset.BTC]: 64000,
  [Asset.DOGE]: 0.12,
  [Asset.PEPE]: 0.000008,
  [Asset.SHIB]: 0.000025,
  [Asset.WIF]: 2.50,
  [Asset.BONK]: 0.000023,
};

export const TIMEFRAMES: TimeframeConfig[] = [
  { label: '1M', durationSec: 120, lockOffsetSec: 60 },      // 60s bet, 60s wait
  { label: '5M', durationSec: 300, lockOffsetSec: 60 },     // 4m bet, 1m wait
  { label: '15M', durationSec: 900, lockOffsetSec: 180 },   // 12m bet, 3m wait
  { label: '1H', durationSec: 3600, lockOffsetSec: 600 },   // 50m bet, 10m wait
  { label: '4H', durationSec: 14400, lockOffsetSec: 1800 }, // 3.5h bet, 30m wait
  { label: '1D', durationSec: 86400, lockOffsetSec: 7200 }, // 22h bet, 2h wait
  { label: '1W', durationSec: 604800, lockOffsetSec: 43200 } // 6.5d bet, 12h wait
];

export const TOAST_DURATION = 3000;

export const RPC_URL = "https://forno.celo.org";
export const CELO_CHAIN_ID = 42220;