# AI Factory Database Migration Guide

## Overview

This document describes the migration from v1 schema (single `tasks` table) to v2 schema with support for persisting agent and model configurations, theme settings, and full CRUD operations.

## Current State (v1)

### Existing Tables

**tasks** - Primary table used by `SQLiteTaskRepository`
- `id` TEXT PRIMARY KEY
- `task` TEXT NOT NULL (JSON serialized Task)
- `result` TEXT (JSON serialized FinalResult, nullable)
- `status` TEXT NOT NULL
- `conversation` TEXT (JSON serialized ConversationTurn[], nullable)
- `created_at` INTEGER NOT NULL
- `updated_at` INTEGER NOT NULL

## New Tables (v2)

### settings

Stores global application settings including UI theme.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Fixed value: "app_settings" |
| theme | TEXT NOT NULL | UI theme: 'synthwave84', 'tokyonight', 'zenburn' |
| ui_layout | TEXT | Layout preference (default: 'dashboard') |
| auto_refresh_ms | INTEGER | Auto-refresh interval in milliseconds |
| max_tasks_display | INTEGER | Maximum tasks shown in UI |
| created_at | INTEGER | Timestamp of creation |
| updated_at | INTEGER | Timestamp of last update |

### models

Stores runtime model configurations with versioning support.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | "provider:modelId" composite key |
| provider | TEXT NOT NULL | LLM provider name |
| modelId | TEXT NOT NULL | Model identifier |
| maxTokens | INTEGER | Maximum tokens for the model |
| costPer1kInput | REAL | Cost per 1k input tokens (USD) |
| costPer1kOutput | REAL | Cost per 1k output tokens (USD) |
| capabilities | TEXT | JSON array of capability tags |
| ownedBy | TEXT | Owner/organization name |
| version | INTEGER | Configuration version (increments on update) |
| isActive | INTEGER | 1 = active, 0 = inactive |
| discoveredAt | INTEGER | Timestamp when model was discovered |
| configSource | TEXT | 'static' (from config) or 'discovered' |
| createdAt | INTEGER | Timestamp of creation |
| updatedAt | INTEGER | Timestamp of last update |

### agents

Stores runtime agent configurations with versioning support.

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
| timeoutMs | INTEGER | Request timeout in milliseconds |
| maxRetries | INTEGER | Maximum retry count |
| version | INTEGER | Configuration version |
| isActive | INTEGER | 1 = active, 0 = inactive |
| configSource | TEXT | 'static' or 'custom' |
| description | TEXT | Human-readable description |
| metadata | TEXT | Additional JSON configuration |
| createdAt | INTEGER | Timestamp of creation |
| updatedAt | INTEGER | Timestamp of last update |

### config_history

Tracks all configuration changes for auditing and rollback capabilities.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY | Auto-incrementing ID |
| entityType | TEXT | 'agent' or 'model' |
| entityId | TEXT | Reference to agent.id or model.id |
| operation | TEXT | 'create', 'update', or 'delete' |
| oldData | TEXT | JSON of previous state (nullable) |
| newData | TEXT | JSON of new state (nullable) |
| versionBefore | INTEGER | Previous version number |
| versionAfter | INTEGER | New version number |
| changedBy | TEXT | User or system identifier |
| changedAt | INTEGER | Timestamp of change |
| description | TEXT | Change description |

### tasks_v2 (optional enhanced tasks)

Enhanced version of the tasks table with foreign key relationships.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Task ID |
| task | TEXT NOT NULL | JSON serialized Task object |
| result | TEXT | JSON serialized FinalResult |
| status | TEXT NOT NULL | Task status |
| conversation | TEXT | JSON serialized ConversationTurn[] |
| created_at | INTEGER | Creation timestamp |
| updated_at | INTEGER | Last update timestamp |
| agent_id | TEXT | Foreign key to agents.id |
| model_id | TEXT | Foreign key to models.id |
| priority | TEXT | Task priority |
| budget_used | REAL | Cost incurred by task |
| estimated_tokens | INTEGER | From ComplexityScore |
| actual_tokens_input | INTEGER | Input token count |
| actual_tokens_output | INTEGER | Output token count |
| latency_ms | INTEGER | Execution latency in ms |

## Views

### v_active_agents

