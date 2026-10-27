// Local development entry: long-polls Telegram so the bot can be tested
// without a public webhook URL. Production runs via src/server.ts on Vercel.
import { bot } from './bot/index.js';

console.log('Bot polling started');
bot.launch().then(() => {
  console.log('Bot polling stopped');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
