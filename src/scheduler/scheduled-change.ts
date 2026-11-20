import { DateTime } from 'luxon';
import { getHookByToken, resumeHook, start } from 'workflow/api';
import { HookNotFoundError } from 'workflow/errors';
import { config } from '../config.js';
import {
  scheduledChange,
  SCHEDULED_CHANGE_TOKEN,
  type ChangeKind,
  type ScheduledChangeMetadata,
} from '../../workflows/scheduled-change.js';

export type { ChangeKind };

export interface PendingChange {
  at: DateTime;
  kind: ChangeKind;
}

const LABELS: Record<ChangeKind, string> = {
  out: 'OOO enable',
  flexible: 'Flexible message on',
  clear: 'OOO cleared',
};

export function describeChange({ at, kind }: PendingChange): string {
  return `${LABELS[kind]} at ${at.toFormat('HH:mm')}`;
}

export async function scheduleChange(time: DateTime, kind: ChangeKind): Promise<void> {
  await start(scheduledChange, [time.toUTC().toISO()!, kind]);
}

/** The pending scheduled change, or null if nothing is pending. */
export async function getScheduledChange(): Promise<PendingChange | null> {
  try {
    const hook = await getHookByToken(SCHEDULED_CHANGE_TOKEN);
    const metadata = (await hook.metadata) as ScheduledChangeMetadata | undefined;
    return metadata
      ? { at: DateTime.fromISO(metadata.at).setZone(config.timezone), kind: metadata.kind }
      : null;
  } catch (err) {
    if (HookNotFoundError.is(err)) return null;
    throw err;
  }
}

/** Cancels the pending scheduled change, returning it, or null if none. */
export async function cancelScheduledChange(): Promise<PendingChange | null> {
  const pending = await getScheduledChange();
  if (!pending) return null;
  try {
    await resumeHook(SCHEDULED_CHANGE_TOKEN, { cancel: true });
    return pending;
  } catch (err) {
    if (HookNotFoundError.is(err)) return null;
    throw err;
  }
}
