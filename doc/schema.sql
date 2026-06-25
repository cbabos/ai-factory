-- AI Factory Database Schema v2
-- 
-- Migration Plan:
-- 1. Create new tables (agents, models, settings) with proper schema
-- 2. Back up existing tasks table if needed
-- 3. Preserve existing tasks table structure for backward compatibility
-- 4. Add indexes for performance
-- 5. Create views for common query patterns

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTINGS TABLE - Theme and application configuration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY CHECK (id = 'app_settings'),  -- Single row table
    theme TEXT NOT NULL CHECK (theme IN ('synthwave84', 'tokyonight', 'zenburn')),
    ui_layout TEXT DEFAULT 'dashboard',
    auto_refresh_ms INTEGER DEFAULT 5000,
    max_tasks_display INTEGER DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MODELS TABLE - persisted runtime model configurations
-- Stores both static config models and discovered models
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,  -- Format: "provider:modelId"
    provider TEXT NOT NULL,
    modelId TEXT NOT NULL,
    maxTokens INTEGER NOT NULL DEFAULT 4096,
    costPer1kInput REAL NOT NULL DEFAULT 0.001,
    costPer1kOutput REAL NOT NULL DEFAULT 0.001,
    capabilities TEXT NOT NULL DEFAULT '[]',  -- JSON array
    ownedBy TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    isActive INTEGER NOT NULL DEFAULT 1,  -- Boolean as INTEGER (1 = active, 0 = inactive)
    discoveredAt INTEGER,  -- When discovered from LLM provider
    configSource TEXT DEFAULT 'static',  -- 'static' or 'discovered'
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(provider, modelId)
);

-- Index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_cost ON models(costPer1kInput);

-- ─────────────────────────────────────────────────────────────────────────────
-- AGENTS TABLE - persisted runtime agent configurations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tags TEXT NOT NULL,  -- JSON array
    complexityMin INTEGER NOT NULL,
    complexityMax INTEGER NOT NULL,
    tokenProfileMin INTEGER NOT NULL,
    tokenProfileMax INTEGER NOT NULL,
    tokenProfileTypical INTEGER NOT NULL,
    preferredModels TEXT,  -- JSON array of modelIds
    timeoutMs INTEGER NOT NULL DEFAULT 30000,
    maxRetries INTEGER NOT NULL DEFAULT 2,
    version INTEGER NOT NULL DEFAULT 1,
    isActive INTEGER NOT NULL DEFAULT 1,  -- Boolean as INTEGER (1 = active, 0 = inactive)
    configSource TEXT DEFAULT 'static',  -- 'static' or 'custom'
    description TEXT,
    metadata TEXT,  -- Additional JSON metadata
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    UNIQUE(name)
);

-- Index for tag-based queries
CREATE INDEX IF NOT EXISTS idx_agents_tags ON agents(tags);
CREATE INDEX IF NOT EXISTS idx_agents_complexity ON agents(complexityMin, complexityMax);

-- ─────────────────────────────────────────────────────────────────────────────
-- TASKS TABLE - preserved for backward compatibility
-- Original schema maintained, optional enhancements added
-- ─────────────────────────────────────────────────────────────────────────────

-- Note: This table already exists. If renaming is needed:
-- ALTER TABLE tasks RENAME TO tasks_legacy;

