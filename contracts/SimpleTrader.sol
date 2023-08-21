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
     uint capitalUsed,
     uint positionId2,
     uint premiumPayed2,
     uint capitalUsed2
   )
 {
   // premium willing to pay
   (uint callPremium, uint putPremium)= _getPurePremiumForStrike(strikeId);
   uint priceCall = callPremium + (callPremium * 10 / 100);
   uint pricePut = putPremium + (putPremium * 10 / 100);
  
   require(
    quoteAsset.transferFrom(msg.sender, address(this), priceCall),
     "quote asset transfer failed"
   );
   (positionId, premiumPayed) = _buyStrike(strikeId, priceCall, size, OptionType(uint(0)));

   require(
    quoteAsset.transferFrom(msg.sender, address(this), pricePut),
     "quote asset transfer failed"
   );
   (positionId2, premiumPayed2) = _buyStrike(strikeId, pricePut, size, OptionType(uint(1)));

   capitalUsed = premiumPayed;
   capitalUsed2 = premiumPayed2;

   // refund the user 
   uint remaining = (priceCall + pricePut) - (premiumPayed + premiumPayed2);
   require(quoteAsset.transfer(msg.sender, remaining));
 }

 function getPremium(uint strikeId) public view returns (
  uint callPremium,
  uint putPremium)
  {
    (callPremium, putPremium)= _getPurePremiumForStrike(strikeId);
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