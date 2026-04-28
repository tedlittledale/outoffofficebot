import { type Telegraf, type Context } from 'telegraf';
import { DateTime } from 'luxon';
import { config } from '../config.js';
import { createGmailAuth } from '../gmail/auth.js';
import {
  enableVacation,
  disableVacation,
  getVacationStatus,
  GmailApiError,
} from '../gmail/vacation.js';
import { cancelScheduleKeyboard } from './keyboards.js';
import { scheduleOutAt, cancelPendingSchedule, getPendingSchedule } from '../scheduler/adhoc.js';
import {
  clearSlackStatus,
  endSlackSnooze,
  isSlackConfigured,
  setSlackPresence,
  setSlackSnooze,
  setSlackStatus,
} from '../slack/status.js';

const auth = createGmailAuth();

type SlackVariant = 'out' | 'flexible' | 'childcare';

const AWAY_VARIANTS: ReadonlySet<SlackVariant> = new Set(['out', 'childcare']);

function minutesUntil(end: DateTime): number {
  const now = DateTime.now().setZone(config.timezone);
  return Math.max(1, Math.ceil(end.diff(now, 'minutes').minutes));
}

function snoozeMinutes(endTime: DateTime | null): number {
  // No explicit end: snooze until end of today (re-armed next morning by cron)
  const target =
    endTime ?? DateTime.now().setZone(config.timezone).endOf('day');
  return minutesUntil(target);
}

