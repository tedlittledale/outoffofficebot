import { createHook, sleep } from 'workflow';
import { HookForceClaimedError } from 'workflow/errors';
import { Telegram } from 'telegraf';
import { DateTime } from 'luxon';
import { config } from '../src/config.js';
import { clearOoo, formatError, setFlexible, setOut } from '../src/actions.js';

export const SCHEDULED_CHANGE_TOKEN = 'scheduled-change';

// 'out' is "out from <time>"; 'flexible' and 'clear' are half-day switches.
export type ChangeKind = 'out' | 'flexible' | 'clear';

export interface ScheduledChangeMetadata {
  at: string;
  kind: ChangeKind;
}

// Applies `kind` at `at` (ISO timestamp) unless cancelled first. Only one is
// ever pending: a newer run force-claims the hook token, superseding this one.
export async function scheduledChange(at: string, kind: ChangeKind) {
  'use workflow';

  const cancel = createHook<{ cancel: true }>({
    token: SCHEDULED_CHANGE_TOKEN,
    metadata: { at, kind } satisfies ScheduledChangeMetadata,
    experimental_force: true,
  });

  try {
    const result = await Promise.race([
      cancel.then(() => 'cancelled' as const),
      sleep(new Date(at)).then(() => 'due' as const),
    ]);
    if (result === 'cancelled') return { status: 'cancelled' };
  } catch (err) {
    if (HookForceClaimedError.is(err)) return { status: 'superseded' };
    throw err;
  }

  await applyScheduledChange(at, kind);
  return { status: 'applied' };
}

async function applyScheduledChange(at: string, kind: ChangeKind): Promise<void> {
  'use step';

  const telegram = new Telegram(config.telegram.botToken);
  try {
    let reply: string;
    if (kind === 'out') {
      reply = `${await setOut()} (scheduled from earlier)`;
    } else {
      const time = DateTime.fromISO(at).setZone(config.timezone).toFormat('HH:mm');
      reply = `It's ${time}. ${kind === 'flexible' ? await setFlexible() : await clearOoo()}`;
    }
    await telegram.sendMessage(config.telegram.allowedChatId, reply);
  } catch (err) {
    await telegram.sendMessage(
      config.telegram.allowedChatId,
      `Failed to apply scheduled change: ${formatError(err)}`,
    );
  }
}
