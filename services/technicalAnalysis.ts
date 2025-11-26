import { PricePoint } from "../types";

export const calculateSMA = (data: PricePoint[], period: number): number | null => {
    if (data.length < period) return null;
    const slice = data.slice(-period);
    const sum = slice.reduce((acc, curr) => acc + curr.price, 0);
    return sum / period;
};

export const calculateRSI = (data: PricePoint[], period: number = 14): number | null => {
    if (data.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // Calculate initial average gain/loss
    for (let i = data.length - period; i < data.length; i++) {
        const diff = data[i].price - data[i - 1].price;
        if (diff >= 0) {
            gains += diff;
        } else {
            losses -= diff;
        }
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

export const getTechnicalSignals = (data: PricePoint[]) => {
    const currentPrice = data[data.length - 1].price;
    const rsi = calculateRSI(data, 14);
    const smaShort = calculateSMA(data, 7);
    const smaLong = calculateSMA(data, 25);

    let signal = 'NEUTRAL';
    if (rsi && rsi > 70) signal = 'OVERBOUGHT (Sell Signal)';
    else if (rsi && rsi < 30) signal = 'OVERSOLD (Buy Signal)';

    let trend = 'SIDEWAYS';
    if (smaShort && smaLong) {
        trend = smaShort > smaLong ? 'UPTREND' : 'DOWNTREND';
    }

    return {
        rsi: rsi ? rsi.toFixed(2) : 'N/A',
        smaShort: smaShort ? smaShort.toFixed(4) : 'N/A',
        smaLong: smaLong ? smaLong.toFixed(4) : 'N/A',
        trend,
        signal
    };
};
