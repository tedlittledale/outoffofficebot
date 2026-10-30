import cron from 'node-cron';
import { type Telegraf } from 'telegraf';
import { config } from '../config.js';
import { morningKeyboard } from '../bot/keyboards.js';
import { resetForMorning } from '../bot/handlers.js';

let task: cron.ScheduledTask | null = null;

export function startMorningCron(bot: Telegraf): void {
  // Weekdays at 8:30am in configured timezone
  task = cron.schedule(
    '30 8 * * 1-5',
    async () => {
      const resetError = await resetForMorning();
      if (resetError) console.error('Morning reset failed:', resetError);
      try {
        await bot.telegram.sendMessage(
          config.telegram.allowedChatId,
          `Good morning! What's your status today?${resetError ? `\n(${resetError})` : ''}`,
          morningKeyboard,
        );
      } catch (err) {
        console.error('Failed to send morning check-in:', err);
      }
    },
    { timezone: config.timezone },
  );

  console.log(`Morning cron scheduled: 08:30 ${config.timezone}, weekdays`);
}

export function stopMorningCron(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
