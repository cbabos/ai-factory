# Quick Start: AI Factory Database Schema

## Overview

This guide helps you quickly set up and use the AI Factory SQLite database schema for persisting agent and model configurations.

## Prerequisites

- Node.js 18+
- SQLite 3.38+ (for JSON functions)
- Existing `ai-factory.db` database

## Installation (5 minutes)

### 1. Backup Existing Database

```bash
cp /Users/cbabos/work/ai-factory/ai-factory.db /Users/cbabos/work/ai-factory/ai-factory.db.backup
```

### 2. Create New Tables

```bash
# Create settings, models, agents, and config_history tables
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db << 'EOF'
-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY CHECK (id = 'app_settings'),
    theme TEXT NOT NULL CHECK (theme IN ('synthwave84', 'tokyonight', 'zenburn')),
    ui_layout TEXT DEFAULT 'dashboard',
    auto_refresh_ms INTEGER DEFAULT 5000,
    max_tasks_display INTEGER DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Models table
CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    modelId TEXT NOT NULL,
    maxTokens INTEGER NOT NULL DEFAULT 4096,
    costPer1kInput REAL NOT NULL DEFAULT 0.001,
    costPer1kOutput REAL NOT NULL DEFAULT 0.001,
    capabilities TEXT NOT NULL DEFAULT '[]',
    ownedBy TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    isActive INTEGER NOT NULL DEFAULT 1,
    discoveredAt INTEGER,
    configSource TEXT DEFAULT 'static',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(provider, modelId)
);

CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_cost ON models(costPer1kInput);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tags TEXT NOT NULL,
    complexityMin INTEGER NOT NULL,
    complexityMax INTEGER NOT NULL,
    tokenProfileMin INTEGER NOT NULL,
    tokenProfileMax INTEGER NOT NULL,
    tokenProfileTypical INTEGER NOT NULL,
    preferredModels TEXT,
    timeoutMs INTEGER NOT NULL DEFAULT 30000,
    maxRetries INTEGER NOT NULL DEFAULT 2,
    version INTEGER NOT NULL DEFAULT 1,
    isActive INTEGER NOT NULL DEFAULT 1,
    configSource TEXT DEFAULT 'static',
    description TEXT,
    metadata TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(name)
);

CREATE INDEX IF NOT EXISTS idx_agents_tags ON agents(tags);
CREATE INDEX IF NOT EXISTS idx_agents_complexity ON agents(complexityMin, complexityMax);

-- Config history table
CREATE TABLE IF NOT EXISTS config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entityType TEXT NOT NULL CHECK (entityType IN ('agent', 'model')),
    entityId TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    oldData TEXT,
    newData TEXT,
    versionBefore INTEGER NOT NULL,
    versionAfter INTEGER NOT NULL,
    changedBy TEXT DEFAULT 'system',
    changedAt INTEGER NOT NULL,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_config_history_entity ON config_history(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_config_history_date ON config_history(changedAt DESC);

-- Enhanced tasks table (optional)
CREATE TABLE IF NOT EXISTS tasks_v2 (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,
    result TEXT,
    status TEXT NOT NULL,
    conversation TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    agent_id TEXT,
    model_id TEXT,
    priority TEXT,
    budget_used REAL DEFAULT 0.0,
    estimated_tokens INTEGER,
    actual_tokens_input INTEGER,
    actual_tokens_output INTEGER,
    latency_ms INTEGER,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks_v2(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks_v2(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks_v2(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_model ON tasks_v2(model_id);
EOF
```

### 3. Verify Tables Created

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db ".tables"
```

Expected output:
```
agents       config_history  models       settings     tasks        tasks_v2
```

### 4. Populate Configuration from factory.config.json

**Load models:**

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db << 'EOF'
INSERT INTO models (id, provider, modelId, maxTokens, costPer1kInput, costPer1kOutput, capabilities, ownedBy, version, isActive, configSource, createdAt, updatedAt)
VALUES 
    ('omlx:gemma-4-12B-it-OptiQ-4bit', 'omlx', 'gemma-4-12B-it-OptiQ-4bit', 32768, 0.005, 0.5, '["codebase","code-generation","execution","file-io","read-only","reasoning","search","synthesis","write"]', 'omlx', 1, 1, 'static', strftime('%s','now'), strftime('%s','now')),
    ('omlx:gpt-oss-20b-MXFP4-Q8', 'omlx', 'gpt-oss-20b-MXFP4-Q8', 32768, 0.5, 1.0, '["analysis","code-generation","codebase","execution","file-io","read-only","reasoning","search","summarization","synthesis","write"]', 'omlx', 1, 1, 'static', strftime('%s','now'), strftime('%s','now')),
    ('omlx:Qwen3-Coder-Next-4bit', 'omlx', 'Qwen3-Coder-Next-4bit', 32768, 0.00005, 0.0002, '["analysis","code-generation","codebase","execution","file-io","listDir","read-only","reasoning","search","summarization","synthesis","write"]', 'omlx', 1, 1, 'static', strftime('%s','now'), strftime('%s','now'))
ON CONFLICT(id) DO UPDATE SET
    maxTokens = excluded.maxTokens,
    costPer1kInput = excluded.costPer1kInput,
    costPer1kOutput = excluded.costPer1kOutput,
    capabilities = excluded.capabilities,
    updatedAt = excluded.updatedAt,
    version = version + 1;
EOF
```

