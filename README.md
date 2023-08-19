# Lyra finance project (for testing locally)

### Run hardhat node 
```
npx hardhat node
```

# First method - without vault
### SimpleTrader.sol
is a lyraAdapter to perform some buy on the AMM

### Script Outputs 
```shell 
npx hardhat run scripts/deploy.ts --network local
```
```
contract name: SynthetixAdapter
address: 0x07C5b1Ce71F98b75d3b32746882fa717d0b262cc
contract name: OptionMarket
address: 0x6672CedbF8dAfcC50B21EB36b8A86fA36b33e055
contract name: ProxyERC20sUSD
address : 0x9E75B06188B417512Bd9d1751b5cA21507D1Fc66
Tx for opening call position  0x993dfe60d69399dca092e781917cdd9490e31811fc35ac22026205fa697c3a94
strike 1 details  [
  BigNumber { value: "1" },
  BigNumber { value: "1500000000000000000000" },
  BigNumber { value: "901500000000000000" },
  BigNumber { value: "1000000000000000000" },
  BigNumber { value: "0" },
  BigNumber { value: "0" },
  BigNumber { value: "0" },
  BigNumber { value: "0" },
  BigNumber { value: "1" },
  id: BigNumber { value: "1" },
  strikePrice: BigNumber { value: "1500000000000000000000" },
  skew: BigNumber { value: "901500000000000000" },
  longCall: BigNumber { value: "1000000000000000000" },
  shortCallBase: BigNumber { value: "0" },
  shortCallQuote: BigNumber { value: "0" },
  longPut: BigNumber { value: "0" },
  shortPut: BigNumber { value: "0" },
  boardId: BigNumber { value: "1" }
]
TraderExample with deployed to 0x61Ecf089F2Bb3BE350AC4914aDFe3e158a4c5755
balance before buy :  BigNumber { value: "999664852324552754975039" }
balance option market before buy :  BigNumber { value: "2103762948565260844" }
strike 1 details [
  BigNumber { value: "1" },
  BigNumber { value: "1500000000000000000000" },
  BigNumber { value: "903000000000000000" },
  BigNumber { value: "2000000000000000000" },
  BigNumber { value: "0" },
  BigNumber { value: "0" },
  BigNumber { value: "0" },
  BigNumber { value: "0" },
  BigNumber { value: "1" },
  id: BigNumber { value: "1" },
  strikePrice: BigNumber { value: "1500000000000000000000" },
  skew: BigNumber { value: "903000000000000000" },
  longCall: BigNumber { value: "2000000000000000000" },
  shortCallBase: BigNumber { value: "0" },
  shortCallQuote: BigNumber { value: "0" },
  longPut: BigNumber { value: "0" },
  shortPut: BigNumber { value: "0" },
  boardId: BigNumber { value: "1" }
]
balance after buy:  BigNumber { value: "999319331529120162528158" }
balance market after buy:  BigNumber { value: "4208077958199588328" }
```
![Alt text](img/simpleScript1.png)
![Alt text](img/simpleScript2.png)

### Run Tests and Outputs
```
npx hardhat test test/simple-trader-tests.ts --network local
```
![Alt text](img/simpleTradeTests.png)

# Second method - with vault 
### Run script to test the workflow
```shell 
npx hardhat run scripts/lyraDeployLocal.ts --network local
```
### Trader.sol
is a lyraVault to perform some buy on the AMM

### LongStrategy.sol
is a strategy to perform a buy on the AMM from the vault 

### Script Outputs 
```
contract name: SynthetixAdapter
address: 0xEE235dDFd4206Cf279cC9423253315013e85A380
contract name: OptionMarket
address: 0xB369f12CDfd924350bFB5E4B1Ff52Bc266CCd46A
contract name: ProxyERC20sUSD
address : 0xA82E7060a8bD3CEe464437BFdb0Ccf7Cd9c04387
Tx for opening call position  0x0a964d8d78936e5e9d86e090360b9eaa32c4575f23ff23e86c1d1469bd2ef5b9
TraderExample with deployed to 0x6C0A0d099179fD5A51406f515F5F2b6FC2E9F90e
LongStrategyExample with deployed to 0x4BE63C56f4317B35409e5B2a3d1B7A92b8cA67B5
strategy balance before buy BigNumber { value: "0" }
```
![Alt text](img/scriptWithVault.png)

### Run Tests and Outputs
```
npx hardhat test test/trader-test.ts --network local
```
![Alt text](img/tradeWithVaultTests.png)