async function applySlackStatus(
  variant: SlackVariant,
  endTime: DateTime | null = null,
): Promise<string | null> {
  if (!isSlackConfigured() || !config.slack) return null;
  const { text, emoji } = config.slack[variant];
  const isAway = AWAY_VARIANTS.has(variant);
  const expirationSec = endTime ? Math.floor(endTime.toSeconds()) : 0;
  try {
    await setSlackStatus(text, emoji, expirationSec);
    await setSlackPresence(isAway ? 'away' : 'auto');
    if (isAway) {
      await setSlackSnooze(snoozeMinutes(endTime));
    } else {
      await endSlackSnooze().catch(() => {
        /* ignore "snooze_not_active" */
      });
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

async function applySlackClear(): Promise<string | null> {
  if (!isSlackConfigured()) return null;
  try {
    await clearSlackStatus();
    await setSlackPresence('auto');
    await endSlackSnooze().catch(() => {
      /* ignore "snooze_not_active" */
    });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function slackSuffix(slackError: string | null): string {
  if (!isSlackConfigured()) return '';
  if (slackError) return `\n(Slack status update failed: ${slackError})`;
  return '\nSlack status updated.';
}

interface ParsedCommand {
  type: 'in' | 'out' | 'flexible' | 'childcare' | 'status' | 'out_from' | 'out_until' | 'unknown';
  time?: DateTime;
}

const DAY_NAMES: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

function parseTimeToday(timeStr: string): DateTime | null {
  const tz = config.timezone;
  // Match: "2pm", "2:30pm", "14:00", "2:30 PM", "14"
  const match = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1]!, 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3]?.toLowerCase();

  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return DateTime.now().setZone(tz).set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
}

function parseFutureDate(dateStr: string): DateTime | null {
  const tz = config.timezone;
  const now = DateTime.now().setZone(tz);
  const lower = dateStr.toLowerCase().trim();

  if (lower === 'tomorrow') {
    return now.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  }

  if (lower === 'next week') {
    // Next Monday at 9am
    const daysUntilMonday = (8 - now.weekday) % 7 || 7;
    return now.plus({ days: daysUntilMonday }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  }

  const dayNumber = DAY_NAMES[lower];
  if (dayNumber !== undefined) {
    let daysAhead = dayNumber - now.weekday;
    if (daysAhead <= 0) daysAhead += 7;
    return now.plus({ days: daysAhead }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
  }

  return null;
}

export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();

  if (/^(status|what'?s?\s+my\s+status)\s*$/i.test(trimmed)) {
    return { type: 'status' };
  }

  if (/^(back|in|i'?m\s+back|i'?m\s+in)\s*$/i.test(trimmed)) {
    return { type: 'in' };
  }

  if (/^(flexible|flex)\s*$/i.test(trimmed)) {
    return { type: 'flexible' };
  }

  if (/^(childcare|kids)\s*$/i.test(trimmed)) {
    return { type: 'childcare' };
  }

  const outFromMatch = trimmed.match(/^out\s+from\s+(.+)$/i);
  if (outFromMatch) {
    const time = parseTimeToday(outFromMatch[1]!.trim());
    if (time) return { type: 'out_from', time };
  }

  const outUntilMatch = trimmed.match(/^out\s+until\s+(.+)$/i);
  if (outUntilMatch) {
    const date = parseFutureDate(outUntilMatch[1]!.trim());
    if (date) return { type: 'out_until', time: date };
  }

  if (/^(out|ooo|off)\s*$/i.test(trimmed)) {
    return { type: 'out' };
  }

  return { type: 'unknown' };
}

function formatError(err: unknown): string {
  if (err instanceof GmailApiError) {
    return `Gmail API error (${err.code}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

const HELP_TEXT = `Available commands:

*in* / *back* — Clear OOO, auto-reply off
*out* / *off* — Set OOO, auto-reply on
*flexible* / *flex* — Set flexible/slow-response message
*childcare* / *kids* — Set childcare day message
*out from 2pm* — Schedule OOO to start at a time
*out until Thursday* — Set OOO with an end date
*status* — Check current OOO state`;

async function handleIn(ctx: Context): Promise<void> {
  try {
    const current = await getVacationStatus(auth);
    await disableVacation(auth);
    const slackError = await applySlackClear();
    const note = current.enabled ? '' : ' (was already off)';
    await ctx.reply(`OOO cleared. Auto-reply is off.${note}${slackSuffix(slackError)}`);
  } catch (err) {
    await ctx.reply(`Failed to clear OOO: ${formatError(err)}`);
  }
}

async function handleOut(ctx: Context): Promise<void> {
  try {
    const current = await getVacationStatus(auth);
    await enableVacation(auth, {
      subject: config.messages.subject,
      message: config.messages.out,
    });
    const slackError = await applySlackStatus('out');
    const note = current.enabled ? ' (was already on)' : '';
    await ctx.reply(`OOO set: Out. Auto-reply is on.${note}${slackSuffix(slackError)}`);
  } catch (err) {
    await ctx.reply(`Failed to set OOO: ${formatError(err)}`);
  }
}

async function handleFlexible(ctx: Context): Promise<void> {
  try {
    await enableVacation(auth, {
      subject: config.messages.subject,
      message: config.messages.flexible,
    });
    const slackError = await applySlackStatus('flexible');
    await ctx.reply(
      `OOO set: Flexible. Auto-reply is on with flexible message.${slackSuffix(slackError)}`,
    );
  } catch (err) {
    await ctx.reply(`Failed to set flexible OOO: ${formatError(err)}`);
  }
}

async function handleChildcare(ctx: Context): Promise<void> {
  try {
    await enableVacation(auth, {
      subject: config.messages.subject,
      message: config.messages.childcare,
    });
    const slackError = await applySlackStatus('childcare');
    await ctx.reply(
      `OOO set: Childcare. Auto-reply is on with childcare message.${slackSuffix(slackError)}`,
    );
  } catch (err) {
    await ctx.reply(`Failed to set childcare OOO: ${formatError(err)}`);
  }
}

async function handleStatus(ctx: Context): Promise<void> {
  try {
    const status = await getVacationStatus(auth);
    const pending = getPendingSchedule();

    let reply = status.enabled
      ? `Auto-reply is *on*.\nSubject: ${status.subject ?? '(none)'}`
      : 'Auto-reply is *off*.';

    if (status.enabled && status.endTime) {
      const endDate = DateTime.fromMillis(status.endTime).setZone(config.timezone);
      reply += `\nEnds: ${endDate.toFormat('cccc d MMMM, HH:mm')}`;
    }

    if (pending.scheduled && pending.time) {
      const schedTime = DateTime.fromJSDate(pending.time).setZone(config.timezone);
      reply += `\n\nPending: ${pending.description} at ${schedTime.toFormat('HH:mm')}`;
    }

    await ctx.reply(reply, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`Failed to get status: ${formatError(err)}`);
  }
}

async function handleOutFrom(ctx: Context, bot: Telegraf, time: DateTime): Promise<void> {
  const now = DateTime.now().setZone(config.timezone);
  if (time <= now) {
    await ctx.reply("That time has already passed today. Send 'out' to enable OOO now.");
    return;
  }

  scheduleOutAt(bot, time, config.telegram.allowedChatId, auth);
  await ctx.reply(
    `OOO scheduled: Out from ${time.toFormat('HH:mm')} today.`,
    cancelScheduleKeyboard,
  );
}

async function handleOutUntil(ctx: Context, endDate: DateTime): Promise<void> {
  try {
    await enableVacation(auth, {
      subject: config.messages.subject,
      message: config.messages.out,
      endTime: endDate.toJSDate(),
    });
    const slackError = await applySlackStatus('out', endDate);
    await ctx.reply(
      `OOO set: Out until ${endDate.toFormat('cccc d MMMM')} at ${endDate.toFormat('HH:mm')}. Auto-reply is on.${slackSuffix(slackError)}`,
    );
  } catch (err) {
    await ctx.reply(`Failed to set OOO: ${formatError(err)}`);
  }
}

export function registerHandlers(bot: Telegraf): void {
  // Auth guard - reject messages from other users
  bot.use((ctx, next) => {
    if (ctx.chat?.id !== config.telegram.allowedChatId) {
      return;
    }
    return next();
  });

  // Callback query handlers for inline keyboard buttons
  bot.action('status_in', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('You selected: In');
    await handleIn(ctx);
  });

  bot.action('status_out', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('You selected: Out');
    await handleOut(ctx);
  });

  bot.action('status_flexible', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('You selected: Flexible');
    await handleFlexible(ctx);
  });

  bot.action('status_childcare', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('You selected: Childcare');
    await handleChildcare(ctx);
  });

  bot.action('cancel_schedule', async (ctx) => {
    await ctx.answerCbQuery();
    const result = cancelPendingSchedule();
    if (result.cancelled) {
      await ctx.editMessageText(`Cancelled: ${result.description}`);
    } else {
      await ctx.editMessageText('No pending schedule to cancel.');
    }
  });

  // Text message handler
  bot.on('text', async (ctx) => {
    const command = parseCommand(ctx.message.text);

    switch (command.type) {
      case 'in':
        await handleIn(ctx);
        break;
      case 'out':
        await handleOut(ctx);
        break;
      case 'flexible':
        await handleFlexible(ctx);
        break;
      case 'childcare':
        await handleChildcare(ctx);
        break;
      case 'status':
        await handleStatus(ctx);
        break;
      case 'out_from':
        await handleOutFrom(ctx, bot, command.time!);
        break;
      case 'out_until':
        await handleOutUntil(ctx, command.time!);
        break;
      case 'unknown':
        await ctx.reply(HELP_TEXT, { parse_mode: 'Markdown' });
        break;
    }
  });
}
