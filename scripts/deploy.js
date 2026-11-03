const hre = require("hardhat");

async function main() {
  const title = process.env.ELECTION_TITLE || "GGSIPU Student Election";
  const description = process.env.ELECTION_DESCRIPTION || "Academic demonstration election on Ethereum Sepolia.";
  console.log("Deploying Voting contract…");
  const Voting = await hre.ethers.getContractFactory("Voting");
  const voting = await Voting.deploy(title, description);
  await voting.waitForDeployment();
  const address = await voting.getAddress();
  console.log("\nDeployment successful");
  console.log("Network:", (await hre.ethers.provider.getNetwork()).name);
  console.log("Contract address:", address);
  console.log("\nSet CONTRACT_ADDRESS in app.js to:", address);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
