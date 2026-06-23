# AI Factory Runtime Configuration Schema

## Overview

This document describes the runtime configuration schema for persisting agents, models, and application settings in SQLite.

## Database Location

- Default path: `/Users/cbabos/work/ai-factory/ai-factory.db`

## New Tables

### 1. settings

Stores global application settings including UI theme, refresh intervals, and display preferences.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Fixed value: "app_settings" (single row table) |
| theme | TEXT NOT NULL | UI theme: 'synthwave84', 'tokyonight', 'zenburn' |
| ui_layout | TEXT | Layout preference (default: 'dashboard') |
| auto_refresh_ms | INTEGER | Auto-refresh interval in milliseconds (default: 5000) |
| max_tasks_display | INTEGER | Maximum tasks shown in UI (default: 100) |
| created_at | INTEGER | Unix timestamp of creation |
| updated_at | INTEGER | Unix timestamp of last update |

**Use Cases:**
- Persist user theme preferences across sessions
- Configure refresh intervals for dashboards
- Set default display limits for task lists

**CRUD Operations:**
- **Read**: `SELECT * FROM settings WHERE id = 'app_settings'`
- **Update**: `UPDATE settings SET theme = ?, ... WHERE id = 'app_settings'`

### 2. models

Persisted runtime model configurations with versioning support for both static config and discovered models.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Composite key: "provider:modelId" |
| provider | TEXT NOT NULL | LLM provider name |
| modelId | TEXT NOT NULL | Model identifier |
| maxTokens | INTEGER | Maximum tokens for the model (default: 4096) |
| costPer1kInput | REAL | Cost per 1k input tokens in USD (default: 0.001) |
| costPer1kOutput | REAL | Cost per 1k output tokens in USD (default: 0.001) |
| capabilities | TEXT | JSON array of capability tags |
| ownedBy | TEXT | Owner/organization name (e.g., 'openai', 'google') |
| version | INTEGER | Configuration version (increments on update) |
| isActive | INTEGER | 1 = active, 0 = inactive (soft delete) |
| discoveredAt | INTEGER | Unix timestamp when model was discovered |
| configSource | TEXT | 'static' (from factory.config.json) or 'discovered' |
| createdAt | INTEGER | Unix timestamp of creation |
| updatedAt | INTEGER | Unix timestamp of last update |

**Indexes:**
- `idx_models_provider` - Provider-based queries
- `idx_models_cost` - Cost-based sorting
- `idx_models_capabilities` - Capability filtering

**Use Cases:**
- Maintain runtime model list beyond static config
- Track discovered models from LLM providers
- Support model versioning and rollback
- Enable/disable models without code changes

**CRUD Operations:**
- **Create**: `INSERT INTO models (...) VALUES (...) ON CONFLICT(id) DO UPDATE`
- **Read**: `SELECT * FROM models WHERE id = ?`
- **Update**: Increment version, update config
- **Delete**: Soft delete by setting `isActive = 0`

### 3. agents

Persisted runtime agent configurations with versioning support.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Agent identifier |
| name | TEXT NOT NULL | Agent name |
| tags | TEXT | JSON array of capability tags |
| complexityMin | INTEGER | Minimum complexity score supported |
| complexityMax | INTEGER | Maximum complexity score supported |
| tokenProfileMin | INTEGER | Minimum token estimate |
| tokenProfileMax | INTEGER | Maximum token estimate |
| tokenProfileTypical | INTEGER | Typical/expected token count |
| preferredModels | TEXT | JSON array of preferred modelIds |
| timeoutMs | INTEGER | Request timeout in milliseconds (default: 30000) |
| maxRetries | INTEGER | Maximum retry count (default: 2) |
| version | INTEGER | Configuration version |
| isActive | INTEGER | 1 = active, 0 = inactive (soft delete) |
| configSource | TEXT | 'static' or 'custom' |
| description | TEXT | Human-readable description |
| metadata | TEXT | Additional JSON configuration |
| createdAt | INTEGER | Unix timestamp of creation |
| updatedAt | INTEGER | Unix timestamp of last update |

**Indexes:**
- `idx_agents_tags` - Tag-based queries
- `idx_agents_complexity` - Complexity range filtering
- `idx_agents_isActive` - Soft delete filtering

**Use Cases:**
- Persist dynamically created agents
- Support agent customization without code
- Enable/disable agents at runtime
- Track agent evolution over time

**CRUD Operations:**
- **Create**: `INSERT INTO agents (...) VALUES (...) ON CONFLICT(id) DO UPDATE`
- **Read**: `SELECT * FROM agents WHERE id = ?`
- **Update**: Increment version, update config
- **Delete**: Soft delete by setting `isActive = 0`

### 4. config_history

Audit trail table tracking all configuration changes for debugging and rollback capabilities.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | Auto-incrementing ID |
| entityType | TEXT | 'agent' or 'model' |
| entityId | TEXT | Reference to agent.id or model.id |
| operation | TEXT | 'create', 'update', 'delete', or 'soft_delete' |
| oldData | TEXT | JSON of previous state (nullable) |
| newData | TEXT | JSON of new state (nullable) |
| versionBefore | INTEGER | Previous version number |
| versionAfter | INTEGER | New version number |
| changedBy | TEXT | User or system identifier |
| changedAt | INTEGER | Unix timestamp of change |
| description | TEXT | Human-readable change description |

**Indexes:**
- `idx_config_history_entity` - Entity-based queries
- `idx_config_history_date` - Timeline queries

