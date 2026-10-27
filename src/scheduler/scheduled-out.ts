import { DateTime } from 'luxon';
import { getHookByToken, resumeHook, start } from 'workflow/api';
import { HookNotFoundError } from 'workflow/errors';
import { config } from '../config.js';
import {
  scheduledOut,
  SCHEDULED_OUT_TOKEN,
  type ScheduledOutMetadata,
} from '../../workflows/scheduled-out.js';

export async function scheduleOut(time: DateTime): Promise<void> {
  await start(scheduledOut, [time.toUTC().toISO()!]);
}

/** The pending scheduled-out time, or null if nothing is pending. */
export async function getScheduledOut(): Promise<DateTime | null> {
  try {
    const hook = await getHookByToken(SCHEDULED_OUT_TOKEN);
    const metadata = (await hook.metadata) as ScheduledOutMetadata | undefined;
    return metadata ? DateTime.fromISO(metadata.at).setZone(config.timezone) : null;
  } catch (err) {
    if (HookNotFoundError.is(err)) return null;
    throw err;
  }
}

/** Cancels the pending scheduled-out, returning its time, or null if none. */
export async function cancelScheduledOut(): Promise<DateTime | null> {
  const pending = await getScheduledOut();
  if (!pending) return null;
  try {
    await resumeHook(SCHEDULED_OUT_TOKEN, { cancel: true });
    return pending;
  } catch (err) {
    if (HookNotFoundError.is(err)) return null;
    throw err;
  }
}
