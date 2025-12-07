#!/usr/bin/env ts-node
/**
 * Gin7 Map Seeding Verification Script
 * 
 * Verifies that:
 * 1. 100x50 grid data is fully seeded (5000 cells)
 * 2. Blocked cells (0) are properly marked as 'nebula' terrain
 * 3. Iserlohn (이제를론) and Phezzan (페잔) are at correct coordinates
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { GalaxyGrid } from '../src/models/gin7/GalaxyGrid';
import { StarSystem } from '../src/models/gin7/StarSystem';
import { Planet } from '../src/models/gin7/Planet';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/opensam';
const SESSION_ID = process.argv[2] || process.env.GIN7_SESSION_ID || 'gin7-default-session';

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: any;
}

async function verifyGridCount(sessionId: string): Promise<VerificationResult> {
  const count = await GalaxyGrid.countDocuments({ sessionId });
  const expected = 5000; // 100x50
  
  return {
    passed: count === expected,
    message: `Grid cells: ${count}/${expected}`,
    details: { count, expected }
  };
}

async function verifyBlockedCells(sessionId: string): Promise<VerificationResult> {
  // Blocked cells should have terrain: 'nebula'
  const blockedCount = await GalaxyGrid.countDocuments({ 
    sessionId, 
    terrain: 'nebula' 
  });
  
  const passableCount = await GalaxyGrid.countDocuments({
    sessionId,
    terrain: { $ne: 'nebula' }
  });

  // Expected from dry-run: 895 blocked, 4105 passable
  const expectedBlocked = 895;
  const expectedPassable = 4105;

  return {
    passed: blockedCount === expectedBlocked && passableCount === expectedPassable,
    message: `Blocked: ${blockedCount}/${expectedBlocked}, Passable: ${passableCount}/${expectedPassable}`,
    details: { blockedCount, passableCount, expectedBlocked, expectedPassable }
  };
}

async function verifyStarSystems(sessionId: string): Promise<VerificationResult> {
  const count = await StarSystem.countDocuments({ sessionId });
  const expected = 80;
  
  return {
    passed: count === expected,
    message: `Star systems: ${count}/${expected}`,
    details: { count, expected }
  };
}

async function verifyIserlohn(sessionId: string): Promise<VerificationResult> {
  // 이제를론 성계 (system_id: 18, grid_x: 19, grid_y: 14)
  const iserlohn = await StarSystem.findOne({
    sessionId,
    name: { $regex: /이제를론|Iserlohn/i }
  });

  if (!iserlohn) {
    return {
      passed: false,
      message: '이제를론(Iserlohn) not found',
      details: null
    };
  }

  const expectedX = 19;
  const expectedY = 14;
  const coordMatch = iserlohn.gridRef.x === expectedX && iserlohn.gridRef.y === expectedY;

  return {
    passed: coordMatch,
    message: `이제를론: (${iserlohn.gridRef.x}, ${iserlohn.gridRef.y}) - Expected: (${expectedX}, ${expectedY})`,
    details: {
      name: iserlohn.name,
      gridRef: iserlohn.gridRef,
      isFortress: iserlohn.isFortress,
      controllingFaction: iserlohn.controllingFactionId
    }
  };
}

async function verifyPhezzan(sessionId: string): Promise<VerificationResult> {
  // 페잔 성계 (system_id: 64, grid_x: 26, grid_y: 38)
  const phezzan = await StarSystem.findOne({
    sessionId,
    name: { $regex: /페잔|Phezzan/i }
  });

  if (!phezzan) {
    return {
      passed: false,
      message: '페잔(Phezzan) not found',
      details: null
    };
  }

  const expectedX = 26;
  const expectedY = 38;
  const coordMatch = phezzan.gridRef.x === expectedX && phezzan.gridRef.y === expectedY;

  return {
    passed: coordMatch,
    message: `페잔: (${phezzan.gridRef.x}, ${phezzan.gridRef.y}) - Expected: (${expectedX}, ${expectedY})`,
    details: {
      name: phezzan.name,
      gridRef: phezzan.gridRef,
      isCapital: phezzan.isCapital,
      controllingFaction: phezzan.controllingFactionId
    }
  };
}

async function verifyFactionDistribution(sessionId: string): Promise<VerificationResult> {
  const byFaction = await StarSystem.aggregate([
    { $match: { sessionId } },
    { $group: { _id: '$controllingFactionId', count: { $sum: 1 } } }
  ]);

  const factionMap: Record<string, number> = {};
  for (const item of byFaction) {
    factionMap[item._id] = item.count;
  }

  // Expected: 은하제국 39, 자유행성동맹 40, 페잔 1
  const empireCount = factionMap['faction_empire'] || 0;
  const allianceCount = factionMap['faction_alliance'] || 0;
  const fezzanCount = factionMap['faction_fezzan'] || 0;

  const passed = empireCount === 39 && allianceCount === 40 && fezzanCount === 1;

  return {
    passed,
    message: `Empire: ${empireCount}/39, Alliance: ${allianceCount}/40, Fezzan: ${fezzanCount}/1`,
    details: factionMap
  };
}

async function verifyPlanets(sessionId: string): Promise<VerificationResult> {
  const count = await Planet.countDocuments({ sessionId });
  // Each system should have 1-5 planets (avg ~3)
  const minExpected = 80; // At least 1 per system
  const maxExpected = 400; // Max 5 per system
  
  return {
    passed: count >= minExpected && count <= maxExpected,
    message: `Planets: ${count} (expected ${minExpected}-${maxExpected})`,
    details: { count, minExpected, maxExpected }
  };
}

async function main() {
  console.log('\n🔍 Gin7 Map Seeding Verification\n');
  console.log(`Session ID: ${SESSION_ID}`);
  console.log(`MongoDB URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('\n✅ Connected to MongoDB\n');

    const tests = [
      { name: '1. Grid Count (100x50=5000)', fn: verifyGridCount },
      { name: '2. Blocked Cells (terrain)', fn: verifyBlockedCells },
      { name: '3. Star Systems (80)', fn: verifyStarSystems },
      { name: '4. 이제를론(Iserlohn) Location', fn: verifyIserlohn },
      { name: '5. 페잔(Phezzan) Location', fn: verifyPhezzan },
      { name: '6. Faction Distribution', fn: verifyFactionDistribution },
      { name: '7. Planets Created', fn: verifyPlanets },
    ];

    let allPassed = true;
    const results: { name: string; result: VerificationResult }[] = [];

    for (const test of tests) {
      const result = await test.fn(SESSION_ID);
      results.push({ name: test.name, result });
      
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      console.log(`   ${result.message}`);
      if (result.details && !result.passed) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      console.log();
      
      if (!result.passed) allPassed = false;
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✅ ALL VERIFICATIONS PASSED');
    } else {
      console.log('❌ SOME VERIFICATIONS FAILED');
      const failed = results.filter(r => !r.result.passed);
      console.log(`   Failed: ${failed.map(r => r.name).join(', ')}`);
    }
    console.log('='.repeat(50) + '\n');

    // Show sample data
    console.log('\n📊 Sample Data:\n');
    
    // Sample grid at Iserlohn coordinates
    const iserlohnGrid = await GalaxyGrid.findOne({ sessionId: SESSION_ID, x: 19, y: 14 });
    if (iserlohnGrid) {
      console.log('Grid at Iserlohn (19, 14):');
      console.log(`  Terrain: ${iserlohnGrid.terrain}`);
      console.log(`  Star Systems: ${iserlohnGrid.starSystemIds.length > 0 ? iserlohnGrid.starSystemIds.join(', ') : 'none'}`);
      console.log(`  Name: ${iserlohnGrid.name || 'unnamed'}`);
    }

    // Sample grid at Phezzan coordinates
    const phezzanGrid = await GalaxyGrid.findOne({ sessionId: SESSION_ID, x: 26, y: 38 });
    if (phezzanGrid) {
      console.log('\nGrid at Phezzan (26, 38):');
      console.log(`  Terrain: ${phezzanGrid.terrain}`);
      console.log(`  Star Systems: ${phezzanGrid.starSystemIds.length > 0 ? phezzanGrid.starSystemIds.join(', ') : 'none'}`);
      console.log(`  Name: ${phezzanGrid.name || 'unnamed'}`);
    }

    // Sample blocked cell
    const blockedCell = await GalaxyGrid.findOne({ sessionId: SESSION_ID, terrain: 'nebula' });
    if (blockedCell) {
      console.log(`\nSample Blocked Cell (${blockedCell.x}, ${blockedCell.y}):`);
      console.log(`  Terrain: ${blockedCell.terrain}`);
      console.log(`  Movement Cost: ${blockedCell.terrainModifiers.movementCost}`);
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();

