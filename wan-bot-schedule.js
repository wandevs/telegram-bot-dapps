const schedule = require('node-schedule');

// * * * * * *
// second minute hour day month dayOfWeek
function robotSchedules() {
  // update: The settlement robot calls this function daily to update the capital pool and settle the pending refund.
  schedule.scheduleJob('*/10 * * * * *', () => {
    startJacksPot();
  });

  schedule.scheduleJob('*/20 * * * * *', async () => {
    startWandora();
  });
}

function startJacksPot() {
  console.log('startJacksPot');
}

function startWandora() {
  console.log('startWandora');
}


robotSchedules();