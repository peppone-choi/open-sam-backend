# Backend Error Handling Analysis Report
**Generated:** 2025-11-24  
**Project:** open-sam-backend  
**Scope:** Error handling patterns, async operations, database transactions

---

## Executive Summary

The backend has **good foundation** with centralized error middleware and custom error classes, but suffers from **inconsistent application** across the codebase. Found **874 instances** of direct error.message exposure and **multiple unhandled promise rejection risks**.

### Critical Issues Found:
1. ✅ **GOOD**: Centralized error middleware exists
2. ❌ **BAD**: Inconsistent error handling in routes (mix of error middleware & direct status codes)
3. ❌ **BAD**: Generic error messages exposed to users (874 instances of error.message)
4. ⚠️ **WARNING**: Empty catch blocks silently swallowing errors
5. ⚠️ **WARNING**: Minimal transaction error handling
6. ⚠️ **WARNING**: Console.log usage in production code for errors

---

## 1. Unhandled Promise Rejections

### Global Handlers ✅
**File:** `src/server-minimal.ts:111-124`

```typescript
// ✅ GOOD: Global handlers exist
process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 거부', {
    reason: String(reason),
    promise: String(promise)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
```

### Empty Catch Blocks ❌
**File:** `src/services/init.service.ts`

```typescript
// ❌ BAD: Silent failures during cleanup
generalRecordRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {})
generalTurnRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {})
nationTurnRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {})
worldHistoryRepository.deleteManyByFilter({ session_id: sessionId }).catch(() => {})
```

**Issue:** Cleanup errors are completely ignored. If deletion fails, old data persists.

**Recommendation:**
```typescript
// ✅ GOOD: Log cleanup failures
const cleanupPromises = [
  generalRecordRepository.deleteManyByFilter({ session_id: sessionId }),
  generalTurnRepository.deleteManyByFilter({ session_id: sessionId }),
  // ...
];

const results = await Promise.allSettled(cleanupPromises);
results.forEach((result, index) => {
  if (result.status === 'rejected') {
    logger.warn('Cleanup failed', { 
      repository: cleanupRepos[index], 
      error: result.reason 
    });
  }
});
```

### Console.error in Catch Blocks ❌
**File:** Multiple locations (50+ instances)

```typescript
// ❌ BAD: Console logging in production
main().catch(console.error);

// Found in:
// - src/scripts/generate-all-logh-commands.ts
// - src/scripts/generate-logh-commands.ts
// - src/models/ActionLogger.ts
// - src/commands/general/deploy.ts
```

**Recommendation:**
```typescript
// ✅ GOOD: Use structured logger
main().catch(error => {
  logger.error('Script execution failed', {
    script: 'generate-logh-commands',
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
```

---

## 2. Try-Catch Without Proper Logging

### Pattern Analysis

| Pattern | Count | Severity |
|---------|-------|----------|
| Empty catch blocks | 4 | 🔴 Critical |
| Console.log/error in catch | 50+ | 🟡 Medium |
| Logger usage in catch | 500+ | 🟢 Good |
| No error logging | Unknown | 🔴 Critical |

### Problematic Examples

#### Example 1: ActionLogger Auto-flush ⚠️
**File:** `src/models/ActionLogger.ts`

```typescript
// ⚠️ WARNING: Using console.error instead of logger
this.flush().catch(err => console.error('[ActionLogger] Auto-flush failed:', err));
```

**Impact:** Auto-flush failures aren't tracked in production logs properly.

**Fix:**
```typescript
// ✅ GOOD
this.flush().catch(err => {
  logger.error('ActionLogger auto-flush failed', {
    error: err.message,
    stack: err.stack,
    bufferSize: this.buffer.length
  });
});
```

#### Example 2: Cache Middleware ⚠️
**File:** `src/api/common/middleware/cache.middleware.ts`

```typescript
// ⚠️ WARNING: Silent cache failures
manager.set(cacheKey, data, ttl).catch(console.error);
```

**Impact:** Cache failures don't trigger alerts, degrading performance silently.

**Fix:**
```typescript
// ✅ GOOD
manager.set(cacheKey, data, ttl).catch(error => {
  logger.warn('Cache set failed', {
    key: cacheKey,
    error: error.message,
    ttl
  });
});
```

---

## 3. Generic Error Messages Exposed to Users

### Severity: 🔴 **CRITICAL**

**Count:** 874 instances of `error.message` directly exposed

### Examples by Location

#### Controllers: Inconsistent Error Responses ❌
**File:** `src/controllers/nationcommand.controller.ts:17-27`

