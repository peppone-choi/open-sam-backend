# Standardized Error Handling Implementation

## Summary

Implemented standardized error handling across open-sam-backend with custom error classes, async handler wrapper, and consistent error response format.

## Components Created/Updated

### 1. Error Classes (src/common/errors/app-error.ts)

Added `ValidationError` class to existing error hierarchy:

- **AppError** (base class): Generic application errors with status code, error code, and metadata
- **ValidationError** (NEW): For 422 validation errors
- **NotFoundError**: For 404 errors
- **BadRequestError**: For 400 errors  
- **UnauthorizedError**: For 401 authentication errors
- **ForbiddenError**: For 403 authorization errors
- **ConflictError**: For 409 conflict errors
- **InternalServerError**: For 500 server errors

Usage example:
```typescript
import { ValidationError, NotFoundError } from '@/common/errors';

// Validation error
if (!userId) {
  throw new ValidationError('User ID is required', { field: 'userId' });
}

// Not found error
const user = await getUserById(id);
if (!user) {
  throw new NotFoundError('User not found', { userId: id });
}
```

### 2. Async Handler Wrapper (src/middleware/async-handler.ts)

Created async handler to automatically catch errors from async route handlers:

```typescript
import { asyncHandler } from '../middleware/async-handler';

// Before:
router.get('/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// After:
router.get('/users', asyncHandler(async (req, res) => {
  const users = await getUsers();
  res.json({ success: true, data: users });
}));
```

### 3. Error Middleware (src/common/middleware/error.middleware.ts)

Updated to use standardized error response format:

**Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": { ... },
    "requestId": "abc123"
  }
}
```

### 4. Routes Updated

Applied `asyncHandler` to top 10 routes in each file:

#### general.routes.ts (10 routes):
1. POST /build-nation-candidate
2. POST /die-on-prestart
3. POST /drop-item
4. GET /get-command-table
5. GET /get-front-info
6. GET /get-general-log
7. POST /instant-retreat
8. GET /get-join-info
9. POST /join
10. GET /get-boss-info

#### battle.routes.ts (10 routes):
1. POST /start
2. POST /auto-resolve
3. GET /:battleId
4. POST /:battleId/deploy
5. POST /:battleId/action
6. POST /:battleId/ready
7. POST /:battleId/resolve
8. GET /:battleId/history
9. POST /:battleId/start-simulation
10. POST /detail

#### nation.routes.ts (10 routes):
1. POST /general-list
2. GET /get-general-log
3. GET /get-nation-info
4. POST /strat_finan
5. POST /set-bill
6. POST /set-block-scout
7. POST /set-block-war
8. POST /set-notice
9. POST /set-rate
10. POST /set-scout-msg

## Benefits

1. **Consistency**: All errors follow the same response format
2. **Less Boilerplate**: No more try-catch blocks in every route
3. **Better Error Handling**: Centralized error handling with proper logging
4. **Type Safety**: Strongly typed error classes with metadata support
5. **Developer Experience**: Clear error codes and helpful metadata

## Error Response Format

All errors now return in this standardized format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User ID is required",
    "details": {
      "field": "userId"
    },
    "requestId": "req_abc123"
  }
}
```

## Migration Guide

### For New Routes

```typescript
import { asyncHandler } from '../middleware/async-handler';
import { NotFoundError, ValidationError } from '@/common/errors';

router.get('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validation
  if (!id) {
    throw new ValidationError('User ID is required');
  }
  
  // Business logic
  const user = await userService.getById(id);
  
  if (!user) {
    throw new NotFoundError('User not found', { userId: id });
  }
  
  // Success response
  res.json({ success: true, data: user });
}));
```

### For Existing Routes

1. Add `asyncHandler` import
2. Wrap async handler with `asyncHandler()`
3. Remove try-catch blocks
4. Replace manual error responses with custom error throws

## Error Codes

- `BAD_REQUEST` - 400: Invalid request
- `UNAUTHORIZED` - 401: Authentication required
- `FORBIDDEN` - 403: Insufficient permissions
- `NOT_FOUND` - 404: Resource not found
- `CONFLICT` - 409: Resource conflict
- `VALIDATION_ERROR` - 422: Validation failed
- `INTERNAL_ERROR` - 500: Server error

## Files Modified

1. `src/common/errors/app-error.ts` - Added ValidationError
2. `src/middleware/async-handler.ts` - Created async handler wrapper
3. `src/common/middleware/error.middleware.ts` - Updated error response format
4. `src/common/errors/index.ts` - Created central export
5. `src/routes/general.routes.ts` - Applied asyncHandler to 10 routes
6. `src/routes/battle.routes.ts` - Applied asyncHandler to 10 routes  
7. `src/routes/nation.routes.ts` - Applied asyncHandler to 10 routes

## Testing

To test the new error handling:

```bash
# Start the server
cd open-sam-backend && npm run dev:api

# Test endpoints
curl http://localhost:8080/api/general/get-boss-info

# Should return standardized error format for errors
```

## Next Steps

- Apply asyncHandler to remaining routes
- Add request validation middleware using the new ValidationError
- Consider adding error tracking/monitoring integration
- Add error recovery strategies for specific error types
