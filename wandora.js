const TelegramBot = require('node-telegram-bot-api');
const { token, chatId } = require('./config');
const jackspotAbi = require('./jackspot-abi.json');
const { getWeb3, isSwitchFinish } = require('./web3switch');

// replace the value below with the Telegram token you receive from @BotFather
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });


let messageModel2 = `
🌟 Wandora Box DApp Stats - $DATE$ 🌟

---- Wandora Box Price Prediction DApp ----

🔍 24 Hour Volume: 🔍

WAN/BTC: $WAN_TO_BTC$ WAN
BTC/USD: $BTC_TO_USD$ WAN
BTC/USD: $ETH_TO_USD$ WAN

(Try the app for yourself at https://wandora.finnexus.app/ or through the DApp store in the official Wanchain Desktop Light Wallet!)
-----------------------------------------------`;

const wandoraBoxWan2BtcSC = "0xdfad0145311acb8f0e0305aceef5d11a05df9aa0";
const wandoraBoxBtc2UsdSC = "0x68f7ac0a94c553d86a606abd115e2128750335e1";
const wandoraBoxEth2UsdSC = "0x9f2f486de9ce5519ac54032c66c0f9d9670f7d87";


async function getWandoraBoxInfos() {
  let msg = messageModel2;

  while (true) {
    if (isSwitchFinish()) {
      break;
    }
    await sleep(100);
  }

  let web3 = getWeb3();

  const currentBlockNumber = await web3.eth.getBlockNumber()

  // The estimated number of the block with a timestamp 24 hours from now based on an assumption of a 5 second block time
  let estimateBlockNumber = currentBlockNumber - 17280
  let correctBlockNumber
  let estimateBlockDetails = await web3.eth.getBlock(estimateBlockNumber)
  let estimateBlockTime = estimateBlockDetails.timestamp
  // Total number of seconds between current time and timestamp of estimated block
  let secondsElapsed = (Date.now() / 1000) - estimateBlockTime
  // The target for secondsElapsed is 24 hours. timeError is the error in seconds based on the first estimatedBlockTime
  // 86400 seconds in one day
  let timeError = 86400 - secondsElapsed
  if (Math.abs(timeError) <= 60) {
    correctBlockNumber = estimateBlockNumber
  }
  // A positive time error means that secondsElapsed is too short, and estimateBlockTime is too late / estimateBlockNumber is too high
  else if (timeError > 60) {
    while (timeError > 60) {
      let timeErrorDivisor = 2
      let blockStepFound = false
      while (!blockStepFound) {
        let timeStep = timeError / timeErrorDivisor
        let blockStep = Math.round(timeStep / 5)
        let newEstimateBlockNumber = estimateBlockNumber - blockStep
        estimateBlockNumber = newEstimateBlockNumber
        let newEstimateBlockDetails = await web3.eth.getBlock(newEstimateBlockNumber)
        // The newSecondsElapsed should be larger than the secondsElapsed 
        let newSecondsElapsed = (Date.now() / 1000) - newEstimateBlockDetails.timestamp
        // If newSecondsElapsed is larger than a day (86400 seconds), we should reduce the size of the time step, and repeat the while loop
        if (newSecondsElapsed > 86400) {
          timeErrorDivisor /= 2
        }
        // If newSecondsElapsed is less than a day of seconds, then we found a blockstep which lets us increase the newSecondsElapsed without going over 24 hours
        // We calculate a new timeError using newSecondsElapsed, which will be smaller than the original time error
        // This continues untill the timeError is less than 60 seconds, breaking the parent loop
        else if (newSecondsElapsed <= 86400) {
          blockStepFound = true
          timeError = 86400 - newSecondsElapsed
        }
      }
    }
    correctBlockNumber = estimateBlockNumber
  }
  else if (timeError < -60) {
    while (timeError < -60) {
      let timeErrorDivisor = 2
      let blockStepFound = false
      while (!blockStepFound) {
        let timeStep = timeError / timeErrorDivisor
        let blockStep = Math.round(timeStep / 5)
        let newEstimateBlockNumber = estimateBlockNumber - blockStep
        estimateBlockNumber = newEstimateBlockNumber
        let newEstimateBlockDetails = await web3.eth.getBlock(newEstimateBlockNumber)
        let newSecondsElapsed = (Date.now() / 1000) - newEstimateBlockDetails.timestamp

        if (newSecondsElapsed < 86400) {
          timeErrorDivisor /= 2
        }
        else if (newSecondsElapsed >= 86400) {
          blockStepFound = true
          timeError = 86400 - newSecondsElapsed
        }
      }
    }
    correctBlockNumber = estimateBlockNumber
  }


  let wan2BtcSC = new web3.eth.Contract(wandoraBoxAbi, wandoraBoxWan2BtcSC);
  let btc2UsdSC = new web3.eth.Contract(wandoraBoxAbi, wandoraBoxBtc2UsdSC);
  let Eth2UsdSC = new web3.eth.Contract(wandoraBoxAbi, wandoraBoxEth2UsdSC);

  async function getTotalVolume(sc) {
    let funcs = [];
    funcs.push(sc.getPastEvents('StakeIn', { fromBlock: correctBlockNumber }));
    const [StakeInHistory] = await Promise.all(funcs);
    let totalVolume = StakeInHistory.reduce((sum, item) => sum + Number(item.returnValues.stakeAmount), 0) / 10e17
    return totalVolume
  }

  wan2BtcTotal = await getTotalVolume(wan2BtcSC)
  btc2UsdTotal = await getTotalVolume(btc2UsdSC)
  Eth2UsdTotal = await getTotalVolume(Eth2UsdSC)

  msg = msg.replace("$WAN_TO_BTC$", wan2BtcTotal);
  msg = msg.replace("$BTC_TO_USD$", btc2UsdTotal);
  msg = msg.replace("$ETH_TO_USD$", Eth2UsdTotal);
  msg = msg.replace("$DATE$", new Date().toISOString().split('T')[0]);
  return msg;
}

async function main() {
  let msg = await getWandoraBoxInfos();
  console.log(msg);
  await bot.sendMessage(chatId, msg);
  process.exit(0);
}

main();
