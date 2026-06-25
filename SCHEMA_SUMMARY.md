# AI Factory SQLite Database Schema - Summary

## Overview

Complete SQLite database schema for the AI Factory UI project with support for:
- Persisting runtime agent configurations (from factory.config.json)
- Persisting runtime model configurations (from factory.config.json)
- Persisting theme settings (synthwave84/tokyonight/zenburn)
- Maintaining backward compatibility with existing tasks table
- CRUD operations for agents and models
- Versioning for agents and models

## Design Decisions

### 1. Table Structure
```
settings      - Global app configuration (UI theme, layout, refresh)
models        - LLM model configurations with versioning
agents        - Agent configurations with versioning
config_history - Audit trail for configuration changes
tasks_v2      - Enhanced tasks with foreign keys (optional)
```

### 2. Key Decisions

| Decision | Rationale |
|----------|-----------|
| JSON arrays for multi-valued fields | Simpler than EAV for <1000 records |
| Soft delete (isActive flag) | Allow recovery without loosing history |
| Version column | Track configuration changes |
| Single settings row | Ensure single source of truth |
| config_history table | Audit trail and rollback capability |

### 3. Backward Compatibility
- Original `tasks` table preserved
- New `tasks_v2` table added for enhanced functionality
- No breaking changes to existing data

## Files Created

| File | Purpose |
|------|---------|
| `doc/schema.sql` | Complete SQL schema with indexes and views |
| `doc/migration.md` | Detailed migration guide |
| `src/core/sqlite-config-store.ts` | TypeScript implementation |
| `SCHEMA_DESIGN.md` | Comprehensive design documentation |
| `QUICKSTART_SCHEMA.md` | Quick start guide with examples |
| `SCHEMA_SUMMARY.md` | This summary document |

## Schema Details

### settings Table
```sql
CREATE TABLE settings (
    id TEXT PRIMARY KEY CHECK (id = 'app_settings'),
    theme TEXT NOT NULL CHECK (theme IN ('synthwave84', 'tokyonight', 'zenburn')),
    ui_layout TEXT DEFAULT 'dashboard',
    auto_refresh_ms INTEGER DEFAULT 5000,
    max_tasks_display INTEGER DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
```

### models Table
```sql
CREATE TABLE models (
    id TEXT PRIMARY KEY,  -- "provider:modelId"
    provider TEXT NOT NULL,
    modelId TEXT NOT NULL,
    maxTokens INTEGER,
    costPer1kInput REAL,
    costPer1kOutput REAL,
    capabilities TEXT,  -- JSON array
    version INTEGER DEFAULT 1,
    isActive INTEGER DEFAULT 1,
    discoveredAt INTEGER,
    configSource TEXT DEFAULT 'static',
    createdAt INTEGER,
    updatedAt INTEGER,
    UNIQUE(provider, modelId)
);
```

### agents Table
```sql
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tags TEXT,  -- JSON array
    complexityMin INTEGER,
    complexityMax INTEGER,
    tokenProfileMin INTEGER,
    tokenProfileMax INTEGER,
    tokenProfileTypical INTEGER,
    preferredModels TEXT,  -- JSON array
    timeoutMs INTEGER,
    maxRetries INTEGER,
    version INTEGER DEFAULT 1,
    isActive INTEGER DEFAULT 1,
    configSource TEXT DEFAULT 'static',
    description TEXT,
    metadata TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    UNIQUE(name)
);
```

### config_history Table
```sql
CREATE TABLE config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entityType TEXT CHECK (entityType IN ('agent', 'model')),
    entityId TEXT NOT NULL,
    operation TEXT CHECK (operation IN ('create', 'update', 'delete')),
    oldData TEXT,
    newData TEXT,
    versionBefore INTEGER,
    versionAfter INTEGER,
    changedBy TEXT DEFAULT 'system',
    changedAt INTEGER,
    description TEXT
);
```

## CRUD Operations

### Models
- **Create:** `INSERT INTO models ...` (version=1)
- **Read:** `SELECT * FROM models WHERE id = ?`
- **Update:** `UPDATE models SET ... version=version+1` (log to config_history)
- **Delete:** `UPDATE models SET isActive=0` (soft delete)

### Agents
- **Create:** `INSERT INTO agents ...` (version=1)
- **Read:** `SELECT * FROM agents WHERE id = ?`
- **findByTags:** `SELECT * FROM agents WHERE tags LIKE '%tag%'`
- **findByComplexity:** `SELECT * FROM agents WHERE min <= X AND max >= X`
- **Update:** `UPDATE agents SET ... version=version+1` (log to config_history)
- **Delete:** `UPDATE agents SET isActive=0` (soft delete)

### Settings
- **Read:** `SELECT * FROM settings WHERE id = 'app_settings'`
- **Update:** `UPDATE settings SET theme = ? WHERE id = 'app_settings'`

## Views

### v_active_agents
Shows only active agents with aggregated preferred models.

