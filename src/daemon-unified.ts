// @ts-nocheck - Type issues need investigation
import dotenv from 'dotenv';
dotenv.config();

import * as cron from 'node-cron';

/**
 * 통합 게임 데몬
 * 
 * 1. 턴 스케줄링 (크론 기반) - 매분마다 게임 턴 처리
 * 2. 커맨드 소비 (Redis Streams) - 비동기 커맨드 실행
 * 
 * 두 가지 역할을 하나의 프로세스에서 처리합니다.
 * 
 * 최적화: 세션 상태 업데이트 직후 락 해제 (운영자 수정 대기 시간 최소화)
 */

let isShuttingDown = false;

// 세션별 마지막 처리 시간 추적 (시나리오별 처리 간격 지원)
const sessionLastProcessedTime: Map<string, number> = new Map();
const sessionLastNPCProcessedTime: Map<string, number> = new Map();

// 동적 임포트를 위한 전역 변수
let mongoConnection: any;
let getScenarioConfig: any; // 시나리오 설정 로더
const fallbackLogger = {
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: (console.debug || console.log).bind(console),
};
let logger: any = fallbackLogger;
let CommandRegistry: any;
let CommandExecutor: any;
let LoghCommandRegistry: any;
let LoghCommandExecutor: any;
let Session: any;
let SessionStateService: any;
let ExecuteEngineService: any;
let processAuction: any;
let processTournament: any;

/**
 * 시나리오별 턴 처리 간격 가져오기
 * @param scenarioId 시나리오 ID (예: 'sangokushi', 'legend-of-galactic-heroes')
 * @returns 처리 간격 (초), 기본값 60초
 */
function getTurnIntervalSeconds(scenarioId: string): number {
  if (!getScenarioConfig) return 60; // 로더가 없으면 기본값
  
  try {
    const config = getScenarioConfig(scenarioId);
    return config?.metadata?.turnIntervalSeconds ?? 60;
  } catch {
    return 60;
  }
}

/**
 * 세션의 처리 간격이 지났는지 확인
 * @param sessionId 세션 ID
 * @param scenarioId 시나리오 ID
 * @returns 처리해야 하면 true
 */
function shouldProcessSession(sessionId: string, scenarioId: string): boolean {
  const now = Date.now();
  const lastProcessed = sessionLastProcessedTime.get(sessionId) || 0;
  const intervalSeconds = getTurnIntervalSeconds(scenarioId);
  const intervalMs = intervalSeconds * 1000;
  
  return (now - lastProcessed) >= intervalMs;
}

/**
 * 턴 처리 함수 (15초마다 호출)
 * 
 * 시나리오별 처리 간격을 확인하여 세션을 처리합니다:
 * - sangokushi: 60초마다 (turnIntervalSeconds: 60)
 * - legend-of-galactic-heroes: 15초마다 (turnIntervalSeconds: 15)
 */
