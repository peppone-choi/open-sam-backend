// @ts-nocheck - Type issues need investigation
import * as cron from 'node-cron';
import { configManager } from './config/ConfigManager';

const { system, daemon: daemonCfg } = configManager.get();

/**
 * 통합 게임 데몬
 */

let isShuttingDown = false;
const sessionLastProcessedTime: Map<string, number> = new Map();
const sessionLastNPCProcessedTime: Map<string, number> = new Map();

let mongoConnection: any;
let getScenarioConfig: any;
let logger: any;
let CommandRegistry: any;
let CommandExecutor: any;
let LoghCommandRegistry: any;
let LoghCommandExecutor: any;
let Session: any;
let SessionStateService: any;
let ExecuteEngineService: any;
let processAuction: any;
let processTournament: any;

function getTurnIntervalSeconds(scenarioId: string): number {
  if (!getScenarioConfig) return 60;
  try {
    const config = getScenarioConfig(scenarioId);
    return config?.metadata?.turnIntervalSeconds ?? 60;
  } catch {
    return 60;
  }
}

function shouldProcessSession(sessionId: string, scenarioId: string): boolean {
  const now = Date.now();
  const lastProcessed = sessionLastProcessedTime.get(sessionId) || 0;
  const intervalSeconds = getTurnIntervalSeconds(scenarioId);
  const intervalMs = intervalSeconds * 1000;
  return (now - lastProcessed) >= intervalMs;
}

async function processTurns() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    for (const session of sessions) {
      const sessionId = session.session_id;
      const scenarioId = session.data?.scenario_id || (sessionId.startsWith('logh_') ? 'legend-of-galactic-heroes' : 'sangokushi');
      if (!shouldProcessSession(sessionId, scenarioId)) continue;
      
      try {
        if (sessionId.startsWith('logh_')) {
          if (SessionStateService) {
            const locked = await SessionStateService.acquireSessionLock(sessionId, 60);
            if (!locked) continue;
          }
          try {
            await processLoghTurn(sessionId);
            sessionLastProcessedTime.set(sessionId, Date.now());
          } finally {
            if (SessionStateService) await SessionStateService.releaseSessionLock(sessionId);
          }
        } else {
          const result = await ExecuteEngineService.execute({ session_id: sessionId, singleTurn: true });
          if (result.updated || !result.locked) sessionLastProcessedTime.set(sessionId, Date.now());
        }
      } catch (error: any) {
        logger.error(`Turn processing error for ${sessionId}`, { error: error.message });
      }
    }
  } catch (error: any) {
    logger.error('Fatal error in turn processor', { error: error.message });
  }
}

async function processLoghTurn(sessionId: string) {
  try {
    const { LoghCommander } = await import('./models/logh/Commander.model');
    const { Fleet } = await import('./models/logh/Fleet.model');
    const { Planet } = await import('./models/logh/Planet.model');
    
    await LoghCommander.updateMany({ session_id: sessionId }, { $set: { turnDone: false } });

    const planets = await Planet.find({ session_id: sessionId });
    for (const planet of planets) {
      if (planet.owner) {
        const production = Math.floor(planet.population / 100);
        planet.resources.minerals = (planet.resources.minerals || 0) + production;
        planet.resources.food = (planet.resources.food || 0) + production;
        await planet.save();
      }
    }

    const fleets = await Fleet.find({ session_id: sessionId });
    for (const fleet of fleets) {
      if (fleet.supplies) {
        fleet.supplies.fuel = Math.max(0, (fleet.supplies.fuel || 0) - 1);
        fleet.supplies.ammunition = Math.max(0, (fleet.supplies.ammunition || 0) - 1);
        await fleet.save();
      }
    }

    const commanders = await LoghCommander.find({ session_id: sessionId, 'activeCommands.0': { $exists: true } });
    for (const commander of commanders) {
      const now = new Date();
      const completedCommands = commander.activeCommands.filter((cmd: any) => cmd.completesAt <= now);
      for (const cmd of completedCommands) {
        const command = LoghCommandRegistry.getCommand(cmd.commandType);
        if (command) {
          try {
            await command.onTurnEnd({ commander: commander as any, session: await Session.findOne({ session_id: sessionId }), env: {} });
          } catch (e) {}
        }
      }
      commander.activeCommands = commander.activeCommands.filter((cmd: any) => cmd.completesAt > now);
      await commander.save();
    }
  } catch (error: any) {
    logger.error('[LOGH] 턴 처리 실패', error);
  }
}

