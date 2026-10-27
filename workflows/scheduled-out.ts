import { createHook, sleep } from 'workflow';
import { HookForceClaimedError } from 'workflow/errors';
import { Telegram } from 'telegraf';
import { config } from '../src/config.js';
import { enableVacation } from '../src/gmail/vacation.js';
import { createGmailAuth } from '../src/gmail/auth.js';
import { applySlackStatus, slackSuffix } from '../src/slack/apply.js';

export const SCHEDULED_OUT_TOKEN = 'scheduled-out';

export interface ScheduledOutMetadata {
  at: string;
}

// Enables OOO at `at` (ISO timestamp) unless cancelled first. Only one is ever
// pending: a newer run force-claims the hook token, superseding this one.
export async function scheduledOut(at: string) {
  'use workflow';

  const cancel = createHook<{ cancel: true }>({
    token: SCHEDULED_OUT_TOKEN,
    metadata: { at } satisfies ScheduledOutMetadata,
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

  await enableScheduledOut();
  return { status: 'enabled' };
}

async function enableScheduledOut(): Promise<void> {
  'use step';

  const telegram = new Telegram(config.telegram.botToken);
  try {
    await enableVacation(createGmailAuth(), {
      subject: config.messages.subject,
      message: config.messages.out,
    });
    const slackError = await applySlackStatus('out');
    await telegram.sendMessage(
      config.telegram.allowedChatId,
      `OOO is now active (scheduled from earlier). Auto-reply is on.${slackSuffix(slackError)}`,
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await telegram.sendMessage(
      config.telegram.allowedChatId,
      `Failed to enable scheduled OOO: ${errMsg}`,
    );
  }
}