**Use Cases:**
- Track who changed what and when
- Debug configuration issues
- Rollback to previous configurations
- Audit compliance

**CRUD Operations:**
- **Create**: `INSERT INTO config_history (...) VALUES (...)`
- **Read**: `SELECT * FROM config_history WHERE entityType = ? AND entityId = ? ORDER BY changedAt DESC`

## Views

### v_active_agents

View showing only active agents for efficient querying.

**Columns:** id, name, description, tags, complexityMin, complexityMax, tokenProfileTypical, timeoutMs, maxRetries, version, preferredModels, configSource, createdAt, updatedAt

**Use Case:** Dashboard showing available agents without filtering for isActive

### v_active_models

View showing only active models for efficient querying.

**Columns:** id, provider, modelId, maxTokens, costPer1kInput, costPer1kOutput, capabilities, ownedBy, version, configSource, createdAt, updatedAt

**Use Case:** Model selector UI without filtering for isActive

## Migration Instructions

### Step 1: Backup Database

```bash
cp /Users/cbabos/work/ai-factory/ai-factory.db /Users/cbabos/work/ai-factory/ai-factory.db.backup
```

### Step 2: Apply Migration

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db < /Users/cbabos/work/ai-factory/doc/migrations/001-add-runtime-config.sql
```

### Step 3: Verify Schema

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db ".schema"
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db ".indexes"
```

### Step 4: Populate Initial Data (Optional)

```bash
# Set default theme
sqlite3 ai-factory.db "INSERT OR IGNORE INTO settings (id, theme, ui_layout, auto_refresh_ms, max_tasks_display, created_at, updated_at) VALUES ('app_settings', 'synthwave84', 'dashboard', 5000, 100, strftime('%s', 'now'), strftime('%s', 'now'));"

# Add default agents
sqlite3 ai-factory.db "INSERT OR IGNORE INTO agents (...) VALUES (...);"

# Add default models
sqlite3 ai-factory.db "INSERT OR IGNORE INTO models (...) VALUES (...);"
```

## TypeScript Implementation

### SQLiteConfigStore

```typescript
import { SQLiteConfigStore } from "./core/sqlite-config-store.js";

const store = new SQLiteConfigStore("ai-factory.db");

// Get current settings
const settings = store.getSettings();

// Update settings
const updated = store.updateSettings({
  theme: "tokyonight",
  auto_refresh_ms: 10000,
});

// Save complete settings
const saved = store.saveSettings({
  theme: "zenburn",
  ui_layout: "compact",
  auto_refresh_ms: 8000,
  max_tasks_display: 50,
});
```

### SQLiteAgentStore

```typescript
import { SQLiteAgentStore } from "./core/agent-store.js";

const store = new SQLiteAgentStore("ai-factory.db");

// Create agent
const agent = store.save({
  id: "custom-agent",
  name: "Custom Analysis Agent",
  tags: ["analysis", "custom"],
  complexityMin: 2,
  complexityMax: 8,
  tokenProfileMin: 1000,
  tokenProfileMax: 10000,
  tokenProfileTypical: 5000,
  preferredModels: ["gpt-oss-20b-MXFP4-Q8"],
  timeoutMs: 60000,
  maxRetries: 3,
});

// Get agent
const found = store.get("custom-agent");

// Update agent
const updated = store.update("custom-agent", {
  maxRetries: 5,
  timeoutMs: 120000,
});

// Soft delete
store.softDelete("custom-agent");

// Find by tags
const foundByTags = store.findByTags(["analysis", "reasoning"]);
```

### SQLiteModelStore

```typescript
import { SQLiteModelStore } from "./core/model-store.js";

const store = new SQLiteModelStore("ai-factory.db");

// Create model
const model = store.save({
  provider: "openai",
  modelId: "gpt-4-turbo",
  maxTokens: 32768,
  costPer1kInput: 0.01,
  costPer1kOutput: 0.03,
  capabilities: ["reasoning", "code", "analysis"],
  ownedBy: "openai",
  configSource: "discovered",
});

// Get model
const found = store.get("openai", "gpt-4-turbo");

// Update model
const updated = store.update("openai", "gpt-4-turbo", {
  costPer1kInput: 0.008,
  costPer1kOutput: 0.024,
});

// Soft delete
store.softDelete("openai", "gpt-4-turbo");

// Find by capability
const foundByCap = store.findByCapability("code");
```

## Usage in AIFactory

The stores can be integrated into `AIFactory` to enable runtime configuration:

```typescript
// In factory.ts constructor or initialize()
const configStore = new SQLiteConfigStore(config.databasePath);
const agentStore = new SQLiteAgentStore(config.databasePath);
const modelStore = new SQLiteModelStore(config.databasePath);

// Persist settings on startup
if (config.settings) {
  configStore.saveSettings(config.settings);
}

// Load models from database
const dbModels = modelStore.getAllActive();
if (dbModels.length > 0) {
  config.models = dbModels;
}

// Load agents from database
const dbAgents = agentStore.getAll();
if (dbAgents.length > 0) {
  config.agents = dbAgents;
}
```

## Backward Compatibility

- Existing `tasks` table is preserved
- New tables are created with `IF NOT EXISTS`
- All existing data remains unchanged
- Migration can be applied incrementally

## Future Enhancements

1. Add triggers for automatic `updated_at` timestamps
2. Implement cascading foreign keys
3. Add materialized views for aggregations
4. Create sync mechanism for multi-instance deployments
5. Add full-text search on agent descriptions
