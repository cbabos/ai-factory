# AI Factory

A lightweight, pluggable AI pipeline system. It captures signals from external sources (cron, webhooks, email, Slack, filesystem), routes them through either the adaptive agent swarm or a deterministic workflow engine, and delivers results back to the originating channel.

## What it does

1. **Inbound** — Sensors detect external events and emit `RawSignal` objects.
2. **Adapt** — Channel-specific adapters normalize signals into `Task` objects.
3. **Orchestrate** — The `Orchestrator` estimates complexity, decomposes large tasks, selects the cheapest capable model, dispatches to agents, and aggregates results. Tasks can also opt into deterministic workflow execution with human checkpoints.
4. **Outbound** — Responders deliver the final result back to the source channel.

## Workflow + HITL status

The project now includes a first-class workflow runtime with:

- versioned workflow definitions and workflow runs in SQLite
- a visual workflow editor and run detail UI
- human task inbox and approval/clarification resume flow
- task-scoped workflow artifacts saved under `out/artifacts/<taskId>/...`
- seeded workflow `requirements-clarify-and-approve@2` that:
  - drafts a structured markdown requirements document
  - derives machine-readable open questions
  - renders clarification requests as questionnaire fields plus bulk answer fallback
  - exposes generated documents to approvers through the UI

Current workflow APIs include:

- `GET /api/workflows`
- `GET /api/workflows/:id`
- `POST /api/workflows`
- `PUT /api/workflows/:id`
- `GET /api/workflow-runs`
- `GET /api/workflow-runs/:id`
- `GET /api/human-tasks`
- `POST /api/human-tasks/:id/respond`
- `GET /api/artifacts`
- `GET /api/artifacts/:id`
- `GET /api/artifacts/:id/content`

The whole system is wired together by `AIFactory` (`src/factory.ts`).

At startup `main.ts` loads optional bootstrap config defaults, then calls `await factory.initialize()`, which queries each configured LLM caller for its available models. Providers come from environment configuration, and discovered models become the runtime source of truth.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Providers are enabled from `.env`. Cloud providers are enabled when their API key is present. Local OpenAI-compatible providers can be enabled by setting a non-empty base URL override. For example, set `OMLX_BASE_URL=http://localhost:8000/v1` or `OLLAMA_BASE_URL=http://localhost:11434/v1`. If authentication is required, also set the matching `*_API_KEY`.

`factory.config.json` is optional bootstrap seed data. It does not need to exist. Providers come from `.env`, runtime models come from discovery, and orchestration/budget/dispatch settings are persisted in SQLite and editable from the UI.

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
- an API server on port `3001` that serves workflow/task/human-task endpoints and the built UI when available

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

- `factory.config.json` — optional bootstrap seed data when you want to override defaults before the DB is populated.
- `.env` — API keys and transport credentials (gitignored).
- `doc/architecture.md` — design decisions.
- `doc/next-steps.md` — roadmap and checklist.
- `doc/workflow-hitl-plan.md` — current workflow/HITL implementation status and follow-up plan.
- `AGENTS.md` — concise notes for AI agents working in this repo.
