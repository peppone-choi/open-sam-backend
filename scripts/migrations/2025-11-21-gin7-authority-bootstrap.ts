import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GalaxySession } from '../../src/models/logh/GalaxySession.model';
import { GalaxyAuthorityCardService } from '../../src/services/logh/GalaxyAuthorityCard.service';
import { GalaxySessionClock } from '../../src/models/logh/GalaxySessionClock.model';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function ensureClock(sessionId: string) {
  const clock = await GalaxySessionClock.findOne({ session_id: sessionId });
  if (clock) return;
  await GalaxySessionClock.create({ session_id: sessionId });
}

async function seedMemorySession() {
  const hasSession = await GalaxySession.countDocuments();
  if (hasSession > 0) {
    return;
  }

  await GalaxySession.create({
    session_id: 'gin7_memory',
    code: 'GIN7-MEM',
    title: 'GIN7 Memory Session',
    maxPlayers: 2000,
    activePlayers: 0,
    factions: [
      { name: 'empire', slots: 1000, activePlayers: 0, status: 'open' },
      { name: 'alliance', slots: 1000, activePlayers: 0, status: 'open' },
    ],
    timeScale: { realSeconds: 1, gameSeconds: 24 },
    reentryPolicy: { allowOriginalCharacter: false, factionLock: true },
    logisticWindowHours: 72,
    economyState: {
      status: 'active',
      treasury: 5_000_000,
      taxRate: 0.12,
      supplyBudget: 2_000_000,
      tradeIndex: 1,
      lastTick: null,
    },
    status: 'preparing',
  });
}

async function run() {
  const useMemory = process.argv.includes('--memory') || process.env.GIN7_MIGRATION_MEMORY === 'true';
  let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
  let memoryServer: MongoMemoryServer | null = null;

  try {
    if (useMemory) {
      memoryServer = await MongoMemoryServer.create();
      mongoUri = memoryServer.getUri();
      console.log(`[GIN7 MIGRATION] Using in-memory MongoDB at ${mongoUri}`);
    }

    await mongoose.connect(mongoUri);
    console.log(`[GIN7 MIGRATION] Connected to ${mongoUri}`);

    if (useMemory) {
      await seedMemorySession();
    }

    const sessions = await GalaxySession.find();
    console.log(`[GIN7 MIGRATION] Found ${sessions.length} Galaxy sessions`);

    let provisioned = 0;
    for (const session of sessions) {
      const factionSeeds = new Set(session.factions?.map((slot) => slot.name) || []);
      if (!factionSeeds.size) {
        factionSeeds.add('empire');
        factionSeeds.add('alliance');
      }

      for (const faction of factionSeeds) {
        if (faction === 'empire' || faction === 'alliance' || faction === 'rebel') {
          await GalaxyAuthorityCardService.ensureAuthorityCards(session.session_id, faction);
        }
      }

      await ensureClock(session.session_id);
      provisioned += 1;
      console.log(`  ✓ Session ${session.session_id}: authority cards + clock provisioned`);
    }

    console.log(`\n[GIN7 MIGRATION] Completed for ${provisioned} sessions (gin7manual Chapter3 職務権限カード, 時間管理).`);
  } finally {
    await mongoose.disconnect();
    console.log('[GIN7 MIGRATION] MongoDB connection closed');

    if (useMemory && memoryServer) {
      await memoryServer.stop();
      console.log('[GIN7 MIGRATION] In-memory MongoDB stopped');
    }
  }
}

run().catch((error) => {
  console.error('[GIN7 MIGRATION] Failed:', error);
  process.exit(1);
});
