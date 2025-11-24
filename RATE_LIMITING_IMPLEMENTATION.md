# Rate Limiting Implementation

## Overview
Rate limiting has been implemented to protect the API from abuse and brute force attacks.

## Implementation Details

### 1. Middleware Created
**File**: `src/middleware/rate-limit.middleware.ts`

Three rate limiters have been implemented:

#### Global Limiter
- **Limit**: 1000 requests per 15 minutes
- **Scope**: All requests
- **Purpose**: Prevent general API abuse

#### Auth Limiter
- **Limit**: 5 requests per 15 minutes
- **Scope**: Authentication endpoints
- **Purpose**: Prevent brute force attacks on login/register

#### API Limiter
- **Limit**: 100 requests per 15 minutes
- **Scope**: General API endpoints
- **Purpose**: Prevent API abuse

### 2. Applied to Servers

#### Main Server (src/server.ts)
- Global limiter applied to all requests
- Auth limiter applied to specific auth routes

#### Minimal Server (src/server-minimal.ts)
- Global limiter applied to all requests

### 3. Protected Endpoints

#### Auth Routes (src/routes/auth.routes.ts)
- `POST /api/auth/login` - Auth limiter (5 req/15min)
- `POST /api/auth/register` - Auth limiter (5 req/15min)

#### Gateway Routes (src/routes/gateway.routes.ts)
- `POST /api/gateway/change-password` - Auth limiter (5 req/15min)

## Response Format

When rate limit is exceeded, the server returns:

```json
{
  "error": "너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.",
  "retryAfter": "15분"
}
```

HTTP Status: `429 Too Many Requests`

## Rate Limit Headers

The server includes the following headers in responses:

- `RateLimit-Limit`: Maximum number of requests
- `RateLimit-Remaining`: Remaining requests in current window
- `RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)

## Testing

### Manual Testing

1. **Start the server**:
   ```bash
   cd open-sam-backend
   npm run dev
   ```

2. **Test auth rate limiting**:
   ```bash
   # Make 6 login attempts (5 allowed, 6th should be blocked)
   for i in {1..6}; do
     curl -X POST http://localhost:8080/api/auth/login \
       -H "Content-Type: application/json" \
       -d '{"username":"test","password":"test"}' \
       -i
     echo "\n---"
   done
   ```

3. **Test global rate limiting**:
   ```bash
   # Make many requests to health endpoint
   for i in {1..10}; do
     curl http://localhost:8080/health -i | grep -E "^(HTTP|RateLimit)"
   done
   ```

### Automated Testing

Run the test script:
```bash
cd open-sam-backend
node test-rate-limit.mjs
```

## Configuration

Rate limiting can be configured by modifying `src/middleware/rate-limit.middleware.ts`:

```typescript
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Time window
  max: 5,                   // Max requests
  // ... other options
});
```

## Security Considerations

1. **IP-based**: Rate limiting is based on IP address (respects `trust proxy` setting)
2. **Brute Force Protection**: Auth endpoints limited to 5 attempts per 15 minutes
3. **DDoS Mitigation**: Global limiter prevents overwhelming the server
4. **Production Ready**: Includes proper error messages in Korean

## Future Enhancements

Potential improvements:
1. Redis-based rate limiting for distributed systems
2. User-based rate limiting (in addition to IP-based)
3. Different limits for authenticated vs anonymous users
4. Rate limit bypass for whitelisted IPs
5. Dynamic rate limiting based on server load

## Dependencies

- `express-rate-limit`: ^7.5.0

## Files Modified

1. `src/middleware/rate-limit.middleware.ts` (created)
2. `src/server.ts` (modified - added global limiter)
3. `src/server-minimal.ts` (modified - added global limiter)
4. `src/routes/auth.routes.ts` (modified - added auth limiter)
5. `src/routes/gateway.routes.ts` (modified - added auth limiter)
6. `package.json` (modified - added express-rate-limit dependency)
