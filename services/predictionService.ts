import { ethers } from 'ethers';
import { PREDICTION_MARKET_ABI, PREDICTION_MARKET_ADDRESS } from '../contracts/PredictionMarketABI';
import { RPC_URL } from '../constants';
import { PredictionDirection, RoundStatus } from '../types';

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

        const lockPrice = Number(roundData.lockPrice) > 0 ? Number(roundData.lockPrice) / 1e8 : null;
        const closePrice = Number(roundData.closePrice) > 0 ? Number(roundData.closePrice) / 1e8 : null;
        const now = Date.now() / 1000;

        let status = RoundStatus.OPEN;
        if (now >= Number(roundData.lockTimestamp) && now < Number(roundData.closeTimestamp)) {
            status = RoundStatus.LOCKED;
        } else if (now >= Number(roundData.closeTimestamp)) {
            status = RoundStatus.ENDED;
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
