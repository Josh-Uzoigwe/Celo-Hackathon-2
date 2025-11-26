import { fetchHistoricalPrice } from './services/priceService.ts';
import { Asset } from './types.ts';

const testOracle = async () => {
    const now = Math.floor(Date.now() / 1000);
    const tenMinutesAgo = now - 600;

    console.log(`Testing fetchHistoricalPrice for timestamp: ${tenMinutesAgo}`);

    // We need to call the internal logic or just use the function and trust it?
    // Let's copy the fetch logic here to inspect the raw data
    const id = 'celo';
    const from = tenMinutesAgo - 3600;
    const to = tenMinutesAgo + 3600;

    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`);
        const data = await response.json();
        const prices = data.prices as [number, number][];

        console.log(`Fetched ${prices.length} data points.`);
        if (prices.length > 0) {
            console.log("First 3 points:", prices.slice(0, 3));
            const interval = prices[1][0] - prices[0][0];
            console.log(`Interval between points: ${interval}ms (${interval / 1000}s)`);
        }

        const price = await fetchHistoricalPrice(Asset.CELO, tenMinutesAgo);
        console.log(`Resolved Price: ${price}`);

    } catch (error) {
        console.error("ERROR:", error);
    }
};

testOracle();
