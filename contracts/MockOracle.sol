// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract MockOracle is AggregatorV3Interface {
    int256 public price;
    uint8 public decimalsVal;
    string public descriptionVal;
    uint256 public versionVal;

    constructor(int256 _initialPrice, uint8 _decimals) {
        price = _initialPrice;
        decimalsVal = _decimals;
        descriptionVal = "Mock Oracle";
        versionVal = 1;
    }

    function updatePrice(int256 _price) external {
        price = _price;
    }

    function decimals() external view override returns (uint8) {
        return decimalsVal;
    }

    function description() external view override returns (string memory) {
        return descriptionVal;
    }

    function version() external view override returns (uint256) {
        return versionVal;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, price, block.timestamp, block.timestamp, _roundId);
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, price, block.timestamp, block.timestamp, 1);
    }
}