async function processTurns() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      
      // 시나리오 ID 추출 (세션에서 또는 기본값)
      const scenarioId = session.data?.scenario_id || 
                        (sessionId.startsWith('logh_') ? 'legend-of-galactic-heroes' : 'sangokushi');
      
      // 시나리오별 처리 간격 확인
      if (!shouldProcessSession(sessionId, scenarioId)) {
        continue; // 아직 처리 간격이 지나지 않음
      }
      
      try {
        // LOGH 세션인지 확인
        if (sessionId.startsWith('logh_')) {
          console.log(`[${new Date().toISOString()}] 🌌 Processing LOGH session: ${sessionId}`);

          // LOGH 세션도 세션 락을 사용하여 동시 실행 방지
          if (SessionStateService) {
            const locked = await SessionStateService.acquireSessionLock(sessionId, 60);
            if (!locked) {
              logger.warn('[LOGH] 턴 처리 건너뜀 - 세션 락 획득 실패', { sessionId });
              continue;
            }
          }

          try {
            await processLoghTurn(sessionId);
            sessionLastProcessedTime.set(sessionId, Date.now()); // 처리 시간 기록
          } finally {
            if (SessionStateService) {
              await SessionStateService.releaseSessionLock(sessionId);
            }
          }
        } else {
          // 일반 게임 세션 처리
          const result = await ExecuteEngineService.execute({ 
            session_id: sessionId,
            singleTurn: true  // 한 턴에 하나씩만 처리
          });
          
          if (result.updated) {
            sessionLastProcessedTime.set(sessionId, Date.now()); // 처리 시간 기록
            logger.debug(`Turn processed for session ${sessionId}`, {
              nextTurntime: result.turntime,
              scenarioId,
              intervalSeconds: getTurnIntervalSeconds(scenarioId)
            });
          } else if (result.locked) {
            // 다른 인스턴스가 잠금 - 무시
          } else {
            sessionLastProcessedTime.set(sessionId, Date.now()); // 체크 시간 기록
          }
        }
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] ❌ Turn processing error for ${sessionId}:`, error.message);
        logger.error(`Turn processing error for session ${sessionId}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error: any) {
    logger.error('Fatal error in turn processor', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * LOGH 턴 처리 함수
 * 
 * LOGH는 Realtime + Strategic 혼합 모드:
 * - Realtime: Fleet 이동, 전투는 실시간 처리 (GameLoop.service.ts)
 * - Strategic: 생산, 보급, 외교 등은 턴제 처리 (여기서)
 */
async function processLoghTurn(sessionId: string) {
  try {
    const { LoghCommander } = await import('./models/logh/Commander.model');
    const { Fleet } = await import('./models/logh/Fleet.model');
    const { Planet } = await import('./models/logh/Planet.model');
    
    // 1. 커맨드 포인트 회복 (턴마다)
    await LoghCommander.updateMany(
      { session_id: sessionId },
      {
        $set: {
          'commandPoints.personal': { $min: ['$commandPoints.personal', '$commandPoints.maxPersonal'] },
          'commandPoints.military': { $min: ['$commandPoints.military', '$commandPoints.maxMilitary'] },
          turnDone: false // 새 턴 시작
        }
      }
    );

    // 2. 행성 생산 처리 (턴마다)
    const planets = await Planet.find({ session_id: sessionId });
    for (const planet of planets) {
      if (planet.owner) {
        // 생산 처리 (간단한 예시)
        const production = Math.floor(planet.population / 100);
        planet.resources.minerals = (planet.resources.minerals || 0) + production;
        planet.resources.food = (planet.resources.food || 0) + production;
        await planet.save();
      }
    }

    // 3. 함대 보급 및 유지비 처리
    const fleets = await Fleet.find({ session_id: sessionId });
    for (const fleet of fleets) {
      // 보급 소모 처리
      if (fleet.supplies) {
        fleet.supplies.fuel = Math.max(0, (fleet.supplies.fuel || 0) - 1);
        fleet.supplies.ammunition = Math.max(0, (fleet.supplies.ammunition || 0) - 1);
        await fleet.save();
      }
    }

    // 4. 진행 중인 전략 커맨드 완료 처리
    const commanders = await LoghCommander.find({
      session_id: sessionId,
      'activeCommands.0': { $exists: true }
    });

    for (const commander of commanders) {
      const now = new Date();
      const completedCommands = commander.activeCommands.filter(
        (cmd: any) => cmd.completesAt <= now
      );

      for (const cmd of completedCommands) {
        // 커맨드 완료 처리
        const command = LoghCommandRegistry.getCommand(cmd.commandType);
        if (command) {
          try {
            const context = {
              commander: commander as any,
              session: await Session.findOne({ session_id: sessionId }),
              env: {}
            };
            await command.onTurnEnd(context);
            logger.info('[LOGH] 전략 커맨드 완료', {
              sessionId,
              commanderNo: commander.no,
              commandType: cmd.commandType
            });
          } catch (error: any) {
            logger.error('[LOGH] 전략 커맨드 완료 처리 실패', {
              sessionId,
              commanderNo: commander.no,
              commandType: cmd.commandType,
              error: error.message
            });
          }
        }
      }

      // 완료된 커맨드 제거
      commander.activeCommands = commander.activeCommands.filter(
        (cmd: any) => cmd.completesAt > now
      );
      await commander.save();
    }

    logger.info('[LOGH] 턴 처리 완료', {
      sessionId,
      commandersUpdated: commanders.length,
      planetsUpdated: planets.length,
      fleetsUpdated: fleets.length
    });

  } catch (error: any) {
    logger.error('[LOGH] 턴 처리 실패', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 경매 처리 함수 (크론)
 * closeDate가 지난 경매들을 자동으로 종료 처리
 */
async function processAuctions() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      
      try {
        await processAuction(sessionId);
      } catch (error: any) {
        logger.error(`Auction processing error for session ${sessionId}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error: any) {
    logger.error('Fatal error in auction processor', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 토너먼트 처리 함수 (크론)
 * 토너먼트 자동 진행 처리
 */
async function processTournaments() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      
      try {
        await processTournament(sessionId);
      } catch (error: any) {
        logger.error(`Tournament processing error for session ${sessionId}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error: any) {
    logger.error('Fatal error in tournament processor', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 세션의 NPC 처리 간격이 지났는지 확인
 */
function shouldProcessNPCForSession(sessionId: string, scenarioId: string): boolean {
  const now = Date.now();
  const lastProcessed = sessionLastNPCProcessedTime.get(sessionId) || 0;
  const intervalSeconds = getTurnIntervalSeconds(scenarioId);
  const intervalMs = intervalSeconds * 1000;
  
  return (now - lastProcessed) >= intervalMs;
}

/**
 * NPC 자동 명령 처리 함수 (15초마다 호출)
 * 시나리오별 처리 간격을 확인하여 NPC에게 명령 할당
 */
async function processNPCCommands() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });

    for (const session of sessions) {
      const sessionId = session.session_id;
      const gameEnv = session.data || {};
      
      // 시나리오 ID 추출
      const scenarioId = session.data?.scenario_id || 
                        (sessionId.startsWith('logh_') ? 'legend-of-galactic-heroes' : 'sangokushi');
      
      // 시나리오별 처리 간격 확인
      if (!shouldProcessNPCForSession(sessionId, scenarioId)) {
        continue;
      }

      try {
        const { NPCAutoCommandService } = await import('./services/ai/NPCAutoCommand.service');
        
        // 장수턴 자동 등록
        const result = await NPCAutoCommandService.assignCommandsToAllNPCs(sessionId, gameEnv);
        
        // 처리 시간 기록
        sessionLastNPCProcessedTime.set(sessionId, Date.now());

        if (result.count > 0) {
          logger.debug(`NPC commands assigned for session ${sessionId}`, {
            assigned: result.count,
            errors: result.errors
          });
        }
        
        // 국가턴 자동 등록 (NPC 군주)
        const nationResult = await NPCAutoCommandService.assignNationTurnsToAllNPCs(sessionId, gameEnv);
        
        if (nationResult.count > 0) {
          logger.debug(`NPC nation turns assigned for session ${sessionId}`, {
            assigned: nationResult.count,
            errors: nationResult.errors
          });
        }
      } catch (error: any) {
        logger.error(`NPC command processing error for session ${sessionId}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error: any) {
    logger.error('Fatal error in NPC command processor', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 전투 해결 처리 함수 (크론)
 * Planning 제한 시간이 지난 전투를 자동으로 Resolution 처리
 */
async function processBattleResolution() {
  try {
    const { Battle } = await import('./models/battle.model');
    const { ResolveTurnService } = await import('./services/battle/ResolveTurn.service');
    
    // Planning 단계이고 제한 시간이 지난 전투 찾기
    const now = new Date();
    const expiredBattles = await Battle.find({
      status: 'IN_PROGRESS',
      currentPhase: 'planning',
      $expr: {
        $lt: [
          { $add: ['$updatedAt', { $multiply: ['$planningTimeLimit', 1000] }] },
          now
        ]
      }
    });

    for (const battle of expiredBattles) {
      try {
        logger.info(`Auto-resolving battle ${battle.battleId} (planning timeout)`);
        await ResolveTurnService.execute(battle.battleId);
      } catch (error: any) {
        logger.error(`Battle resolution error for ${battle.battleId}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }

    if (expiredBattles.length > 0) {
      logger.debug(`Battle resolutions processed`, { count: expiredBattles.length });
    }
  } catch (error: any) {
    logger.error('Fatal error in battle resolution processor', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Mongoose 내부 필드 및 식별자 필드를 제거하는 헬퍼 함수
 */
function sanitizeForUpdate(obj: any, additionalFields: string[] = []): any {
  const sanitized = { ...obj };
  
  // Mongoose 내부 필드 제거
  delete sanitized.__v;
  delete sanitized._id;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  
  // 추가 필드 제거 (식별자 필드 등)
  additionalFields.forEach(field => {
    delete sanitized[field];
  });
  
  // 중첩된 객체에서도 __v와 _id 제거
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
      if (sanitized[key].__v !== undefined) {
        delete sanitized[key].__v;
      }
      if (sanitized[key]._id !== undefined) {
        delete sanitized[key]._id;
      }
    }
  });
  
  return sanitized;
}

/**
 * DB 동기화 처리 함수 (크론)
 *
 * sync-queue에 있는 변경된 엔티티들을 DB에 저장합니다.
 *
 * 동작 순서:
 * 1. sync-queue에서 모든 항목 스캔
 * 2. 엔티티 타입별로 DB에 저장
 * 3. 저장 완료 후 큐에서 제거
 */
async function syncToDB() {
  try {
    const { scanSyncQueue, getSyncQueueItem, removeFromSyncQueue } = await import('./common/cache/sync-queue.helper');
    const { General } = await import('./models/general.model');
    const { City } = await import('./models/city.model');
    const { Nation } = await import('./models/nation.model');
    const { Session } = await import('./models/session.model');

    // sync-queue에서 모든 항목 스캔
    const queueItems = await scanSyncQueue();

    if (queueItems.length === 0) {
      // 저장할 항목이 없으면 로그 생략
      return;
    }

    logger.debug(`DB 동기화 시작`, { count: queueItems.length });

    let successCount = 0;
    let errorCount = 0;

    for (const item of queueItems) {
      try {
        // 큐 아이템 조회
        const queueData = await getSyncQueueItem(item.key);
        if (!queueData || !queueData.data) {
          // TTL 만료 또는 다른 프로세스가 이미 처리 - 정상 상황
          // scanSyncQueue와 getSyncQueueItem 사이에 TTL 만료될 수 있음
          await removeFromSyncQueue(item.key);
          continue;
        }

        const { type, data } = queueData;

        // 엔티티 타입별로 DB 저장
        switch (type) {
          case 'session':
            // data 필드는 Mixed 타입이므로 개별 업데이트하여 충돌 방지
            // 주의: isunited(서버 상태)는 어드민/시나리오 리셋에서만 변경해야 하므로
            // sync-queue를 통해서는 절대 덮어쓰지 않도록 필터링한다.
            const { session_id: sSessionId, data: sData, ...restSessionFields } = data;

            // 상위 필드에서 isunited 제거
            const sessionUpdate: any = sanitizeForUpdate(restSessionFields, ['session_id', 'isunited']);
            
            // data 필드 내부의 각 속성을 개별적으로 설정
            if (sData) {
              const sanitizedData = sanitizeForUpdate(sData);

              // data.isunited 및 data.game_env.isunited는 sync-queue에서 무시
              if (sanitizedData.isunited !== undefined) {
                delete sanitizedData.isunited;
              }
              if (sanitizedData.game_env && sanitizedData.game_env.isunited !== undefined) {
                delete sanitizedData.game_env.isunited;
              }

              Object.keys(sanitizedData).forEach(key => {
                sessionUpdate[`data.${key}`] = sanitizedData[key];
              });
            }
            
            await Session.updateOne(
              { session_id: sSessionId },
              { $set: sessionUpdate },
              { strict: false }
            );
            break;

          case 'general':
            const generalFilter = data._id
              ? { _id: data._id }
              : { session_id: data.session_id, no: data.no };

            // data 필드는 Mixed 타입이므로 개별 업데이트하여 충돌 방지
            const { data: gData, ...restGeneralFields } = data;
            const generalUpdate: any = sanitizeForUpdate(restGeneralFields, ['session_id', 'no']);
            
            // data 필드 내부의 각 속성을 개별적으로 설정
            if (gData) {
              const sanitizedGData = sanitizeForUpdate(gData);
              Object.keys(sanitizedGData).forEach(key => {
                generalUpdate[`data.${key}`] = sanitizedGData[key];
              });
            }

            await General.updateOne(
              generalFilter,
              { $set: generalUpdate },
              { strict: false }
            );
            break;

          case 'city':
            // data 필드는 Mixed 타입이므로 개별 업데이트하여 충돌 방지
            const { session_id: cSessionId, city: cCity, data: cData, ...restCityFields } = data;
            const cityUpdate: any = sanitizeForUpdate(restCityFields, ['session_id', 'city']);
            
            // data 필드 내부의 각 속성을 개별적으로 설정
            if (cData) {
              const sanitizedCData = sanitizeForUpdate(cData);
              Object.keys(sanitizedCData).forEach(key => {
                cityUpdate[`data.${key}`] = sanitizedCData[key];
              });
            }
            
            await City.updateOne(
              { session_id: cSessionId, city: cCity },
              { $set: cityUpdate },
              { strict: false }
            );
            break;

          case 'nation':
            // data 필드는 Mixed 타입이므로 개별 업데이트하여 충돌 방지
            const { session_id: nSessionId, nation: nNation, data: nData, ...restNationFields } = data;
            const nationUpdate: any = sanitizeForUpdate(restNationFields, ['session_id', 'nation']);
            
            // data 필드 내부의 각 속성을 개별적으로 설정
            if (nData) {
              const sanitizedNData = sanitizeForUpdate(nData);
              Object.keys(sanitizedNData).forEach(key => {
                nationUpdate[`data.${key}`] = sanitizedNData[key];
              });
            }
            
            await Nation.updateOne(
              { session_id: nSessionId, nation: nNation },
              { $set: nationUpdate },
              { strict: false }
            );
            break;

          default:
            logger.warn('Unknown entity type in sync queue', { type, key: item.key });
        }

        // 저장 완료 후 큐에서 제거
        await removeFromSyncQueue(item.key);
        successCount++;

      } catch (error: any) {
        errorCount++;
        logger.error('DB 동기화 실패', {
          key: item.key,
          type: item.type,
          error: error.message,
          stack: error.stack
        });
        // 실패한 항목은 다음 크론에서 재시도되도록 큐에 남겨둠
      }
    }

    if (successCount > 0 || errorCount > 0) {
      logger.info('DB 동기화 완료', {
        total: queueItems.length,
        success: successCount,
        errors: errorCount
      });
    }

  } catch (error: any) {
    logger.error('DB 동기화 크론 실행 중 오류', {
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * 커맨드 소비 처리 함수 (크론)
 * Redis Streams에서 커맨드를 읽어 실행합니다.
 * 
 * 일반 커맨드와 LOGH 커맨드를 모두 처리합니다.
 */
async function consumeCommands(queue: any, groupName: string, consumerName: string) {
  try {
    // 비블로킹 방식으로 커맨드 소비 (한 번에 최대 10개)
    await queue.consume(groupName, consumerName, async (message: any) => {
      logger.debug('커맨드 수신', {
        commandId: message.commandId,
        category: message.category,
        type: message.type,
        gameMode: message.gameMode,
        generalId: message.generalId,
        commanderNo: message.commanderNo,
        sessionId: message.sessionId
      });

      let result: any;

      // LOGH 커맨드 vs 일반 커맨드 구분
      if (message.gameMode === 'logh' || message.commanderNo !== undefined) {
        // LOGH 커맨드 실행 - commanderNo는 숫자형으로 정규화
        const commanderNo = typeof message.commanderNo === 'string'
          ? parseInt(message.commanderNo, 10)
          : message.commanderNo;

        if (!Number.isFinite(commanderNo)) {
          logger.error('[LOGH] commanderNo 파싱 실패로 커맨드 건너뜀', {
            commandId: message.commandId,
            rawCommanderNo: message.commanderNo,
          });
          return;
        }

        result = await LoghCommandExecutor.execute({
          commandType: message.type,
          commanderNo,
          sessionId: message.sessionId,
          arg: message.arg
        });
      } else {
        // 일반 커맨드 실행
        result = await CommandExecutor.execute({
          category: message.category,
          type: message.type,
          generalId: message.generalId,
          sessionId: message.sessionId,
          arg: message.arg
        });
      }

      if (!result.success) {
        logger.error('커맨드 실행 실패', {
          commandId: message.commandId,
          error: result.error
        });
        throw new Error(result.error || 'Command execution failed');
      }

      logger.info('커맨드 실행 완료', {
        commandId: message.commandId,
        gameMode: message.gameMode,
        result: result.result
      });
    });
  } catch (error: any) {
    // Consumer Group이 없거나 메시지가 없는 경우는 정상
    if (!error.message?.includes('BUSYGROUP') && error.message) {
      logger.debug('커맨드 소비 중 오류 (정상일 수 있음)', {
        error: error.message
      });
    }
  }
}

/**
 * 메인 시작 함수
 * server.ts에서 import해서 사용 가능
 */
export async function startUnifiedDaemon() {
  return start();
}

async function start() {
  try {
    console.log('[DAEMON START] 🚀 통합 게임 데몬 시작 중...');
    
    // 동적 임포트로 모든 의존성 로드
    const loggerModule = await import('./common/logger');
    logger = loggerModule.logger;
    
    logger.info('🚀 통합 게임 데몬 시작 중...', {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      hostname: process.env.HOSTNAME || 'daemon-unified-1'
    });

    // MongoDB 연결
    console.log('[DAEMON START] MongoDB 연결 중...');
    const dbModule = await import('./db/connection');
    mongoConnection = dbModule.mongoConnection;
    await mongoConnection.connect(process.env.MONGODB_URI);
    console.log('[DAEMON START] ✅ MongoDB 연결 성공');
    logger.info('✅ MongoDB 연결 성공');

    // Redis 연결
    console.log('[DAEMON START] Redis 연결 중...');
    const { RedisService } = await import('./infrastructure/queue/redis.service');
    await RedisService.connect();
    console.log('[DAEMON START] ✅ Redis 연결 성공');
    logger.info('✅ Redis 연결 성공');

    // 모델 및 서비스 로드
    console.log('[DAEMON START] 모델 로딩 시작...');
    const sessionModule = await import('./models/session.model');
    Session = sessionModule.Session;
    console.log('[DAEMON START] Session 모델 로딩 완료');

    // 세션 상태 서비스 로드 (세션 락용)
    const sessionStateModule = await import('./services/sessionState.service');
    SessionStateService = sessionStateModule.SessionStateService;
    console.log('[DAEMON START] SessionStateService 로딩 완료');
    
    const commandModule = await import('./core/command');
    CommandRegistry = commandModule.CommandRegistry;
    console.log('[DAEMON START] CommandRegistry 로딩 완료');
    
    const executorModule = await import('./core/command/CommandExecutor');
    CommandExecutor = executorModule.CommandExecutor;
    console.log('[DAEMON START] CommandExecutor 로딩 완료');
    
    // LOGH CommandRegistry 및 Executor 로드
    const loghRegistryModule = await import('./commands/logh/CommandRegistry');
    LoghCommandRegistry = loghRegistryModule.commandRegistry;
    console.log('[DAEMON START] LOGH CommandRegistry 로딩 완료');
    
    const loghExecutorModule = await import('./commands/logh/LoghCommandExecutor');
    LoghCommandExecutor = loghExecutorModule.LoghCommandExecutor;
    console.log('[DAEMON START] LOGH CommandExecutor 로딩 완료');
    
    const engineModule = await import('./services/global/ExecuteEngine.service');
    ExecuteEngineService = engineModule.ExecuteEngineService;
    console.log('[DAEMON START] ExecuteEngineService 로딩 완료');
    
    const auctionModule = await import('./services/auction/AuctionEngine.service');
    processAuction = auctionModule.processAuction;
    console.log('[DAEMON START] AuctionEngine 로딩 완료');
    
    const tournamentModule = await import('./services/tournament/TournamentEngine.service');
    processTournament = tournamentModule.processTournament;
    console.log('[DAEMON START] TournamentEngine 로딩 완료');
    
    // 시나리오 설정 로더 (turnIntervalSeconds 등)
    const scenarioDataModule = await import('./utils/scenario-data');
    getScenarioConfig = scenarioDataModule.getScenarioConfig;
    console.log('[DAEMON START] ScenarioData 유틸리티 로딩 완료');

    // 커맨드 레지스트리 초기화
    console.log('[DAEMON START] 커맨드 레지스트리 초기화 중...');
    await CommandRegistry.loadAll();
    const commandStats = CommandRegistry.getStats();
    console.log('[DAEMON START] ✅ 커맨드 시스템 초기화 완료', commandStats);
    logger.info('✅ 커맨드 시스템 초기화 완료', commandStats);

    // 이벤트 핸들러 등록
    console.log('[DAEMON START] 이벤트 핸들러 등록 중...');
    const { registerAllEventHandlers } = await import('./events');
    registerAllEventHandlers();
    console.log('[DAEMON START] ✅ 이벤트 핸들러 등록 완료');
    logger.info('✅ 이벤트 핸들러 등록 완료');
    
    // LOGH 커맨드 레지스트리 상태 확인
    const loghStats = LoghCommandRegistry.getStats();
    console.log('[DAEMON START] ✅ LOGH 커맨드 시스템 초기화 완료', loghStats);
    logger.info('✅ LOGH 커맨드 시스템 초기화 완료', loghStats);

    // CommandQueue 초기화
    console.log('[DAEMON START] CommandQueue 초기화 중...');
    const { CommandQueue } = await import('./infrastructure/queue/command-queue');
    const queue = new CommandQueue('game:commands');
    await queue.init();
    console.log('[DAEMON START] ✅ CommandQueue 초기화 완료');
    logger.info('✅ CommandQueue 초기화 완료');

    // 1. 턴 처리 스케줄러 시작 (15초마다 - 실시간 시나리오 지원)
    // 시나리오별 처리 간격: sangokushi=60초, logh=15초 (scenario.json의 turnIntervalSeconds)
    console.log('[DAEMON START] 턴 처리 스케줄러 등록 중...');
    const TURN_INTERVAL_MS = 15 * 1000; // 15초 (가장 빠른 간격 기준)
    let isProcessingTurns = false; // 중복 실행 방지
    setInterval(() => {
      if (isProcessingTurns) {
        logger.debug('턴 처리가 이미 실행 중입니다. 스킵합니다.');
        return;
      }
      isProcessingTurns = true;
      processTurns()
        .catch(err => {
          logger.error('턴 처리 작업 실행 중 오류', {
            error: err.message,
            stack: err.stack
          });
        })
        .finally(() => {
          isProcessingTurns = false;
        });
    }, TURN_INTERVAL_MS);
    logger.info('✅ 턴 스케줄러 시작 (15초마다)', { intervalMs: TURN_INTERVAL_MS });

    // 2. 경매 스케줄러 시작 (경매 종료 처리)
    const AUCTION_CRON_EXPRESSION = '* * * * *'; // 매분
    cron.schedule(AUCTION_CRON_EXPRESSION, () => {
      processAuctions().catch(err => {
        logger.error('경매 처리 크론 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    });
    logger.info('✅ 경매 스케줄러 시작', { schedule: AUCTION_CRON_EXPRESSION });

    // 3. 토너먼트 스케줄러 시작 (토너먼트 자동 진행)
    const TOURNAMENT_CRON_EXPRESSION = '* * * * *'; // 매분
    cron.schedule(TOURNAMENT_CRON_EXPRESSION, () => {
      processTournaments().catch(err => {
        logger.error('토너먼트 처리 크론 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    });
    logger.info('✅ 토너먼트 스케줄러 시작', { schedule: TOURNAMENT_CRON_EXPRESSION });

    // 4. NPC 자동 명령 스케줄러 시작 (15초마다 - 시나리오별 간격 적용)
    const NPC_INTERVAL_MS = 15 * 1000; // 15초 (가장 빠른 간격 기준)
    setInterval(() => {
      processNPCCommands().catch(err => {
        logger.error('NPC 명령 처리 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    }, NPC_INTERVAL_MS);
    logger.info('✅ NPC 자동 명령 스케줄러 시작 (15초마다, 시나리오별 간격 적용)', { intervalMs: NPC_INTERVAL_MS });

    // 5. DB 동기화 스케줄러 시작 (5초마다)
    const SYNC_CRON_EXPRESSION = '*/5 * * * * *'; // 5초마다
    cron.schedule(SYNC_CRON_EXPRESSION, () => {
      syncToDB().catch(err => {
        logger.error('DB 동기화 크론 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    });
    logger.info('✅ DB 동기화 스케줄러 시작', { schedule: SYNC_CRON_EXPRESSION });

    // 5.5. 전투 해결 스케줄러 시작 (5초마다)
    const BATTLE_CRON_EXPRESSION = '*/5 * * * * *'; // 5초마다
    cron.schedule(BATTLE_CRON_EXPRESSION, () => {
      processBattleResolution().catch(err => {
        logger.error('전투 해결 크론 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    });
    logger.info('✅ 전투 해결 스케줄러 시작', { schedule: BATTLE_CRON_EXPRESSION });

    // 6. 커맨드 소비 스케줄러 시작 (매초마다)
    const COMMAND_CRON_EXPRESSION = '* * * * * *'; // 매초
    const consumerName = process.env.HOSTNAME || 'daemon-unified-1';
    const groupName = 'cmd-group';
    
    cron.schedule(COMMAND_CRON_EXPRESSION, () => {
      consumeCommands(queue, groupName, consumerName).catch(err => {
        logger.error('커맨드 소비 크론 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    });
    logger.info('✅ 커맨드 소비 스케줄러 시작', { schedule: COMMAND_CRON_EXPRESSION });
    
    console.log('\n========================================');
    console.log('🎮 통합 게임 데몬 시작 완료!');
    console.log('========================================');
    console.log(`🔧 일반 커맨드: ${commandStats.total}개 로드됨`);
    console.log(`   - General: ${commandStats.generalCount}개`);
    console.log(`   - Nation: ${commandStats.nationCount}개`);
    console.log(`   - LOGH: ${commandStats.loghCount}개`);
    console.log('');
    console.log(`🌌 LOGH 커맨드: ${loghStats.total}개 로드됨`);
    console.log(`   - Strategic: ${loghStats.strategic}개`);
    console.log(`   - Tactical: ${loghStats.tactical}개`);
    console.log(`   - Legacy: ${loghStats.legacy}개`);
    console.log('');
    console.log('📋 활성화된 스케줄러:');
    console.log(`   ✅ 턴 처리: 15초마다 (시나리오별 간격 적용)`);
    console.log(`   ✅ 커맨드 소비: ${COMMAND_CRON_EXPRESSION} (일반 + LOGH 혼합)`);
    console.log(`   ✅ 경매 처리: ${AUCTION_CRON_EXPRESSION} (매분)`);
    console.log(`   ✅ 토너먼트: ${TOURNAMENT_CRON_EXPRESSION} (매분)`);
    console.log(`   ✅ NPC 명령: 15초마다 (시나리오별 간격 적용)`);
    console.log(`   ✅ DB 동기화: ${SYNC_CRON_EXPRESSION} (5초마다)`);
    console.log(`   ✅ 전투 해결: ${BATTLE_CRON_EXPRESSION} (5초마다)`);
    console.log('');
    console.log('🔌 Queue 정보:');
    console.log(`   - Stream: game:commands`);
    console.log(`   - Group: ${groupName}`);
    console.log(`   - Consumer: ${consumerName}`);
    console.log('========================================\n');
    
    logger.info('🎮 통합 게임 데몬 시작 완료!', {
      features: {
        turnScheduler: true,
        auctionScheduler: true,
        tournamentScheduler: true,
        npcAutoCommand: true,
        dbSync: true,
        battleResolution: true,
        commandConsumer: true
      },
      totalCommands: commandStats.total,
      streamName: 'game:commands',
      consumerGroup: groupName,
      consumerName: consumerName,
      turnIntervalMs: TURN_INTERVAL_MS,
      npcIntervalMs: NPC_INTERVAL_MS,
      auctionCronSchedule: AUCTION_CRON_EXPRESSION,
      tournamentCronSchedule: TOURNAMENT_CRON_EXPRESSION,
      syncCronSchedule: SYNC_CRON_EXPRESSION,
      commandCronSchedule: COMMAND_CRON_EXPRESSION
    });
    
    // 메인 프로세스는 계속 실행 (크론 작업이 돌 수 있도록)
    // setInterval로 이벤트 루프 유지
    setInterval(() => {
      // 주기적으로 상태 확인 (매 5분)
      if (!isShuttingDown) {
        logger.debug('데몬 상태 확인 - 정상 실행 중');
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    logger.error('🔥 통합 게임 데몬 시작 실패', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal: string) {
  logger.info('🛑 Shutdown 신호 수신', { signal });
  isShuttingDown = true;

  try {
    // 모든 세션의 락 해제
    const { RedisService } = await import('./infrastructure/queue/redis.service');
    const redis = RedisService.getClient();
    
    // execute_engine_lock:* 패턴의 모든 락 키 찾기
    const lockKeys = await redis.keys('execute_engine_lock:*');
    if (lockKeys.length > 0) {
      await Promise.all(lockKeys.map(key => redis.del(key)));
      logger.info('🔓 모든 락 해제 완료', { count: lockKeys.length, keys: lockKeys });
    }

    // MongoDB 연결 종료
    await mongoConnection.disconnect();
    logger.info('MongoDB 연결 종료');

    // Redis 연결 종료
    await RedisService.disconnect();
    logger.info('Redis 연결 종료');

    logger.info('✅ 통합 게임 데몬 정상 종료');
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown 중 에러', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// 프로세스 에러 핸들링
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('처리되지 않은 Promise 거부', {
    reason: String(reason),
    promise: String(promise)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('처리되지 않은 예외', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// 이 파일이 직접 실행될 때만 start() 호출
// ts-node-dev에서도 작동하도록 개선
if (require.main === module || process.argv[1]?.includes('daemon-unified')) {
  start().catch(err => {
    console.error('❌ 데몬 시작 실패:', err);
    process.exit(1);
  });
}
