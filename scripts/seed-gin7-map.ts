#!/usr/bin/env ts-node
/**
 * Gin7 Map Seeder Script
 * 
 * Seeds the galaxy map using data from 은영전지도.md
 * 
 * Usage:
 *   npx ts-node scripts/seed-gin7-map.ts [sessionId]
 *   npm run seed:gin7-map [sessionId]
 * 
 * Options:
 *   --clear    Clear existing data before seeding
 *   --stats    Show statistics after seeding
 *   --dry-run  Parse data without writing to database
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Gin7MapSeedService } from '../src/services/gin7/Gin7MapSeedService';
import { MapDataLoader } from '../src/services/gin7/MapDataLoader';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/opensam';

interface Args {
  sessionId: string;
  clear: boolean;
  stats: boolean;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const result: Args = {
    sessionId: process.env.GIN7_SESSION_ID || 'gin7-default-session',
    clear: false,
    stats: true,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--clear') {
      result.clear = true;
    } else if (arg === '--stats') {
      result.stats = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (!arg.startsWith('--')) {
      result.sessionId = arg;
    }
  }

  return result;
}

async function dryRun(): Promise<void> {
  console.log('\n📋 Dry Run - Parsing map data without database writes\n');
  
  try {
    const mapData = await MapDataLoader.loadMapData();
    
    console.log('✅ Map data parsed successfully!\n');
    
    console.log('📊 Grid Information:');
    console.log(`   Width: ${mapData.gridInfo.width}`);
    console.log(`   Height: ${mapData.gridInfo.height}`);
    console.log(`   Warp time per grid: ${mapData.gridInfo.warpTimePerGridDays} days`);
    
    const gridStats = MapDataLoader.getGridStats(mapData);
    console.log(`   Passable cells: ${gridStats.passable}`);
    console.log(`   Blocked cells: ${gridStats.blocked}`);
    console.log(`   Total cells: ${gridStats.total}`);
    
    console.log('\n🌟 Star Systems:');
    console.log(`   Total systems: ${mapData.starSystems.length}`);
    
    // Count by faction
    const byFaction: Record<string, number> = {};
    for (const system of mapData.starSystems) {
      byFaction[system.faction] = (byFaction[system.faction] || 0) + 1;
    }
    for (const [faction, count] of Object.entries(byFaction)) {
      console.log(`   - ${faction}: ${count} systems`);
    }
    
    console.log('\n📍 Sample Star Systems:');
    for (const system of mapData.starSystems.slice(0, 5)) {
      console.log(`   [${system.system_id}] ${system.system_name_ko} (${system.grid_x}, ${system.grid_y}) - ${system.faction}`);
    }
    console.log(`   ... and ${mapData.starSystems.length - 5} more`);
    
    console.log('\n🔗 Distance Data:');
    console.log(`   Total distance entries: ${mapData.distances.length}`);
    
    console.log('\n✅ Dry run completed successfully!');
  } catch (error) {
    console.error('\n❌ Dry run failed:', error);
    process.exit(1);
  }
}

async function seedMap(args: Args): Promise<void> {
  console.log('\n🚀 Gin7 Map Seeder\n');
  console.log(`Session ID: ${args.sessionId}`);
  console.log(`MongoDB URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  
  try {
    // Connect to MongoDB
    console.log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data if requested
    if (args.clear) {
      console.log('\n🗑️  Clearing existing galaxy data...');
      await Gin7MapSeedService.clearGalaxy(args.sessionId);
      console.log('✅ Cleared existing data');
    }

    // Seed the galaxy
    console.log('\n🌌 Seeding galaxy from 은영전지도.md...');
    const startTime = Date.now();
    
    const result = await Gin7MapSeedService.seedGalaxyFromFile(args.sessionId);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Seeding completed in ${duration}s`);
    console.log(`   Grids created: ${result.gridsCreated}`);
    console.log(`   Systems created: ${result.systemsCreated}`);
    console.log(`   Planets created: ${result.planetsCreated}`);

    // Show statistics if requested
    if (args.stats) {
      console.log('\n📊 Galaxy Statistics:');
      const stats = await Gin7MapSeedService.getStats(args.sessionId);
      console.log(`   Total grids: ${stats.grids}`);
      console.log(`   Passable grids: ${stats.passableGrids}`);
      console.log(`   Blocked grids: ${stats.blockedGrids}`);
      console.log(`   Star systems: ${stats.systems}`);
      console.log(`   Planets: ${stats.planets}`);
      console.log('   By faction:');
      for (const [faction, count] of Object.entries(stats.byFaction)) {
        const factionName = faction
          .replace('faction_empire', '은하제국')
          .replace('faction_alliance', '자유행성동맹')
          .replace('faction_fezzan', '페잔')
          .replace('faction_neutral', '중립');
        console.log(`     - ${factionName}: ${count}`);
      }
    }

    console.log('\n✅ Map seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Map seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.dryRun) {
    await dryRun();
  } else {
    await seedMap(args);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});








