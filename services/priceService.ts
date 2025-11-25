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