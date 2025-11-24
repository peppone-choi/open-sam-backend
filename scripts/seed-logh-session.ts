import 'dotenv/config';
import mongoose from 'mongoose';
import { GalaxySession } from '../src/models/logh/GalaxySession.model';
import { GalaxySessionClock } from '../src/models/logh/GalaxySessionClock.model';
import { GalaxyCharacter } from '../src/models/logh/GalaxyCharacter.model';
import { Fleet } from '../src/models/logh/Fleet.model';
import { MapGrid } from '../src/models/logh/MapGrid.model';
import { TacticalMap } from '../src/models/logh/TacticalMap.model';
import { GalaxyGroundCombat } from '../src/models/logh/GalaxyGroundCombat.model';
import { GalaxyAuthorityCardService } from '../src/services/logh/GalaxyAuthorityCard.service';
import { GalaxyFactionCode } from '../src/models/logh/GalaxySession.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/opensam';
const SESSION_ID = process.env.LOGH_SESSION_ID || 'logh-skirmish-1';
const CHARACTER_ID = process.env.LOGH_CHARACTER_ID || 'logh-char-01';

async function ensureSession() {
  await GalaxySession.findOneAndUpdate(
    { session_id: SESSION_ID },
    {
      session_id: SESSION_ID,
      code: 'LOGH-SKIRMISH',
      title: 'LOGH Skirmish Session',
      maxPlayers: 200,
      activePlayers: 1,
      factions: [
        { name: 'empire', slots: 100, activePlayers: 1, status: 'open' },
        { name: 'alliance', slots: 100, activePlayers: 0, status: 'open' },
      ],
      status: 'running',
      mode: 'logh',
    },
    { upsert: true }
  );

  await GalaxySessionClock.findOneAndUpdate(
    { session_id: SESSION_ID },
    {
      session_id: SESSION_ID,
      gameTime: new Date(),
      phase: 'strategic',
      loopStats: { samples: 0, lastDurationMs: 0 },
    },
    { upsert: true }
  );
}

async function ensureCharacter() {
  await GalaxyCharacter.findOneAndUpdate(
    { session_id: SESSION_ID, characterId: CHARACTER_ID },
    {
      session_id: SESSION_ID,
      characterId: CHARACTER_ID,
      userId: 'logh-user-1',
      displayName: '라인하르트 QA',
      originType: 'generated',
      faction: 'empire',
      rank: '대장',
      commandPoints: {
        pcp: 60,
        mcp: 80,
        lastRecoveredAt: new Date(Date.now() - 60 * 1000),
      },
      commandCards: [
        { cardId: 'card.logh.warp', name: '워프 명령', category: 'fleet', commands: ['warp', 'move'] },
      ],
    },
    { upsert: true }
  );
}

async function ensureAuthorityCards() {
  await GalaxyAuthorityCardService.ensureAuthorityCards(SESSION_ID, 'empire' as GalaxyFactionCode);
}

async function ensureMapGrid() {
  await MapGrid.findOneAndUpdate(
    { session_id: SESSION_ID },
    {
      session_id: SESSION_ID,
      gridSize: { width: 32, height: 16 },
      grid: Array.from({ length: 16 }, () => Array.from({ length: 32 }, () => 1)),
      statistics: { systems: 0, hazards: 0 },
    },
    { upsert: true }
  );
}

async function ensureFleets() {
  await Fleet.findOneAndUpdate(
    { session_id: SESSION_ID, fleetId: 'fleet-empire-1' },
    {
      session_id: SESSION_ID,
      fleetId: 'fleet-empire-1',
      name: '제국 QA 함대',
      fleetType: 'fleet',
      commanderId: CHARACTER_ID,
      commanderName: '라인하르트 QA',
      faction: 'empire',
      ships: [{ type: 'battleship', count: 20, health: 95 }],
      totalShips: 20,
      totalStrength: 1800,
      supplies: 9000,
      fuel: 800,
      morale: 90,
      training: { discipline: 70, space: 80, ground: 20, air: 30 },
      strategicPosition: { x: 10, y: 6 },
      gridPosition: { x: 10, y: 6 },
      tacticalPosition: { x: 10, y: 6, heading: 0 },
    },
    { upsert: true }
  );

  await Fleet.findOneAndUpdate(
    { session_id: SESSION_ID, fleetId: 'fleet-alliance-1' },
    {
      session_id: SESSION_ID,
      fleetId: 'fleet-alliance-1',
      name: '동맹 QA 함대',
      fleetType: 'fleet',
      commanderId: 'logh-char-ally-1',
      commanderName: '양 웬리 QA',
      faction: 'alliance',
      ships: [{ type: 'cruiser', count: 18, health: 95 }],
      totalShips: 18,
      totalStrength: 1500,
      supplies: 8000,
      fuel: 750,
      morale: 92,
      training: { discipline: 72, space: 82, ground: 25, air: 35 },
      strategicPosition: { x: 20, y: 6 },
      gridPosition: { x: 20, y: 6 },
      tacticalPosition: { x: 20, y: 6, heading: 180 },
    },
    { upsert: true }
  );
}

async function ensureTacticalAndGround() {
  await TacticalMap.findOneAndUpdate(
    { session_id: SESSION_ID, tacticalMapId: 'logh-battle-1' },
    {
      session_id: SESSION_ID,
      tacticalMapId: 'logh-battle-1',
      status: 'active',
      strategicGridPosition: { x: 16, y: 6 },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { upsert: true }
  );

  await GalaxyGroundCombat.findOneAndUpdate(
    { session_id: SESSION_ID, battleId: 'logh-ground-1' },
    {
      session_id: SESSION_ID,
      battleId: 'logh-ground-1',
      gridCoordinates: { x: 16, y: 6 },
      factions: [
        { code: 'empire', commanderIds: [CHARACTER_ID], groundUnits: 2000 },
        { code: 'alliance', commanderIds: ['logh-char-ally-1'], groundUnits: 1800 },
      ],
      occupationStatus: [],
      supplyBatches: [],
      warehouseStocks: [],
      combatPhase: 'landing',
      startedAt: new Date(),
      lastUpdateAt: new Date(),
    },
    { upsert: true }
  );
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  await ensureSession();
  await ensureCharacter();
  await ensureAuthorityCards();
  await ensureMapGrid();
  await ensureFleets();
  await ensureTacticalAndGround();

  // eslint-disable-next-line no-console
  console.log('[LOGH] Skirmish session seeded:', SESSION_ID);
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
