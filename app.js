// Update this after deploying the current contracts/Voting.sol to Sepolia.
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
const SEPOLIA_CHAIN_ID = 11155111n;
const EXPLORER = "https://sepolia.etherscan.io";

const ABI = [
  "function admin() view returns (address)",
  "function electionTitle() view returns (string)",
  "function electionDescription() view returns (string)",
  "function votingActive() view returns (bool)",
  "function votingStarted() view returns (bool)",
  "function votingEnded() view returns (bool)",
  "function totalVotes() view returns (uint256)",
  "function candidateCount() view returns (uint256)",
  "function registeredVoterCount() view returns (uint256)",
  "function getCandidate(uint256) view returns (uint256,string,string,uint256)",
  "function isRegistered(address) view returns (bool)",
  "function hasVotedAlready(address) view returns (bool)",
  "function addCandidate(string,string)",
  "function registerVoter(address)",
  "function startVoting()",
  "function endVoting()",
  "function castVote(uint256)",
  "function getResult() view returns (uint256,uint256,bool)",
  "event CandidateAdded(uint256 indexed id,string name,string party)",
  "event VoterRegistered(address indexed voter)",
  "event VotingStarted(uint256 timestamp)",
  "event VoteCast(address indexed voter,uint256 indexed candidateId)",
  "event VotingEnded(uint256 timestamp)"
];

let provider, signer, contract, currentAccount, isAdmin = false;
let busy = false;

const $ = id => document.getElementById(id);
const shortAddress = value => value ? value.slice(0, 6) + "…" + value.slice(-4) : "";

window.addEventListener("load", () => {
  $("contractAddress").textContent = CONTRACT_ADDRESS;
  $("contractLink").href = EXPLORER + "/address/" + CONTRACT_ADDRESS;
  if (!window.ethereum) {
    notify("MetaMask was not detected. Install MetaMask to use the voting app.", "error");
    $("connectBtn").disabled = true;
    return;
  }
  window.ethereum.on("accountsChanged", accounts => {
    if (!accounts.length) disconnectUI();
    else connectWallet(true);
  });
  window.ethereum.on("chainChanged", () => window.location.reload());
  $("connectBtn").addEventListener("click", () => connectWallet(false));
  $("refreshBtn").addEventListener("click", refreshAll);
  $("addCandidateBtn").addEventListener("click", addCandidate);
  $("registerVoterBtn").addEventListener("click", registerVoter);
  $("startBtn").addEventListener("click", startVoting);
  $("endBtn").addEventListener("click", endVoting);
});

async function connectWallet(silent) {
  try {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    setBusy(true, "Connecting wallet…");
    const accounts = await window.ethereum.request({
      method: silent ? "eth_accounts" : "eth_requestAccounts"
    });
    if (!accounts.length) { disconnectUI(); return; }
    provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      throw new Error("Switch MetaMask to Ethereum Sepolia (chain ID 11155111).");
    }
    if (!ethers.isAddress(CONTRACT_ADDRESS) || CONTRACT_ADDRESS === ethers.ZeroAddress) {
      throw new Error("The app has not been configured with the new contract address yet. Deploy the updated contract and set CONTRACT_ADDRESS in app.js.");
    }
    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") throw new Error("No contract bytecode found at the configured address on Sepolia.");
    signer = await provider.getSigner();
    currentAccount = await signer.getAddress();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const admin = await contract.admin();
    isAdmin = admin.toLowerCase() === currentAccount.toLowerCase();
    $("walletAddress").textContent = currentAccount;
    $("connectBtn").textContent = "Wallet connected";
    $("connectBtn").disabled = true;
    $("mainContent").classList.remove("hidden");
    $("welcomePanel").classList.add("hidden");
    $("adminPanel").classList.toggle("hidden", !isAdmin);
    $("adminBadge").classList.toggle("hidden", !isAdmin);
    await refreshAll();
  } catch (error) {
    notify(parseError(error), "error");
    disconnectUI();
  } finally {
    setBusy(false);
  }
}

