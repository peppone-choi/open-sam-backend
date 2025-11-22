# GIN7 Mode Backend Overview

This note documents the backend primitives that power the Legend of Galactic Heroes (銀河英雄伝説Ⅶ) mode. All rules reference `gin7manual.txt` so downstream teams can trace the rationale.

## Session Clock & Victory Flow

- Each LOGH session now has a `GalaxySessionClock` document that tracks the in-universe time (`timeScaleFactor = 24`) in sync with real time (gin7manual.txt:1076-1118, 444-470).
- The `Gin7StrategicLoopService` advances the clock every 5 seconds, mirrors the manual victory conditions, and locks the session when:
  - An enemy capital planet (Odin or Heinessen) falls while satisfying the decisive/limited thresholds (gin7manual.txt:443-468).
  - Either faction controls ≤3 star systems including the capital.
  - The campaign reaches UC 801.07.27 without decisive victory, in which case population share determines a local victory (ties favor the Alliance per gin7manual.txt:466-468).
- When a victory is detected the loop updates `GalaxySession.victoryState`, appends a notification, and calls `SessionStateService.finishSession` so legacy dashboards stay in sync.

## Authority Cards & Organizational Roles

- `GalaxyAuthorityCard` stores every 職務権限カード, tying template metadata to a concrete holder. The structure mirrors Chapter3’s card breakdown and enforces the 16-card limit per character (gin7manual.txt:1076-1088).
- `GalaxyAuthorityCardService.ensureAuthorityCards()` provisions faction-specific cards from documented templates while `assignCard` / `releaseCard` enforce the manual’s ownership and revocation rules (gin7manual.txt:2334-2350).
- Starter characters now receive card payloads derived from these templates, keeping UI copy, command groups, and email aliases consistent with the source material.

## Strategic Operations

- `GalaxyOperation` now supports the three official objectives — 占領 / 防衛 / 掃討 — by extending the schema and validation set (gin7manual.txt:1800-1898).
- The daemon-driven loop automatically transitions operations through `issued → executing → completed`, respecting the 30-game-day expiry (gin7manual.txt:1850-1868) and preventing expired plans from lingering.
- Promise tuples now back every multi-query payload (`tupleAll()` helper). `/api/gin7/operations` and `/api/gin7/tactical` therefore always return fully-populated arrays in deterministic order (latest `updatedAt` first) even when Mongo returns `null`, simplifying frontend reducers.
- New gin7 routes provide:
  - `GET /api/gin7/operations/sessions/:sessionId/operations` — filterable status feed for planners.
  - `POST /api/gin7/operations/sessions/:sessionId/operations/:operationId/issue` — mirrors the 発令 command and stamps audit logs.

### Sample: `GET /api/gin7/operations/sessions/s2-main/operations`
```
{
  "success": true,
  "data": [
    {
      "operationId": "OP-ALL-011",
      "session_id": "s2-main",
      "code": "防衛02",
      "objectiveType": "defense",
      "status": "issued",
      "targetGrid": { "x": 33, "y": 11 },
      "timeline": {
        "waitHours": 4,
        "executionHours": 18,
        "issuedAt": "2025-11-21T02:20:00.000Z"
      },
      "auditTrail": [
        { "note": "Operation entered execution window (gin7manual.txt:1850-1866)", "author": "system" }
      ]
    }
  ],
  "compliance": [
    {
      "manualRef": "gin7manual.txt:1800-1898",
      "note": "Filterable 作戦 상태: 発令→作戦실행→30日 종료"
    }
  ]
}
```

## Tactical State API

- `GET /api/gin7/state/tactical` (surfaced via `/api/gin7/tactical` on the router) packages fleet formations plus the persisted energy sliders for HUD binding.
- The response contains a stable `units` array (tuple-resolved, ordered by fleet insert order), a normalized `energy` object, and `radarHeat` (flagship share used by the UI heat-map overlay).

### Sample: `GET /api/gin7/tactical?sessionId=s2-main`
```
{
  "success": true,
  "data": {
    "units": [
      {
        "id": "FLEET-001",
        "name": "第1艦隊",
        "type": "flagship",
        "hp": 9200,
        "maxHp": 12000,
        "energy": 68,
        "maxEnergy": 100,
        "position": { "row": 12, "col": 18 },
        "heading": 45,
        "faction": "empire"
      }
    ],
    "energy": { "beam": 24, "gun": 18, "shield": 20, "engine": 14, "warp": 12, "sensor": 12 },
    "radarHeat": 0.33
  }
}
```

## Card Management API

- `GET /api/gin7/authority/sessions/:sessionId/cards` exposes card inventory per session/faction.
- `POST /api/gin7/authority/sessions/:sessionId/cards/:cardId/assign` / `release` let personnel officers wire cards without direct DB edits, while the service enforces the manual-specified limits.

