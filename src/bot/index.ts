import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { registerHandlers } from './handlers.js';

export const bot = new Telegraf(config.telegram.botToken);

registerHandlers(bot);
