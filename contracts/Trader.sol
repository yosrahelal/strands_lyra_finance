// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.9;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LyraVault} from "./core/LyraVault.sol";
import {Vault} from "./libraries/Vault.sol";

import {IStrategy} from "./interfaces/IStrategy.sol";

contract Trader is LyraVault {

  constructor(
    address _susd,
    address _feeRecipient,
    uint _roundDuration,
    string memory _tokenName,
    string memory _tokenSymbol,
    Vault.VaultParams memory _vaultParams
  ) LyraVault(_susd, _feeRecipient, _roundDuration, _tokenName, _tokenSymbol, _vaultParams) {
  }

  function buyStraddle(uint size, uint strikeId) public {
    require(vaultState.roundInProgress, "round closed");
    // perform trade through strategy
    (uint positionId, uint premiumReceived, uint capitalUsed) = strategy.doTrade(strikeId, lyraRewardRecipient, size);

    // update the remaining locked amount
    vaultState.lockedAmountLeft = vaultState.lockedAmountLeft - capitalUsed;

    // todo: udpate events
    emit Trade(msg.sender, positionId, premiumReceived, capitalUsed);
  }

}
