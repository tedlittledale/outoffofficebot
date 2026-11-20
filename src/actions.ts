import { DateTime } from 'luxon';
import { config } from './config.js';
import { createGmailAuth } from './gmail/auth.js';
import {
  enableVacation,
  disableVacation,
  getVacationStatus,
  GmailApiError,
} from './gmail/vacation.js';
import { applySlackClear, applySlackStatus, slackSuffix } from './slack/apply.js';

// Status changes shared by the Telegram handlers, the morning cron and the
// scheduled-change workflow. Each returns the reply to send; Gmail failures throw.

const auth = createGmailAuth();

export function formatError(err: unknown): string {
  if (err instanceof GmailApiError) {
    return `Gmail API error (${err.code}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

export async function clearOoo(): Promise<string> {
  const current = await getVacationStatus(auth);
  await disableVacation(auth);
  const slackError = await applySlackClear();
  const note = current.enabled ? '' : ' (was already off)';
  return `OOO cleared. Auto-reply is off.${note}${slackSuffix(slackError)}`;
}

export async function setOut(): Promise<string> {
  const current = await getVacationStatus(auth);
  await enableVacation(auth, {
    subject: config.messages.subject,
    message: config.messages.out,
  });
  const slackError = await applySlackStatus('out');
  const note = current.enabled ? ' (was already on)' : '';
  return `OOO set: Out. Auto-reply is on.${note}${slackSuffix(slackError)}`;
}

export async function setFlexible(): Promise<string> {
  await enableVacation(auth, {
    subject: config.messages.subject,
    message: config.messages.flexible,
  });
  const slackError = await applySlackStatus('flexible');
  return `OOO set: Flexible. Auto-reply is on with flexible message.${slackSuffix(slackError)}`;
}

// Called before the morning check-in so that, if no answer comes, Gmail and
// Slack sit at their defaults rather than carrying over yesterday's status.
// A holiday or "out until <date>" that hasn't ended yet is left in place, and
// `away` says whether it runs past today (so there's no need to ask).
export async function resetForMorning(): Promise<{ away: boolean; error: string | null }> {
  try {
    const current = await getVacationStatus(auth);
    if (current.enabled && current.endTime && current.endTime > Date.now()) {
      const endOfToday = DateTime.now().setZone(config.timezone).endOf('day');
      return { away: current.endTime > endOfToday.toMillis(), error: null };
    }
    if (current.enabled) await disableVacation(auth);
  } catch (err) {
    return { away: false, error: `Failed to clear Gmail auto-reply: ${formatError(err)}` };
  }
  const slackError = await applySlackClear();
  return { away: false, error: slackError ? `Slack status clear failed: ${slackError}` : null };
}
