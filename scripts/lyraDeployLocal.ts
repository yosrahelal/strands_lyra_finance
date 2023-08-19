import { lyraConstants, getGlobalDeploys, getMarketDeploys, lyraDefaultParams, lyraUtils, TestSystem } from '@lyrafinance/protocol';
import { toBN } from '@lyrafinance/protocol/dist/scripts/util/web3utils';
import { DeployOverrides } from '@lyrafinance/protocol/dist/test/utils/deployTestSystem';
import { DeltaLongStrategyDetailStruct } from '../typechain-types/DeltaLongStrategy';
import { ethers } from 'hardhat';
import { PricingParametersStruct } from '@lyrafinance/protocol/dist/typechain-types/OptionMarketViewer';
import { TestSystemContractsType } from '@lyrafinance/protocol/dist/test/utils/deployTestSystem';

async function main() {
  ////////////////////////////////////////////////////
  // FIRST STEP - Deployment of a local test system //
  ///////////////////////////////////////////////////

  // run `npx hardhat node` in terminal
  // 1. get local deployer and network
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  const [deployer, manager, randomUser, randomUser2] = await ethers.getSigners();

  provider.getGasPrice = async () => {
    return ethers.BigNumber.from('0');
  };
  provider.estimateGas = async () => {
    return ethers.BigNumber.from(15000000);
  }; // max limit to prevent run out of gas errors

  // 2. deploy and seed market with overrides
  const exportAddresses = true;
  const enableTracer = false;
  const overrides: DeployOverrides = {
    minCollateralParams: {
      ...lyraDefaultParams.MIN_COLLATERAL_PARAMS,
      minStaticBaseCollateral: lyraUtils.toBN('0.001'),
    },
    pricingParams: {
      ...lyraDefaultParams.PRICING_PARAMS,
      standardSize: toBN('10'),
      spotPriceFeeCoefficient: toBN('0.001'),
    }
  };

  const localTestSystem = await TestSystem.deploy(deployer, enableTracer, exportAddresses, overrides);

  // testing parameters
  const spotPrice = toBN('3000');
  let boardId = ethers.BigNumber.from(0);
  const boardParameter = {
    expiresIn: lyraConstants.DAY_SEC * 7,
    baseIV: '0.9',
    strikePrices: ['2500', '3000', '3200', '3300', '3350', '3500'],
    skews: ['0.9', '0.8', '0.7', '0.8', '0.9', '0.9'],
  };
  const initialPoolDeposit = toBN('1500000'); // 1.5m

  await TestSystem.seed(deployer, localTestSystem,
    {
      initialBoard: boardParameter,
      initialBasePrice: spotPrice,
      initialPoolDeposit: initialPoolDeposit,
    });

  const boards = await localTestSystem.optionMarket.getLiveBoards();
  boardId = boards[0];

  await localTestSystem.optionGreekCache.updateBoardCachedGreeks(boardId);
  ////////////////////////////////////////////////////
  // SECOND STEP - Buy a call option strike id 1   //
  ///////////////////////////////////////////////////

  // 1. get global contracts
  const lyraGlobal = await getGlobalDeploys('local');
  console.log('contract name:', lyraGlobal.SynthetixAdapter.contractName);
  console.log('address:', lyraGlobal.SynthetixAdapter.address);

  // 2. get market contracts
  const lyraMarket = await getMarketDeploys('local', 'sETH');
  console.log('contract name:', lyraMarket.OptionMarket.contractName);
  console.log('address:', lyraMarket.OptionMarket.address);

  const sUSD = new ethers.Contract(lyraGlobal.QuoteAsset.address, lyraGlobal.QuoteAsset.abi, deployer);
  console.log('contract name:', lyraGlobal.QuoteAsset.contractName);
  console.log('address :', sUSD.address);

  // 3.  open position (long put position on the board 1 and strike 1)
  
  const tradeInputForCALL = {
    strikeId: 4,
    positionId: 0,
    amount: toBN('1'),
    setCollateralTo: toBN('0'),
    iterations: 1,
    optionType: TestSystem.OptionType.LONG_PUT,
    minTotalCost: toBN('0'),
    maxTotalCost: toBN('500'),
  };

  const tx1 = await localTestSystem.optionMarket.openPosition(tradeInputForCALL);
  console.log('Tx for opening call position ', (await tx1.wait()).transactionHash);

  //////////////////////////////////////////////////////////////////
  // THIRD STEP - Buy a call and a put with buyStraddle function  //
  /////////////////////////////////////////////////////////////////
  let vaultParams = 
  {
    decimals: 18,
    cap: toBN('5000000'),
    asset: sUSD.address,
  };

  // 1. deploy TraderExample smart contract to buy the two positions
  const TraderExample = await ethers.getContractFactory('Trader');
  const trader = await TraderExample.deploy(
    sUSD.address,
    manager.address,
    lyraConstants.DAY_SEC * 7,
    'LyraVault Share',
    'Lyra VS',
    vaultParams,
  );
  await trader.deployed();

  console.log(`TraderExample with deployed to ${trader.address}`);

  // 2. deploy strategy 
  const LongStrategyExample = await ethers.getContractFactory('LongStrategy',
  {
    libraries: {
      BlackScholes: localTestSystem.blackScholes.address,
    },
  });
  const strategy = await LongStrategyExample.deploy(
    trader.address, TestSystem.OptionType.LONG_CALL
  );
  await strategy.deployed();

  console.log(`LongStrategyExample with deployed to ${strategy.address}`);

  // 3. init strategy 
  await strategy.initAdapter(
    localTestSystem.lyraRegistry.address,
    localTestSystem.optionMarket.address,
    localTestSystem.testCurve.address,
    localTestSystem.basicFeeCounter.address,
  );
  
  // 4. link strategy to the vault
  await trader.setStrategy(strategy.address);

  // 5. set strategy details
  const strategyDetail: DeltaLongStrategyDetailStruct = {
    minTradeInterval: 600,
    maxVolVariance: toBN('0.1'),
    gwavPeriod: 600,
    minTimeToExpiry: lyraConstants.DAY_SEC,
    maxTimeToExpiry: lyraConstants.WEEK_SEC * 2,
    targetDelta: toBN('0.15'),
    maxDeltaGap: toBN('0.05'), // accept delta from 0.1~0.2
    minVol: toBN('0.6'), // min vol to buy. (also used to calculate max premium for call buying vault)
    maxVol: toBN('0.9'), // max vol to buy.
    size: toBN('10'),
  };

  // some checks about the strike details before calling buyStraddle
  boardId = boards[0];

  let strikes = await localTestSystem.optionMarket.getBoardStrikes(boardId);

  await strategy.setStrategyDetail(strategyDetail);

  // 6. start first  round
  await sUSD.mint(randomUser.address, toBN('1000000'));
  await sUSD.mint(randomUser2.address, toBN('1000000'));
  
  // user 1 deposits
  await sUSD.connect(randomUser).approve(trader.address, lyraConstants.MAX_UINT);
  await trader.connect(randomUser).deposit(toBN('50000'));
  // user 2 deposits
  await sUSD.connect(randomUser2).approve(trader.address, lyraConstants.MAX_UINT);
  await trader.connect(randomUser2).deposit(toBN('50000'));

  await trader.startNextRound(boards[0]);

  // 7. make a trade long from user 1 
  let strategySUSDBalanceBefore = await sUSD.balanceOf(strategy.address);
  console.log("strategy balance before buy", strategySUSDBalanceBefore);

  await trader.connect(randomUser).buyStraddle(toBN('10'), strikes[4]);

  let strategySUDCBalanceAfter = await sUSD.balanceOf(strategy.address);
  console.log("strategy balance after buy", strategySUDCBalanceAfter);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
