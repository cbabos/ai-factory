# AI Factory

A lightweight, pluggable AI pipeline system. It captures signals from external sources (cron, webhooks, email, Slack, filesystem), routes them through a small agent swarm, and delivers results back to the originating channel.

## What it does

1. **Inbound** — Sensors detect external events and emit `RawSignal` objects.
2. **Adapt** — Channel-specific adapters normalize signals into `Task` objects.
3. **Orchestrate** — The `Orchestrator` estimates complexity, decomposes large tasks, selects the cheapest capable model, dispatches to agents, and aggregates results.
4. **Outbound** — Responders deliver the final result back to the source channel.

The whole system is wired together by `AIFactory` (`src/factory.ts`).

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add real API keys for the providers you use in `factory.config.json`.

### 3. Build

```bash
npm run build
```

### 4. Run

```bash
node --experimental-sqlite dist/main.js
```

The app starts:
- a cron sensor (every 60s)
- a webhook HTTP server on port `3000`
- a file watcher on `./watched`
- an SQLite-backed repository at `./ai-factory.db`

Press `Ctrl+C` to stop gracefully.

## Sending signals

Every signal flows through the pipeline: `Sensor → Adapter → TaskFactory → Orchestrator → Responder`.

### 1. Cron

Enabled automatically by `main.ts`. The default cron sensor emits a `RawSignal` every 60 seconds.

### 2. Webhook

Send a POST to the webhook sensor (default `http://localhost:3000/webhook`):

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"body": "Summarize the latest deployment notes"}'
```

The response will be `202 Accepted` with `{ "received": true }`.

### 3. File watcher

Create or modify a file under `./watched`:

```bash
mkdir -p watched
echo "Analyze this quarterly report" > watched/report.txt
```

### 4. Email

Email support requires real IMAP credentials. The skeleton is in `src/sensors/email-sensor.ts`. To enable it, create an `EmailSensor` in `src/main.ts` with a config object:

```typescript
factory.registerSensor(new EmailSensor({
  host: "imap.gmail.com",
  port: 993,
  user: process.env.EMAIL_USER!,
  password: process.env.EMAIL_PASS!,
  pollIntervalMs: 60_000,
}));
```

Send an email to the configured inbox; the sensor polls for unseen messages.

### 5. Slack

Slack support requires a Slack app token and signing secret. The skeleton is in `src/sensors/slack-sensor.ts`. To enable it, create a `SlackSensor` in `src/main.ts`:

```typescript
factory.registerSensor(new SlackSensor({
  token: process.env.SLACK_BOT_TOKEN!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  port: 3001,
}));
```

Mention or DM the bot; the sensor emits a signal for each message event.

## Development

### Verified command order

Run these in order before committing:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src/
npm test            # vitest run
```

Shortcut:

```bash
npm run typecheck && npm run lint && npm test
```

### Run a single test file

```bash
npx vitest run src/core/__tests__/logger.test.ts
```

### Watch tests

```bash
npm run test:watch
```

### Project conventions

- ESM project — imports use `.js` extensions even in `.ts` files.
- `strict: true` and `noUncheckedIndexedAccess: true`.
- `any` is forbidden; use `unknown` and narrow.
- Unused variables must start with `_`.

### Useful files

- `factory.config.json` — runtime model/agent configuration.
- `.env` — API keys and transport credentials (gitignored).
- `doc/architecture.md` — design decisions.
- `doc/next-steps.md` — roadmap and checklist.
- `AGENTS.md` — concise notes for AI agents working in this repo.