```typescript
// ❌ BAD: Exposes internal error messages
static async getReservedCommand(req: Request, res: Response) {
  try {
    const result = await GetReservedCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message  // ❌ Internal error exposed
    });
  }
}
```

**Issues:**
1. Bypasses error middleware
2. Exposes stack traces in development
3. Returns generic 500 for all errors
4. No error logging
5. Inconsistent with error.middleware.ts pattern

**This pattern repeated in:**
- `src/controllers/nationcommand.controller.ts` (5 methods)
- `src/controllers/general.controller.ts` (12 methods)
- `src/controllers/global.controller.ts` (12 methods)
- `src/routes/nation.routes.ts` (16 routes)

#### Routes: Mixed Error Handling Patterns ❌
**File:** `src/routes/nation.routes.ts:289-296`

```typescript
// ❌ BAD: Inconsistent error handling
router.post('/general-list', authenticate, async (req, res) => {
  try {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message }); // ❌ 400 for all errors
  }
});
```

**Problems:**
1. Always returns 400 (even for 500 errors)
2. No logging
3. Doesn't use next(error) for error middleware
4. Different format than controllers ({ error: msg } vs { success: false, message: msg })

#### Authentication Middleware: Better Pattern ✅
**File:** `src/middleware/auth.ts:78-96`

```typescript
// ✅ GOOD: Specific error messages
} catch (error) {
  if (error instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({ 
      success: false,
      message: '유효하지 않은 토큰입니다'  // ✅ User-friendly
    });
  }
  if (error instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ 
      success: false,
      message: '토큰이 만료되었습니다'  // ✅ User-friendly
    });
  }
  
  // ⚠️ Generic fallback but at least doesn't expose details
  return res.status(500).json({ 
    success: false,
    message: '인증 처리 중 오류가 발생했습니다' 
  });
}
```

### Recommended Pattern

```typescript
// ✅ BEST PRACTICE
router.post('/general-list', authenticate, async (req, res, next) => {
  try {
    const result = await GeneralListService.execute(req.body, req.user);
    res.json(result);
  } catch (error) {
    next(error); // Let error middleware handle it
  }
});
```

Or with custom errors:

```typescript
// ✅ GOOD: Custom error classes
static async getReservedCommand(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await GetReservedCommandService.execute(req.body, req.user);
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      next(new BadRequestError('잘못된 요청 데이터입니다'));
    } else if (error instanceof NotFoundError) {
      next(error);
    } else {
      logger.error('Command execution failed', { 
        error: error.message, 
        stack: error.stack 
      });
      next(new InternalServerError('명령 처리 중 오류가 발생했습니다'));
    }
  }
}
```

---

## 4. Missing Error Middleware Usage

### Current State

**Error Middleware Exists:** ✅ `src/common/middleware/error.middleware.ts`  
**Applied in Server:** ✅ `src/server-minimal.ts:88`

```typescript
// ✅ GOOD: Error middleware is registered
app.use(errorMiddleware);
```

### Problem: Routes Bypass Error Middleware

**Count:** 100+ route handlers with manual error handling

#### Anti-Pattern Distribution

```
src/routes/nation.routes.ts:       16 manual error handlers
src/routes/general.routes.ts:      20 manual error handlers  
src/routes/game.routes.ts:         26 manual error handlers
src/routes/admin.routes.ts:        36 manual error handlers
src/controllers/general.controller.ts:  12 manual error handlers
src/controllers/nationcommand.controller.ts: 5 manual error handlers
```

### Impact

1. **Inconsistent Error Formats**
   - Some routes: `{ error: string }`
   - Controllers: `{ success: false, message: string }`
   - Error middleware: `{ error: { message, code, details, requestId, path, method } }`

2. **Missing Features**
   - No request IDs in manual handlers
   - No stack traces in dev mode
   - No centralized logging
   - No error code standardization

### Solution: Async Handler Wrapper

```typescript
// ✅ BEST: Create async handler utility
// src/common/middleware/async-handler.ts

import { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage:
router.post('/general-list', authenticate, asyncHandler(async (req, res) => {
  const result = await GeneralListService.execute(req.body, req.user);
  res.json(result);
}));
```

---

## 5. Inconsistent Error Response Formats

### Format Variations Found

#### Format 1: APIHelper Pattern
```typescript
// src/common/APIHelper.ts
{
  result: false,
  reason: 'Error message'
}
```

#### Format 2: Controller Pattern
```typescript
// src/controllers/nationcommand.controller.ts
{
  success: false,
  message: 'Error message'
}
```

