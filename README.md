# Blockchain Voting System

A browser-based voting demo backed by the `Voting.sol` smart contract. The frontend is a static site and can be hosted on GitHub Pages; wallet transactions run through MetaMask on **Ethereum Sepolia**.

> **Testnet / educational project only.** This contract is not suitable for public, governmental, or otherwise high-stakes elections. Votes and voter addresses are public on-chain data.

## Repository

- `index.html`, `style.css`, `app.js` — static frontend
- `contracts/Voting.sol` — Solidity voting contract
- `scripts/deploy.js` — Hardhat deployment script
- `.github/workflows/pages.yml` — deploys the static frontend to GitHub Pages

## 1. Install and compile

Requires Node.js (LTS) and npm.

```bash
npm install
npm run compile
npm test
```

## 2. Deploy the contract to Sepolia

1. Create a local `.env` file (it is ignored by Git) with your Sepolia RPC endpoint and a dedicated testnet deployer private key:

   ```dotenv
   SEPOLIA_RPC_URL=https://YOUR_SEPOLIA_RPC_ENDPOINT
   PRIVATE_KEY=0xYOUR_TESTNET_DEPLOYER_PRIVATE_KEY
   ```

2. Fund that testnet account with Sepolia ETH from a testnet faucet.
3. Deploy:

   ```bash
   npm run deploy:sepolia
   ```

4. Copy the address printed as `Voting deployed to:`.

**Never commit `.env`, paste a private key into chat, or use a wallet holding real funds for this demo.** A Sepolia RPC URL is not a wallet secret, but the private key is.

## 3. Point the frontend at the deployed contract

Open `app.js` and replace `CONTRACT_ADDRESS` with the new Sepolia deployment address. Commit and push that change to `master`. The frontend checks that MetaMask is connected to Sepolia (chain ID `11155111`) and that contract bytecode exists at the configured address before it initializes.

The frontend uses ethers.js v6 from a CDN, so no frontend build step is required.

## 4. Publish with GitHub Pages

The workflow at `.github/workflows/pages.yml` publishes `index.html`, `app.js`, and `style.css` whenever `master` is updated.

In the repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. Then open **Actions** and check the “Deploy voting system to GitHub Pages” run. Once the workflow succeeds, GitHub displays the published URL in the Pages settings and the deployment job.

For this repository, the expected project-site URL is:

`https://vardangoel5.github.io/voting-system/`

The URL is not live/verified until the Pages workflow completes successfully.

## Admin and voter flow

- The account that deploys the contract becomes its admin.
- The admin adds candidates and registers voter wallet addresses.
- The admin starts voting; registered addresses can cast one vote each.
- The admin ends voting; the contract exposes a winner when voting has ended and at least one vote was cast.

## Important limitations

This is a transparent, on-chain demonstration, not a secret-ballot system. Addresses and votes can be inspected publicly. The current contract does not provide privacy-preserving ballots, independent identity verification, robust election dispute handling, or a full tie-resolution process. Do not use it to run a real election.
