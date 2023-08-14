//SPDX-License-Identifier:MIT
pragma solidity ^0.8.9;

interface IStrategy {
  function activeExpiry() external returns (uint);

  function setBoard(uint boardId) external;

  function doTrade(uint strikeId, address rewardRecipient)
    external
    returns (
      uint positionId,
      uint premium,
      uint collateralAdded
    );

  function reducePosition(
    uint positionId,
    uint closeAmount,
    address rewardRecipient
  ) external;

  function emergencyCloseAll(address lyraRewardRecipient) external;

  function returnFundsAndClearStrikes() external;
}