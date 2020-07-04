const TelegramBot = require('node-telegram-bot-api');
const { token, chatId } = require('./config');
const jackspotAbi = require('./jackspot-abi.json');
const { getWeb3, isSwitchFinish } = require('./web3switch');

// replace the value below with the Telegram token you receive from @BotFather
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

let messageModel = `
🌟Jack's Pot Insight $DATE$🌟
  Jackpot:    $PRIZE_POOL$ WAN
  Pool:         $TOTAL_POOL$ WAN
  Players:     $TOTAL_PLAYER$
  Tickets:     $TOTAL_TICKETS$

🔍Last Round🔍
  Win Number: $WIN_NUMBER$
  Prize:            $PAID_PRIZE$
  Winners:       $WINNERS$

🚀🚀🚀🚀🚀
(Play Jack's Pot through the Wan Wallet DApp Store or the web version at https://jackspot.finnexus.app/)`

const jacksPotSC = "0x76b074d91f546914c6765ef81cbdc6f9c7da5685";

async function getJacksPotInfos() {
  let msg = messageModel;

  while (true) {
    if (isSwitchFinish()) {
      break;
    }
    await sleep(100);
  }

  msg = msg.replace("$DATE$", new Date().toISOString().split('T')[0]);

  let web3 = getWeb3();
  let sc = new web3.eth.Contract(jackspotAbi, jacksPotSC);


  let funcs = [];
  funcs.push(sc.methods.poolInfo().call());
  funcs.push(sc.getPastEvents('Buy', { fromBlock: 8865321 }));
  funcs.push(sc.getPastEvents('LotteryResult', { fromBlock: 8865321 }));

  const [poolInfo, buyEvents, settleEvents] = await Promise.all(funcs);

  let totalPool = (Number(web3.utils.fromWei(poolInfo.delegatePool)) + Number(web3.utils.fromWei(poolInfo.demandDepositPool)) + Number(web3.utils.fromWei(poolInfo.prizePool))).toFixed(1);
  let pricePool = Number(web3.utils.fromWei(poolInfo.prizePool)).toFixed(1);
  msg = msg.replace("$TOTAL_POOL$", totalPool);
  msg = msg.replace("$PRIZE_POOL$", pricePool);

  let winCode = 0;
  let winCount = 0;

  winCount = Number(settleEvents[settleEvents.length - 1].returnValues.amounts[0]) > 0 ? settleEvents[settleEvents.length - 1].returnValues.amounts.length : 0;
  winCode = settleEvents[settleEvents.length - 1].returnValues.winnerCode;
  let paid_prize = Number(web3.utils.fromWei(settleEvents[settleEvents.length - 1].returnValues.prizePool)).toFixed(1);

  msg = msg.replace('$WIN_NUMBER$', winCode);
  msg = msg.replace('$WINNERS$', winCount);
  msg = msg.replace('$PAID_PRIZE$', paid_prize);


  let playerData = [];
  funcs = [];
  for (let i = 0; i < buyEvents.length; i++) {
    funcs.push(sc.methods.getUserCodeList(buyEvents[i].returnValues.user).call());
  }

  let users = await Promise.all(funcs);

  let addresses = [];
  let tickets = [];
  let tmpTickets = [];
  for (let i = 0; i < buyEvents.length; i++) {
    let totalStakeAmount = 0;
    for (let m = 0; m < users[i].amounts.length; m++) {
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
      for (let m = 0; m < users[i].codes.length; m++) {
        if (!tmpTickets.includes(users[i].codes[m])) {
          tmpTickets.push(users[i].codes[m]);
          tickets.push({
            ticket: Number(users[i].codes[m]),
            count: 1,
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

  msg = msg.replace("$TOTAL_TICKETS$", tickets.length.toString());
  msg = msg.replace("$TOTAL_PLAYER$", playerData.length.toString());

  return msg;
}

async function main() {
  let msg = await getJacksPotInfos();
  console.log(msg);
  await bot.sendMessage(chatId, msg);
  process.exit(0);
}

main();
