# Logging Quick Reference

## Import Statement
```typescript
import { logger } from '../common/logger';
```

## Usage Examples

### Info Logging
Use for important state changes, successful operations, and normal flow events.

```typescript
// Simple message
logger.info('Server started');

// With metadata
logger.info('Lock acquired', { lockKey, ttl: 120 });
logger.info('Turn execution completed', { sessionId, duration: 1500 });
```

### Error Logging
Use for errors and exceptions. Always include error details.

```typescript
// With error object
logger.error('Database connection failed', { 
  error: error.message, 
  stack: error.stack 
});

// With context
logger.error('Failed to process command', { 
  action, 
  generalId, 
  error: error.message 
});
```

### Warning Logging
Use for unexpected conditions that don't break functionality.

```typescript
logger.warn('Missing configuration, using default', { 
  defaultValue: 60 
});

logger.warn('Lock exists but may be stale', { 
  lockKey, 
  ttl 
});
```

### Debug Logging
Use for detailed information useful during development. Only shows when DEBUG env var is set.

```typescript
logger.debug('Processing batch', { 
  batchNum, 
  totalBatches 
});

logger.debug('Cache hit', { 
  key, 
  ttl 
});
```

## Best Practices

### ✅ DO
- Use structured metadata instead of string interpolation
- Include contextual identifiers (sessionId, userId, etc.)
- Use appropriate log levels
- Include error messages and stack traces
- Keep messages concise but descriptive

```typescript
// Good
logger.info('User logged in', { userId, sessionId });
logger.error('Query failed', { query, error: err.message, stack: err.stack });
```

### ❌ DON'T
- Use console.log/error/warn (ESLint will catch this)
- Concatenate strings with metadata
- Log sensitive information (passwords, tokens)
- Use vague messages without context

```typescript
// Bad
console.log(`User ${userId} logged in`);
logger.info('Error happened'); // No context!
logger.info('Login', { password }); // Sensitive data!
```

## Log Levels Guide

| Level | Use Case | Example |
|-------|----------|---------|
| `info` | Normal operations, state changes | Server started, request completed |
| `error` | Errors requiring attention | DB connection failed, command failed |
| `warn` | Unexpected but handled conditions | Config missing, using default value |
| `debug` | Detailed debugging info | Cache operations, batch processing |

## Common Patterns

### API Endpoints
```typescript
logger.info('API request', { 
  method: req.method, 
  path: req.path, 
  userId 
});

logger.error('API error', { 
  method: req.method, 
  path: req.path, 
  error: err.message,
  stack: err.stack 
});
```

### Database Operations
```typescript
logger.debug('DB query', { collection, query });
logger.error('DB operation failed', { 
  operation: 'update', 
  collection, 
  error: err.message 
});
```

### Background Jobs
```typescript
logger.info('Job started', { jobName, jobId });
logger.info('Job completed', { jobName, jobId, duration });
logger.error('Job failed', { jobName, jobId, error: err.message });
```

### WebSocket Events
```typescript
logger.info('Socket connected', { socketId, userId, sessionId });
logger.debug('Socket event', { event, data });
logger.info('Socket disconnected', { socketId, reason });
```

## Output Format

All logs are output as JSON:

```json
{
  "ts": "2025-11-23T19:00:00.000Z",
  "level": "info",
  "msg": "Lock acquired",
  "lockKey": "execute_engine_lock:sangokushi_default",
  "ttl": 120
}
```

This format is:
- Machine-readable
- Easy to parse and search
- Compatible with log aggregation tools
- Includes all necessary context

## Verification Commands

Check for console statements:
```bash
npm run check:console
```

Run ESLint:
```bash
npm run lint
```

Fix linting issues automatically:
```bash
npm run lint:fix
```

Search logs:
```bash
# In production/development logs
cat logs/app.log | jq '.msg' | grep "Lock acquired"
cat logs/app.log | jq 'select(.level == "error")'
cat logs/app.log | jq 'select(.sessionId == "sangokushi_default")'
```
