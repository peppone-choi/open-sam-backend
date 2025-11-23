import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GalaxySession } from '../../src/models/logh/GalaxySession.model';
import { GalaxyAuthorityCardService } from '../../src/services/logh/GalaxyAuthorityCard.service';
import { gin7CommandCatalog } from '../../src/config/gin7/catalog';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const useMemory = process.argv.includes('--memory') || process.env.GIN7_MIGRATION_MEMORY === 'true';
  let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sangokushi';
  let memoryServer: MongoMemoryServer | null = null;

  try {
    if (useMemory) {
      memoryServer = await MongoMemoryServer.create();
      mongoUri = memoryServer.getUri();
      console.log(`[GIN7 BACKFILL] Using in-memory MongoDB at ${mongoUri}`);
    }

    await mongoose.connect(mongoUri);
    console.log(`[GIN7 BACKFILL] Connected to ${mongoUri}`);

    const sessions = await GalaxySession.find();
    console.log(`[GIN7 BACKFILL] Found ${sessions.length} Galaxy sessions`);

    let updatedSessions = 0;
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

      updatedSessions += 1;
      console.log(`  ✓ Session ${session.session_id}: cards synced to catalog ${gin7CommandCatalog.version}`);
    }

    console.log(`\n[GIN7 BACKFILL] Completed for ${updatedSessions} sessions.`);
  } finally {
    await mongoose.disconnect();
    console.log('[GIN7 BACKFILL] MongoDB connection closed');

    if (useMemory && memoryServer) {
      await memoryServer.stop();
      console.log('[GIN7 BACKFILL] In-memory MongoDB stopped');
    }
  }
}

run().catch((error) => {
  console.error('[GIN7 BACKFILL] Failed:', error);
  process.exit(1);
});