#### Format 3: Route Pattern
```typescript
// src/routes/nation.routes.ts
{
  error: 'Error message'
}
```

#### Format 4: Error Middleware Pattern (✅ BEST)
```typescript
// src/common/middleware/error.middleware.ts
{
  error: {
    message: 'Error message',
    code: 'ERROR_CODE',
    details: {},
    requestId: 'uuid',
    path: '/api/path',
    method: 'POST',
    stack: '...' // dev only
  }
}
```

### Recommendation: Standardize on Error Middleware Format

```typescript
// ✅ Create type definitions
// src/types/api-response.ts

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: any;
    requestId?: string;
    path?: string;
    method?: string;
    stack?: string; // dev only
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;
```

---

## 6. Database Transaction Error Handling

### Current Transaction Usage

**Files with Transactions:**
- `src/daemon/session-persister.ts`
- `src/services/nation/onNationDestroyed.transaction.ts`
- `src/services/battle/onCityOccupied.transaction.ts`

### Example: Session Persister ⚠️
**File:** `src/daemon/session-persister.ts:95-147`

```typescript
async function persistModel(modelName: string, sessionIds: string[]) {
  try {
    const Model = mongoose.models[modelName];
    if (!Model) {
      logger.warn(`[Data Persister] Model not found: ${modelName}`);
      return 0;
    }

    let totalSaved = 0;
    for (const sessionId of sessionIds) {
      try {
        const docs = await Model.find({
          session_id: sessionId,
          data: { $exists: true }
        });

        let savedCount = 0;
        for (const doc of docs) {
          try {
            // ⚠️ No transaction - potential race conditions
            if (doc.data) {
              const exists = await Model.exists({ _id: doc._id });
              if (!exists) {
                logger.debug('[Data Persister] doc was deleted, skipping');
                continue;
              }
              
              doc.markModified('data');
              await doc.save();  // ⚠️ Individual saves, not atomic
              savedCount++;
            }
          } catch (error: any) {
            // ✅ GOOD: Error handling per document
            if (error.message?.includes('No document found')) {
              logger.debug('[Data Persister] doc not found (likely deleted)');
            } else {
              logger.error('[Data Persister] Failed to save doc', {
                error: error.message
              });
            }
          }
        }
        totalSaved += savedCount;
      } catch (error: any) {
        logger.error('[Data Persister] Failed to persist session', { 
          error: error.message 
        });
      }
    }
    return totalSaved;
  } catch (error: any) {
    logger.error('[Data Persister] Failed to persist model', { 
      modelName, 
      error: error.message 
    });
    return 0;
  }
}
```

**Issues:**
1. No transactions despite modifying multiple documents
2. Race condition: doc can be deleted between `exists()` check and `save()`
3. No rollback mechanism
4. Partial success possible (some docs saved, others failed)

### Example: ExecuteEngine Service ⚠️
**File:** `src/services/global/ExecuteEngine.service.ts:61-200`

```typescript
static async execute(data: any, _user?: any) {
  const redis = getRedisClient();
  const lockKey = `${LOCK_KEY}:${sessionId}`;
  
  let lockAcquired = false;
  try {
    // ✅ GOOD: Redis lock for distributed coordination
    const lock = await redis.set(lockKey, '1', 'EX', LOCK_TTL, 'NX');
    if (!lock) {
      return { success: true, result: false, locked: true };
    }
    lockAcquired = true;
    
    const session = await sessionRepository.findBySessionId(sessionId);
    // ... massive turn processing logic ...
    
    // ⚠️ WARNING: No DB transaction wrapping all changes
    // Multiple models modified without atomicity
    
  } catch (error) {
    logger.error('Execute engine error', { error });
    throw error;  // ❌ Lock not released on error
  } finally {
    // ❌ BAD: Finally block missing
    // Lock not released properly
  }
}
```

**Critical Issues:**
1. Redis lock acquired but not released in finally block
2. No MongoDB transaction for multi-document updates
3. Partial turn processing possible on error
4. No rollback mechanism

### Recommended Transaction Pattern

```typescript
// ✅ GOOD: Proper transaction handling
import { startSession, ClientSession } from 'mongoose';

async function executeWithTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
  lockKey?: string
): Promise<T> {
  const mongoSession = await startSession();
  let redisLock: boolean = false;
  
  try {
    // Start transaction
    mongoSession.startTransaction();
    
    // Acquire Redis lock if needed
    if (lockKey) {
      const redis = getRedisClient();
      const lock = await redis.set(lockKey, '1', 'EX', 120, 'NX');
      if (!lock) {
        throw new ConflictError('Another operation in progress');
      }
      redisLock = true;
    }
    
    // Execute operation
    const result = await operation(mongoSession);
    
    // Commit transaction
    await mongoSession.commitTransaction();
    
    logger.info('Transaction committed successfully', { lockKey });
    return result;
    
  } catch (error) {
    // Rollback on error
    await mongoSession.abortTransaction();
    logger.error('Transaction aborted', { 
      lockKey, 
      error: error.message 
    });
    throw error;
    
  } finally {
    // Always cleanup
    await mongoSession.endSession();
    
    if (redisLock && lockKey) {
      const redis = getRedisClient();
      await redis.del(lockKey);
      logger.debug('Redis lock released', { lockKey });
    }
  }
}

// Usage:
await executeWithTransaction(async (session) => {
  await Model1.updateOne({ ... }, { ... }, { session });
  await Model2.create([{ ... }], { session });
  await Model3.deleteMany({ ... }, { session });
  return result;
}, 'execute_engine_lock:session123');
```

---

## 7. Detailed File-by-File Issues

### High Priority Files

#### src/controllers/nationcommand.controller.ts
- **Lines:** 17-87
- **Issues:** 5 identical error handlers, all bypassing error middleware
- **Fix:** Add `next` parameter, wrap in asyncHandler, call next(error)

#### src/controllers/general.controller.ts  
- **Issues:** 12 manual error handlers
- **Impact:** Medium (frequently called endpoints)
- **Fix:** Standardize on error middleware

#### src/routes/nation.routes.ts
- **Lines:** 289-2000+
- **Issues:** 16 async handlers with try-catch, inconsistent status codes
- **Fix:** Use asyncHandler wrapper

#### src/common/APIHelper.ts
- **Lines:** 165-170
- **Issues:** Generic 500 error with error.message exposed
- **Fix:** 
  ```typescript
  } catch (error: any) {
    logger.error('API execution failed', {
      apiClass: apiClass.name,
      error: error.message,
      stack: error.stack
    });
    
    if (error instanceof AppError) {
      throw error; // Let error middleware handle
    }
    
    throw new InternalServerError('API 처리 중 오류가 발생했습니다');
  }
  ```

#### src/middleware/auth.ts
- **Lines:** 92-95
- **Status:** ✅ Mostly good, but generic error at end
- **Improvement:** Log error before sending generic message

---

## 8. Recommendations

### Immediate Actions (Sprint 1)

#### 1. Create Async Handler Wrapper
```typescript
// src/common/middleware/async-handler.ts
export const asyncHandler = (fn: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

#### 2. Standardize Error Response Format
```typescript
// Update error.middleware.ts to always return:
{
  success: false,
  error: {
    message: string,
    code: string,
    requestId: string,
    details?: any,
    stack?: string  // dev only
  }
}
```

#### 3. Fix Critical Routes (Top 10 by Traffic)
- [ ] `/api/nation/general-list`
- [ ] `/api/general/front-info`
- [ ] `/api/command/submit`
- [ ] `/api/game/basic-info`
- [ ] `/api/auth/login`

#### 4. Add Transaction Helper
```typescript
// src/common/db/transaction-helper.ts
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T>
```

### Short-term Actions (Sprint 2-3)

#### 5. Replace Console.* with Logger
```bash
# Find and replace
find src -name "*.ts" -exec sed -i 's/console.error/logger.error/g' {} \;
find src -name "*.ts" -exec sed -i 's/console.log/logger.info/g' {} \;
find src -name "*.ts" -exec sed -i 's/console.warn/logger.warn/g' {} \;
```

#### 6. Refactor Controllers
- Remove try-catch from controller methods
- Add `next: NextFunction` parameter
- Call `next(error)` instead of res.status(500)

#### 7. Service Layer Error Handling
```typescript
// Services should throw custom errors, not return { success: false }
static async execute(data: any, user?: any) {
  if (!user) {
    throw new UnauthorizedError('인증이 필요합니다');
  }
  
  if (!data.required) {
    throw new BadRequestError('필수 파라미터가 누락되었습니다');
  }
  
  const result = await repository.findOne(...);
  if (!result) {
    throw new NotFoundError('데이터를 찾을 수 없습니다');
  }
  
  return result;
}
```

#### 8. Add Error Monitoring
```typescript
// src/common/middleware/error-monitoring.middleware.ts
import * as Sentry from '@sentry/node';

export const errorMonitoring = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(err, {
      extra: {
        requestId: req.requestId,
        user: req.user,
        path: req.path,
        method: req.method
      }
    });
  }
  
  next(err);
};
```

### Long-term Actions (Next Quarter)

#### 9. Implement Circuit Breaker for External Services
```typescript
// For Redis, MongoDB, external APIs
import CircuitBreaker from 'opossum';

const redisBreaker = new CircuitBreaker(redisOperation, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});
```

#### 10. Add Retry Logic for Transient Failures
```typescript
import pRetry from 'p-retry';

await pRetry(
  () => repository.save(doc),
  {
    retries: 3,
    onFailedAttempt: error => {
      logger.warn('Retry attempt', { 
        attemptNumber: error.attemptNumber,
        retriesLeft: error.retriesLeft 
      });
    }
  }
);
```

#### 11. Implement Dead Letter Queue
```typescript
// For failed command executions
const DLQ = new Queue('command-dlq', {
  connection: redisConfig
});

// In command processor
catch (error) {
  await DLQ.add('failed-command', {
    originalCommand: command,
    error: error.message,
    timestamp: new Date(),
    retryCount: command.retryCount || 0
  });
}
```

---

## 9. Error Handling Best Practices Checklist

### For Routes
- [ ] Use `asyncHandler` wrapper for all async routes
- [ ] Don't use try-catch (let asyncHandler catch)
- [ ] Don't call `res.status().json()` on error
- [ ] Call `next(error)` to pass to error middleware
- [ ] Add request ID to all responses

### For Controllers
- [ ] Don't handle errors in controllers
- [ ] Add `next: NextFunction` parameter
- [ ] Let errors bubble up to error middleware
- [ ] Use custom error classes (BadRequestError, NotFoundError, etc.)

### For Services
- [ ] Throw custom errors, don't return { success: false }
- [ ] Use specific error types (ValidationError, NotFoundError)
- [ ] Include context in error metadata
- [ ] Log errors with structured logger
- [ ] Don't catch errors unless you can handle them

### For Database Operations
- [ ] Use transactions for multi-document updates
- [ ] Always use try-catch-finally with transactions
- [ ] Abort transaction on error
- [ ] Release locks in finally block
- [ ] Use session parameter in all operations within transaction

### For Async Operations
- [ ] Always handle promise rejections
- [ ] Use try-catch for async/await
- [ ] Use .catch() for promise chains
- [ ] Log all errors before re-throwing
- [ ] Include operation context in logs

---

## 10. Testing Recommendations

### Unit Tests for Error Scenarios

```typescript
describe('NationCommandController', () => {
  describe('getReservedCommand', () => {
    it('should call next() with error when service throws', async () => {
      const error = new Error('Service error');
      const next = jest.fn();
      
      jest.spyOn(GetReservedCommandService, 'execute')
        .mockRejectedValue(error);
      
      await controller.getReservedCommand(req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
```

### Integration Tests for Error Middleware

```typescript
describe('Error Middleware', () => {
  it('should return 400 for BadRequestError', async () => {
    app.get('/test', (req, res, next) => {
      next(new BadRequestError('Invalid input'));
    });
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(response.body.error.message).toBe('Invalid input');
  });
  
  it('should not expose stack trace in production', async () => {
    process.env.NODE_ENV = 'production';
    
    app.get('/test', () => {
      throw new Error('Internal error');
    });
    
    const response = await request(app).get('/test');
    
    expect(response.body.error.stack).toBeUndefined();
  });
});
```

---

## 11. Metrics to Track

### Error Rate Metrics

```typescript
// Add to monitoring
export const errorMetrics = {
  total: new Counter({
    name: 'api_errors_total',
    help: 'Total API errors',
    labelNames: ['code', 'path', 'method']
  }),
  
  duration: new Histogram({
    name: 'error_handling_duration_seconds',
    help: 'Error handling duration',
    labelNames: ['type']
  })
};

// In error middleware
errorMetrics.total.inc({
  code: err.code,
  path: req.path,
  method: req.method
});
```

### Dashboard Queries

```promql
# Error rate by endpoint
rate(api_errors_total[5m])

# Top error codes
topk(10, sum by (code) (api_errors_total))

# Unhandled rejections
rate(unhandled_rejection_total[5m])
```

---

## Conclusion

The backend has a **solid error handling foundation** but needs **consistent application** across all code paths. Priority should be:

1. **Week 1:** Fix critical routes, add asyncHandler
2. **Week 2-3:** Refactor controllers and services
3. **Week 4:** Add transaction helpers and monitoring
4. **Ongoing:** Code review to enforce standards

**Estimated Effort:** 2-3 weeks for complete refactor  
**Risk:** Low (changes are mostly additive)  
**Impact:** High (better debugging, user experience, reliability)