async function processAuctions() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    for (const session of sessions) {
      try { await processAuction(session.session_id); } catch (e) {}
    }
  } catch (e) {}
}

async function processTournaments() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    for (const session of sessions) {
      try { await processTournament(session.session_id); } catch (e) {}
    }
  } catch (e) {}
}

function shouldProcessNPCForSession(sessionId: string, scenarioId: string): boolean {
  const now = Date.now();
  const lastProcessed = sessionLastNPCProcessedTime.get(sessionId) || 0;
  return (now - lastProcessed) >= getTurnIntervalSeconds(scenarioId) * 1000;
}

async function processNPCCommands() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    for (const session of sessions) {
      const sessionId = session.session_id;
      const scenarioId = session.data?.scenario_id || (sessionId.startsWith('logh_') ? 'legend-of-galactic-heroes' : 'sangokushi');
      if (!shouldProcessNPCForSession(sessionId, scenarioId)) continue;

      try {
        const { NPCAutoCommandService } = await import('./services/ai/NPCAutoCommand.service');
        await NPCAutoCommandService.assignCommandsToAllNPCs(sessionId, session.data || {});
        sessionLastNPCProcessedTime.set(sessionId, Date.now());
        await NPCAutoCommandService.assignNationTurnsToAllNPCs(sessionId, session.data || {});
      } catch (e) {}
    }
  } catch (e) {}
}

async function processBattleResolution() {
  try {
    const { Battle } = await import('./models/battle.model');
    const { ResolveTurnService } = await import('./services/battle/ResolveTurn.service');
    const now = new Date();
    const expiredBattles = await Battle.find({
      status: 'IN_PROGRESS',
      currentPhase: 'planning',
      $expr: { $lt: [{ $add: ['$updatedAt', { $multiply: ['$planningTimeLimit', 1000] }] }, now] }
    });
    for (const battle of expiredBattles) {
      try { await ResolveTurnService.execute(battle.battleId); } catch (e) {}
    }
  } catch (e) {}
}

async function syncToDB() {
  try {
    const { scanSyncQueue, getSyncQueueItem, removeFromSyncQueue } = await import('./common/cache/sync-queue.helper');
    const { General } = await import('./models/general.model');
    const { City } = await import('./models/city.model');
    const { Nation } = await import('./models/nation.model');
    const queueItems = await scanSyncQueue();
    if (queueItems.length === 0) return;

    for (const item of queueItems) {
      try {
        const queueData = await getSyncQueueItem(item.key);
        if (!queueData || !queueData.data) {
          await removeFromSyncQueue(item.key);
          continue;
        }
        const { type, data } = queueData;
        switch (type) {
          case 'session':
            await Session.updateOne({ session_id: data.session_id }, { $set: data }, { strict: false });
            break;
          case 'general':
            await General.updateOne({ session_id: data.session_id, no: data.no }, { $set: data }, { strict: false });
            break;
          case 'city':
            await City.updateOne({ session_id: data.session_id, city: data.city }, { $set: data }, { strict: false });
            break;
          case 'nation':
            await Nation.updateOne({ session_id: data.session_id, nation: data.nation }, { $set: data }, { strict: false });
            break;
        }
        await removeFromSyncQueue(item.key);
      } catch (e) {}
    }
  } catch (e) {}
}

