import { getGlobalDeploys, getMarketDeploys, lyraDefaultParams, lyraUtils, TestSystem } from '@lyrafinance/protocol';
import { toBN } from '@lyrafinance/protocol/dist/scripts/util/web3utils';
import { DeployOverrides } from '@lyrafinance/protocol/dist/test/utils/deployTestSystem';
import { ethers } from 'hardhat';

async function main() {
  ////////////////////////////////////////////////////
  // FIRST STEP - Deployment of a local test system //
  ///////////////////////////////////////////////////

  // run `npx hardhat node` in terminal
  // 1. get local deployer and network
  const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  const [deployer] = await ethers.getSigners();

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
  };

  const localTestSystem = await TestSystem.deploy(deployer, enableTracer, exportAddresses, overrides);
  await TestSystem.seed(deployer, localTestSystem);

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
    strikeId: 1,
    positionId: 0,
    amount: toBN('1'),
    setCollateralTo: toBN('0'),
    iterations: 1,
    optionType: TestSystem.OptionType.LONG_CALL,
    minTotalCost: toBN('0'),
    maxTotalCost: toBN('500'),
  };

  const tx1 = await localTestSystem.optionMarket.openPosition(tradeInputForCALL);
  console.log('Tx for opening call position ', (await tx1.wait()).transactionHash);

  //////////////////////////////////////////////////////////////////
  // THIRD STEP - Buy a call and a put with buyStraddle function  //
  /////////////////////////////////////////////////////////////////

  // some checks about the strike details before calling buyStraddle
  let boardIds = await localTestSystem.optionMarket.getLiveBoards();
  let strikeIds = await localTestSystem.optionMarket.getBoardStrikes(boardIds[0]);
  let strike1 = await localTestSystem.optionMarket.getStrike(strikeIds[0]);
  console.log('strike 1 details ', strike1);

  // 1. deploy TraderExample smart contract to buy the two positions
  const TraderExample = await ethers.getContractFactory('SimpleTrader',
  {
    libraries: {
      BlackScholes: localTestSystem.blackScholes.address,
    },
  });
  const trader = await TraderExample.deploy();
  await trader.deployed();

  console.log(`TraderExample with deployed to ${trader.address}`);

  // 2. init Lyra adapter and optionMarket
  await trader.initAdapter(
    localTestSystem.lyraRegistry.address,
    localTestSystem.optionMarket.address,
    localTestSystem.testCurve.address,
    localTestSystem.basicFeeCounter.address,
  );

  // some checks
  let balanceBefore = await sUSD.balanceOf(deployer.address);
  let balanceBefore1 = await sUSD.balanceOf(localTestSystem.optionMarket.address);
  console.log('balance before buy : ', balanceBefore);
  console.log('balance option market before buy : ', balanceBefore1);

  // 3. buy position
  await sUSD.approve(trader.address, toBN('5000'));
  await trader.buyStraddle(1, toBN('1'));

  // some checks about the strike details after calling buyStraddle
  boardIds = await localTestSystem.optionMarket.getLiveBoards();
  strikeIds = await localTestSystem.optionMarket.getBoardStrikes(boardIds[0]);
  strike1 = await localTestSystem.optionMarket.getStrike(strikeIds[0]);
  console.log('strike 1 details', strike1);

  let balanceAfter = await sUSD.balanceOf(deployer.address);
  let balanceAfter1 = await sUSD.balanceOf(localTestSystem.optionMarket.address);
  console.log('balance after buy: ', balanceAfter);
  console.log('balance market after buy: ', balanceAfter1);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });