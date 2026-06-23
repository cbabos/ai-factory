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

## Project Structure

```
src/
├── core/          # Core architecture (event bus, tracer, budget, etc.)
├── llm/           # LLM providers (OpenAI, Anthropic, Google, etc.)
├── agents/        # Agent implementations
├── responders/    # Response handlers
├── sensors/       # Event sensors (webhook, file, email, Slack)
├── adapters/      # Signal adapters
├── tools/         # Tool registry and integrations
├── ui/            # React 19 UI application
│   ├── components/  # Reusable components
│   ├── pages/       # Page components
│   ├── theme/       # Theme system
│   ├── hooks/       # Custom hooks
│   └── utils/       # Utilities
└── main.ts        # Runtime entrypoint
```

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

## UI Application

### React 19 App

The UI is a React 19 application built with TypeScript and Vite. It provides a web-based dashboard for managing AI agents, models, and tasks.

**Entry Point:**
```bash
npm run build
# then serve dist/ with a static server
```

For development:
```bash
npx vite src/ui --port 3000
```

### Runtime Configuration

The UI loads runtime configuration from environment variables:

- `VITE_API_URL` — API server endpoint (default: `http://localhost:3001`)
- `VITE_THEME` — Default theme (`synthwave84` | `tokyonight` | `zenburn`)

Configuration is loaded from `.env` in the project root (via `dotenv/config` in `main.ts`).

### Theme System

The UI supports three themes, defined in `src/ui/theme/constants.ts`:

| Theme | ID | Description |
|-------|-----|-------------|
| Synthwave 84 | `synthwave84` | Neon pink/purple high-contrast cyberpunk theme |
| Tokyo Night | `tokyonight` | Soft purple/blue reduced brightness theme |
| Zenburn | `zenburn` | Low-contrast grayscale eye comfort theme |

**Theme API:**
```typescript
import { useTheme, ThemeSwitcher, SettingsPanel } from './ui/theme.js';

// Theme switcher component
<ThemeSwitcher />

// Settings panel with theme options
<SettingsPanel />

// Hook usage
const { currentTheme, setTheme, themeOptions } = useTheme();
setTheme('tokyonight');
```

**Theme Colors Interface:**
```typescript
interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  muted: string;
  border: string;
  background: string;
  foreground: string;
  fontFamily: string;
}
```

### API Endpoints

The UI communicates with the API server at `http://localhost:3001` (configurable via `VITE_API_URL`).

**Available Endpoints:**
- `GET /api/agents` — List all agents
- `GET /api/agents/:id` — Get agent details
- `POST /api/agents` — Create agent
- `PUT /api/agents/:id` — Update agent
- `DELETE /api/agents/:id` — Delete agent
- `GET /api/models` — List available models
- `GET /api/tasks` — List tasks
- `POST /api/tasks` — Create task
- `GET /api/tasks/:id` — Get task details

**Authentication:**
API endpoints are protected by a simple token-based auth. Set `API_SECRET_TOKEN` in `.env` to enable.

### Development

**UI Development Workflow:**

1. Start the UI development server:
   ```bash
   npx vite src/ui --port 3000
   ```

2. Make changes to components in `src/ui/components/`

3. Changes auto-reload via Vite HMR

**Component Structure:**
```
src/ui/components/
├── layout/      # Panel, Card, Grid, Section
├── forms/       # Input, TextArea, Select, MultiSelect
├── controls/    # Button, ToggleButton, ToggleCheckbox
├── ui/          # Badge, Alert, StatusIndicator
└── common/      # Reusable primitives
```

### Testing

UI tests use Vitest with React Testing Library:

```bash
# Run all UI tests
npm run test -- src/ui/

# Run a specific test file
npx vitest run src/ui/pages/__tests__/Agents.test.tsx

# Run tests with coverage
npm run test:coverage -- src/ui/
```

**Test Pattern:**
- Tests live alongside components in `__tests__/` directories
- Use React Testing Library for component testing
- Mock API calls with `vi.mock()` or test doubles

### API Usage Examples

**Making API Calls:**
```typescript
import { api } from './ui/services/api.js';

// Fetch agents
const agents = await api.get('/api/agents');

// Create agent
const newAgent = await api.post('/api/agents', {
  name: 'SearchAgent',
  model: 'gpt-4',
  capabilities: ['search', 'web'],
});

// Update agent
await api.put('/api/agents/:id', { capabilities: ['search', 'web', 'write'] });

// Delete agent
await api.delete('/api/agents/:id');
```

**Theme Management:**
```typescript
import { useTheme, saveThemePreference, loadThemePreference } from './ui/theme.js';

export function ThemeManager() {
  const { currentTheme, setTheme } = useTheme();

  const handleChange = (themeId: string) => {
    setTheme(themeId as ThemeId);
    saveThemePreference(themeId);
  };

  // Load saved preference on mount
  useEffect(() => {
    const saved = loadThemePreference();
    if (saved && saved !== currentTheme.id) {
      setTheme(saved);
    }
  }, []);

  return (
    <select value={currentTheme.id} onChange={(e) => handleChange(e.target.value)}>
      {themeOptions.map(theme => (
        <option key={theme.id} value={theme.id}>
          {theme.name}
        </option>
      ))}
    </select>
  );
}
```

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

## Runtime Configuration Examples

**Environment Variables (.env):**
```bash
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
MISTRAL_API_KEY=...
GROQ_API_KEY=...
DEEPSEEK_API_KEY=...

# UI Runtime
VITE_API_URL=http://localhost:3001
VITE_THEME=synthwave84

# Outbound Integrations
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=app-password
SMTP_FROM=you@gmail.com

SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

**Agent Configuration (factory.config.json):**
```json
{
  "agents": [
    {
      "id": "search-agent",
      "name": "SearchAgent",
      "model": "gpt-4",
      "capabilities": ["search", "web", "analysis"]
    },
    {
      "id": "executor-agent",
      "name": "ExecutorAgent",
      "model": "claude-3-opus",
      "capabilities": ["shell", "file", "execution"]
    }
  ],
  "models": [
    {
      "provider": "openai",
      "name": "gpt-4",
      "maxTokens": 8192
    }
  ],
  "theme": "synthwave84"
}
```

## Docs

- Architecture and design decisions: `doc/architecture.md`
- Roadmap and completion checklist: `doc/next-steps.md`
