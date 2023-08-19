// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;
import {LyraAdapter} from "@lyrafinance/protocol/contracts/periphery/LyraAdapter.sol";
import {OptionMarket} from "@lyrafinance/protocol/contracts/OptionMarket.sol";
// Libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleTrader is LyraAdapter {
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

   function buyStraddle(uint strikeId, uint size)
   public
   returns (
     uint positionId,
     uint premiumPayed,
     uint capitalUsed
   )
 {
   // premium willing to pay
   (uint callPremium, uint putPremium)= _getPurePremiumForStrike(strikeId);
   uint priceCall = callPremium + (callPremium * 10 / 100);

   require(
    quoteAsset.transferFrom(msg.sender, address(this), priceCall),
     "quote asset transfer failed for call"
   );

   (positionId, premiumPayed) = _buyStrike(strikeId, priceCall, size, OptionType(uint(0)));
   capitalUsed = premiumPayed;
 }

 function _buyStrike(
  uint strikeId,
  uint maxPremium,
  uint size,
  OptionType optionType
) internal returns (uint, uint) {
  // perform trade to long
  TradeResult memory result = _openNewPosition(strikeId, maxPremium, size, optionType);

  // update active strikes
  activePositionIds.push(result.positionId);

  require(result.totalCost <= maxPremium, "premium too high");

  return (result.positionId, result.totalCost);
}

function _openNewPosition(
  uint strikeId,
  uint maxPremium,
  uint size,
  OptionType optionType
) internal returns (TradeResult memory){
  TradeInputParameters memory tradeParams = TradeInputParameters({
    strikeId: strikeId,
    positionId: 0, // if 0, new position is created
    iterations: 1, // more iterations use more gas but incur less slippage
    optionType: optionType,
    amount: size,
    setCollateralTo: 0, // set to 0 if opening long
    minTotalCost: 0,
    maxTotalCost: maxPremium,
    rewardRecipient: address(0)
  });

  TradeResult memory result = _openPosition(tradeParams);
  
  return result;
  }
}