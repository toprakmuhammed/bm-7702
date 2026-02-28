# BM-7702 — Next-Gen Transaction Infrastructure on Monad (EIP-7702)

BM-7702 is more than just a one-click batch token distribution tool for founders and hackathon organizers. It is a powerful infrastructure built on **EIP-7702** and **Monad** that completely eliminates transaction friction and barriers. 

By allowing Externally Owned Accounts (EOAs) to temporarily execute smart contract payloads, this project bypasses the endless transaction approval prompts that bottleneck user experience. Whether it's removing transaction hurdles in blockchain gaming, enabling gasless sponsorships, or ensuring you never miss a top-selling opportunity during fast-paced token sales due to confirmation delays, BM-7702 redefines seamless on-chain interactions.
## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

## Smart Contract Deployment

```bash
# 1. Copy env and add your private key
cp .env.example .env

# 2. Compile contracts
npx hardhat compile

# 3. Deploy to Monad Testnet
npx hardhat run scripts/deploy.ts --network monadTestnet

# 4. Update the contract address in src/hooks/useEIP7702.ts
```

## Features

### Batch Send
Send MON or ERC-20 tokens to multiple wallets in a single transaction.
- Add recipients manually or import from CSV
- Supports native MON and any ERC-20 token
- One EIP-7702 signature, one transaction, many recipients

### Fund Pool
Distribute remaining funds to team members with one click.
- Set total budget and track usage
- Equal split or custom amounts
- Preview distribution before executing

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Web3:** viem + wagmi
- **Contracts:** Solidity 0.8.27 + Hardhat
- **Network:** Monad Testnet (Chain ID: 10143)
- **Protocol:** EIP-7702 (EOA delegation for batch execution)

## Network Info

| Key | Value |
|-----|-------|
| Network | Monad Testnet |
| RPC | `https://testnet-rpc.monad.xyz` |
| Chain ID | `10143` |
| Currency | MON |
| Explorer | `https://testnet.monadexplorer.com` |
