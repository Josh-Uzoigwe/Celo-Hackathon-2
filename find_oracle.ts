import { ethers } from 'ethers';
import { PREDICTION_MARKET_ADDRESS } from './contracts/PredictionMarketABI.ts';
import { RPC_URL } from './constants';

const main = async () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log(`Scanning storage of ${PREDICTION_MARKET_ADDRESS}...`);

    for (let i = 0; i < 15; i++) {
        const data = await provider.getStorage(PREDICTION_MARKET_ADDRESS, i);
        console.log(`Slot ${i}: ${data}`);

        // Check if it looks like an address
        if (data.startsWith('0x000000000000000000000000')) {
            const address = '0x' + data.slice(26);
            if (address !== '0x0000000000000000000000000000000000000000') {
                console.log(`Possible Address at Slot ${i}: ${address}`);
            }
        }
    }
};

main();