### Sample: `GET /api/gin7/authority/sessions/s2-main/cards`
```
{
  "success": true,
  "data": [
    {
      "cardId": "card.personal.basic:empire",
      "templateId": "card.personal.basic",
      "faction": "empire",
      "title": "個人カード",
      "category": "personal",
      "commandCodes": ["move", "travel", "chat", "mail:personal"],
      "status": "assigned",
      "holderCharacterId": "gal-char-02",
      "manualRef": "gin7manual.txt:1076-1118"
    }
  ],
  "compliance": [
    {
      "manualRef": "gin7manual.txt:1076-1166",
      "note": "職務権限カード 재고/소유 한도(16장) 자동 검증"
    }
  ]
}
```

## Telemetry & Energy Persistence (QA reference)

`Gin7FrontendService` backs HUD slider state and QA probes with two Mongo collections:

- `gin7tacticalpreferences` — single document per character storing the latest slider balance plus the last telemetry snapshot streamed from the browser.
- `gin7telemetrysamples` — append-only history powering future dashboards or Atlas charts.

Sample documents captured on 2025-11-22 via `docker exec sam-mongodb mongosh`:

```jsonc
// db.gin7tacticalpreferences.findOne({ session_id: "gin7-session-01" })
{
  "session_id": "gin7-session-01",
  "characterId": "gin7-char-01",
  "energy": { "beam": 40, "gun": 18, "shield": 22, "engine": 12, "warp": 5, "sensor": 3 },
  "telemetry": {
    "avgFps": 58.2,
    "cpuPct": 64.4,
    "memoryMb": 22.5,
    "sampleCount": 240,
    "collectedAt": "2025-11-22T02:13:49.011Z"
  },
  "createdAt": "2025-11-22T02:13:48.930Z",
  "updatedAt": "2025-11-22T02:13:49.012Z"
}

// db.gin7telemetrysamples.findOne({ session_id: "gin7-session-01" })
{
  "session_id": "gin7-session-01",
  "characterId": "gin7-char-01",
  "scene": "strategy",
  "avgFps": 58.2,
  "cpuPct": 64.4,
  "memoryMb": 22.5,
  "sampleCount": 240,
  "durationMs": 5000,
  "collectedAt": "2025-11-22T02:13:48.948Z",
  "createdAt": "2025-11-22T02:13:48.992Z"
}
```

Use these structures when crafting QA queries or dashboards.

## Session 2 Kickoff Dry Run & Monitoring

### Dry run checklist (2025-11-21)
- Executed `npx ts-node scripts/migrations/2025-11-21-gin7-authority-bootstrap.ts --session=s2 --dry-run` to reseed clocks/cards for the two active Session2 sandboxes. Results are logged in `d_log/2025-11-21_gin7-session2-dryrun.log` with missing-character callouts for QA follow-up.
- Verified unified daemon via `node dist/daemon-unified.js --once --session=s2-preview`; average tick latency remained <1.8s and the new `loopStats` snapshot persisted for each `GalaxySessionClock`.
- Forced a lag spike (`GIN7_LOOP_ALERT_THRESHOLD_MS=10`) to assert alert propagation and to capture webhook payloads prior to re-enabling the sane threshold (3.5s per Chapter3 logistics cadence).

### Strategic loop monitoring & alert hooks
- Each `GalaxySessionClock` now persists a `loopStats` block with `lastTickDurationMs`, rolling averages, `consecutiveFailures`, and `lastAlertAt/Reason`. These fields are consumed by the `/api/gin7/session` + `/api/gin7/strategy` endpoints and feed the frontend radar widgets.
- `Gin7StrategicLoopService` raises alerts through `Gin7DaemonAlert.service`. Configure the hooks via:
  - `GIN7_LOOP_ALERT_THRESHOLD_MS` (default `3500`) – lag threshold per tick.
  - `GIN7_ALERT_WEBHOOK_URL` – optional ops webhook; when unset, alerts stay in structured logs only.
  - `GIN7_ALERT_RATE_LIMIT` (default `5` per minute) and `GIN7_ALERT_TIMEOUT_MS` (default `2000`) to protect downstream channels.
- Alerts fire for per-session tick failures, tick latency breaches, and session victory detection. Every alert is also stored in `loopStats.lastAlertAt/Reason` for dashboard replay.

## Session & Strategy API Surfaces

### `GET /api/gin7/session/sessions/:sessionId/overview`
- Purpose: single payload for 職務権限 카드 상태, PCP/MCP 회복률, loop health, and shortcut metadata (Ref: gin7manual.txt:1076-1188, 1800-1898).
- Response includes `schemaVersion` (`2025-11-21.session.1`), session basics, `clock.loopStats`, aggregated card counts, command-point averages, substitution debt, and the 12 most relevant authority cards.

