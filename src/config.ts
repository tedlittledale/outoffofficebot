import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const slackUserToken = process.env['SLACK_USER_TOKEN'];

export const config = {
  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
    allowedChatId: Number(required('TELEGRAM_CHAT_ID')),
  },
  gmail: {
    clientId: required('GOOGLE_CLIENT_ID'),
    clientSecret: required('GOOGLE_CLIENT_SECRET'),
    refreshToken: required('GOOGLE_REFRESH_TOKEN'),
    address: required('GMAIL_ADDRESS'),
  },
  slack: slackUserToken
    ? {
        userToken: slackUserToken,
        out: {
          text:
            process.env['SLACK_STATUS_OUT_TEXT'] ??
            'Not working today — back next working day',
          emoji: process.env['SLACK_STATUS_OUT_EMOJI'] ?? ':palm_tree:',
        },
        flexible: {
          text:
            process.env['SLACK_STATUS_FLEXIBLE_TEXT'] ??
            'Working flexibly today — slower to respond than usual',
          emoji: process.env['SLACK_STATUS_FLEXIBLE_EMOJI'] ?? ':turtle:',
        },
        childcare: {
          text:
            process.env['SLACK_STATUS_CHILDCARE_TEXT'] ??
            'On childcare today — checking email but not working',
          emoji:
            process.env['SLACK_STATUS_CHILDCARE_EMOJI'] ?? ':wave:',
        },
      }
    : null,
  timezone: process.env['OOO_TIMEZONE'] ?? 'Europe/London',
  port: Number(process.env['PORT'] ?? '8080'),
  messages: {
    subject: process.env['OOO_SUBJECT'] ?? 'Out of Office',
    out:
      process.env['OOO_OUT_MESSAGE'] ??
      `<p>Hi</p><p>I'm not working today. I'll get back to you on my next working day.</p><p>Ted</p>`,
    flexible:
      process.env['OOO_FLEXIBLE_MESSAGE'] ??
      `<p>Hi</p><p>I'm working flexibly today and may be slower than usual to respond. I'll get back to you as soon as I can.</p><p>Ted</p>`,
    childcare:
      process.env['OOO_CHILDCARE_MESSAGE'] ??
      `<p>Hi</p><p>I'm looking after Dylan/Erin today. I'll be checking emails, but won't be working.</p><p>Ted</p>`,
  },
} as const;
