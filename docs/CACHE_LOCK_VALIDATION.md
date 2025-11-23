# Cache / Lock Validation Checklist & Sample Logs

Use this checklist whenever you ship cache/lock-sensitive changes. Each section lists: (a) how to reproduce, (b) what changed compared to the previous behavior, and (c) canonical log snippets you should see after the fix.

## 1. TurnScheduler → ExecuteEngine

| Step | Expected result |
| --- | --- |
| `npm run dev:turn` (or start the daemon) | Scheduler logs **cache-driven scheduling** instead of raw Mongo queries. |
| Trigger a turn (`POST /api/admin/execute` or wait for `turntime`) | After ExecuteEngine completes, `SessionStateService.invalidateCache` runs and the next schedule uses the new `turntime`. |

**Before**: Scheduler queried `Session.find({ status: 'running' })` without cache context and gave no hint when it hit DB.

**After (sample log)**
```
[TurnScheduler] scheduled session via cache hierarchy { sessionId: 's1', cachedTurntime: '2025-11-23T09:10:00.000Z' }
[TurnScheduler] invalidated session cache after ExecuteEngine run { sessionId: 's1' }
```

## 2. SessionStateService / Socket broadcasts

| Step | Expected result |
| --- | --- |
| `PATCH /api/admin/session` pause/resume | API acquires `session:lock:{sessionId}` (lock helper log) before writing. |
| Observe server logs | You should see `[Lock] acquired distributed lock` with `context: 'session-state'` followed by `broadcastGameEvent(state:updated)` in the Socket manager log. |
| Client WebSocket | Receives `state:updated` event immediately because caches were invalidated before the lock was released. |

**Sample log**
```
[Lock] acquired distributed lock { lockKey: 'session:lock:s1', context: 'session-state' }
[SessionStateService] 세션 상태 업데이트 완료 { sessionId: 's1', updates: { status: 'paused' } }
[Lock] released distributed lock { lockKey: 'session:lock:s1', context: 'session-state' }
```

## 3. Battle settlement + event hooks

| Step | Expected result |
| --- | --- |
| Finish a battle (`POST /api/battle/mock-finish`) | Daemon acquires `lock:battle:settle:sX:battleId`. No duplicate settlement occurs even if two workers poll simultaneously. |
| Inspect Redis | Key disappears after settlement (`redis-cli TTL lock:battle:settle:*` → `-2`). |
| Refresh city/nation view | Updated owner info appears immediately thanks to cache invalidation. |

**Sample log (after)**
```
[BattleEventHook] 캐시 무효화 완료 (전투 정산) {
  sessionId: 's1',
  battleId: 'btl-2025-11-23-01',
  cityId: 16,
  nationIds: [101, 205]
}
```

## 4. Auction processor

| Step | Expected result |
| --- | --- |
| Run `node dist/daemon/auction-processor.js --once` twice concurrently | Exactly one instance processes each session; the other logs “Skip session because auction lock is held elsewhere.” |
| Inspect Redis | `lock:auction:{session}` exists <60s and then expires. |

**Sample log**
```
[AuctionProcessor] Skip session because auction lock is held elsewhere { sessionId: 's1' }
```

## 5. Tournament engine

| Step | Expected result |
| --- | --- |
| Start two tournament schedulers (intentionally) | Second worker should emit `[TournamentEngine] Skip run because another worker holds the lock`. |
| Verify state | `tnmt_time` advances only once. |

**Sample log**
```
[TournamentEngine] Skip run because another worker holds the lock { sessionId: 's1' }
```

## 6. Socket / real-time validation flow

1. Trigger a state change (pause session, finish battle, run auction).
2. Confirm the following log sequence appears in `server.ts` logs:
   - `[Lock] acquired distributed lock ... context: 'session-state'`
   - `[SessionStateService] invalidateCache` or `[BattleEventHook] 캐시 무효화 완료`
   - `socketManager.broadcastGameEvent` line.
3. Use `wss://` client (or `npm run ws:test`) to confirm `state:updated`, `battle:finished`, `auction:closed` events include the new payload.

## 7. Before/After summary

| Path | Before | After |
| --- | --- | --- |
| Turn scheduling | Direct Mongo reads, no cache awareness | Reads via `SessionStateService` + explicit cache invalidation after execution |
| Session locks | Inline `ioredis` logic per service | Shared helper with context-aware retries/logs |
| Battle settlement | No dedupe, cache invalidation was implicit | Redis lock + explicit `city/nation` cache bust + proof in log |
| Auction/Tournament daemons | No locking → duplicate runs possible | `lock:auction:*` and `lock:tournament:*` guard each cron |
| Runbook | Tribal knowledge | `CACHE_LOCK_RUNBOOK.md` defines fallback + manual steps |

Keep this document updated whenever a new daemon or entity comes under cache/lock control.
