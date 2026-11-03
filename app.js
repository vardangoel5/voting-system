const CONTRACT_ADDRESS = "0x80E99ab40370DEF535EF3Cb0250FC00BAEBa9716";

const ABI = [
  "function candidateCount() view returns (uint)",
  "function totalVotes() view returns (uint)",
  "function votingActive() view returns (bool)",
  "function admin() view returns (address)",
  "function getCandidate(uint id) view returns (uint, string, string, uint)",
  "function isRegistered(address voter) view returns (bool)",
  "function hasVotedAlready(address voter) view returns (bool)",
  "function castVote(uint candidateId)",
  "function registerVoter(address voter)",
  "function addCandidate(string name, string party)",
  "function startVoting()",
  "function endVoting()",
  "function getWinner() view returns (string, string, uint)",
  "event VoteCast(address indexed voter, uint candidateId)",
  "event VoterRegistered(address indexed voter)",
  "event VotingStarted()",
  "event VotingEnded()"
];

let provider, signer, contract;
let currentAccount = null;
let isAdmin = false;

window.addEventListener("load", async () => {
  if (typeof window.ethereum === "undefined") {
    showError("MetaMask not detected. Please install MetaMask.");
    document.getElementById("connectBtn").disabled = true;
    return;
  }
  window.ethereum.on("accountsChanged", handleAccountChange);
  window.ethereum.on("chainChanged", () => window.location.reload());
});

async function handleAccountChange(accounts) {
  if (accounts.length === 0) {
    resetUI();
    return;
  }

  try {
    currentAccount = accounts[0];
    provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (network.chainId !== 11155111n) {
      throw new Error("Wrong network. Please switch MetaMask to Ethereum Sepolia (chain ID 11155111).");
    }

    const deployedCode = await provider.getCode(CONTRACT_ADDRESS);
    if (deployedCode === "0x") {
      throw new Error("No contract is deployed at the configured address on Sepolia. Deploy Voting.sol and update CONTRACT_ADDRESS in app.js.");
    }

    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    document.getElementById("walletAddress").textContent =
      currentAccount.slice(0, 6) + "..." + currentAccount.slice(-4);
    await initContract();
    await refreshAll();
  } catch (err) {
    showError("Could not switch wallet account: " + err.message);
  }
}

async function connectWallet() {
  try {
    showLoading("Connecting wallet...");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    currentAccount = accounts[0];

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    document.getElementById("walletAddress").textContent =
      currentAccount.slice(0, 6) + "..." + currentAccount.slice(-4);
    document.getElementById("connectBtn").textContent = "Connected";
    document.getElementById("connectBtn").disabled = true;
    document.getElementById("mainContent").classList.remove("hidden");

    await initContract();
    await refreshAll();
    hideLoading();
  } catch (err) {
    hideLoading();
    showError("Connection failed: " + err.message);
  }
}

async function initContract() {
  try {
    const adminAddr = await contract.admin();
    isAdmin = adminAddr.toLowerCase() === currentAccount.toLowerCase();
    document.getElementById("adminPanel").classList.toggle("hidden", !isAdmin);
    document.getElementById("adminBadge").classList.toggle("hidden", !isAdmin);
  } catch (e) {
    console.error(e);
  }
}

async function refreshAll() {
  await loadStatus();
  await loadCandidates();
  await loadVoterStatus();
}

