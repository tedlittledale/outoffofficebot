// Local development entry: long-polls Telegram so the bot can be tested
// without a public webhook URL. Production runs via src/server.ts on Vercel.
//
// Starting to poll deletes the bot's webhook, which silently cuts off the
// production bot, so refuse to start while one is set unless --force is given.
// Use a separate test bot token for local polling.
import { bot } from './bot/index.js';

const webhook = await bot.telegram.getWebhookInfo();
if (webhook.url && !process.argv.includes('--force')) {
  console.error(
    `This bot token has a webhook set (${webhook.url}), so it's the production bot.\n` +
      'Polling would delete the webhook and stop the deployed bot receiving messages.\n' +
      'Use a separate test bot token, or pass --force (then run `npm run telegram:setup` afterwards).',
  );
  process.exit(1);
}

console.log('Bot polling started');
bot.launch().then(() => {
  console.log('Bot polling stopped');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
