// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Single-election voting contract for educational/testnet use.
contract Voting {
    struct Candidate {
        uint256 id;
        string name;
        string party;
        uint256 voteCount;
    }

    address public immutable admin;
    string public electionTitle;
    string public electionDescription;
    bool public votingActive;
    bool public votingStarted;
    bool public votingEnded;
    uint256 public totalVotes;
    uint256 public candidateCount;
    uint256 public registeredVoterCount;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    mapping(address => bool) public registeredVoters;

    event CandidateAdded(uint256 indexed id, string name, string party);
    event VoterRegistered(address indexed voter);
    event VotingStarted(uint256 timestamp);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event VotingEnded(uint256 timestamp);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier beforeVoting() {
        require(!votingStarted, "Election already started");
        require(!votingEnded, "Election already ended");
        _;
    }

    constructor(string memory title_, string memory description_) {
        require(bytes(title_).length > 0, "Election title required");
        admin = msg.sender;
        electionTitle = title_;
        electionDescription = description_;
    }

    function addCandidate(string calldata name, string calldata party)
        external onlyAdmin beforeVoting
    {
        require(bytes(name).length > 0, "Candidate name required");
        require(bytes(party).length > 0, "Candidate affiliation required");
        candidateCount++;
        candidates[candidateCount] = Candidate(candidateCount, name, party, 0);
        emit CandidateAdded(candidateCount, name, party);
    }

    function registerVoter(address voter) external onlyAdmin beforeVoting {
        require(voter != address(0), "Invalid voter address");
        require(!registeredVoters[voter], "Already registered");
        registeredVoters[voter] = true;
        registeredVoterCount++;
        emit VoterRegistered(voter);
    }

    function startVoting() external onlyAdmin beforeVoting {
        require(candidateCount >= 2, "Add at least two candidates");
        votingStarted = true;
        votingActive = true;
        emit VotingStarted(block.timestamp);
    }

    function endVoting() external onlyAdmin {
        require(votingActive, "Voting is not active");
        votingActive = false;
        votingEnded = true;
        emit VotingEnded(block.timestamp);
    }

    function castVote(uint256 candidateId) external {
        require(votingActive, "Voting is not active");
        require(registeredVoters[msg.sender], "Voter is not registered");
        require(!hasVoted[msg.sender], "Address has already voted");
        require(candidateId > 0 && candidateId <= candidateCount, "Invalid candidate");

        hasVoted[msg.sender] = true;
        candidates[candidateId].voteCount++;
        totalVotes++;
        emit VoteCast(msg.sender, candidateId);
    }

    function getCandidate(uint256 id) external view returns (
        uint256, string memory, string memory, uint256
    ) {
        require(id > 0 && id <= candidateCount, "Invalid candidate");
        Candidate storage candidate = candidates[id];
        return (candidate.id, candidate.name, candidate.party, candidate.voteCount);
    }

    function getResult() external view returns (
        uint256 winnerId, uint256 highestVotes, bool tied
    ) {
        require(votingEnded, "Election has not ended");
        if (totalVotes == 0) return (0, 0, false);

        for (uint256 i = 1; i <= candidateCount; i++) {
            uint256 count = candidates[i].voteCount;
            if (count > highestVotes) {
                highestVotes = count;
                winnerId = i;
                tied = false;
            } else if (count == highestVotes && count > 0) {
                tied = true;
                winnerId = 0;
            }
        }
    }

    function isRegistered(address voter) external view returns (bool) {
        return registeredVoters[voter];
    }

    function hasVotedAlready(address voter) external view returns (bool) {
        return hasVoted[voter];
    }
}
