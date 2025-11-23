# Cache & Lock Failure Runbook (Draft)

This runbook covers operational responses for cache/lock incidents across MongoDB, Redis, and the session daemons.

## 1. Quick triage checklist

1. **Check health dashboards/logs**
   - `d_log/2025-11-21_redis-monitor.log` or `pm2 logs cache-manager` for connection churn.
   - `open-sam-backend/src/common/lock/distributed-lock.helper.ts` emits `[Lock]` debug lines for every acquisition/release.
2. **Confirm Redis reachability**
   - `redis-cli -u $REDIS_URL PING`
   - `redis-cli --scan --pattern 'lock:*'` for stuck locks.
3. **Confirm Mongo responsiveness**
   - `db.runCommand({ ping: 1 })` via `mongosh`.
4. **Gather daemon status**
   - Turn scheduler: `tail -f d_log/2025-11-21_backend-battle-calculator.log`
   - Auction cron: `pm2 logs auction-processor`
   - Tournament cron: `pm2 logs daemon-unified | rg TournamentEngine`

## 2. Redis outage / cache server failure

| Step | Action |
| --- | --- |
| Detect | `CacheManager` logs `Redis 연결 에러`, lock helper logs `Redis unavailable`. L1 cache continues serving but latency will spike. |
| Contain | `kubectl rollout restart redis` or restart the managed instance. Ensure persistence (AOF/RDB) is intact. |
| Validate | Run `redis-cli INFO replication` and confirm `role:master` + `connected_clients > 0`. Check that `CacheManager.waitForRedis()` stops warning. |
| Reheat caches | Trigger `npm run seed:caches` if needed, or rely on normal traffic; stale entries will miss and repopulate automatically. |
| Follow-up | Audit `lock:*` keys to ensure no zombie keys remained after restart.

## 3. Lock timeout / stuck lock

1. **Identify offender**
   - `redis-cli --scan --pattern 'lock:*' | xargs -I{} redis-cli TTL {}` to find keys with large TTLs.
2. **Graceful release**
   - Prefer calling the owning service’s unlock endpoint (e.g. admin `forceUnlockAndClearCache`).
3. **Manual release** (only if owner is dead)
   - `redis-cli DEL lock:auction:s1`, `redis-cli DEL lock:battle:settle:s1:123`.
   - Immediately restart the relevant daemon so it acquires a fresh token.
4. **Retry policy**
   - Locks now retry 2–3 times before logging a warning, so operators should expect occasional “skip due to lock” debug lines. Investigate only if skip persists for >2 cycles.

## 4. Cache layer degraded performance

- **Symptoms**: `L1` miss storms, `CacheService` logs “DB 조회” for every call.
- **Actions**:
  1. Ensure `CACHE_ENABLE_REDIS` is `true` and the process has reconnected.
  2. Restart the offending worker (e.g. `systemctl restart open-sam-backend`).
  3. Run targeted warmup scripts (e.g. `node scripts/cache/preload-session.js --session=s1`).

## 5. Mongo transaction / atomicity faults

- **City capture pipeline**
  - If `onCityOccupied` fails mid-way, run `node scripts/battle/replay-city-occupy.js --session=s1 --city=16` inside a `withTransaction`. Verify city ownership, city defense, and `BattleEventHook` logs.
- **Nation destruction**
  - Re-run the handler with the same parameters; idempotent updates (set nation=0) are safe because caches are invalidated before commit.
- **Session unification updates**
  - If `session.data.isunited` is inconsistent, call `SessionStateService.updateSessionState(sessionId, { isUnited: 2, status: 'finished' })`, then `SessionStateService.invalidateCache(sessionId)`.

## 6. Daemon restart & replay

| Daemon | Safe restart steps |
| --- | --- |
| Turn scheduler / turn processor | Stop process → ensure `execute_engine_lock:*` keys are gone → start process. Scheduler rehydrates via `SessionStateService`. |
| Auction processor | Stop cron → `redis-cli --scan --pattern 'lock:auction:*' | awk '{print "DEL", $1}' | redis-cli` → restart. Missed auctions for previous minute will be retried automatically. |
| Tournament engine | Stop daemon-unified → ensure `lock:tournament:*` cleared → restart; engine recomputes `iter` based on elapsed time. |
| Battle processor | Safe to restart anytime; it rebuilds `activeBattleTimers` from Mongo within 1s.

## 7. Battle settlement replay after crash

1. Inspect `battle` document: `db.battles.findOne({ battleId: 'XXX' })` to confirm `status`.
2. If `status` is still `IN_PROGRESS` but both armies are zero, call `handleBattleEnded` manually (Node REPL) **after** deleting any stale `lock:battle:settle:*` keys.
3. Watch logs for `BattleEventHook` completion and ensure caches invalidated (look for `[BattleEventHook] 캐시 무효화 완료`).

## 8. Redis downgrade fallback

If Redis is intentionally disabled (e.g., maintenance), set `CACHE_ENABLE_REDIS=false` and restart the backend.
- L1 cache remains active but is per-process; expect higher Mongo pressure.
- Locks will log warnings and simply skip locking, so run only a single instance of each daemon until Redis returns.

## 9. Post-incident review template

- What lock key or cache namespace was affected?
- Which daemons were competing?
- How long did clients observe stale data?
- Were manual `DEL` operations performed? If so, document the target keys.
- Link to the relevant section in this runbook for future responders.