```
GET /api/gin7/session/sessions/s2-main/overview
{
  "success": true,
  "schemaVersion": "2025-11-21.session.1",
  "data": {
    "session": {
      "sessionId": "s2-main",
      "title": "LOGH Session 2",
      "status": "running",
      "factions": [
        { "name": "empire", "slots": 120, "activePlayers": 87 },
        { "name": "alliance", "slots": 120, "activePlayers": 84 }
      ],
      "logisticWindowHours": 72,
      "notifications": [
        {
          "message": "UC 797.04 전략 루프 가동",
          "createdAt": "2025-11-21T03:00:00.000Z",
          "manualRef": "gin7manual.txt:299-304"
        }
      ]
    },
    "clock": {
      "gameTime": "0797-04-18T00:00:00.000Z",
      "phase": "strategic",
      "manuallyPaused": false,
      "loopStats": {
        "lastTickDurationMs": 1320,
        "avgTickDurationMs": 1488,
        "maxTickDurationMs": 2480,
        "sampleCount": 86,
        "consecutiveFailures": 0,
        "lastTickCompletedAt": "2025-11-21T03:12:05.019Z"
      }
    },
    "cards": {
      "total": 128,
      "byStatus": { "available": 41, "assigned": 79, "locked": 6, "revoked": 2 },
      "byCategory": { "personal": 32, "fleet": 28, "logistics": 24, "politics": 22, "intel": 22 },
      "recentAssignments": [
        {
          "cardId": "card.logistics.officer:empire",
          "holderCharacterId": "gal-char-77",
          "lastIssuedAt": "2025-11-21T02:58:00.000Z"
        }
      ]
    },
    "commandPoints": {
      "rosterSize": 171,
      "totals": { "pcp": 1462, "mcp": 1638 },
      "average": { "pcp": 8.55, "mcp": 9.58 },
      "lowCapacity": 23,
      "substitutionDebt": 11,
      "lastRecoverySample": [
        {
          "characterId": "gal-char-02",
          "displayName": "양 웬리",
          "pcp": 12,
          "mcp": 12,
          "lastRecoveredAt": "2025-11-21T02:50:00.000Z"
        }
      ]
    },
    "shortcuts": [
      {
        "cardId": "card.politics.chief:alliance",
        "title": "국가정책 카드",
        "status": "assigned",
        "commandGroups": ["政治", "人事"],
        "commandCodes": ["set-tax", "appoint-governor"]
      }
    ]
  }
}
```

### `GET /api/gin7/strategy/sessions/:sessionId/map`
- Purpose: supply the 100×50 grid, warp graph, fleet overlays, and active 作戦 hotspot feed referenced in Chapter2-3 (gin7manual.txt:316-331, 1850-1898).
- Response (`schemaVersion = 2025-11-21.strategy.1`) bundles session basics, `clock.loopStats`, map meta, star system slices, fleet overlays, and ordered hotspots.

```
GET /api/gin7/strategy/sessions/s2-main/map
{
  "success": true,
  "schemaVersion": "2025-11-21.strategy.1",
  "data": {
    "session": { "sessionId": "s2-main", "title": "LOGH Session 2", "status": "running" },
    "clock": { "phase": "strategic", "loopStats": { "lastTickDurationMs": 1320 } },
    "map": {
      "meta": { "width": 100, "height": 50, "systemCount": 82, "warpRouteCount": 244 },
      "starSystems": [
        {
          "systemId": "odin",
          "systemNumber": 1,
          "name": "오딘",
          "faction": "empire",
          "grid": { "x": 42, "y": 18 },
          "strategicValue": "critical",
          "warpRoutes": ["fezzan", "iserlohn"]
        }
      ]
    },
    "fleets": [
      {
        "fleetId": "emp-fleet-03",
        "name": "Reuenthal Fleet",
        "faction": "empire",
        "status": "moving",
        "position": { "x": 47, "y": 21 },
        "destination": { "x": 48, "y": 22 },
        "isMoving": true,
        "totalShips": 5400,
        "morale": 78,
        "formation": "offensive",
        "inCombat": false
      }
    ],
    "operationHotspots": [
      {
        "operationId": "OP-EMP-044",
        "code": "掃討03",
        "objectiveType": "sweep",
        "status": "issued",
        "targetGrid": { "x": 52, "y": 19 },
        "waitHours": 6,
        "executionHours": 24,
        "issuedAt": "2025-11-21T02:40:00.000Z"
      }
    ]
  }
}
```

## Migration & Ops


1. Run `npx ts-node scripts/migrations/2025-11-21-gin7-authority-bootstrap.ts` after pulling to seed authority cards and clocks for existing sessions.
2. Launch the daemon (`npm run dev:api` or `node dist/daemon-unified.js`) to start the new strategic loop alongside legacy schedulers.
3. Use `npm run typecheck && npm test` to verify schema alignment locally.

These additions keep the TypeScript backend self-contained — no PHP coupling — while matching the original GIN7 rulebook for authority hierarchies, command timing, and victory evaluation.
