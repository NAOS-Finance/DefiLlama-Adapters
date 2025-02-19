const sdk = require("@defillama/sdk");
const { ethereumContractData, polygonContractData, avaxContractData, bscContractData } = require("./config");
const BigNumber = require("bignumber.js");
const { getTokensAndLPsTrackedValue } = require("../helper/unicrypt");

function getTvl(args) {
  return async (timestamp, ethBlock, chainBlocks) => {
    let totalBalances = {}
    for (let i = 0; i < args.length; i++) {

      const contractAddress = args[i].contract
      const abi = args[i].contractABI
      const balances = {};
      const chain = args[i].chain
      const block = chainBlocks[chain]
      const factory = args[i].factory
      const trackedTokens = args[i].trackedTokens
      const totalDepositId = Number(
        (
          await sdk.api.abi.call({
            abi: abi.depositId,
            target: contractAddress,
            chain: chain,
            block: block 
          })
        ).output
      );
        
      let lockedLPs = [];
      const allDepositId = Array.from(Array(totalDepositId).keys());
      const lpAllTokens = (
        await sdk.api.abi.multiCall({
          abi: abi.getDepositDetails,
          calls: allDepositId.map((num) => ({
            target: contractAddress,
            params: num,
          })),
          chain: chain,
          block: block 
        })
      ).output 

      lpAllTokens.forEach(lp => {
        if (lp.success) {
          const lpToken = lp.output[0].toLowerCase()
          lockedLPs.push(lpToken)
        }
      })  

      const lpFilterTokens = lockedLPs.sort().filter(function (item, pos, ary) {
        return (!pos || item != ary[pos - 1]) && item != "0x0000000000000000000000000000000000000000";
      });

      await getTokensAndLPsTrackedValue(balances, lpFilterTokens, contractAddress, factory, trackedTokens, block, chain)

      for (const [token, balance] of Object.entries(balances)) {
        if (!totalBalances[token]) totalBalances[token] = '0'
        totalBalances[token] = BigNumber(totalBalances[token]).plus(BigNumber(balance)).toFixed(0)
      }
    }
    return totalBalances
  }
};

module.exports = {
  methodology: `Counts each LP pair's native token and 
  stable balance, adjusted to reflect locked pair's value. 
  Balances and merged across multiple locker to return sum TVL per chain`,
  ethereum: {
    tvl: getTvl(ethereumContractData),
  },
  bsc: {
    tvl: getTvl(bscContractData),
  },
  polygon: {
    tvl: getTvl(polygonContractData),
  },
  avax: {
    tvl: getTvl(avaxContractData),
  },
};

