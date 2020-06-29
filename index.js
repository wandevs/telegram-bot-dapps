const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const { token, chatId } = require('./config');
const jackspotAbi = require('./jackspot-abi.json');
const wandoraBoxAbi = require('./wandora-abi.json');
const { getWeb3, isSwitchFinish } = require('./web3switch');
const { promisify } = require('util')
const sleep = promisify(setTimeout)


// replace the value below with the Telegram token you receive from @BotFather
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// * * * * * *
// second minute hour day month dayOfWeek
const robotSchedules = () => {
    // update: The settlement robot calls this function daily to update the capital pool and settle the pending refund.
    schedule.scheduleJob('0 0 6,18 * * *', async () => {
        let msg = await getJacksPotInfos();
        console.log(msg);
        await bot.sendMessage(chatId, msg);
    });

    schedule.scheduleJob('0 0 3,15 * * *', async () => {
      let wandoraMsg = await getWandoraBoxInfos();
      console.log(wandoraMsg);
      await bot.sendMessage(chatId, wandoraMsg);
  });
}

robotSchedules();

let messageModel = `
🌟 Jack's Pot Insight $DATE$ 🌟
  Jackpot:    $PRIZE_POOL$ WAN
  Pool:         $TOTAL_POOL$ WAN
  Players:     $TOTAL_PLAYER$
  Tickets:     $TOTAL_TICKETS$

🔍 Last Round 🔍
  Win Number: $WIN_NUMBER$
  Prize:            $PAID_PRIZE$
  Winners:       $WINNERS$

🚀🚀🚀🚀🚀
( Welcome to play Jack's Pot in Wan Wallet DApps or in website https://jackspot.finnexus.app/ )`

let messageModel2 = `
Wandora Box DApp Stats - $DATE$

---- Price Predication Product Wandora Box ----

24 hour WAN volume: $WANDORA_AMOUNT$ WAN

(Try the app for yourself at https://wandora.finnexus.app/ or through the DApp store in the official Wanchain Desktop Light Wallet!)
-----------------------------------------------`;

const jacksPotSC = "0x76b074d91f546914c6765ef81cbdc6f9c7da5685";
const wandoraBoxWan2BtcSC = "0xdfad0145311acb8f0e0305aceef5d11a05df9aa0";


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
  if (Math.abs(timeError) <= 60){
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
    while(timeError < -60) {
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
  

  let sc = new web3.eth.Contract(wandoraBoxAbi, wandoraBoxWan2BtcSC);

  let funcs = [];
  funcs.push(sc.getPastEvents('StakeIn', { fromBlock: correctBlockNumber }));
  const [StakeInHistory] = await Promise.all(funcs);

  let totalVolume = StakeInHistory.reduce((sum, item) => sum + Number(item.returnValues.stakeAmount), 0) / 10e17
  
  msg=msg.replace("$WANDORA_AMOUNT$", totalVolume);
  msg=msg.replace("$DATE$", new Date().toISOString().split('T')[0]);
  return msg;
}


async function getJacksPotInfos() {
    let msg = messageModel;

    while (true) {
        if (isSwitchFinish()) {
            break;
        }
        await sleep(100);
    }

    msg=msg.replace("$DATE$", new Date().toISOString().split('T')[0]);

    let web3 = getWeb3();
    let sc = new web3.eth.Contract(jackspotAbi, jacksPotSC);


    let funcs = [];
    funcs.push(sc.methods.poolInfo().call());
    funcs.push(sc.getPastEvents('Buy', { fromBlock: 8865321 }));
    funcs.push(sc.getPastEvents('LotteryResult', { fromBlock: 8865321 }));

    const [poolInfo, buyEvents, settleEvents] = await Promise.all(funcs);

    let totalPool = (Number(web3.utils.fromWei(poolInfo.delegatePool)) + Number(web3.utils.fromWei(poolInfo.demandDepositPool)) + Number(web3.utils.fromWei(poolInfo.prizePool))).toFixed(1);
    let pricePool = Number(web3.utils.fromWei(poolInfo.prizePool)).toFixed(1);
    msg=msg.replace("$TOTAL_POOL$", totalPool);
    msg=msg.replace("$PRIZE_POOL$", pricePool);

    let winCode = 0;
    let winCount = 0;

    winCount = Number(settleEvents[settleEvents.length - 1].returnValues.amounts[0]) > 0 ? settleEvents[settleEvents.length - 1].returnValues.amounts.length : 0;
    winCode = settleEvents[settleEvents.length - 1].returnValues.winnerCode;
    let paid_prize = Number(web3.utils.fromWei(settleEvents[settleEvents.length - 1].returnValues.prizePool)).toFixed(1);
    
    msg=msg.replace('$WIN_NUMBER$', winCode);
    msg=msg.replace('$WINNERS$', winCount);
    msg=msg.replace('$PAID_PRIZE$', paid_prize);


    let playerData = [];
    funcs = [];
    for (let i=0; i<buyEvents.length; i++) {
      funcs.push(sc.methods.getUserCodeList(buyEvents[i].returnValues.user).call());
    }

    let users = await Promise.all(funcs);

    let addresses = [];
    let tickets = [];
    let tmpTickets = [];
    for (let i=0; i<buyEvents.length; i++) {
      let totalStakeAmount = 0;
      for (let m=0; m<users[i].amounts.length; m++) {
        totalStakeAmount += Number(web3.utils.fromWei(users[i].amounts[m]));
      }

      let one = {
        address: buyEvents[i].returnValues.user.toLowerCase(),
        ticketsCount: users[i].codes.length,
        totalStakeAmount,
        key: i
      };

      if (Number(one.ticketsCount) > 0 && Number(one.totalStakeAmount) > 0 && !addresses.includes(one.address)) {
        playerData.push(one);
        addresses.push(one.address);
        for (let m=0; m<users[i].codes.length; m++) {
          if (!tmpTickets.includes(users[i].codes[m])) {
            tmpTickets.push(users[i].codes[m]);
            tickets.push({
              ticket:Number(users[i].codes[m]),
              count:1,
              stake: Number(web3.utils.fromWei(users[i].amounts[m]))
            });
          } else {
            let id = tmpTickets.indexOf(users[i].codes[m]);
            tickets[id].count++;
            tickets[id].stake += Number(web3.utils.fromWei(users[i].amounts[m]));
          }
        }
      }
    }

    msg=msg.replace("$TOTAL_TICKETS$", tickets.length.toString());
    msg=msg.replace("$TOTAL_PLAYER$", playerData.length.toString());

    // console.log('msg', msg);

    return msg;
}

