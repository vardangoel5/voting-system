const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting", function () {
  async function deploy() {
    const [admin, voter1, voter2, outsider] = await ethers.getSigners();
    const Voting = await ethers.getContractFactory("Voting");
    const voting = await Voting.deploy("Campus Election", "Student council election");
    await voting.waitForDeployment();
    return { voting, admin, voter1, voter2, outsider };
  }
  async function prepare(voting, voter1, voter2) {
    await voting.addCandidate("Avery", "Independent");
    await voting.addCandidate("Jordan", "Campus First");
    await voting.registerVoter(voter1.address);
    await voting.registerVoter(voter2.address);
  }

  it("stores election details and makes deployer admin", async function () {
    const { voting, admin } = await deploy();
    expect(await voting.admin()).to.equal(admin.address);
    expect(await voting.electionTitle()).to.equal("Campus Election");
    expect(await voting.electionDescription()).to.equal("Student council election");
  });

  it("enforces admin permissions and validates setup", async function () {
    const { voting, outsider, voter1 } = await deploy();
    await expect(voting.connect(outsider).addCandidate("A", "B")).to.be.revertedWith("Only admin");
    await expect(voting.addCandidate("", "B")).to.be.revertedWith("Candidate name required");
    await expect(voting.registerVoter(ethers.ZeroAddress)).to.be.revertedWith("Invalid voter address");
    await expect(voting.startVoting()).to.be.revertedWith("Add at least two candidates");
    await voting.addCandidate("A", "B");
    await voting.addCandidate("C", "D");
    await voting.registerVoter(voter1.address);
    await expect(voting.registerVoter(voter1.address)).to.be.revertedWith("Already registered");
  });

  it("allows one vote per registered address and rejects invalid attempts", async function () {
    const { voting, voter1, voter2, outsider } = await deploy();
    await prepare(voting, voter1, voter2);
    await voting.startVoting();
    await expect(voting.connect(outsider).castVote(1)).to.be.revertedWith("Voter is not registered");
    await expect(voting.connect(voter1).castVote(99)).to.be.revertedWith("Invalid candidate");
    await voting.connect(voter1).castVote(1);
    await expect(voting.connect(voter1).castVote(2)).to.be.revertedWith("Address has already voted");
    expect(await voting.totalVotes()).to.equal(1);
    expect((await voting.getCandidate(1))[3]).to.equal(1);
  });

  it("locks setup after start and prevents restarting after end", async function () {
    const { voting, voter1, voter2 } = await deploy();
    await prepare(voting, voter1, voter2);
    await voting.startVoting();
    await expect(voting.addCandidate("Late", "Party")).to.be.revertedWith("Election already started");
    await expect(voting.registerVoter(ethers.Wallet.createRandom().address)).to.be.revertedWith("Election already started");
    await voting.endVoting();
    await expect(voting.startVoting()).to.be.revertedWith("Election already started");
    await expect(voting.castVote(1)).to.be.revertedWith("Voting is not active");
  });

  it("returns the unique winner after voting ends", async function () {
    const { voting, voter1, voter2 } = await deploy();
    await prepare(voting, voter1, voter2);
    await voting.startVoting();
    await voting.connect(voter1).castVote(1);
    await voting.connect(voter2).castVote(1);
    await voting.endVoting();
    const result = await voting.getResult();
    expect(result.winnerId).to.equal(1);
    expect(result.highestVotes).to.equal(2);
    expect(result.tied).to.equal(false);
  });

  it("reports a tie and handles an election with no votes", async function () {
    const { voting, voter1, voter2 } = await deploy();
    await prepare(voting, voter1, voter2);
    await voting.startVoting();
    await voting.connect(voter1).castVote(1);
    await voting.connect(voter2).castVote(2);
    await voting.endVoting();
    const result = await voting.getResult();
    expect(result.winnerId).to.equal(0);
    expect(result.highestVotes).to.equal(1);
    expect(result.tied).to.equal(true);
  });

  it("returns an empty result when no ballots were cast", async function () {
    const { voting, voter1, voter2 } = await deploy();
    await prepare(voting, voter1, voter2);
    await voting.startVoting();
    await voting.endVoting();
    const result = await voting.getResult();
    expect(result.winnerId).to.equal(0);
    expect(result.highestVotes).to.equal(0);
    expect(result.tied).to.equal(false);
  });
});