-- Enhanced tasks table (optional migration path)
CREATE TABLE IF NOT EXISTS tasks_v2 (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,  -- JSON serialized Task object
    result TEXT,  -- JSON serialized FinalResult object
    status TEXT NOT NULL,
    conversation TEXT,  -- JSON serialized ConversationTurn[] array
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    agent_id TEXT,  -- Foreign key to agents.id (nullable)
    model_id TEXT,  -- Foreign key to models.id (nullable)
    priority TEXT,  -- From Task.priority
    budget_used REAL DEFAULT 0.0,
    estimated_tokens INTEGER,  -- From ComplexityScore.estimatedTokens
    actual_tokens_input INTEGER,
    actual_tokens_output INTEGER,
    latency_ms INTEGER,
    FOREIGN KEY (agent_id) REFERENCES agents(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks_v2(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks_v2(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks_v2(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_model ON tasks_v2(model_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- HISTORY TABLE - tracks configuration changes (versioning)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entityType TEXT NOT NULL CHECK (entityType IN ('agent', 'model')),
    entityId TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    oldData TEXT,  -- JSON of previous state
    newData TEXT,  -- JSON of new state
    versionBefore INTEGER NOT NULL,
    versionAfter INTEGER NOT NULL,
    changedBy TEXT DEFAULT 'system',  -- User or system identifier
    changedAt INTEGER NOT NULL,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_config_history_entity ON config_history(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_config_history_date ON config_history(changedAt DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS for common query patterns
-- ─────────────────────────────────────────────────────────────────────────────

-- View: Active agents with their preferred models (as JSON array)
CREATE VIEW IF NOT EXISTS v_active_agents AS
SELECT 
    a.id,
    a.name,
    a.description,
    a.tags,
    a.complexityMin,
    a.complexityMax,
    a.tokenProfileTypical,
    a.timeoutMs,
    a.maxRetries,
    a.version,
    json_group_array(DISTINCT m.modelId) AS preferredModels,
    a.createdAt,
    a.updatedAt
FROM agents a
LEFT JOIN agents a2 ON a.id = a2.id
LEFT JOIN models m ON json_array_contains(a.preferredModels, m.modelId)
WHERE a.isActive = 1
GROUP BY a.id;

-- View: Active models with capabilities as JSON array
CREATE VIEW IF NOT EXISTS v_active_models AS
SELECT 
    id,
    provider,
    modelId,
    maxTokens,
    costPer1kInput,
    costPer1kOutput,
    capabilities,
    ownedBy,
    version,
    createdAt,
    updatedAt
FROM models
WHERE isActive = 1;

-- View: Task summary with agent/model info
CREATE VIEW IF NOT EXISTS v_task_summaries AS
SELECT 
    t.id,
    t.status,
    t.created_at,
    t.updated_at,
    t.agent_id,
    a.name AS agent_name,
    t.model_id,
    m.provider,
    m.modelId AS model_name,
    t.budget_used,
    t.actual_tokens_input,
    t.actual_tokens_output,
    t.latency_ms
FROM tasks_v2 t
LEFT JOIN agents a ON t.agent_id = a.id
LEFT JOIN models m ON t.model_id = m.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- UTILITY FUNCTIONS (for JSON array operations in SQLite 3.38+)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper function to check if JSON array contains a value
-- Usage: json_array_contains('[1,2,3]', '2') returns 1 or 0
-- CREATE FUNCTION json_array_contains(json_array TEXT, value TEXT) RETURNS INTEGER
-- BEGIN
--     RETURN CASE WHEN json_each.value = value THEN 1 ELSE 0 END;
-- END;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION SCRIPT - Run this to migrate from v1 to v2
-- ─────────────────────────────────────────────────────────────────────────────

/*
-- Step 1: Backup existing database (optional but recommended)
-- cp /path/to/ai-factory.db /path/to/ai-factory.db.backup

-- Step 2: Create new tables
-- (Run the CREATE TABLE statements above)

-- Step 3: Populate settings table (theme defaults to synthwave84)
INSERT INTO settings (id, theme, ui_layout, auto_refresh_ms, max_tasks_display, created_at, updated_at)
VALUES ('app_settings', 'synthwave84', 'dashboard', 5000, 100, UNIXEPOCH('now'), UNIXEPOCH('now'))
ON CONFLICT(id) DO NOTHING;

-- Step 4: Migrate static models from factory.config.json to models table
-- (This would be done by reading the config and inserting each model)
-- Example:
INSERT INTO models (id, provider, modelId, maxTokens, costPer1kInput, costPer1kOutput, capabilities, ownedBy, version, isActive, configSource, createdAt, updatedAt)
VALUES 
    ('omlx:gemma-4-12B-it-OptiQ-4bit', 'omlx', 'gemma-4-12B-it-OptiQ-4bit', 32768, 0.005, 0.5, '["codebase","code-generation","execution","file-io","read-only","reasoning","search","synthesis","write"]', 'omlx', 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now')),
    ('omlx:gpt-oss-20b-MXFP4-Q8', 'omlx', 'gpt-oss-20b-MXFP4-Q8', 32768, 0.5, 1.0, '["analysis","code-generation","codebase","execution","file-io","read-only","reasoning","search","summarization","synthesis","write"]', 'omlx', 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now')),
    ('omlx:Qwen3-Coder-Next-4bit', 'omlx', 'Qwen3-Coder-Next-4bit', 32768, 0.00005, 0.0002, '["analysis","code-generation","codebase","execution","file-io","listDir","read-only","reasoning","search","summarization","synthesis","write"]', 'omlx', 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now'))
ON CONFLICT(id) DO UPDATE SET
    maxTokens = excluded.maxTokens,
    costPer1kInput = excluded.costPer1kInput,
    costPer1kOutput = excluded.costPer1kOutput,
    capabilities = excluded.capabilities,
    updatedAt = excluded.updatedAt,
    version = version + 1;

-- Step 5: Migrate static agents from factory.config.json to agents table
INSERT INTO agents (id, name, tags, complexityMin, complexityMax, tokenProfileMin, tokenProfileMax, tokenProfileTypical, preferredModels, timeoutMs, maxRetries, version, isActive, configSource, createdAt, updatedAt)
VALUES 
    ('search-agent', 'search-agent', '["search","codebase","read-only","analysis","synthesis","reasoning","listDir"]', 1, 10, 200, 2000, 800, '["Qwen3-Coder-Next-4bit","gpt-oss-20b-MXFP4-Q8","gemma-4-12B-it-OptiQ-4bit"]', 30000, 2, 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now')),
    ('analysis-agent', 'analysis-agent', '["analysis","reasoning","summarization","synthesis"]', 1, 10, 500, 4000, 1500, '["gpt-oss-20b-MXFP4-Q8","Qwen3-Coder-Next-4bit"]', 60000, 2, 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now')),
    ('summarizer-agent', 'summarizer-agent', '["summarization","synthesis","analysis","reasoning"]', 1, 10, 200, 1500, 600, '["gpt-oss-20b-MXFP4-Q8","Qwen3-Coder-Next-4bit"]', 30000, 1, 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now')),
    ('executor-agent', 'executor-agent', '["execution","code-generation","write","synthesis","file-io","read-only"]', 1, 10, 500, 8000, 2000, '["Qwen3-Coder-Next-4bit","gemma-4-12B-it-OptiQ-4bit","gpt-oss-20b-MXFP4-Q8"]', 120000, 1, 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now')),
    ('file-io-agent', 'file-io-agent', '["file-io","read-only","write","listDir","search","codebase"]', 1, 10, 100, 1000, 400, '["Qwen3-Coder-Next-4bit","gemma-4-12B-it-OptiQ-4bit","gpt-oss-20b-MXFP4-Q8"]', 15000, 2, 1, 1, 'static', UNIXEPOCH('now'), UNIXEPOCH('now'))
ON CONFLICT(id) DO UPDATE SET
    tags = excluded.tags,
    timeoutMs = excluded.timeoutMs,
    maxRetries = excluded.maxRetries,
    updatedAt = excluded.updatedAt,
    version = version + 1;

-- Step 6: Update existing tasks with optional agent/model references
-- (This would be done after tasks are processed by the system)
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- CLEANUP: Remove old tables if migrating (uncomment when needed)
-- ─────────────────────────────────────────────────────────────────────────────

/*
-- If tasks table needs schema changes, rename and recreate
-- ALTER TABLE tasks RENAME TO tasks_old;
-- Then run CREATE TABLE tasks_v2

-- After��ifying all data is migrated, drop old table
-- DROP TABLE tasks_old;
*/

