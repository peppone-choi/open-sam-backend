# Backend Session B - Task Breakdown

## Task 1: ✅ tryUniqueItemLottery Implementation
**Status**: ALREADY IMPLEMENTED
- Location: src/utils/unique-item-lottery.ts
- Functions: tryUniqueItemLottery, giveRandomUniqueItem
- Already integrated in 25+ command files

## Task 2: Create Lottery Tests
**Status**: TODO
- Create: src/services/lottery/__tests__/unique-item-lottery.test.ts
- Test scenarios:
  - Basic lottery probability
  - Inheritance point refund
  - Item availability checking
  - NPC type filtering

## Task 3: Create Session Seed Script
**Status**: TODO  
- Create: scripts/seed-test-session.js
- Requirements:
  - 1 session (sangokushi_test)
  - 5 users
  - 10 generals
  - MongoDB + Redis injection

## Task 4: Join/GetFrontInfo TODOs
**Status**: REVIEW NEEDED
- Both files already handle:
  - rank_data table integration (lines 464-497 in Join.service.ts)
  - Inheritance point logging (lines 507-546 in Join.service.ts)
  - Image info processing (lines 1178-1223 in Join.service.ts)
- ACTION: Verify no outstanding TODOs exist

## Validation Commands
```bash
npm run build
node scripts/seed-test-session.js
npm test -- lottery
```
