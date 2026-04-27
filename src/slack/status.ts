import { config } from '../config.js';

interface SlackStatus {
  text: string;
  emoji: string;
  expiration?: number;
}

const STATUS_MAP = {
  out: { text: 'Out of office', emoji: ':palm_tree:' },
  flexible: { text: 'Working flexibly', emoji: ':clock3:' },
  childcare: { text: 'Childcare', emoji: ':baby:' },
  in: { text: '', emoji: '' },
} as const;

export type SlackStatusType = keyof typeof STATUS_MAP;

export async function setSlackStatus(
  type: SlackStatusType,
  expiration?: Date,
): Promise<void> {
  const token = config.slack?.token;
  if (!token) return;

  const status = STATUS_MAP[type];
  const profile: SlackStatus = {
    text: status.text,
    emoji: status.emoji,
  };
  if (expiration) {
    profile.expiration = Math.floor(expiration.getTime() / 1000);
  }

  const res = await fetch('https://slack.com/api/users.profile.set', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ profile }),
  });

  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
}
