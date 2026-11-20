// Points Telegram at the deployed bot and registers the command menu.
// Usage: npm run telegram:setup -- https://ooo-bot-nu.vercel.app
import 'dotenv/config';
import { Telegram } from 'telegraf';

const baseUrl = process.argv[2]?.replace(/\/+$/, '');
const token = process.env['TELEGRAM_BOT_TOKEN'];
const secret = process.env['TELEGRAM_WEBHOOK_SECRET'];

if (!baseUrl || !token || !secret) {
  console.error(
    'Usage: npm run telegram:setup -- https://<your-domain>\n' +
      'Needs TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the environment or .env.',
  );
  process.exit(1);
}

const telegram = new Telegram(token);

await telegram.setWebhook(`${baseUrl}/api/telegram`, { secret_token: secret });
await telegram.setMyCommands([
  { command: 'holiday', description: "On holiday until the day you're back, e.g. /holiday 17 Nov" },
]);

const info = await telegram.getWebhookInfo();
console.log('Webhook URL:', info.url);
console.log('Pending updates:', info.pending_update_count);
if (info.last_error_message) {
  console.log('Last error:', info.last_error_message);
}