async function consumeCommands(queue: any, groupName: string, consumerName: string) {
  try {
    await queue.consume(groupName, consumerName, async (message: any) => {
      let result: any;
      if (message.gameMode === 'logh' || message.commanderNo !== undefined) {
        result = await LoghCommandExecutor.execute({
          commandType: message.type,
          commanderNo: parseInt(message.commanderNo, 10),
          sessionId: message.sessionId,
          arg: message.arg
        });
      } else {
        result = await CommandExecutor.execute({
          category: message.category,
          type: message.type,
          generalId: message.generalId,
          sessionId: message.sessionId,
          arg: message.arg
        });
      }
      if (!result.success) throw new Error(result.error);
    });
  } catch (e) {}
}

export async function startUnifiedDaemon() {
  return start();
}

async function start() {
  try {
    const loggerModule = await import('./common/logger');
    logger = loggerModule.logger;
    
    logger.info('🚀 통합 게임 데몬 시작 중...', { nodeEnv: system.nodeEnv });

    const dbModule = await import('./db/connection');
    mongoConnection = dbModule.mongoConnection;
    await mongoConnection.connect();

    const { RedisService } = await import('./infrastructure/queue/redis.service');
    await RedisService.connect();

    const sessionModule = await import('./models/session.model');
    Session = sessionModule.Session;

    const sessionStateModule = await import('./services/sessionState.service');
    SessionStateService = sessionStateModule.SessionStateService;
    
    const commandModule = await import('./core/command');
    CommandRegistry = commandModule.CommandRegistry;
    
    const executorModule = await import('./core/command/CommandExecutor');
    CommandExecutor = executorModule.CommandExecutor;
    
    const loghRegistryModule = await import('./commands/logh/CommandRegistry');
    LoghCommandRegistry = loghRegistryModule.commandRegistry;
    
    const loghExecutorModule = await import('./commands/logh/LoghCommandExecutor');
    LoghCommandExecutor = loghExecutorModule.LoghCommandExecutor;
    
    const engineModule = await import('./services/global/ExecuteEngine.service');
    ExecuteEngineService = engineModule.ExecuteEngineService;
    
    const auctionModule = await import('./services/auction/AuctionEngine.service');
    processAuction = auctionModule.processAuction;
    
    const tournamentModule = await import('./services/tournament/TournamentEngine.service');
    processTournament = tournamentModule.processTournament;
    
    const scenarioDataModule = await import('./utils/scenario-data');
    getScenarioConfig = scenarioDataModule.getScenarioConfig;

    await CommandRegistry.loadAll();
    const { registerAllEventHandlers } = await import('./events');
    registerAllEventHandlers();
    
    const { CommandQueue } = await import('./infrastructure/queue/command-queue');
    const queue = new CommandQueue('game:commands');
    await queue.init();

    const TURN_INTERVAL_MS = 15000;
    let isProcessingTurns = false;
    setInterval(() => {
      if (isProcessingTurns) return;
      isProcessingTurns = true;
      processTurns().finally(() => { isProcessingTurns = false; });
    }, TURN_INTERVAL_MS);

    cron.schedule('* * * * *', () => { processAuctions(); });
    cron.schedule('* * * * *', () => { processTournaments(); });
    
    setInterval(() => { processNPCCommands(); }, 15000);
    
    cron.schedule('*/5 * * * * *', () => { syncToDB(); });
    cron.schedule('*/5 * * * * *', () => { processBattleResolution(); });

    const consumerName = process.env.HOSTNAME || 'daemon-unified-1';
    cron.schedule('* * * * * *', () => { consumeCommands(queue, 'cmd-group', consumerName); });
    
    logger.info('🎮 통합 게임 데몬 시작 완료!');
  } catch (error) {
    logger.error('🔥 통합 게임 데몬 시작 실패', error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  logger.info('🛑 Shutdown 신호 수신', { signal });
  isShuttingDown = true;
  try {
    const { RedisService } = await import('./infrastructure/queue/redis.service');
    const redis = RedisService.getClient();
    const lockKeys = await redis.keys('execute_engine_lock:*');
    if (lockKeys.length > 0) await Promise.all(lockKeys.map(key => redis.del(key)));
    await mongoConnection.disconnect();
    await RedisService.disconnect();
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module || process.argv[1]?.includes('daemon-unified')) {
  start().catch(err => {
    process.exit(1);
  });
}
