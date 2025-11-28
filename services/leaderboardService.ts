import { ethers } from 'ethers';
import { PREDICTION_MARKET_ABI, PREDICTION_MARKET_ADDRESS } from '../contracts/PredictionMarketABI';
import { RPC_URL } from '../constants';

export interface LeaderboardEntry {
    address: string;
    totalWinnings: number;
    roundsWon: number;
}

export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, provider);

        const currentBlock = await provider.getBlockNumber();
        // Reduce range to 10000 blocks to avoid RPC timeouts/limits
        const fromBlock = Math.max(0, currentBlock - 10000);

        console.log(`Fetching leaderboard events from block ${fromBlock} to ${currentBlock}`);

        // Fetch Claim events
        const claimFilter = contract.filters.Claim();
        const claimLogs = await contract.queryFilter(claimFilter, fromBlock).catch(e => {
            console.error("Failed to fetch Claim logs", e);
            return [];
        });

        // Fetch BetPlaced events to ensure we have a list of all active users
        const betFilter = contract.filters.BetPlaced();
        const betLogs = await contract.queryFilter(betFilter, fromBlock).catch(e => {
            console.error("Failed to fetch BetPlaced logs", e);
            return [];
        });

        const winningsMap: Record<string, number> = {};
        const roundsWonMap: Record<string, number> = {};
        const activityMap: Record<string, boolean> = {};

        // Process Claims
        for (const log of claimLogs) {
            try {
                // @ts-ignore
                const { user, amount } = log.args;
                const amountEth = parseFloat(ethers.formatEther(amount));

                if (winningsMap[user]) {
                    winningsMap[user] += amountEth;
                    roundsWonMap[user] += 1;
                } else {
                    winningsMap[user] = amountEth;
                    roundsWonMap[user] = 1;
                }
                activityMap[user] = true;
            } catch (err) {
                console.warn("Error parsing claim log", err);
            }
        }

        // Process Bets
        for (const log of betLogs) {
            try {
                // @ts-ignore
                const { user } = log.args;
                activityMap[user] = true;
            } catch (err) {
                console.warn("Error parsing bet log", err);
            }
        }

        const leaderboard: LeaderboardEntry[] = Object.keys(activityMap).map(address => ({
            address,
            totalWinnings: winningsMap[address] || 0,
            roundsWon: roundsWonMap[address] || 0
        }));

        // Sort by total winnings (descending)
        return leaderboard.sort((a, b) => b.totalWinnings - a.totalWinnings);

    } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        return [];
    }
};
