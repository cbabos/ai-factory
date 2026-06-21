# AI Factory — Agent Notes

Single-package TypeScript/Node project. ESM (`"type": "module"`).

## Verified Commands

Run in this order before considering a change complete:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src/
npm test            # vitest run
```

Shortcut:

```bash
npm run typecheck && npm run lint && npm test
```

## Key Project Facts

- **No build step is required for tests.** `npm run build` runs `tsc` and writes to `dist/`.
- **Test framework:** Vitest with `globals: true`, pattern `src/**/*.test.ts`.
- **Import extensions:** TypeScript imports use `.js` extensions (e.g., `import { x } from "./foo.js"`), even though source files are `.ts`.
- **Strict guardrails:**
  - `@typescript-eslint/no-explicit-any` is `error` — use `unknown` and narrow.
  - Unused variables must start with `_`.
  - `strict: true` and `noUncheckedIndexedAccess: true`.
- **Entrypoints:**
  - Library barrel: `src/index.ts`
  - Runtime: `src/main.ts` (loads `factory.config.json`)
  - Wiring class: `src/factory.ts` (`AIFactory`)

## Testing Tips

- **Inject fake LLM callers in integration tests.** `AIFactoryOptions` accepts `callers?: Map<Provider, ILLMCaller>`. Pass a fake caller to avoid real API calls.
- **Silence logs in tests.** Pass `logger: new NoopLogger()` via `AIFactoryOptions`, or pass `NoopLogger` directly to `EventBus`, `Subject`, or `ModelCatalog` constructors.
- **Run a single test file:**

  ```bash
  npx vitest run src/core/__tests__/logger.test.ts
  ```

## Runtime Notes

- **Runtime loads `.env`.** `src/main.ts` imports `dotenv/config` at the top, so environment variables are read from `.env` automatically.
- **Copy `.env.example` to `.env`** and fill in real values. `.env` is gitignored.
- **Real LLM callers need env vars** listed in `src/factory.ts` (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY`).
- **Real outbound integrations need env vars:** `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` for email; `SLACK_BOT_TOKEN`/`SLACK_SIGNING_SECRET` for Slack.
- Adapters, responders, and sensors must be registered with `AIFactory` before calling `start()`.
- `CronSensor` is functional. Real transport skeletons are in place for webhook, file-system, email, and Slack (email/Slack require valid credentials to reach external services).

## Docs

- Architecture and design decisions: `doc/architecture.md`
- Roadmap and completion checklist: `doc/next-steps.md`
