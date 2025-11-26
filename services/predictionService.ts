import { ethers } from 'ethers';
import { PREDICTION_MARKET_ABI, PREDICTION_MARKET_ADDRESS } from '../contracts/PredictionMarketABI';
import { RPC_URL } from '../constants';
import { PredictionDirection, RoundStatus, Asset } from '../types';
import { fetchHistoricalPrice } from './priceService';

export interface RoundResult {
    roundId: number;
    status: RoundStatus;
    winner: PredictionDirection | null;
    lockPrice: number | null;
    closePrice: number | null;
}

export const getRoundResult = async (roundId: number): Promise<RoundResult | null> => {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, provider);
        const roundData = await contract.rounds(roundId);

        let lockPrice = Number(roundData.lockPrice) > 0 ? Number(roundData.lockPrice) / 1e8 : null;
        let closePrice = Number(roundData.closePrice) > 0 ? Number(roundData.closePrice) / 1e8 : null;

        // Fallback 1: Local Storage (Local Oracle)
        if (lockPrice === null) {
            const storedLock = localStorage.getItem(`round_${roundId}_lockPrice`);
            if (storedLock) lockPrice = parseFloat(storedLock);
        }
        if (closePrice === null) {
            const storedClose = localStorage.getItem(`round_${roundId}_closePrice`);
            if (storedClose) closePrice = parseFloat(storedClose);
        }

        // Fallback 2: Historical API (Historical Oracle)
        // Only fetch if we are in ENDED state and still missing prices
        const now = Date.now() / 1000;
        let status = RoundStatus.OPEN;
        if (now >= Number(roundData.lockTimestamp) && now < Number(roundData.closeTimestamp)) {
            status = RoundStatus.LOCKED;
        } else if (now >= Number(roundData.closeTimestamp)) {
            status = RoundStatus.ENDED;
        }

        if (status === RoundStatus.ENDED || status === RoundStatus.LOCKED) {
            if (lockPrice === null) {
                // Fetch historical lock price
                const price = await fetchHistoricalPrice(Asset.CELO, Number(roundData.lockTimestamp));
                if (price) {
                    lockPrice = price;
                    // Cache it
                    localStorage.setItem(`round_${roundId}_lockPrice`, price.toString());
                }
            }
        }

        if (status === RoundStatus.ENDED) {
            if (closePrice === null) {
                // Fetch historical close price
                const price = await fetchHistoricalPrice(Asset.CELO, Number(roundData.closeTimestamp));
                if (price) {
                    closePrice = price;
                    // Cache it
                    localStorage.setItem(`round_${roundId}_closePrice`, price.toString());
                }
            }
        }

        let winner: PredictionDirection | null = null;
        if (status === RoundStatus.ENDED && lockPrice !== null && closePrice !== null) {
            if (closePrice > lockPrice) {
                winner = PredictionDirection.UP;
            } else if (closePrice < lockPrice) {
                winner = PredictionDirection.DOWN;
            }
        }

        return {
            roundId,
            status,
            winner,
            lockPrice,
            closePrice
        };
    } catch (error) {
        console.error(`Failed to fetch result for round ${roundId}`, error);
        return null;
    }
};
