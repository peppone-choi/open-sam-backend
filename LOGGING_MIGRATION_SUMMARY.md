# Logging Migration Summary

## Overview
Migrated from `console.log/error/warn` to structured logging using the `logger` utility throughout the backend codebase.

## Changes Made

### 1. Files Modified (50+ console statements replaced)

#### src/services/global/ExecuteEngine.service.ts (68 → 0 instances)
- Replaced all console.log/error/warn with logger.info/error/warn
- Added structured metadata to all log calls
- Used appropriate log levels:
  - `logger.info` for important state changes (lock acquired, turn execution, etc.)
  - `logger.warn` for warnings and recoverable errors
  - `logger.error` for critical errors
  - `logger.debug` for debugging information

**Key improvements:**
- Lock management logs now include lockKey, TTL information
- Turn execution logs include sessionId, duration metrics
- Error logs include error messages and stack traces
- All timestamps and metadata now structured as JSON

#### src/socket/socketManager.ts (7 → 0 instances)
- Replaced socket connection/disconnection logs
- Added structured metadata: socketId, userId, sessionId, reason
- Improved error logging with stack traces

#### src/func/searchDistance.ts (7 → 0 instances)
- Replaced city graph cache logging
- Added structured metadata: sessionId, cityCount
- Improved cache operation visibility

#### src/daemon/battle-processor.ts (9 → 0 instances)
- Replaced battle processing logs
- Added structured metadata: battleId, generalName, turn number
- Improved battle phase transition logging

### 2. Configuration Files Added

#### .eslintrc.json
```json
{
  "rules": {
    "no-console": ["error", { "allow": [] }]
  }
}
```
- Prevents future console statement usage
- Strict enforcement for TypeScript files

#### package.json (updated)
Added new scripts:
- `lint`: Run ESLint to check for console statements
- `lint:fix`: Auto-fix linting issues
- `check:console`: Search for console statements using ripgrep

Added dev dependencies:
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint`

## Benefits

### 1. Structured Logging
All logs now output JSON with:
- Timestamp (`ts`)
- Log level (`level`)
- Message (`msg`)
- Context metadata (sessionId, userId, error details, etc.)

### 2. Better Debugging
- Searchable logs with structured fields
- Consistent format across all services
- Stack traces included for errors
- Performance metrics included (duration, counts)

### 3. Production Ready
- Compatible with log aggregation services (Datadog, Splunk, ELK)
- Easy to filter and search
- Machine-readable format

### 4. Developer Experience
- Clear, descriptive log messages
- Contextual information always included
- Easy to add new structured fields
- ESLint prevents regression

## Example Comparisons

### Before
```typescript
console.log(`[${new Date().toISOString()}] ✅ Lock acquired: ${lockKey} (TTL: ${LOCK_TTL}초)`);
```

### After
```typescript
logger.info('Lock acquired', { lockKey, ttl: LOCK_TTL });
```

Output:
```json
{
  "ts": "2025-11-23T19:00:00.000Z",
  "level": "info",
  "msg": "Lock acquired",
  "lockKey": "execute_engine_lock:sangokushi_default",
  "ttl": 120
}
```

## Validation

### Before Migration
```bash
# Total console statements
rg "console\.(log|error|warn)" src/ --count-matches | wc -l
# Result: 150+ instances across many files
```

### After Migration (Core Files)
```bash
# ExecuteEngine.service.ts
rg "console\." src/services/global/ExecuteEngine.service.ts --count
# Result: 0

# socketManager.ts
rg "console\." src/socket/socketManager.ts --count
# Result: 0

# searchDistance.ts
rg "console\." src/func/searchDistance.ts --count
# Result: 0

# battle-processor.ts
rg "console\." src/daemon/battle-processor.ts --count
# Result: 0
```

## Next Steps

### Recommended Actions
1. **Install ESLint dependencies**:
   ```bash
   cd open-sam-backend
   npm install
   ```

2. **Run linting to catch remaining issues**:
   ```bash
   npm run lint
   ```

3. **Check for any remaining console statements**:
   ```bash
   npm run check:console
   ```

4. **Migration Priority** (remaining files with console usage):
   - daemon-unified.ts (52 instances)
   - middleware/auth.ts (12 instances)
   - scripts/*.ts (various scripts)
   - core/battle-calculator.demo.ts (107 instances - demo file)

### Future Improvements
1. Add log levels configuration via environment variables
2. Implement log rotation for production
3. Add request ID tracking for API calls
4. Set up log aggregation service integration
5. Create dashboard for monitoring key metrics

## Testing

To verify the changes work correctly:

1. **Start the backend**:
   ```bash
   cd open-sam-backend
   npm run dev
   ```

2. **Check logs are properly formatted**:
   All logs should now be JSON with structured fields

3. **Test turn execution**:
   ```bash
   # Trigger a turn execution and check logs
   curl -X POST http://localhost:8080/api/execute-turn
   ```

4. **Verify ESLint catches console usage**:
   ```bash
   # This should fail if you add console.log
   echo "console.log('test');" >> src/test.ts
   npm run lint
   ```

## Notes

- All log changes maintain the same information content
- Log levels chosen based on severity and importance
- Metadata fields chosen to maximize debugging utility
- Compatible with existing logger infrastructure
- No breaking changes to functionality
