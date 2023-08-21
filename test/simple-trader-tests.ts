import { lyraUtils, lyraDefaultParams, lyraEvm, TestSystem } from '@lyrafinance/protocol';
import { toBN } from '@lyrafinance/protocol/dist/scripts/util/web3utils';
import { TestSystemContractsType } from '@lyrafinance/protocol/dist/test/utils/deployTestSystem';
import { PricingParametersStruct } from '@lyrafinance/protocol/dist/typechain-types/OptionMarketViewer';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { SimpleTrader } from '../typechain-types';
import { MockERC20 } from '../typechain-types/MockERC20';
import { DeployOverrides } from '@lyrafinance/protocol/dist/test/utils/deployTestSystem';


describe('Trader integration test', async () => {
  // mocked tokens
  let susd: MockERC20;

  let lyraTestSystem: TestSystemContractsType;
  let trader: SimpleTrader;

  // roles
  let deployer: SignerWithAddress;
  let manager: SignerWithAddress;
  let randomUser: SignerWithAddress;
  let randomUser2: SignerWithAddress;

  // testing parameters
  let boardId = BigNumber.from(0);
  const exportAddresses = true;
  const enableTracer = false;
  const overrides: DeployOverrides = {
    minCollateralParams: {
      ...lyraDefaultParams.MIN_COLLATERAL_PARAMS,
      minStaticBaseCollateral: lyraUtils.toBN('0.001'),
    },
  };

  before('assign roles', async () => {
    const addresses = await ethers.getSigners();
    deployer = addresses[0];
    manager = addresses[1];
    randomUser = addresses[8];
    randomUser2 = addresses[9];
  });

  before('deploy lyra core', async () => {
    lyraTestSystem = await TestSystem.deploy(deployer, enableTracer, exportAddresses, overrides);

    await TestSystem.seed(deployer, lyraTestSystem);

    // assign test tokens
    susd = lyraTestSystem.snx.quoteAsset as MockERC20;

    // set boardId
    const boards = await lyraTestSystem.optionMarket.getLiveBoards();
    boardId = boards[0];

    // fast forward do vol gwap can work
    await lyraEvm.fastForward(600);
  });

  before('deploy trader', async () => {
    const Trader = await ethers.getContractFactory('SimpleTrader',
    {
        libraries: {
          BlackScholes: lyraTestSystem.blackScholes.address,
        },
    });

    const cap = toBN('5000000');
    const decimals = 18;

    trader = (await Trader.connect(manager).deploy()) as SimpleTrader;
  });

  before('initialize trader and adaptor', async () => {
    await trader.initAdapter(
      lyraTestSystem.lyraRegistry.address,
      lyraTestSystem.optionMarket.address,
      lyraTestSystem.testCurve.address, // curve swap
      lyraTestSystem.basicFeeCounter.address,
    );
  });

  describe('Do a trade', async () => {
    let strikes: BigNumber[] = [];
    before('create fake susd for users', async () => {
      await susd.mint(randomUser.address, toBN('1000000'));
      await susd.connect(randomUser).approve(trader.address, toBN('5000'));

    });
    before('set strikes array', async () => {
      strikes = await lyraTestSystem.optionMarket.getBoardStrikes(boardId);
    });

    it('should trade when delta and vol are within range', async () => {
      const userSUSDBalance = await susd.balanceOf(randomUser.address);
      const marketSUSDBalance = await susd.balanceOf(lyraTestSystem.optionMarket.address);
      expect(marketSUSDBalance.isZero()).to.be.true;

      await trader.connect(randomUser).buyStraddle(strikes[0], toBN('0.5'));

      const marketSUDCBalanceAfter = await susd.balanceOf(lyraTestSystem.optionMarket.address);    
      // check that we receive sUSD
      expect(marketSUDCBalanceAfter.sub(marketSUSDBalance).gt(0)).to.be.true;

      // check that the trader refunded all the sUSD 
      const traderBalanceAfter = await susd.balanceOf(trader.address);
      expect(traderBalanceAfter.isZero()).to.be.true;
    });
  });
});