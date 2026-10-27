import { Hono } from 'hono';
import { DateTime } from 'luxon';
import { config } from './config.js';
import { bot } from './bot/index.js';
import { morningKeyboard } from './bot/keyboards.js';

const app = new Hono();

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/api/telegram', async (c) => {
  const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (!config.telegram.webhookSecret || secret !== config.telegram.webhookSecret) {
    return c.text('Unauthorized', 401);
  }
  await bot.handleUpdate(await c.req.json());
  return c.text('ok');
});

// Vercel Cron fires at both 07:30 and 08:30 UTC on weekdays; only the one
// that lands on 08:xx in the configured timezone sends, so DST is absorbed.
app.get('/api/cron/morning', async (c) => {
  if (!config.cronSecret || c.req.header('Authorization') !== `Bearer ${config.cronSecret}`) {
    return c.text('Unauthorized', 401);
  }
  const now = DateTime.now().setZone(config.timezone);
  if (now.hour !== 8) {
    return c.json({ sent: false, reason: `local hour is ${now.hour}` });
  }
  await bot.telegram.sendMessage(
    config.telegram.allowedChatId,
    "Good morning! What's your status today?",
    morningKeyboard,
  );
  return c.json({ sent: true });
});

export default app;
