import { config } from '../config.js';

export class SlackApiError extends Error {
  constructor(
    message: string,
    public readonly slackError: string | undefined,
  ) {
    super(message);
    this.name = 'SlackApiError';
  }
}

interface SlackResponse {
  ok: boolean;
  error?: string;
  warning?: string;
}

async function callSlack(method: string, body: unknown): Promise<SlackResponse> {
  if (!config.slack) {
    throw new SlackApiError('Slack is not configured', undefined);
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${config.slack.userToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as SlackResponse;
  if (!data.ok) {
    throw new SlackApiError(
      `Slack ${method} failed: ${data.error ?? 'unknown error'}`,
      data.error,
    );
  }
  return data;
}

async function callSlackForm(
  method: string,
  params: Record<string, string>,
): Promise<SlackResponse> {
  if (!config.slack) {
    throw new SlackApiError('Slack is not configured', undefined);
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      Authorization: `Bearer ${config.slack.userToken}`,
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = (await res.json()) as SlackResponse;
  if (!data.ok) {
    throw new SlackApiError(
      `Slack ${method} failed: ${data.error ?? 'unknown error'}`,
      data.error,
    );
  }
  return data;
}

export function isSlackConfigured(): boolean {
  return config.slack !== null;
}

// Slack wants a ":shortcode:". Env values often arrive as `"turtle"` or
// `":turtle:"` (with literal quotes copied from a .env example), so tidy them up.
export function normalizeEmoji(emoji: string): string {
  const name = emoji.trim().replace(/^["']+|["']+$/g, '').trim().replace(/^:+|:+$/g, '');
  return name ? `:${name}:` : '';
}

export async function setSlackStatus(
  text: string,
  emoji: string,
  expirationSec = 0,
): Promise<void> {
  const profile = {
    status_text: text,
    status_emoji: normalizeEmoji(emoji),
    status_expiration: expirationSec,
  };
  try {
    await callSlack('users.profile.set', { profile });
  } catch (err) {
    // An unknown emoji shouldn't stop the status text (and the presence/DnD
    // calls after it) from being applied, so retry without one.
    if (
      err instanceof SlackApiError &&
      err.slackError === 'profile_status_set_failed_not_valid_emoji' &&
      profile.status_emoji
    ) {
      console.warn(`Slack rejected status emoji ${profile.status_emoji}; setting status without it`);
      await callSlack('users.profile.set', { profile: { ...profile, status_emoji: '' } });
      return;
    }
    throw err;
  }
}

export async function clearSlackStatus(): Promise<void> {
  await callSlack('users.profile.set', {
    profile: {
      status_text: '',
      status_emoji: '',
      status_expiration: 0,
    },
  });
}

export async function setSlackPresence(presence: 'away' | 'auto'): Promise<void> {
  await callSlack('users.setPresence', { presence });
}

export async function setSlackSnooze(numMinutes: number): Promise<void> {
  await callSlackForm('dnd.setSnooze', { num_minutes: String(numMinutes) });
}

export async function endSlackSnooze(): Promise<void> {
  await callSlackForm('dnd.endSnooze', {});
}
