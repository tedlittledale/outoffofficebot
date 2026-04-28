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

export async function setSlackStatus(
  text: string,
  emoji: string,
  expirationSec = 0,
): Promise<void> {
  await callSlack('users.profile.set', {
    profile: {
      status_text: text,
      status_emoji: emoji,
      status_expiration: expirationSec,
    },
  });
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
