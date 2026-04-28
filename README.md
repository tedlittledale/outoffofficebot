# OOO Bot

A Telegram bot that manages your Gmail out-of-office (vacation responder) status. It sends a daily morning check-in with inline buttons and accepts ad-hoc text commands throughout the day to toggle your OOO on and off — no need to open Gmail settings.

## Prerequisites

- Node.js 22+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram chat ID (send `/start` to [@userinfobot](https://t.me/userinfobot) to find it)
- A Google Cloud project with the Gmail API enabled and OAuth 2.0 credentials (Desktop app type)

## Setup

### 1. Clone and install

```bash
git clone <repo-url> && cd ooo
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GMAIL_ADDRESS`.

To also update your Slack status alongside Gmail OOO, add `SLACK_USER_TOKEN` (a User OAuth token from your Slack app — see "Slack setup" below). Slack is optional: if `SLACK_USER_TOKEN` is unset, only Gmail is updated.

### 3. Google Cloud project setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API** under APIs & Services
4. Go to **OAuth consent screen**, configure for External users
5. Add the scope `https://www.googleapis.com/auth/gmail.settings.basic`
6. Go to **Credentials** → Create **OAuth client ID** → Application type: **Desktop app**
7. Copy the Client ID and Client Secret into your `.env`

> **Important:** If your OAuth consent screen is in "Testing" mode, refresh tokens expire after 7 days. To get persistent tokens, publish the app (it will still be restricted to your account).

### 4. Slack setup (optional)

If you want the bot to update your Slack status whenever it toggles your Gmail OOO:

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) (or use your existing one)
2. Under **OAuth & Permissions**, add the **User Token Scope** `users.profile:write`
3. Install the app to your workspace
4. Copy the **User OAuth Token** (starts with `xoxp-`) into `.env` as `SLACK_USER_TOKEN`

Optional overrides for status text/emoji (defaults shown):

```
SLACK_STATUS_OUT_TEXT="Out of office"
SLACK_STATUS_OUT_EMOJI=":palm_tree:"
SLACK_STATUS_FLEXIBLE_TEXT="Working flexibly — slower to respond"
SLACK_STATUS_FLEXIBLE_EMOJI=":turtle:"
```

When you send `out until <date>`, the Slack status expiration is set to match the Gmail end time. When you send `in`/`back`, the Slack status is cleared.

### 5. Authenticate with Gmail

```bash
npm run auth-setup
```

This opens your browser for Google OAuth consent. After authorising, the script prints a refresh token — paste it into `.env` as `GOOGLE_REFRESH_TOKEN`.

### 6. Run

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build && npm start
```

## Deploy to Railway

1. Push this repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect the GitHub repo
4. Add all environment variables from `.env` in the Railway dashboard
5. Railway will detect the `Procfile` and run the worker process
6. The health check endpoint is available at `GET /health` on the configured `PORT`

## Commands

| Command | Action |
|---|---|
| `in` / `back` | Clear OOO, auto-reply off |
| `out` / `off` | Set OOO, auto-reply on |
| `flexible` / `flex` | Set flexible/slow-response auto-reply |
| `out from 2pm` | Schedule OOO to enable at that time |
| `out until Thursday` | Set OOO with an end date |
| `status` | Show current OOO state |

The morning check-in is sent at 07:30 UK time on weekdays with inline buttons for In, Out, and Flexible.

## Notes

- State is read directly from the Gmail API — there is no database
- Scheduled future changes (e.g. "out from 2pm") are held in memory and lost on restart
- The bot only responds to your Telegram chat ID — messages from anyone else are silently ignored
