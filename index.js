const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const { token, chatId } = require('./config');
const jackspotAbi = require('./jackspot-abi.json');
import { getWeb3, isSwitchFinish } from './web3switch';
// replace the value below with the Telegram token you receive from @BotFather
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// * * * * * *
// second minute hour day month dayOfWeek
const robotSchedules = () => {
    // update: The settlement robot calls this function daily to update the capital pool and settle the pending refund.
    schedule.scheduleJob('0 * * * * *', async () => {
        let msg = await getInfos();
        await bot.sendMessage(chatId, msg);
    });
}

robotSchedules();

let messageModel = `
Hello, everyone! 
It's my honor to introduce the latest status of Jack's Pot DApp on Wanchain.

---- The No-loss lottery Jack's Pot ----
Jack's Pot's total stake pool has reached $TOTAL_POOL$ Wan.
The jackpot amount for this round is $PRIZE_POOL$ Wan.
( Welcome join us to play in Wan Wallet DApps or in website https://jackspot.finnexus.app/ )
----------------------------------------`

let messageModel2 = `
Hello, everyone! 
It's my honor to introduce the latest status of Wandora Box DApp on Wanchain.

---- Price Predication Product Wandora Box ----
Wandora Box had $WANDORA_AMOUNT$ wan trade in last 24 hours.
( Welcome join us to play in Wan Wallet DApps or in website https://wandora.finnexus.app/ )
-----------------------------------------------`;

const jacksPotSC = "0x76b074d91f546914c6765ef81cbdc6f9c7da5685";

async function getInfos() {
    let msg = messageModel;

    while (true) {
        if (isSwitchFinish()) {
            break;
        }
        await sleep(100);
    }

    let web3 = getWeb3();
    let jackspot = new web3.eth.Contract(jackspotAbi, jacksPotSC);
    let poolInfo = await jackspot.methods.poolInfo().call();
    let totalPool = (Number(web3.utils.fromWei(poolInfo.delegatePool)) + Number(web3.utils.fromWei(poolInfo.demandDepositPool)) + Number(web3.utils.fromWei(poolInfo.prizePool))).toFixed(1);
    let pricePool = Number(web3.utils.fromWei(poolInfo.prizePool)).toFixed(1);
    msg.replace("$TOTAL_POOL$", totalPool);
    msg.replace("$PRIZE_POOL$", pricePool);

    return msg;
}

