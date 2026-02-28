import { createWalletClient, http, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
    rpcUrls: {
        default: { http: ['https://testnet-rpc.monad.xyz/'] },
    },
}

async function main() {
    const pkStr = '0x442f5dd68dab574b5cd85f0d8d73e2312cf32baceba2fe428ba7e62b06221703';
    const account = privateKeyToAccount(pkStr);
    console.log("account:", account.address);

    const client = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http()
    });

    const BATCH_DELEGATION_ADDRESS = '0xC2490c748577e9ECB94d7519c3DfF0AAfb54858C';
    const currentNonce = await client.getTransactionCount({ address: account.address });

    console.log("Signing auth...");
    const authorization = await client.signAuthorization({
        contractAddress: BATCH_DELEGATION_ADDRESS,
        nonce: currentNonce + 1
    });
    console.log("authorization:", authorization);

    console.log("Sending tx...");
    const BATCH_ABI = parseAbi([
        'struct Call { address to; uint256 value; bytes data; }',
        'function execute((address to, uint256 value, bytes data)[] calls)',
    ]);
    const callData = encodeFunctionData({
        abi: BATCH_ABI,
        functionName: 'execute',
        args: [[{ to: account.address, value: 0n, data: "0x" }]],
    });

    try {
        const hash = await client.sendTransaction({
            to: account.address,
            data: callData,
            value: 0n, // send 0 to save money
            authorizationList: [authorization],
            chain: monadTestnet,
            type: 'eip7702',
            nonce: currentNonce
        });
        console.log("hash:", hash);
    } catch (e) {
        console.log("err:", e);
    }
}
main();
