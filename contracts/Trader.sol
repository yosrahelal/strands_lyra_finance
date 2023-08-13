// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;
import {LyraAdapter} from "@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol";
import {OptionMarket} from "@lyrafinance/protocol/contracts/OptionMarket.sol";
// Libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Trader is LyraAdapter {
  uint[] public activePositionIds;

  constructor() LyraAdapter() {}

  function initAdapter(
    address _lyraRegistry,
    address _optionMarket,
    address _curveSwap,
    address _feeCounter
  ) external onlyOwner {
    // set addresses for LyraAdapter
    setLyraAddresses(_lyraRegistry, _optionMarket, _curveSwap, _feeCounter);
  }

  function buyStraddle(uint size, uint strikeId) public {
    // Get the strike price from the market
    uint price = optionMarket.getStrike(strikeId).strikePrice;
    // approve quote for optionMarket to perform transferFrom (of optionMarket)
    quoteAsset.approve(address(optionMarket), type(uint).max);
    // transfer amount of the strike
    quoteAsset.transferFrom(msg.sender, address(this), price);
    // call position
    _openNewPosition(strikeId, OptionType(uint(0)), size);
    // put position
    _openNewPosition(strikeId, OptionType(uint(1)), size);
  }

  function _openNewPosition(
    uint strikeId,
    OptionType optionType,
    uint amount
  ) internal {
    TradeInputParameters memory tradeParams = TradeInputParameters({
      strikeId: strikeId,
      positionId: 0, // if 0, new position is created
      iterations: 1, // more iterations use more gas but incur less slippage
      optionType: optionType,
      amount: amount,
      setCollateralTo: 0, // set to 0 if opening long
      minTotalCost: 0,
      maxTotalCost: 5 ether,
      rewardRecipient: address(0)
    });

    TradeResult memory result = _openPosition(tradeParams); // built-in LyraAdapter.sol function
    activePositionIds.push(result.positionId);
  }
}