### v_active_models
Shows only active models with all configuration.

### v_task_summaries
Task summaries with agent and model information joined.

## Indexes

```sql
-- Models
CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_cost ON models(costPer1kInput);

-- Agents
CREATE INDEX idx_agents_tags ON agents(tags);
CREATE INDEX idx_agents_complexity ON agents(complexityMin, complexityMax);

-- Config History
CREATE INDEX idx_config_history_entity ON config_history(entityType, entityId);
CREATE INDEX idx_config_history_date ON config_history(changedAt DESC);

-- Tasks v2
CREATE INDEX idx_tasks_status ON tasks_v2(status);
CREATE INDEX idx_tasks_created ON tasks_v2(created_at DESC);
CREATE INDEX idx_tasks_agent ON tasks_v2(agent_id);
CREATE INDEX idx_tasks_model ON tasks_v2(model_id);
```

## Migration Steps

1. **Backup existing database**
   ```bash
   cp ai-factory.db ai-factory.db.backup
   ```

2. **Create new tables** (run `doc/schema.sql`)

3. **Populate with factory.config.json data**
   - Models → models table
   - Agents → agents table

4. **Set default settings**
   ```bash
   INSERT INTO settings (id, theme, created_at, updated_at)
   VALUES ('app_settings', 'synthwave84', strftime('%s','now'), strftime('%s','now'));
   ```

5. **Verify**
   ```bash
   sqlite3 ai-factory.db "SELECT COUNT(*) FROM models; SELECT COUNT(*) FROM agents;"
   ```

## Testing

### Verify Tables
```bash
sqlite3 ai-factory.db ".tables"
```

### Check Settings
```bash
sqlite3 ai-factory.db "SELECT * FROM settings;"
```

### Check Models
```bash
sqlite3 ai-factory.db "SELECT id, provider, modelId FROM models;"
```

### Check Agents
```bash
sqlite3 ai-factory.db "SELECT id, name, tags FROM agents;"
```

## TypeScript API

```typescript
import { SQLiteConfigStore } from "./src/core/sqlite-config-store.js";

const store = new SQLiteConfigStore({ 
  dbPath: 'ai-factory.db',
  logger: console
});

// Set theme
await store.setTheme('tokyonight');

// Save model
await store.saveModel({
  provider: 'omlx',
  modelId: 'gpt-4',
  maxTokens: 32768,
  costPer1kInput: 0.001,
  costPer1kOutput: 0.002,
  capabilities: ['code-generation'],
});

// Save agent
await store.saveAgent({
  id: 'search-agent',
  tags: ['search', 'codebase'],
  complexityRange: [1, 10],
  tokenProfile: { min: 100, max: 1000, typical: 500 },
  preferredModels: ['gpt-4'],
  timeoutMs: 30000,
  maxRetries: 2,
});

// Get all agents
const agents = await store.getAgents();

// Get configuration history
const history = await store.getConfigHistory('agent', 'search-agent');

// Cleanup
store.close();
```

## Rollback

If migration fails:
```bash
cp ai-factory.db.backup ai-factory.db
sqlite3 ai-factory.db "
  DROP TABLE IF EXISTS settings;
  DROP TABLE IF EXISTS models;
  DROP TABLE IF EXISTS agents;
  DROP TABLE IF EXISTS config_history;
  DROP TABLE IF EXISTS tasks_v2;
  DROP VIEW IF EXISTS v_active_agents;
  DROP VIEW IF EXISTS v_active_models;
  DROP VIEW IF EXISTS v_task_summaries;
"
```

## Requirements Met

| Requirement | Status |
|-------------|--------|
| Persist runtime agent configurations | ✅ agents table |
| Persist runtime model configurations | ✅ models table |
| Persist theme settings | ✅ settings table |
| Maintain backward compatibility | ✅ tasks table preserved |
| CRUD for agents | ✅ create, read, update, delete |
| CRUD for models | ✅ create, read, update, delete |
| Versioning for agents | ✅ version column + config_history |
| Versioning for models | ✅ version column + config_history |
| Theme options | ✅ synthwave84, tokyonight, zenburn |

## Next Steps

1. Run migration script in production
2. Update factory.config.json schema reference
3. Build UI components for agent/edit
4. Create configuration history UI
5. Implement automatic backups

## Questions Answered

**Q: Why not normalize JSON arrays?**  
A: Simpler schema for static configurations with <1000 records. EAV overkill.

**Q: Why soft delete?**  
A: Allows recovery and preserves history. Hard delete still available if needed.

**Q: Single table for settings?**  
A: Single row with CHECK constraint ensures consistency and validates input.

**Q: Foreign keys vs. no foreign keys?**  
A: Foreign keys supported in tasks_v2 but not strictly required for this scale.

## Conclusion

This schema provides a complete, backwards-compatible solution for persisting AI Factory configurations in SQLite while maintaining the existing tasks table. The design prioritizes simplicity, auditability, and ease of use over complex normalization, which is appropriate for this use case.