async function loadStatus() {
  try {
    const active = await contract.votingActive();
    const total = await contract.totalVotes();

    const statusEl = document.getElementById("votingStatus");
    statusEl.textContent = active ? "ACTIVE" : "INACTIVE";
    statusEl.className = "status-badge " + (active ? "active" : "inactive");
    document.getElementById("totalVotes").textContent = total.toString();

    document.getElementById("startBtn").disabled = active;
    document.getElementById("endBtn").disabled = !active;

    if (!active && Number(total) > 0) {
      await loadWinner();
    } else {
      document.getElementById("winnerSection").classList.add("hidden");
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadCandidates() {
  try {
    const count = Number(await contract.candidateCount());
    const container = document.getElementById("candidateList");
    container.innerHTML = "";

    const active = await contract.votingActive();
    const voted = await contract.hasVotedAlready(currentAccount);
    const registered = await contract.isRegistered(currentAccount);

    for (let i = 1; i <= count; i++) {
      const [id, name, party, votes] = await contract.getCandidate(i);
      const card = document.createElement("div");
      card.className = "candidate-card";

      const info = document.createElement("div");
      info.className = "candidate-info";

      const candidateName = document.createElement("div");
      candidateName.className = "candidate-name";
      candidateName.textContent = name;

      const candidateParty = document.createElement("div");
      candidateParty.className = "candidate-party";
      candidateParty.textContent = party;

      const voteCount = document.createElement("div");
      voteCount.className = "candidate-votes";
      voteCount.textContent = `${votes.toString()} votes`;

      info.append(candidateName, candidateParty);
      card.append(info, voteCount);

      if (active && registered && !voted) {
        const voteButton = document.createElement("button");
        voteButton.className = "vote-btn";
        voteButton.textContent = "Vote";
        voteButton.addEventListener("click", () => castVote(id));
        card.appendChild(voteButton);
      }

      container.appendChild(card);
    }

    if (count === 0) {
      container.innerHTML = "<p class='no-data'>No candidates added yet.</p>";
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadVoterStatus() {
  try {
    const registered = await contract.isRegistered(currentAccount);
    const voted = await contract.hasVotedAlready(currentAccount);

    document.getElementById("regStatus").textContent = registered ? "Registered" : "Not Registered";
    document.getElementById("regStatus").className = registered ? "tag green" : "tag red";
    document.getElementById("voteStatus").textContent = voted ? "Voted" : "Not Voted";
    document.getElementById("voteStatus").className = voted ? "tag green" : "tag orange";
  } catch (e) {
    console.error(e);
  }
}

async function loadWinner() {
  try {
    const [name, party, votes] = await contract.getWinner();
    document.getElementById("winnerName").textContent = name;
    document.getElementById("winnerParty").textContent = party;
    document.getElementById("winnerVotes").textContent = votes.toString();
    document.getElementById("winnerSection").classList.remove("hidden");
  } catch (e) {
    document.getElementById("winnerSection").classList.add("hidden");
  }
}

async function castVote(candidateId) {
  try {
    showLoading("Casting vote...");
    const tx = await contract.castVote(candidateId);
    await tx.wait();
    showSuccess("Vote cast successfully! Tx: " + tx.hash.slice(0, 10) + "...");
    await refreshAll();
  } catch (err) {
    showError(parseError(err));
  } finally {
    hideLoading();
  }
}

async function addCandidate() {
  const name = document.getElementById("candName").value.trim();
  const party = document.getElementById("candParty").value.trim();
  if (!name || !party) return showError("Fill both fields.");

  try {
    showLoading("Adding candidate...");
    const tx = await contract.addCandidate(name, party);
    await tx.wait();
    document.getElementById("candName").value = "";
    document.getElementById("candParty").value = "";
    showSuccess("Candidate added.");
    await loadCandidates();
  } catch (err) {
    showError(parseError(err));
  } finally {
    hideLoading();
  }
}

async function registerVoter() {
  const addr = document.getElementById("voterAddr").value.trim();
  if (!ethers.isAddress(addr)) return showError("Invalid address.");

  try {
    showLoading("Registering voter...");
    const tx = await contract.registerVoter(addr);
    await tx.wait();
    document.getElementById("voterAddr").value = "";
    showSuccess("Voter registered.");
    await loadVoterStatus();
  } catch (err) {
    showError(parseError(err));
  } finally {
    hideLoading();
  }
}

async function startVoting() {
  try {
    showLoading("Starting voting...");
    const tx = await contract.startVoting();
    await tx.wait();
    showSuccess("Voting started.");
    await refreshAll();
  } catch (err) {
    showError(parseError(err));
  } finally {
    hideLoading();
  }
}

async function endVoting() {
  try {
    showLoading("Ending voting...");
    const tx = await contract.endVoting();
    await tx.wait();
    showSuccess("Voting ended.");
    await refreshAll();
  } catch (err) {
    showError(parseError(err));
  } finally {
    hideLoading();
  }
}

function parseError(err) {
  if (err.reason) return err.reason;
  if (err.message?.includes("Already voted")) return "You already voted.";
  if (err.message?.includes("Not registered")) return "You are not registered to vote.";
  if (err.message?.includes("user rejected")) return "Transaction rejected.";
  return err.message || "Unknown error";
}

function showLoading(msg) {
  document.getElementById("loadingMsg").textContent = msg;
  document.getElementById("loadingOverlay").classList.remove("hidden");
}
function hideLoading() {
  document.getElementById("loadingOverlay").classList.add("hidden");
}
function showSuccess(msg) {
  const el = document.getElementById("notification");
  el.textContent = msg;
  el.className = "notification success";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}
function showError(msg) {
  const el = document.getElementById("notification");
  el.textContent = msg;
  el.className = "notification error";
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}
function resetUI() {
  currentAccount = null;
  provider = null;
  signer = null;
  contract = null;
  isAdmin = false;
  document.getElementById("mainContent").classList.add("hidden");
  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("adminBadge").classList.add("hidden");
  document.getElementById("walletAddress").textContent = "";
  document.getElementById("connectBtn").textContent = "Connect Wallet";
  document.getElementById("connectBtn").disabled = false;
}