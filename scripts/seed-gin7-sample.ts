import 'dotenv/config';
import mongoose from 'mongoose';
import { Gin7FrontendService } from '../src/services/logh/Gin7Frontend.service';
import { GalaxySession } from '../src/models/logh/GalaxySession.model';
import { GalaxyCharacter } from '../src/models/logh/GalaxyCharacter.model';
import { GalaxyAuthorityCard } from '../src/models/logh/GalaxyAuthorityCard.model';
import { Fleet } from '../src/models/logh/Fleet.model';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/opensam';
const SESSION_ID = process.env.GIN7_SESSION_ID || 'gin7-session-01';
const CHARACTER_ID = process.env.GIN7_CHARACTER_ID || 'gin7-char-01';

async function ensureSession() {
  await GalaxySession.findOneAndUpdate(
    { session_id: SESSION_ID },
    {
      session_id: SESSION_ID,
      code: 'GIN7-DEMO',
      title: 'GIN7 QA Demo Session',
      maxPlayers: 2000,
      activePlayers: 1,
      factions: [
        { name: 'empire', slots: 1000, activePlayers: 1, status: 'open' },
        { name: 'alliance', slots: 1000, activePlayers: 0, status: 'open' },
      ],
      status: 'running',
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
      userId: 'qa-user',
      displayName: 'ラインハルト QA',
      originType: 'original',
      faction: 'empire',
      rank: '元帥',
      commandPoints: {
        pcp: 96,
        mcp: 144,
        lastRecoveredAt: new Date(Date.now() - 120 * 1000),
      },
      commandCards: [
        { cardId: 'card.personal.basic', name: '個人カード', category: 'personal', commands: ['move', 'travel', 'chat'] },
        { cardId: 'card.captain.basic', name: '艦長カード', category: 'fleet', commands: ['warp', 'dock', 'supply', 'formation:set'] },
      ],
      mailbox: { personal: 'qa@empire.gin7', roles: [] },
    },
    { upsert: true }
  );
}

async function ensureAuthorityCards() {
  const cards = [
    {
      cardId: 'card.personal.basic:empire',
      templateId: 'card.personal.basic',
      title: '個人カード',
      category: 'personal',
      commandCodes: ['move', 'travel', 'chat', 'mail:personal'],
    },
    {
      cardId: 'card.captain.basic:empire',
      templateId: 'card.captain.basic',
      title: '艦長カード',
      category: 'fleet',
      commandCodes: ['warp', 'dock', 'supply', 'formation:set'],
    },
  ];

  for (const card of cards) {
    await GalaxyAuthorityCard.findOneAndUpdate(
      { session_id: SESSION_ID, cardId: card.cardId },
      {
        session_id: SESSION_ID,
        faction: 'empire',
        status: 'assigned',
        holderCharacterId: CHARACTER_ID,
        manualRef: 'gin7manual.txt',
        commandGroups: ['作戦'],
        ...card,
      },
      { upsert: true }
    );
  }
}

async function ensureFleet() {
  await Fleet.findOneAndUpdate(
    { session_id: SESSION_ID, fleetId: 'fleet-qa-01' },
    {
      session_id: SESSION_ID,
      fleetId: 'fleet-qa-01',
      name: 'QA 검증 함대',
      fleetType: 'fleet',
      commanderId: CHARACTER_ID,
      commanderName: 'ラインハルト QA',
      faction: 'empire',
      ships: [{ type: 'battleship', count: 10, health: 95 }],
      totalShips: 10,
      totalStrength: 900,
      supplies: 9000,
      fuel: 800,
      morale: 85,
      training: { discipline: 70, space: 75, ground: 20, air: 30 },
      strategicPosition: { x: 12, y: 8 },
      gridPosition: { x: 12, y: 8 },
      tacticalPosition: { x: 12, y: 8, heading: 45 },
    },
    { upsert: true }
  );
}

async function run() {
  await mongoose.connect(MONGODB_URI);
  await ensureSession();
  await ensureCharacter();
  await ensureAuthorityCards();
  await ensureFleet();

  const energy = await Gin7FrontendService.updateEnergyProfile(SESSION_ID, CHARACTER_ID, {
    beam: 40,
    gun: 18,
    shield: 22,
    engine: 12,
    warp: 5,
    sensor: 3,
  });
  console.log('[gin7] energy profile updated', energy);

  await Gin7FrontendService.recordTelemetry(SESSION_ID, CHARACTER_ID, {
    scene: 'strategy',
    avgFps: 58.2,
    cpuPct: 64.4,
    memoryMb: 22.5,
    sampleCount: 240,
    durationMs: 5000,
  });
  console.log('[gin7] telemetry sample stored');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
