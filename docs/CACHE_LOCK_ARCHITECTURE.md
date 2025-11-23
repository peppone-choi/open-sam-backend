# Cache, Lock & Transaction Architecture

## 1. Multi-tier cache overview

```
Player/API -> CacheService.getOrLoad()
              │
              ├─ L1: NodeCache (3s TTL, per-process)
              ├─ L2: Redis (entity TTL 360s, shared across daemons)
              └─ L3: MongoDB (authoritative persistence via session-persister)
```

- **Read path**: `L1 → L2 → Mongo`. Cache misses hydrate both layers.
- **Write path**: repositories call `save{Entity}` helpers → Redis (L2) → L1, while `db-sync-processor` flushes sync queue to Mongo.
- **Session state**: `SessionStateService` wraps `sessionRepository` and caches derived state objects for 60 seconds via `session:state:{sessionId}`.

## 2. Entity TTL & invalidation matrix

| Entity | L1 TTL | L2 TTL | Key pattern | Invalidation triggers |
| --- | --- | --- | --- | --- |
| Session | 3s | 360s (`session:byId:{sessionId}`) | `SessionStateService.updateSessionState`, `sessionRepository.saveDocument`, `ExecuteEngineService` completion, admin lock/unlock hooks | `SessionStateService.invalidateCache`, `invalidateCache('session', …)` |
| Session State view | 60s | 60s (`session:state:{sessionId}`) | Auto-populated from session snapshot | Explicit invalidation after ExecuteEngine run and admin state changes |
| General | 3s | 360s (`general:byId:{sessionId}:{generalId}`, `general:byNo:…`) | repo `saveGeneral`, enlistment/retire operations, tournaments | `invalidateCache('general', sessionId, generalId)` + list keys |
| City | 3s | 360s (`city:byId:{sessionId}:{cityId}`) | `cityRepository` writes, `battle-processor` settlement, `BattleEventHook` | `invalidateCache('city', sessionId, cityId)` and derived `cities:*` lists |
| Nation | 3s | 360s (`nation:byId:{sessionId}:{nationId}`) | Tribute/payroll, war outcomes, tournament rewards | `invalidateCache('nation', sessionId, nationId)` + `nations:list/active` |

### Component-specific rules

- **TurnScheduler**
  - Uses `SessionStateService.getSessionState` for every scheduling pass, so each daemon reads from cache instead of Mongo.
  - After every `ExecuteEngineService.execute` call, it calls `SessionStateService.invalidateCache(sessionId)` to force a fresh state snapshot before re-scheduling.
  - Locked sessions (`state.isLocked === true`) are skipped until the owning daemon releases the Redis lock.

- **SessionStateService**
  - Persists state via repositories then invalidates `session` caches plus `session:state:*` views.
  - All mutations acquire locks through `distributed-lock.helper.ts` (`session:lock:{sessionId}`, TTL 300s, 2 retries) to serialize admin + daemon transitions.

- **Battle/Event processors**
  - `battle-processor` acquires `lock:battle:settle:{sessionId}:{battleId}` before mutating city garrisons or invoking hooks.
  - After settlement it invalidates touched city/nation caches so UI nodes see the new owner immediately.
  - `BattleEventHook.onUnified` (unchanged code path) continues to call repositories; the resulting cache writes plus `SessionStateService.invalidateCache` keep session/global UI consistent.

- **Auction processor**
  - Serializes `processAuction(sessionId)` invocations with `lock:auction:{sessionId}` (TTL 55s) so only one worker can close bids per minute.

- **Tournament engine**
  - `processTournament` now takes `lock:tournament:{sessionId}` (TTL 90s) before reading or writing schedule state. Subsequent retries simply skip when the lock is held.

## 3. Distributed lock strategy

The helper at `src/common/lock/distributed-lock.helper.ts` centralizes Redis-backed locks. Each consumer specifies TTL + retry budget; tokens are stored per key to guarantee safe release.

| Lock key pattern | Owner(s) | TTL | Purpose |
| --- | --- | --- | --- |
| `session:lock:{sessionId}` | `SessionStateService` / admin pause/resume | 300s | Serialize state transitions, pause, resume, finish |
| `execute_engine_lock:{sessionId}` | `ExecuteEngineService` | configurable (`EXECUTE_ENGINE_LOCK_TTL`, default 120s) | Ensure only one turn executor runs per session |
| `lock:auction:{sessionId}` | `auction-processor` cron workers | 55s | Prevent overlapping auction settlement per minute |
| `lock:tournament:{sessionId}` | Tournament engine cron | 90s | Avoid duplicate bracket/phase advancement |
| `lock:battle:settle:{sessionId}:{battleId}` | Battle processor | 120s | Deduplicate battle settlement + event hooks |

**Acquisition policy**
- Default retries: 2–3 attempts with exponential-ish backoff (250–500 ms).
- Locks auto-expire; heartbeats are only required for long-running ExecuteEngine since its bespoke lock is unchanged.
- Failure to acquire never blocks the caller forever—daemons simply skip work and will retry on the next poll.

**Release policy**
- All releases go through the helper’s Lua script to ensure only the owner token can delete the key.
- Fallback `DEL` is used when the token is missing (eg. TTL expiry) to avoid zombie locks.

## 4. MongoDB transaction guidance

| Scenario | Isolation requirement | Strategy |
| --- | --- | --- |
| City occupation → nation destruction → possible unification | Multi-document update touching `cities`, `nations`, `generals`, `session` | Use a `withTransaction` block initiated from `BattleEventHook` (or a future orchestrator) whenever you need atomic state transitions (city owner flip + general nation reset + `session.data.isunited`). Embed the `cityRepository`, `nationRepository`, and `sessionRepository` writes in the same transaction session. |
| Turn execution (command processing) | Already serialized by `execute_engine_lock`, but updates only touch one general/nation at a time | Single-document writes through repositories; rely on cache write + eventual DB sync |
| Auction settlement | Bids + inventory adjustments typically affect a single auction lot and the winner. Repository updates are sufficient; rely on `lock:auction` for serialization |
| Tournament progression | Game env KV storage mutations (single `KVStorage` doc) + `tournament` collection updates; run sequentially under `lock:tournament` | Single-document atomic updates are enough because each step only touches one document at a time |
| Session pause/resume, admin overrides | Use `session:lock:{sessionId}` to gate writes, then update the `session` document via repository (single-document write) |

**Implementation notes**
- When transactions are necessary, reuse the existing Mongo connection from `connectDB` and call `const session = await mongoose.startSession(); await session.withTransaction(async () => { ... })`. The cache layer should still be updated via `save{Entity}` inside the transaction so L1/L2 stay fresh.
- Always invalidate caches (`invalidateCache(...)`) inside the transaction before commit so that other daemons fetch the updated values after the lock is released.

## 5. Reference snippets

- **Distributed lock helper**: `src/common/lock/distributed-lock.helper.ts` (shared `acquireDistributedLock`, `releaseDistributedLock`, `runWithDistributedLock`).
- **TurnScheduler cache usage**: `src/daemon/turn-scheduler.ts` now logs cache-driven scheduling and invalidates session state after every ExecuteEngine run.
- **Battle settlement cache busting**: `src/daemon/battle-processor.ts` invalidates city/nation entries once a battle finishes.

These rules ensure every daemon or API surface follows the same contract: read through the cache hierarchy, serialize conflicting state changes through Redis locks, and document when MongoDB needs formal transactions versus simple repository writes.
