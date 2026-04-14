import { Markup } from 'telegraf';

export const morningKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('☀️ In', 'status_in'),
    Markup.button.callback('🏠 Out', 'status_out'),
  ],
  [
    Markup.button.callback('⏳ Flexible', 'status_flexible'),
    Markup.button.callback('👶 Childcare', 'status_childcare'),
  ],
]);

export const cancelScheduleKeyboard = Markup.inlineKeyboard([
  Markup.button.callback('Cancel scheduled change', 'cancel_schedule'),
]);
