/**
 * Initialize LOGH Game Data
 * 은하영웅전설 초기 데이터 로딩
 *
 * Based on LoghData.ts - actual game data from gin7manual.txt
 */

import { mongoConnection } from '../db/connection';
import { LoghCommander } from '../models/logh/Commander.model';
import { Fleet } from '../models/logh/Fleet.model';
import { Planet } from '../models/logh/Planet.model';
import { FAMOUS_COMMANDERS, COMMAND_POINTS_BY_RANK, Rank, FactionType } from '../engine/logh/LoghData';
import { logger } from '../common/logger';

async function initLoghData(sessionId: string) {
  try {
    await mongoConnection.connect();

    logger.info(`[LOGH] Initializing data for session ${sessionId}`);

    // Clear existing data
    await LoghCommander.deleteMany({ session_id: sessionId });
    await Fleet.deleteMany({ session_id: sessionId });
    await Planet.deleteMany({ session_id: sessionId });

    // Create famous commanders
    let commanderNo = 1;
    const commanderIds: number[] = [];

    for (const [key, data] of Object.entries(FAMOUS_COMMANDERS)) {
      const commandPoints = COMMAND_POINTS_BY_RANK[data.rank as Rank] || 10;

      const commander = await LoghCommander.create({
        session_id: sessionId,
        no: commanderNo,
        name: data.name,
        faction: data.faction,
        rank: data.rank,
        stats: data.stats,
        evaluationPoints: 1000,
        famePoints: 500,
        achievements: 100,
        commandPoints,
        authorityCards: [],
        fleetId: null,
        flagship: null,
        position: {
          x: data.faction === FactionType.EMPIRE ? 100 : -100,
          y: 0,
          z: 0,
        },
        supplies: 50000,
        isActive: true,
        turnDone: false,
      });

      commanderIds.push(commanderNo);
      logger.info(`[LOGH] Created commander: ${data.name} (${data.faction})`);

      commanderNo++;
    }

    // Create initial fleets for each commander
    for (const no of commanderIds) {
      const commander = await LoghCommander.findOne({ session_id: sessionId, no });
      if (!commander) continue;

      const fleetId = `fleet_${sessionId}_${no}`;

      const fleet = await Fleet.create({
        session_id: sessionId,
        id: fleetId,
        name: `${commander.name}의 함대`,
        commanderId: no,
        faction: commander.faction,
        ships: [
          { type: 'battleship', count: 100 },
          { type: 'cruiser', count: 200 },
          { type: 'destroyer', count: 300 },
          { type: 'carrier', count: 50 },
        ],
        totalShips: 650,
        supplies: 30000,
        position: commander.position,
        formation: 'standard',
      });

      // Assign fleet to commander
      commander.fleetId = fleetId;
      await commander.save();

      logger.info(`[LOGH] Created fleet: ${fleet.name} (${fleet.totalShips} ships)`);
    }

    // Create initial planets
    const planets = [
      { name: '오딘', faction: 'empire', x: 100, y: 0, z: 0, isFortress: true },
      { name: '하이네센', faction: 'alliance', x: -100, y: 0, z: 0, isFortress: true },
      { name: '페잔', faction: 'neutral', x: 0, y: 50, z: 0, isFortress: false },
      { name: '이제르론', faction: 'neutral', x: 0, y: 0, z: 50, isFortress: true },
    ];

    for (const planetData of planets) {
      await Planet.create({
        session_id: sessionId,
        id: `planet_${sessionId}_${planetData.name}`,
        name: planetData.name,
        owner: planetData.faction as 'empire' | 'alliance' | 'neutral',
        production: {
          ships: planetData.isFortress ? 500 : 200,
          resources: planetData.isFortress ? 1000 : 500,
        },
        garrisonFleetId: null,
        isFortress: planetData.isFortress,
        fortressGuns: planetData.isFortress ? 10000 : 0,
        warehouse: {
          supplies: 100000,
          ships: 1000,
        },
        position: {
          x: planetData.x,
          y: planetData.y,
          z: planetData.z,
        },
      });

      logger.info(`[LOGH] Created planet: ${planetData.name} (${planetData.faction})`);
    }

    logger.info(`[LOGH] Data initialization completed for session ${sessionId}`);
    logger.info(`[LOGH] Created ${commanderIds.length} commanders, ${commanderIds.length} fleets, ${planets.length} planets`);

    process.exit(0);
  } catch (error: any) {
    logger.error('[LOGH] Data initialization failed', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Run with default session or provided argument
const sessionId = process.argv[2] || 'session_logh_default';
initLoghData(sessionId);
