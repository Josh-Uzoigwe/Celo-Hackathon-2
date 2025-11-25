import { ethers } from 'ethers';
import { PREDICTION_MARKET_ABI, PREDICTION_MARKET_ADDRESS } from '../contracts/PredictionMarketABI';
import { RPC_URL } from '../constants';

export interface LeaderboardEntry {
    address: string;
    totalWinnings: number;
    roundsWon: number; // We might not be able to get this easily from Claim events alone, but we can approximate or omit
}

export const fetchLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, provider);

        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 50000); // Look back ~50k blocks

        // Fetch Claim events
        const claimFilter = contract.filters.Claim();
        const claimLogs = await contract.queryFilter(claimFilter, fromBlock);

        // Fetch BetPlaced events
        // event BetPlaced(uint256 indexed epoch, address indexed user, Position pos, uint256 amount);
        const betFilter = contract.filters.BetPlaced();
        const betLogs = await contract.queryFilter(betFilter, fromBlock);

        const winningsMap: Record<string, number> = {};
        const roundsWonMap: Record<string, number> = {};
        const activityMap: Record<string, boolean> = {}; // Track all active users

        // Process Claims
        claimLogs.forEach((log: any) => {
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
        });

        // Process Bets to ensure all active users are on the list
        betLogs.forEach((log: any) => {
            const { user } = log.args;
            activityMap[user] = true;
        });

        const leaderboard: LeaderboardEntry[] = Object.keys(activityMap).map(address => ({
            address,
            totalWinnings: winningsMap[address] || 0,
            roundsWon: roundsWonMap[address] || 0
        }));

        // Sort by winnings desc, then by rounds won
        return leaderboard.sort((a, b) => {
            if (b.totalWinnings !== a.totalWinnings) {
                return b.totalWinnings - a.totalWinnings;
            }
            return b.roundsWon - a.roundsWon;
        }).slice(0, 10);

    } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        return [];
    }
};
