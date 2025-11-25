import { ethers } from 'ethers';

const RPC_URL = "https://forno.celo-sepolia.celo-testnet.org";
const PREDICTION_MARKET_ADDRESS = "0x2AA2572befe6F81ed1756895bCF7cF2BA40AACd6";
const PREDICTION_MARKET_ABI = [
    {
        "inputs": [],
        "name": "genesisStartRound",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "executeRound",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "epoch",
                "type": "uint256"
            }
        ],
        "name": "betUp",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "epoch",
                "type": "uint256"
            }
        ],
        "name": "betDown",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256[]",
                "name": "epochs",
                "type": "uint256[]"
            }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "rounds",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "epoch",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "startTimestamp",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "lockTimestamp",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "closeTimestamp",
                "type": "uint256"
            },
            {
                "internalType": "int256",
                "name": "lockPrice",
                "type": "int256"
            },
            {
                "internalType": "int256",
                "name": "closePrice",
                "type": "int256"
            },
            {
                "internalType": "uint256",
                "name": "totalAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "upAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "downAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "rewardBaseCalAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "rewardAmount",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "oracleCalled",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "currentEpoch",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "ledger",
        "outputs": [
            {
                "internalType": "uint8",
                "name": "position",
                "type": "uint8"
            },
            {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "claimed",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "Claim",
        "type": "event"
    }
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(PREDICTION_MARKET_ADDRESS, PREDICTION_MARKET_ABI, provider);

    try {
        const currentEpoch = await contract.currentEpoch();
        console.log("Current Epoch:", currentEpoch.toString());

        const roundData = await contract.rounds(currentEpoch);
        console.log("Round Data:", {
            epoch: roundData.epoch.toString(),
            startTimestamp: roundData.startTimestamp.toString(),
            lockTimestamp: roundData.lockTimestamp.toString(),
            closeTimestamp: roundData.closeTimestamp.toString(),
            lockPrice: roundData.lockPrice.toString(),
            closePrice: roundData.closePrice.toString(),
        });

        const latestBlock = await provider.getBlock('latest');
        const now = latestBlock?.timestamp || Math.floor(Date.now() / 1000);
        console.log("Current Block Time:", now);
        console.log("Lock in:", Number(roundData.lockTimestamp) - now);
        console.log("Close in:", Number(roundData.closeTimestamp) - now);

        if (Number(roundData.startTimestamp) === 0) {
            console.log("Market not started.");
            return;
        }

        console.log("Simulating executeRound...");
        try {
            await contract.executeRound.staticCall();
            console.log("executeRound simulation SUCCESS (No revert).");
        } catch (e: any) {
            console.error("executeRound simulation FAILED:");
            console.error("Reason:", e.reason);
            console.error("Code:", e.code);
            if (e.data) console.error("Data:", e.data);
        }

        console.log("Reading Oracle Address from Storage Slot 9...");
        const oracleSlot = await provider.getStorage(PREDICTION_MARKET_ADDRESS, 9);
        const oracleAddress = ethers.dataSlice(oracleSlot, 12);
        console.log("Oracle Address:", oracleAddress);

        console.log("Checking Oracle Code...");
        const oracleCode = await provider.getCode(oracleAddress);
        console.log("Oracle Code Length:", oracleCode.length);

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

main();