function disconnectUI() {
  provider = signer = contract = currentAccount = null;
  isAdmin = false;
  $("mainContent").classList.add("hidden");
  $("welcomePanel").classList.remove("hidden");
  $("adminPanel").classList.add("hidden");
  $("adminBadge").classList.add("hidden");
  $("walletAddress").textContent = "Not connected";
  $("connectBtn").textContent = "Connect wallet";
  $("connectBtn").disabled = !window.ethereum;
}

async function refreshAll() {
  if (!contract) return;
  try {
    setBusy(true, "Loading election data…");
    const [title, description, active, started, ended, total, count, voters, registered, voted] =
      await Promise.all([
        contract.electionTitle(), contract.electionDescription(),
        contract.votingActive(), contract.votingStarted(), contract.votingEnded(),
        contract.totalVotes(), contract.candidateCount(), contract.registeredVoterCount(),
        contract.isRegistered(currentAccount), contract.hasVotedAlready(currentAccount)
      ]);
    $("electionTitle").textContent = title;
    $("electionDescription").textContent = description || "No additional election details.";
    $("votingStatus").textContent = ended ? "ENDED" : active ? "LIVE" : started ? "PAUSED" : "SETUP";
    $("votingStatus").className = "status-badge " + (active ? "active" : ended ? "ended" : "inactive");
    $("totalVotes").textContent = total.toString();
    $("candidateCount").textContent = count.toString();
    $("registeredCount").textContent = voters.toString();
    $("regStatus").textContent = registered ? "Registered" : "Not registered";
    $("voteStatus").textContent = voted ? "Vote recorded" : "Not voted";
    $("regStatus").className = "tag " + (registered ? "green" : "red");
    $("voteStatus").className = "tag " + (voted ? "green" : "orange");
    $("startBtn").disabled = !isAdmin || started || ended || Number(count) < 2;
    $("endBtn").disabled = !isAdmin || !active;
    $("adminHelp").textContent = ended ? "This election has ended. A new deployment is required for another election." :
      started ? "Election is locked. Candidate and voter registration are closed." :
      "Add at least two candidates and register voter wallet addresses before starting.";
    $("adminSetup").classList.toggle("locked", started || ended);
    await loadCandidates(active, ended, registered, voted, Number(count));
    await loadResult(ended, Number(total));
    $("electionExplorer").href = EXPLORER + "/address/" + CONTRACT_ADDRESS;
    $("resultsExplorer").href = EXPLORER + "/address/" + CONTRACT_ADDRESS;
    $("resultTotal").textContent = total.toString();
  } catch (error) {
    notify("Could not load election data: " + parseError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function loadCandidates(active, ended, registered, voted, count) {
  const list = $("candidateList");
  const resultRows = $("resultRows");
  list.replaceChildren();
  resultRows.replaceChildren();
  if (!count) {
    const empty = document.createElement("p");
    empty.className = "no-data";
    empty.textContent = "No candidates have been added yet.";
    list.append(empty);
    return;
  }
  const candidates = [];
  const electionTotalVotes = Number(await contract.totalVotes());
  for (let id = 1; id <= count; id++) {
    const [candidateId, name, party, votes] = await contract.getCandidate(id);
    candidates.push({candidateId, name, party, votes});
  }
  for (const candidate of candidates) {
    const {candidateId, name, party, votes} = candidate;
    const card = document.createElement("article");
    card.className = "candidate-card";
    const heading = document.createElement("h3");
    heading.textContent = name;
    const affiliation = document.createElement("p");
    affiliation.className = "candidate-party";
    affiliation.textContent = party;
    const voteCount = document.createElement("p");
    voteCount.className = "candidate-votes";
    voteCount.textContent = ended ? votes.toString() + " votes" : "Vote count hidden until election ends";
    card.append(heading, affiliation, voteCount);
    if (active && registered && !voted) {
      const button = document.createElement("button");
      button.className = "vote-btn";
      button.textContent = "Cast vote";
      button.addEventListener("click", () => castVote(candidateId));
      card.append(button);
    }
    list.append(card);
    if (ended) {
      const percentage = electionTotalVotes > 0 ? Number(candidate.votes) / electionTotalVotes * 100 : 0;
      const row = document.createElement("div");
      row.className = "result-row";
      const candidateName = document.createElement("span");
      candidateName.className = "result-name";
      candidateName.textContent = name;
      const track = document.createElement("div");
      track.className = "result-track";
      const fill = document.createElement("div");
      fill.className = "result-fill";
      fill.style.width = percentage.toFixed(1) + "%";
      track.append(fill);
      const percent = document.createElement("span");
      percent.className = "result-percent";
      percent.textContent = percentage.toFixed(1) + "%";
      const countLabel = document.createElement("span");
      countLabel.className = "result-votes";
      countLabel.textContent = votes.toString() + (Number(votes) === 1 ? " vote" : " votes");
      row.append(candidateName, track, percent, countLabel);
      resultRows.append(row);
    }
  }
}

async function loadResult(ended, total) {
  $("resultSection").classList.add("hidden");
  if (!ended) return;
  $("resultSection").classList.remove("hidden");
  if (!total) {
    $("resultTitle").textContent = "No votes were cast";
    $("resultDetail").textContent = "The election ended without any recorded votes.";
    return;
  }
  const [winnerId, highestVotes, tied] = await contract.getResult();
  if (tied) {
    $("resultTitle").textContent = "Result: Tie";
    $("resultDetail").textContent = "Multiple candidates received " + highestVotes.toString() + " votes. The contract does not select a winner.";
  } else {
    const [, name, party] = await contract.getCandidate(winnerId);
    $("resultTitle").textContent = "Winner: " + name;
    $("resultDetail").textContent = party + " · " + highestVotes.toString() + " votes";
  }
}

async function transact(label, action) {
  if (busy) return;
  try {
    setBusy(true, label + " — confirm in MetaMask…");
    const tx = await action();
    setBusy(true, "Transaction submitted. Waiting for confirmation…");
    const receipt = await tx.wait();
    notify(label + " confirmed. View transaction on Etherscan.", "success", EXPLORER + "/tx/" + receipt.hash);
    await refreshAll();
    return true;
  } catch (error) {
    notify(parseError(error), "error");
    return false;
  } finally {
    setBusy(false);
  }
}

async function addCandidate() {
  const name = $("candidateName").value.trim();
  const party = $("candidateParty").value.trim();
  if (!name || !party) return notify("Enter both a candidate name and affiliation.", "error");
  if (await transact("Candidate added", () => contract.addCandidate(name, party))) {
    $("candidateName").value = "";
    $("candidateParty").value = "";
  }
}

async function registerVoter() {
  const address = $("voterAddress").value.trim();
  if (!ethers.isAddress(address) || address === ethers.ZeroAddress) return notify("Enter a valid, non-zero wallet address.", "error");
  if (await transact("Voter registered", () => contract.registerVoter(address))) $("voterAddress").value = "";
}

async function startVoting() {
  await transact("Voting started", () => contract.startVoting());
}
async function endVoting() {
  if (!confirm("End voting permanently? This cannot be undone.")) return;
  await transact("Voting ended", () => contract.endVoting());
}
async function castVote(id) {
  if (!confirm("Confirm your vote? Each registered wallet can vote only once.")) return;
  await transact("Vote recorded", () => contract.castVote(id));
}

function setBusy(value, message) {
  busy = value;
  $("loadingOverlay").classList.toggle("hidden", !value);
  if (message) $("loadingMsg").textContent = message;
}
function notify(message, type, link) {
  const el = $("notification");
  el.replaceChildren();
  const span = document.createElement("span");
  span.textContent = message + " ";
  el.append(span);
  if (link) {
    const a = document.createElement("a");
    a.href = link; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = "Open Etherscan";
    el.append(a);
  }
  el.className = "notification " + type;
}
function parseError(error) {
  const message = error?.shortMessage || error?.reason || error?.info?.error?.message || error?.message || "Unknown error";
  if (/user rejected|user denied/i.test(message)) return "You rejected the transaction in MetaMask.";
  if (/Already registered/i.test(message)) return "This wallet is already registered.";
  if (/already voted/i.test(message)) return "This wallet has already voted.";
  if (/not registered/i.test(message)) return "This wallet is not registered to vote.";
  if (/Only admin/i.test(message)) return "Only the deploying admin wallet can perform this action.";
  return message.replace(/^execution reverted:\s*/i, "");
}
