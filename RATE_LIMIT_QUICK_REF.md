# Rate Limiting Quick Reference

## Limits

| Endpoint | Limit | Window | Limiter |
|----------|-------|--------|---------|
| All endpoints | 1000 req | 15 min | Global |
| POST /api/auth/login | 5 req | 15 min | Auth |
| POST /api/auth/register | 5 req | 15 min | Auth |
| POST /api/gateway/change-password | 5 req | 15 min | Auth |

## Response Headers

```
RateLimit-Limit: 5
RateLimit-Remaining: 3
RateLimit-Reset: 1700000000
```

## Error Response (429)

```json
{
  "error": "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
  "retryAfter": "15분"
}
```

## Test Commands

### Test Login Rate Limit
```bash
for i in {1..6}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' -i
done
```

### Check Rate Limit Headers
```bash
curl http://localhost:8080/health -i | grep RateLimit
```

## Files

- Middleware: `src/middleware/rate-limit.middleware.ts`
- Applied in: `src/server.ts`, `src/server-minimal.ts`
- Protected: `src/routes/auth.routes.ts`, `src/routes/gateway.routes.ts`

## Configuration

Edit `src/middleware/rate-limit.middleware.ts`:

```typescript
windowMs: 15 * 60 * 1000  // 15 minutes
max: 5                     // 5 requests
```
