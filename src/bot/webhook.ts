import { type Telegram } from 'telegraf';

export const BOT_COMMANDS = [
  { command: 'holiday', description: "On holiday until the day you're back, e.g. /holiday 17 Nov" },
];

// Points Telegram at `url` (and registers the command menu) unless it already
// is. Returns true if anything changed. Run hourly by the cron so the bot
// recovers on its own if the webhook is deleted, e.g. by polling with this token.
export async function ensureWebhook(
  telegram: Telegram,
  url: string,
  secret: string,
): Promise<boolean> {
  const info = await telegram.getWebhookInfo();
  if (info.url === url) return false;
  await telegram.setWebhook(url, { secret_token: secret });
  await telegram.setMyCommands(BOT_COMMANDS);
  console.log(`Webhook was ${info.url ? `"${info.url}"` : 'not set'}; now ${url}`);
  return true;
}
