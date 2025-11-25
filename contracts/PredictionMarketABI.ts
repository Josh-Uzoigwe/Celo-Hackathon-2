export const PREDICTION_MARKET_ABI = [
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

export const PREDICTION_MARKET_ADDRESS = "0x2AA2572befe6F81ed1756895bCF7cF2BA40AACd6";
