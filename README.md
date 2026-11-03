# BlockVote — Blockchain Voting System

An educational single-election voting dApp using Solidity, Hardhat, ethers.js, MetaMask and Ethereum Sepolia. The frontend is hosted on GitHub Pages.

> **Academic/testnet demo only.** This is not a secure real-world election system. Wallet identities and ballots are public on-chain; it has no secret ballot, identity verification, coercion resistance, or formal election audit process.

## Features

- Admin-only candidate creation and voter wallet registration.
- Election title and description stored in the contract.
- One-time lifecycle: setup → live → ended. Setup locks when voting starts; ended elections cannot be restarted.
- One vote per registered wallet, enforced by the contract.
- Candidate vote totals shown after the election ends.
- Explicit tie and zero-vote result handling.
- Transaction confirmation messages and Sepolia Etherscan links.
- Frontend checks the Sepolia chain and verifies contract bytecode.

## Run locally

Requires Node.js 20 LTS (or compatible) and npm.

```bash
npm ci
npm run compile
npm test
```

Start a local Hardhat node and deploy locally in separate terminals:

```bash
npm run node
npm run deploy:local
```

## Deploy to Sepolia

1. Create a local `.env` file (never commit it):
   ```dotenv
   SEPOLIA_RPC_URL=https://YOUR_SEPOLIA_RPC_ENDPOINT
   PRIVATE_KEY=0xYOUR_TESTNET_ONLY_PRIVATE_KEY
   ELECTION_TITLE=GGSIPU Student Election
   ELECTION_DESCRIPTION=Academic demonstration election
   ```
2. Fund the deployer with Sepolia test ETH.
3. Deploy with `npm run deploy:sepolia`.
4. Copy the new address printed by the script into `CONTRACT_ADDRESS` in `app.js`, then commit and push.

A fresh deployment is required because this release changes the contract interface and election lifecycle. **Never paste a private key into chat or commit it to Git.** Use a dedicated testnet wallet with no real funds.

## Admin and voter workflow

1. The wallet that deploys the contract is the administrator.
2. Admin adds at least two candidates and registers voter wallet addresses before starting.
3. Admin starts voting. Candidate and voter registration are locked.
4. Registered voters connect MetaMask on Sepolia and cast one vote each.
5. Admin ends voting. Results show the unique winner, a tie, or no votes.
6. Users can verify the contract and confirmed transactions on Sepolia Etherscan.

## Publish

GitHub Actions publishes `index.html`, `app.js`, and `style.css` to GitHub Pages on pushes to `master`:

https://vardangoel5.github.io/voting-system/

The Pages workflow publishes the static frontend only. It does not deploy the Solidity contract. The contract must be deployed separately and its address configured in `app.js`.
