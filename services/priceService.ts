import { Asset } from '../types';
import { COINGECKO_IDS } from '../constants';

const CACHE_DURATION = 15000; // 15 seconds
const priceCache: Record<string, { price: number; timestamp: number }> = {};

export const fetchRealPrice = async (asset: Asset): Promise<number | null> => {
  const id = COINGECKO_IDS[asset];
  const now = Date.now();

  // Check cache to avoid hitting API rate limits too hard
  if (priceCache[asset] && (now - priceCache[asset].timestamp < CACHE_DURATION)) {
    return priceCache[asset].price;
  }

  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    const price = data[id]?.usd;

    if (price) {
      priceCache[asset] = { price, timestamp: now };
      return price;
    }
    return null;
  } catch (error) {
    console.warn(`CoinGecko fetch failed for ${asset}:`, error);
    // Return null to allow fallback to simulation engine's last known price
    return null;
  }
};

export const fetchHistoricalPrice = async (asset: Asset, timestamp: number): Promise<number | null> => {
  const id = COINGECKO_IDS[asset];
  // CoinGecko expects seconds for 'from' and 'to' in market_chart/range, but we want a specific point.
  // We'll ask for a small range around the timestamp.

  const from = timestamp - 3600; // 1 hour before
  const to = timestamp + 3600;   // 1 hour after

  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`);
    if (!response.ok) throw new Error('Network response was not ok');

    const data = await response.json();
    const prices = data.prices as [number, number][]; // [timestamp_ms, price]

    if (!prices || prices.length === 0) return null;

    // Find the price closest to the target timestamp
    const targetMs = timestamp * 1000;
    let closestPrice = prices[0][1];
    let minDiff = Math.abs(prices[0][0] - targetMs);

    for (const [ts, price] of prices) {
      const diff = Math.abs(ts - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestPrice = price;
      }
    }

    return closestPrice;

  } catch (error) {
    console.warn(`CoinGecko historical fetch failed for ${asset}:`, error);
    return null;
  }
};