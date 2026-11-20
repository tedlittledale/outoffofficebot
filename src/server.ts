import { Hono } from 'hono';
import { DateTime } from 'luxon';
import { config } from './config.js';
import { bot } from './bot/index.js';
import { sendMorningCheckin } from './scheduler/morning.js';

const app = new Hono();

function authorized(expected: string | undefined, actual: string | undefined): boolean {
  return !!expected && actual === expected;
}

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/api/telegram', async (c) => {
  if (!authorized(config.telegram.webhookSecret, c.req.header('X-Telegram-Bot-Api-Secret-Token'))) {
    return c.text('Unauthorized', 401);
  }
  await bot.handleUpdate(await c.req.json());
  return c.text('ok');
});

// Vercel Cron fires at :30 every weekday hour (UTC); only the run that lands
// on the check-in hour in the configured timezone sends, so DST is absorbed.
app.get('/api/cron/morning', async (c) => {
  if (!authorized(config.cronSecret && `Bearer ${config.cronSecret}`, c.req.header('Authorization'))) {
    return c.text('Unauthorized', 401);
  }
  const now = DateTime.now().setZone(config.timezone);
  if (now.hour !== config.morningCheckinHour) {
    return c.json({ sent: false, reason: `local hour is ${now.hour}` });
  }
  await sendMorningCheckin(bot);
  return c.json({ sent: true });
});

export default app;
