-- AI Factory Runtime Configuration Schema v2
--
-- This migration adds tables for persistent runtime configuration of agents,
-- models, and application settings with full CRUD support.

-- ─────────────────────────────────────────────────────────────────────────────
-- SETTINGS TABLE - Theme and application configuration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY CHECK (id = 'app_settings'),
    theme TEXT NOT NULL CHECK (theme IN ('synthwave84', 'tokyonight', 'zenburn')),
    ui_layout TEXT DEFAULT 'dashboard',
    auto_refresh_ms INTEGER DEFAULT 5000,
    max_tasks_display INTEGER DEFAULT 100,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- MODELS TABLE - Persisted runtime model configurations
-- ─────────────────────────────────────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_models_capabilities ON models(capabilities);

-- ─────────────────────────────────────────────────────────────────────────────
-- AGENTS TABLE - Persisted runtime agent configurations
-- ─────────────────────────────────────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_agents_isActive ON agents(isActive);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIG_HISTORY TABLE - Audit trail for configuration changes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS config_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entityType TEXT NOT NULL CHECK (entityType IN ('agent', 'model')),
    entityId TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'soft_delete')),
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

-- ─────────────────────────────────────────────────────────────────────────────
-- VIEWS for common query patterns
-- ─────────────────────────────────────────────────────────────────────────────

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
    a.preferredModels,
    a.configSource,
    a.createdAt,
    a.updatedAt
FROM agents a
WHERE a.isActive = 1;

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
    configSource,
    createdAt,
    updatedAt
FROM models
WHERE isActive = 1;