**Load agents:**

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db << 'EOF'
INSERT INTO agents (id, name, tags, complexityMin, complexityMax, tokenProfileMin, tokenProfileMax, tokenProfileTypical, preferredModels, timeoutMs, maxRetries, version, isActive, configSource, createdAt, updatedAt)
VALUES 
    ('search-agent', 'search-agent', '["search","codebase","read-only","analysis","synthesis","reasoning","listDir"]', 1, 10, 200, 2000, 800, '["Qwen3-Coder-Next-4bit","gpt-oss-20b-MXFP4-Q8","gemma-4-12B-it-OptiQ-4bit"]', 30000, 2, 1, 1, 'static', strftime('%s','now'), strftime('%s','now')),
    ('analysis-agent', 'analysis-agent', '["analysis","reasoning","summarization","synthesis"]', 1, 10, 500, 4000, 1500, '["gpt-oss-20b-MXFP4-Q8","Qwen3-Coder-Next-4bit"]', 60000, 2, 1, 1, 'static', strftime('%s','now'), strftime('%s','now')),
    ('summarizer-agent', 'summarizer-agent', '["summarization","synthesis","analysis","reasoning"]', 1, 10, 200, 1500, 600, '["gpt-oss-20b-MXFP4-Q8","Qwen3-Coder-Next-4bit"]', 30000, 1, 1, 1, 'static', strftime('%s','now'), strftime('%s','now')),
    ('executor-agent', 'executor-agent', '["execution","code-generation","write","synthesis","file-io","read-only"]', 1, 10, 500, 8000, 2000, '["Qwen3-Coder-Next-4bit","gemma-4-12B-it-OptiQ-4bit","gpt-oss-20b-MXFP4-Q8"]', 120000, 1, 1, 1, 'static', strftime('%s','now'), strftime('%s','now')),
    ('file-io-agent', 'file-io-agent', '["file-io","read-only","write","listDir","search","codebase"]', 1, 10, 100, 1000, 400, '["Qwen3-Coder-Next-4bit","gemma-4-12B-it-OptiQ-4bit","gpt-oss-20b-MXFP4-Q8"]', 15000, 2, 1, 1, 'static', strftime('%s','now'), strftime('%s','now'))
ON CONFLICT(id) DO UPDATE SET
    tags = excluded.tags,
    timeoutMs = excluded.timeoutMs,
    maxRetries = excluded.maxRetries,
    updatedAt = excluded.updatedAt,
    version = version + 1;
EOF
```

### 5. Set Default Settings

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db << 'EOF'
INSERT INTO settings (id, theme, ui_layout, auto_refresh_ms, max_tasks_display, created_at, updated_at)
VALUES ('app_settings', 'synthwave84', 'dashboard', 5000, 100, strftime('%s','now'), strftime('%s','now'))
ON CONFLICT(id) DO UPDATE SET
    theme = excluded.theme,
    ui_layout = excluded.ui_layout,
    updated_at = strftime('%s','now');
EOF
```

### 6. Verify Installation

```bash
echo "=== Settings ==="
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT * FROM settings;"

echo "=== Models ==="
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT id, provider, modelId FROM models;"

echo "=== Agents ==="
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT id, name, tags FROM agents;"
```

## Usage Examples

### CRUD: Models

**Create model:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "INSERT INTO models (id, provider, modelId, maxTokens, costPer1kInput, costPer1kOutput, capabilities, ownedBy, version, isActive, configSource, createdAt, updatedAt) VALUES ('omlx:new-model', 'omlx', 'new-model', 32768, 0.001, 0.002, '[]', 'omlx', 1, 1, 'static', strftime('%s','now'), strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET version = version + 1, updatedAt = strftime('%s','now');"
```

**Read all models:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT id, provider, modelId, costPer1kInput FROM models WHERE isActive = 1;"
```

**Update model:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "UPDATE models SET costPer1kInput = 0.0005, updatedAt = strftime('%s','now'), version = version + 1 WHERE id = 'omlx:Qwen3-Coder-Next-4bit';"
```

**Delete model (soft):**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "UPDATE models SET isActive = 0, updatedAt = strftime('%s','now') WHERE id = 'omlx:new-model';"
```

### CRUD: Agents

**Create agent:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "INSERT INTO agents (id, name, tags, complexityMin, complexityMax, tokenProfileMin, tokenProfileMax, tokenProfileTypical, preferredModels, timeoutMs, maxRetries, version, isActive, configSource, createdAt, updatedAt) VALUES ('new-agent', 'new-agent', '\"[\\\"search\\\"]\"', 1, 5, 100, 500, 200, '\"[\\\"gpt-4\\\"]\"', 30000, 1, 1, 1, 'custom', strftime('%s','now'), strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET version = version + 1, updatedAt = strftime('%s','now');"
```

**Read by tags:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT id, tags FROM agents WHERE isActive = 1 AND tags LIKE '%search%';"
```

