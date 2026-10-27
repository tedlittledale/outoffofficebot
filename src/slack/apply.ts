import { DateTime } from 'luxon';
import { config } from '../config.js';
import {
  clearSlackStatus,
  endSlackSnooze,
  isSlackConfigured,
  setSlackPresence,
  setSlackSnooze,
  setSlackStatus,
} from './status.js';

export type SlackVariant = 'out' | 'flexible' | 'childcare';

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

export async function applySlackStatus(
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

export async function applySlackClear(): Promise<string | null> {
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

export function slackSuffix(slackError: string | null): string {
  if (!isSlackConfigured()) return '';
  if (slackError) return `\n(Slack status update failed: ${slackError})`;
  return '\nSlack status updated.';
}
