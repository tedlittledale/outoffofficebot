# CLAUDE.md

## Project overview

OOO Bot — a Telegram bot that manages Gmail out-of-office (vacation responder) status. Deployed on Railway.

## Tech stack

- TypeScript, Node.js 22+
- Telegraf (Telegram bot framework)
- Google Gmail API (vacation responder settings)
- node-cron (morning check-in schedule)
- Luxon (date/time handling)

## Deployment

- Hosted on **Railway** (https://railway.app)
- Railway detects the `Procfile` and runs the worker process
- Environment variables are configured in the Railway dashboard
- Health check endpoint: `GET /health` on the configured `PORT`

## Key directories

- `src/bot/` — Telegram bot handlers and keyboard definitions
- `src/gmail/` — Gmail API auth and vacation responder logic
- `src/scheduler/` — Cron jobs (morning check-in) and ad-hoc scheduling
- `src/config.ts` — Central configuration, reads from environment variables

## Build and run

- `npm run dev` — development with hot reload
- `npm run build && npm start` — production build
- `npx tsc --noEmit` — type-check without emitting

## Key details

- No database; state is read directly from the Gmail API
- Scheduled future changes (e.g. "out from 2pm") are held in memory and lost on restart
- The bot only responds to a single configured Telegram chat ID
- Default OOO messages can be overridden via environment variables (`OOO_OUT_MESSAGE`, `OOO_FLEXIBLE_MESSAGE`, `OOO_CHILDCARE_MESSAGE`)
