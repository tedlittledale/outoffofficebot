// Points Telegram at the deployed bot and registers the command menu.
// Usage: npm run telegram:setup -- https://ooo-bot-nu.vercel.app
// Normally unnecessary: the hourly cron does the same via ensureWebhook().
import 'dotenv/config';
import { Telegram } from 'telegraf';
import { BOT_COMMANDS } from '../src/bot/webhook.js';

const baseUrl = process.argv[2]?.replace(/\/+$/, '');
// Values pulled with `vercel env pull` can carry a trailing newline (real or a
// literal "\n") or stray quotes, which make Telegram reject the token with a 404.
function clean(value: string | undefined): string | undefined {
  return value?.trim().replace(/^["']|["']$/g, '').replace(/(\\n)+$/, '').trim() || undefined;
}

const token = clean(process.env['TELEGRAM_BOT_TOKEN']);
const secret = clean(process.env['TELEGRAM_WEBHOOK_SECRET']);

if (!baseUrl || !token || !secret) {
  console.error(
    'Usage: npm run telegram:setup -- https://<your-domain>\n' +
      'Needs TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in the environment or .env.',
  );
  process.exit(1);
}

const telegram = new Telegram(token);

try {
  const me = await telegram.getMe();
  console.log(`Bot: @${me.username}`);
} catch {
  console.error(
    'Telegram rejected TELEGRAM_BOT_TOKEN (it should look like 123456789:ABC..., 46 characters).\n' +
      `The value found is ${token.length} characters${/^\d+:[\w-]{30,}$/.test(token) ? '' : " and isn't in that format"}.\n` +
      (token.includes('SENSITIVE')
      ? 'Vercel redacts these values when pulled, so they can only be pasted in by hand (token from @BotFather).\n' +
        'Usually there is no need: the hourly cron restores the webhook on its own.'
      : 'Check the token with @BotFather.'),
  );
  process.exit(1);
}

await telegram.setWebhook(`${baseUrl}/api/telegram`, { secret_token: secret });
await telegram.setMyCommands(BOT_COMMANDS);

const info = await telegram.getWebhookInfo();
console.log('Webhook URL:', info.url);
console.log('Pending updates:', info.pending_update_count);
if (info.last_error_message) {
  console.log('Last error:', info.last_error_message);
}
