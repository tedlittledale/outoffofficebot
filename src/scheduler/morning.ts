import { type Telegraf } from 'telegraf';
import { config } from '../config.js';
import { morningKeyboard } from '../bot/keyboards.js';
import { resetForMorning } from '../actions.js';

export async function sendMorningCheckin(bot: Telegraf): Promise<void> {
  const { away, error } = await resetForMorning();
  if (error) console.error('Morning reset failed:', error);
  if (away) return;
  await bot.telegram.sendMessage(
    config.telegram.allowedChatId,
    `Good morning! What's your status today?${error ? `\n(${error})` : ''}`,
    morningKeyboard,
  );
}
