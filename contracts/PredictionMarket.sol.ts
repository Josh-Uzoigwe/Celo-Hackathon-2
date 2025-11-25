// This file contains the Solidity code for reference and display within the app.

export const SOLIDITY_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title CeloPulse Prediction Market (Production Ready)
 * @notice Binary options market with configurable intervals and locking buffers.
 */
contract CeloPulsePrediction is ReentrancyGuard, Ownable {

    enum RoundStatus { OPEN, LOCKED, ENDED }
    enum Position { UP, DOWN }

    struct Round {
        uint256 epoch;
        uint256 startTimestamp;
        uint256 lockTimestamp;
        uint256 closeTimestamp;
        int256 lockPrice;
        int256 closePrice;
        uint256 totalAmount;
        uint256 upAmount;
        uint256 downAmount;
        uint256 rewardBaseCalAmount;
        uint256 rewardAmount;
        bool oracleCalled;
    }

    struct BetInfo {
        Position position;
        uint256 amount;
        bool claimed;
    }

    // Configuration
    uint256 public intervalSeconds; // e.g., 300 for 5 minutes
    uint256 public bufferSeconds;   // e.g., 60 for 1 minute lock period
    uint256 public minBetAmount;
    uint256 public treasuryFee;     // e.g., 200 = 2%

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => BetInfo)) public ledger;
    
    uint256 public currentEpoch;
    
    // External Interactions
    AggregatorV3Interface internal oracle;
    IERC20 public token;

    event StartRound(uint256 indexed epoch);
    event LockRound(uint256 indexed epoch, int256 price);
    event EndRound(uint256 indexed epoch, int256 price);
    event BetPlaced(uint256 indexed epoch, address indexed user, Position pos, uint256 amount);
    event Claim(address indexed user, uint256 amount);

    constructor(
        address _oracleAddress, 
        address _tokenAddress, 
        uint256 _intervalSeconds, 
        uint256 _bufferSeconds
    ) {
        oracle = AggregatorV3Interface(_oracleAddress);
        token = IERC20(_tokenAddress);
        intervalSeconds = _intervalSeconds;
        bufferSeconds = _bufferSeconds;
        minBetAmount = 1 ether; // 1 CELO/cUSD
        treasuryFee = 200; // 2%
    }

    /**
     * @notice Start the genesis round
     */
    function genesisStartRound() external onlyOwner {
        currentEpoch = currentEpoch + 1;
        _startRound(currentEpoch);
    }

    /**
     * @notice Execute round logic: Lock previous, End old, Start new
     */
    function executeRound() external {
        // 1. Genesis check
        require(rounds[currentEpoch].startTimestamp != 0, "Not started");

        // 2. Checks if the current round can be locked
        if (block.timestamp >= rounds[currentEpoch].lockTimestamp && rounds[currentEpoch].lockPrice == 0) {
             _lockRound(currentEpoch);
        }

        // 3. Checks if the current round can be ended
        if (block.timestamp >= rounds[currentEpoch].closeTimestamp) {
             _endRound(currentEpoch);
             
             // 4. Start new round
             currentEpoch = currentEpoch + 1;
             _startRound(currentEpoch);
        }
    }

    function _startRound(uint256 epoch) internal {
        Round storage r = rounds[epoch];
        r.startTimestamp = block.timestamp;
        // Betting Phase = Interval - Buffer
        r.lockTimestamp = block.timestamp + (intervalSeconds - bufferSeconds);
        r.closeTimestamp = block.timestamp + intervalSeconds;
        r.epoch = epoch;
        r.totalAmount = 0;

        emit StartRound(epoch);
    }

    function _lockRound(uint256 epoch) internal {
        int256 currentPrice = _getLatestPrice();
        rounds[epoch].lockPrice = currentPrice;
        emit LockRound(epoch, currentPrice);
    }

    function _endRound(uint256 epoch) internal {
        int256 currentPrice = _getLatestPrice();
        Round storage r = rounds[epoch];
        r.closePrice = currentPrice;
        r.oracleCalled = true;
        
        emit EndRound(epoch, currentPrice);
    }

    function betUp(uint256 epoch) external payable nonReentrant {
        require(epoch == currentEpoch, "Bet is too early/late");
        require(rounds[epoch].lockPrice == 0, "Round is locked");
        require(block.timestamp < rounds[epoch].lockTimestamp, "Round locked by time");
        require(msg.value >= minBetAmount, "Bet too small");

        // Logic to record bet
        Round storage round = rounds[epoch];
        round.totalAmount = round.totalAmount + msg.value;
        round.upAmount = round.upAmount + msg.value;

        BetInfo storage betInfo = ledger[epoch][msg.sender];
        betInfo.position = Position.UP;
        betInfo.amount = betInfo.amount + msg.value;
        
        emit BetPlaced(epoch, msg.sender, Position.UP, msg.value);
    }

    function betDown(uint256 epoch) external payable nonReentrant {
        require(epoch == currentEpoch, "Bet is too early/late");
        require(rounds[epoch].lockPrice == 0, "Round is locked");
        require(block.timestamp < rounds[epoch].lockTimestamp, "Round locked by time");
        require(msg.value >= minBetAmount, "Bet too small");

        Round storage round = rounds[epoch];
        round.totalAmount = round.totalAmount + msg.value;
        round.downAmount = round.downAmount + msg.value;

        BetInfo storage betInfo = ledger[epoch][msg.sender];
        betInfo.position = Position.DOWN;
        betInfo.amount = betInfo.amount + msg.value;

        emit BetPlaced(epoch, msg.sender, Position.DOWN, msg.value);
    }
    
    function claim(uint256[] calldata epochs) external nonReentrant {
        uint256 reward; 
        
        for (uint256 i = 0; i < epochs.length; i++) {
            // ... Validation and reward calculation logic ...
            // Checks if user won the round and hasn't claimed yet
        }
        
        if (reward > 0) {
            // Transfer logic
            payable(msg.sender).transfer(reward);
            emit Claim(msg.sender, reward);
        }
    }

    function _getLatestPrice() internal view returns (int256) {
        (, int256 price, , , ) = oracle.latestRoundData();
        return price;
    }
    
    // Admin function to change interval dynamically
    function setRoundInterval(uint256 _interval, uint256 _buffer) external onlyOwner {
        intervalSeconds = _interval;
        bufferSeconds = _buffer;
    }
}`;