**Read by complexity range (find agents supporting complexity 3):**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT id, complexityMin, complexityMax FROM agents WHERE isActive = 1 AND complexityMin <= 3 AND complexityMax >= 3;"
```

### CRUD: Settings

**Get current settings:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT * FROM settings;"
```

**Change theme:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "UPDATE settings SET theme = 'tokyonight', updated_at = strftime('%s','now') WHERE id = 'app_settings';"
```

**Update auto-refresh:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "UPDATE settings SET auto_refresh_ms = 10000, updated_at = strftime('%s','now') WHERE id = 'app_settings';"
```

### View Queries

**Active agents with tags as JSON:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "
SELECT id, name, json_group_array(json_object('tag', json_array(tags))) AS tags FROM agents WHERE isActive = 1 GROUP BY id;
"
```

**Active models sorted by cost:**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "
SELECT provider, modelId, costPer1kInput FROM models WHERE isActive = 1 ORDER BY costPer1kInput ASC;
"
```

**Task summaries (with joined agent/model info):**
```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "
SELECT t.status, t.created_at, a.name AS agent, m.provider, m.modelId 
FROM tasks_v2 t 
LEFT JOIN agents a ON t.agent_id = a.id 
LEFT JOIN models m ON t.model_id = m.id 
ORDER BY t.created_at DESC 
LIMIT 10;
"
```

## Common Operations

### Add New Agent from UI

```bash
cat > /tmp/new_agent.json << 'EOF'
{
  "id": "custom-agent",
  "name": "custom-agent",
  "tags": ["custom", "analysis"],
  "complexityRange": [1, 10],
  "tokenProfile": {"min": 200, "max": 2000, "typical": 800},
  "preferredModels": ["Qwen3-Coder-Next-4bit"],
  "timeoutMs": 45000,
  "maxRetries": 3
}
EOF

# Convert to SQL INSERT
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "INSERT INTO agents (id, name, tags, complexityMin, complexityMax, tokenProfileMin, tokenProfileMax, tokenProfileTypical, preferredModels, timeoutMs, maxRetries, version, isActive, configSource, createdAt, updatedAt) VALUES ('custom-agent', 'custom-agent', '[\"custom\",\"analysis\"]', 1, 10, 200, 2000, 800, '[\"Qwen3-Coder-Next-4bit\"]', 45000, 3, 1, 1, 'custom', strftime('%s','now'), strftime('%s','now')) ON CONFLICT(id) DO UPDATE SET version = version + 1, updatedAt = strftime('%s','now');"
```

### Disable Agent Temporarily

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "UPDATE agents SET isActive = 0, updatedAt = strftime('%s','now') WHERE id = 'search-agent';"
```

### Re-enable Agent

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "UPDATE agents SET isActive = 1, updatedAt = strftime('%s','now') WHERE id = 'search-agent';"
```

### View Configuration History

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT * FROM config_history ORDER BY changedAt DESC LIMIT 20;"
```

### Restore Configuration from History

```bash
# Get the old data for a model
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT oldData FROM config_history WHERE entityType = 'model' AND entityId = 'omlx:Qwen3-Coder-Next-4bit' ORDER BY changedAt DESC LIMIT 1;"
```

## Troubleshooting

### Error: "no such table"

**Solution:** Tables not created. Run the schema installation steps above.

### Error: "UNIQUE constraint failed"

**Solution:** Record already exists. Use `ON CONFLICT(...) DO UPDATE` or delete first.

### Error: "database is locked"

**Solution:** Another process is using the database. Wait or stop other processes.

### Data Not Visible in UI

**Solution:** Ensure UI is reading from correct database path and connecting after migration.

### Theme Not Changing

**Solution:** Settings table exists but theme value not in allowed list. Check CHECK constraint.

## Next Steps

1. **Update TypeScript Implementation:** Use `SQLiteConfigStore` class for programmatic access
2. **Build UI Components:** Create forms for agent/model editing
3. **Add Configuration History UI:** View and restore previous configurations
4. **Set Up Automatic Backups:** Schedule daily backups of `ai-factory.db`
5. **Document Endpoints:** Create REST API wrappers around config operations

## Files Reference

| File | Purpose |
|------|---------|
| `doc/schema.sql` | Complete SQL schema |
| `doc/migration.md` | Detailed migration instructions |
| `src/core/sqlite-config-store.ts` | TypeScript API implementation |
| `SCHEMA_DESIGN.md` | Full design documentation |
| `QUICKSTART_SCHEMA.md` | This quick start guide |

## Support

If issues occur:
1. Check backup exists: `ai-factory.db.backup`
2. Verify table names match: `.tables`
3. Confirm constraints: `.schema table_name`
4. Review history: `SELECT * FROM config_history;`

For assistance, refer to:
- Architecture docs: `doc/architecture.md`
- Next steps: `doc/next-steps.md`
EOF