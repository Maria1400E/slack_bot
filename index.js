require('dotenv').config();
const { App } = require('@slack/bolt');
const { saveTicketToSheet } = require('./googleSheets');
const { listenForDMs } = require('./slackListener');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

listenForDMs(app, saveTicketToSheet);

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack bot is running!');
})();