View showing only active agents with their preferred models aggregated.

### v_active_models

View showing only active models with all their configuration.

### v_task_summaries

View providing task summaries with agent and model information joined.

## Migration Steps

### 1. Backup Current Database

```bash
cp /Users/cbabos/work/ai-factory/ai-factory.db /Users/cbabos/work/ai-factory/ai-factory.db.backup
```

### 2. Run Schema Changes

Execute the `CREATE TABLE` statements from `schema.sql`.

### 3. Populate Default Settings

```sql
INSERT OR IGNORE INTO settings (id, theme, ui_layout, auto_refresh_ms, max_tasks_display, created_at, updated_at)
VALUES (
    'app_settings',
    'synthwave84',
    'dashboard',
    5000,
    100,
    strftime('%s', 'now'),
    strftime('%s', 'now')
);
```

### 4. Populate Models from factory.config.json

Read the `models` array from `factory.config.json` and insert each model:

```sql
INSERT INTO models (id, provider, modelId, maxTokens, costPer1kInput, costPer1kOutput, capabilities, ownedBy, version, isActive, configSource, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'static', strftime('%s', 'now'), strftime('%s', 'now'));
```

### 5. Populate Agents from factory.config.json

Read the `agents` array from `factory.config.json` and insert each agent:

```sql
INSERT INTO agents (id, name, tags, complexityMin, complexityMax, tokenProfileMin, tokenProfileMax, tokenProfileTypical, preferredModels, timeoutMs, maxRetries, version, isActive, configSource, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'static', strftime('%s', 'now'), strftime('%s', 'now'));
```

### 6. Optional: Migrate Existing Tasks

Add agent_id and model_id references to existing tasks as they are processed by the system (not immediately required).

## Backward Compatibility

The original `tasks` table is preserved. New tasks can be written to `tasks_v2` while existing queries use `tasks`. A migration tool can be run during deployment to migrate existing data.

## Indexes

All new tables include indexes on:
- Primary keys
- Foreign key columns (where applicable)
- Common query fields (provider, createdAt, updatedAt, isActive)
- JSON array contents (tags, capabilities)

## CRUD Operations

### Models

- **Create**: INSERT with auto-incrementing version = 1
- **Read**: SELECT by id or provider
- **Update**: UPDATE with version increment and history entry
- **Delete**: UPDATE isActive = 0 (soft delete) or hard DELETE with history

### Agents

- **Create**: INSERT with auto-incrementing version = 1
- **Read**: SELECT by id or findByTags
- **Update**: UPDATE with version increment and history entry
- **Delete**: UPDATE isActive = 0 (soft delete) or hard DELETE with history

### Settings

- **Create**: INSERT for id='app_settings' (one-time)
- **Read**: SELECT by id='app_settings'
- **Update**: UPDATE for id='app_settings'
- **Delete**: Not supported (settings are required)

## Testing the Migration

After migration, verify:

1. All agents from factory.config.json are in agents table
2. All models from factory.config.json are in models table
3. Settings table has the app_settings row
4. New indexes are created
5. Views return expected data

```bash
sqlite3 ai-factory.db "SELECT COUNT(*) FROM agents;"
sqlite3 ai-factory.db "SELECT COUNT(*) FROM models;"
sqlite3 ai-factory.db "SELECT * FROM settings;"
```

## Rollback Plan

If issues occur:

1. Restore from backup:
   ```bash
   cp /Users/cbabos/work/ai-factory/ai-factory.db.backup /Users/cbabos/work/ai-factory/ai-factory.db
   ```

2. Drop new tables if needed:
   ```sql
   DROP TABLE IF EXISTS settings;
   DROP TABLE IF EXISTS models;
   DROP TABLE IF EXISTS agents;
   DROP TABLE IF EXISTS config_history;
   DROP TABLE IF EXISTS tasks_v2;
   DROP VIEW IF EXISTS v_active_agents;
   DROP VIEW IF EXISTS v_active_models;
   DROP VIEW IF EXISTS v_task_summaries;
   ```

## Future Enhancements

1. Add triggers to automatically update `updated_at` timestamps
2. Add cascading foreign key relationships
3. Create materialized views for complex aggregations
4. Add full-text search on agent descriptions and model capabilities
5. Implement soft delete with tombstone records
