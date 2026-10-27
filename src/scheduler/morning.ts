import { type Telegraf } from 'telegraf';
import { config } from '../config.js';
import { morningKeyboard } from '../bot/keyboards.js';

export async function sendMorningCheckin(bot: Telegraf): Promise<void> {
  await bot.telegram.sendMessage(
    config.telegram.allowedChatId,
    "Good morning! What's your status today?",
    morningKeyboard,
  );
}
