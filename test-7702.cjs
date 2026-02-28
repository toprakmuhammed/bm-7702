const { createWalletClient, http, parseEther, encodeFunctionData, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { monadTestnet } = require('./node_modules/viem/chains');

async function main() {
    const pkStr = '0x442f5dd68dab574b5cd85f0d8d73e2312cf32baceba2fe428ba7e62b06221703';
    const account = privateKeyToAccount(pkStr);
    console.log("account:", account.address);

    const client = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http("https://testnet-rpc.monad.xyz/")
    });

    const BATCH_DELEGATION_ADDRESS = '0xC2490c748577e9ECB94d7519c3DfF0AAfb54858C';
    console.log("Signing auth...");
    const authorization = await client.signAuthorization({
        contractAddress: BATCH_DELEGATION_ADDRESS,
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
        args: [[{ to: account.address, value: 1n, data: "0x" }]],
    });

    try {
      const hash = await client.sendTransaction({
          to: account.address,
          data: callData,
          value: 1n,
          authorizationList: [authorization],
          chain: monadTestnet,
      });
      console.log("hash:", hash);
    } catch(e) {
      console.log("err:", e);
    }
}
main();
