# Error Handling Quick Reference

## Import Error Classes

```typescript
import { asyncHandler } from '../middleware/async-handler';
import { 
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  BadRequestError,
  ForbiddenError
} from '@/common/errors';
```

## Route Pattern

```typescript
router.post('/resource', asyncHandler(async (req, res) => {
  // Validation
  if (!req.body.id) {
    throw new ValidationError('ID is required');
  }
  
  // Authorization
  if (!req.user) {
    throw new UnauthorizedError();
  }
  
  // Business logic
  const resource = await getResource(req.body.id);
  
  if (!resource) {
    throw new NotFoundError('Resource not found');
  }
  
  // Success
  res.json({ success: true, data: resource });
}));
```

## Error Types

| Error Class | Status | Code | When to Use |
|------------|--------|------|-------------|
| `ValidationError` | 422 | `VALIDATION_ERROR` | Invalid input data |
| `BadRequestError` | 400 | `BAD_REQUEST` | Malformed request |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Not authenticated |
| `ForbiddenError` | 403 | `FORBIDDEN` | No permission |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `ConflictError` | 409 | `CONFLICT` | Resource conflict |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` | Server error |

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": { "resourceId": 123 },
    "requestId": "abc123"
  }
}
```

## Common Patterns

### Validation
```typescript
if (!email || !isValidEmail(email)) {
  throw new ValidationError('Valid email is required', { field: 'email' });
}
```

### Not Found
```typescript
const user = await User.findById(id);
if (!user) {
  throw new NotFoundError('User not found', { userId: id });
}
```

### Authorization
```typescript
if (!req.user || req.user.role !== 'admin') {
  throw new ForbiddenError('Admin access required');
}
```

### Conflict
```typescript
const existing = await User.findOne({ email });
if (existing) {
  throw new ConflictError('User already exists', { email });
}
```
