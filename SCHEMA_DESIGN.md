# AI Factory SQLite Database Schema Design

## Summary

This document describes the complete SQLite database schema for the AI Factory UI project, designed to persist runtime agent and model configurations while maintaining backward compatibility with the existing `tasks` table.

## Design Decisions

### 1. Table Structure

**Separated Concerns:**
- `settings` - Global application settings (theme, layout, refresh)
- `models` - LLM model configurations with versioning
- `agents` - Agent configurations with versioning
- `config_history` - Audit trail for configuration changes
- `tasks_v2` - Enhanced tasks with foreign keys (optional migration path)

**Why separate tables?**
- Each entity type has different lifecycle patterns
- Enables specific indexes and constraints
- Better data integrity with foreign keys
- Independent versioning schemes

### 2. Versioning Strategy

**Agents and Models:**
- `version` INTEGER column (increments on each update)
- `configSource` TEXT ('static' or 'custom')
- `isActive` INTEGER (soft delete support, 1=active, 0=inactive)

**Changes logged to `config_history` table:**
- Tracks all create/update/delete operations
- Stores old and new state as JSON
- Enables rollback and audit trails

### 3. JSON Storage for Arrays

**SQLite limitation:** No native array type

**Solutions used:**
- `tags` (agents): JSON array of strings
- `capabilities` (models): JSON array of strings
- `preferredModels` (agents): JSON array of modelId strings

**Query trade-off:** Slower than normalized tables but:
- Simpler single-table design
- No need for junction tables
- Acceptable performance for UI scale (<1000 records per table)

### 4. Theme Configuration

**Choices:** 'synthwave84', 'tokyonight', 'zenburn'

**Design:**
- Single settings row with id='app_settings'
- CHECK constraint ensures valid theme values
- Auto-increment default auto_refresh_ms
- Configurable max tasks display for pagination

### 5. Backward Compatibility

**Existing `tasks` table preserved:**
- Original schema unchanged
- No breaking changes to existing data
- New `tasks_v2` table for enhanced tasks (optional)

**Migration path:**
1. Keep existing `tasks` table
2. Use `tasks_v2` for new tasks
3. eventually migrate old tasks to new schema

### 6. Indexing Strategy

**Primary indexes:**
- All tables: Primary key lookup (O(1))

**Additional indexes:**
- `models`: by provider, by cost
- `agents`: by tags (JSON), by complexity range
- `config_history`: by entity, by timestamp
- `tasks_v2`: by status, agent, model

## CRUD Operations

### Models

| Operation | SQL | Notes |
|-----------|-----|-------|
| CREATE | INSERT | version=1, isActive=1 |
| READ | SELECT by id | Full config | 
| READ | SELECT by provider | Filter by provider |
| UPDATE | UPDATE with version increment | Log to config_history |
| DELETE | UPDATE isActive=0 | Soft delete (recommended) |
| DELETE | DELETE | Hard delete (with history) |

### Agents

| Operation | SQL | Notes |
|-----------|-----|-------|
| CREATE | INSERT | version=1, isActive=1 |
| READ | SELECT by id | Full manifest |
| READ | findByTags | JSON array search |
| READ | findByComplexity | Range query on min/max |
| UPDATE | UPDATE with version increment | Log to config_history |
| DELETE | UPDATE isActive=0 | Soft delete (recommended) |
| DELETE | DELETE | Hard delete (with history) |

### Settings

| Operation | SQL | Notes |
|-----------|-----|-------|
| CREATE | INSERT or INSERT OR IGNORE | id='app_settings' |
| READ | SELECT WHERE id='app_settings' | Single row |
| UPDATE | UPDATE WHERE id='app_settings' | Partial updates |
| DELETE | Not allowed | Required for operation |

## Migration Plan

### Step 1: Backup
```bash
cp /Users/cbabos/work/ai-factory/ai-factory.db /Users/cbabos/work/ai-factory/ai-factory.db.bak
```

### Step 2: Schema Installation
Execute statements in `doc/schema.sql`:

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db < /Users/cbabos/work/ai-factory/doc/schema.sql
```

### Step 3: Populate Data

**From factory.config.json:**
- Models array → insert into `models` table
- Agents array → insert into `agents` table

**Default settings:**
```sql
INSERT INTO settings (id, theme, created_at, updated_at)
VALUES ('app_settings', 'synthwave84', strftime('%s','now'), strftime('%s','now'));
```

### Step 4: Verification

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "
SELECT COUNT(*) FROM agents;
SELECT COUNT(*) FROM models;
SELECT * FROM settings;
"
```

## API Integration

### TypeScript Implementation

See `src/core/sqlite-config-store.ts` for complete implementation.

**Key classes:**
- `SQLiteConfigStore` - Main entry point
- Handles all CRUD operations
- Logs configuration changes
- Converts JSON arrays to/from database format

**Example usage:**
```typescript
const store = new SQLiteConfigStore({ dbPath: 'ai-factory.db' });

// Save a model
await store.saveModel({
  provider: 'omlx',
  modelId: 'gpt-4',
  maxTokens: 32768,
  costPer1kInput: 0.001,
  costPer1kOutput: 0.002,
  capabilities: ['code-generation', 'reasoning'],
});

// Save an agent
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
```

## Performance Considerations

### For Current Scale (<1000 records per table)

**Acceptable:**
- JSON array storage
- Simple SELECT queries
- Single-table lookups

**Index coverage:**
- All primary keys
- Common filter fields (provider, isActive)
- Full-text search not needed at this scale

### Future Considerations

**When scale increases:**
1. Consider normalized junction tables for many-to-many
2. Implement caching layer (redis)
3. Add full-text search (FTS5 extension)
4. Partition `config_history` by year

## Security Considerations

**Input validation:**
- CHECK constraints on theme values
- NOT NULL constraints on required fields
- UNIQUE constraints on composite keys

**SQL injection prevention:**
- Uses prepared statements (SQLiteSync API)
- No raw query concatenation

## Testing

### Schema Validation

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db ".schema"
```

### CRUD Operations Test

```bash
# Test settings
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT * FROM settings;"

# Test models
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT id, provider, modelId FROM models;"

# Test agents
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT id, name, tags FROM agents;"
```

### View Queries

```bash
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT * FROM v_active_agents LIMIT 5;"
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "SELECT * FROM v_active_models LIMIT 5;"
```

## Rollback Procedures

**If migration fails:**
```bash
# Restore from backup
cp /Users/cbabos/work/ai-factory/ai-factory.db.bak /Users/cbabos/work/ai-factory/ai-factory.db

# Or drop new tables
sqlite3 /Users/cbabos/work/ai-factory/ai-factory.db "
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

## Files Created

1. `doc/schema.sql` - Complete SQL schema with indexes and views
2. `doc/migration.md` - Detailed migration guide
3. `src/core/sqlite-config-store.ts` - TypeScript implementation
4. `SCHEMA_DESIGN.md` - This document

## Next Steps

1. Review schema with team
2. Create migration script for production
3. Update factory.config.json to reference database location
4. Implement UI components to edit agents/models
5. Add configuration history UI view

## Questions & Decisions

### Q: Why not use Entity-Attribute-Value (EAV) pattern?

**A:** Too complex for this scale. JSON storage is sufficient for <1000 records.

### Q: Why soft delete instead of hard delete?

**A:** Preserves history and allows recovery. Hard delete still available if needed.

### Q: Why separate settings table for theme?

**A:** Single row table with CHECK constraints ensures consistency and validates input.

### Q: Why JSON arrays instead of normalized junction tables?

**A:** Simpler schema for static configurations that rarely change. EAV overkill here.
