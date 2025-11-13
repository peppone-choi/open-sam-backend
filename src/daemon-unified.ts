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

// 동적 임포트를 위한 전역 변수
let mongoConnection: any;
let logger: any;
let CommandRegistry: any;
let CommandExecutor: any;
let Session: any;
let ExecuteEngineService: any;
let processAuction: any;
let processTournament: any;

/**
 * 턴 처리 함수 (크론)
 */
async function processTurns() {
  try {
    console.log(`[${new Date().toISOString()}] 🔄 processTurns() called`);
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });
    console.log(`[${new Date().toISOString()}] 📋 Found ${sessions.length} active sessions`);
    
    for (const session of sessions) {
      const sessionId = session.session_id;
      
      try {
        console.log(`[${new Date().toISOString()}] ⚙️ Processing session: ${sessionId}`);
        const result = await ExecuteEngineService.execute({ session_id: sessionId });
        
        if (result.updated) {
          console.log(`[${new Date().toISOString()}] ✅ Turn processed for ${sessionId}`, {
            nextTurntime: result.turntime
          });
          logger.info(`Turn processed for session ${sessionId}`, {
            nextTurntime: result.turntime
          });
        } else if (result.locked) {
          console.log(`[${new Date().toISOString()}] 🔒 Session ${sessionId} is locked by another instance`);
          // 다른 인스턴스가 잠금 - 무시
        } else {
          console.log(`[${new Date().toISOString()}] ⏭️ Session ${sessionId} - no turn update needed`);
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
 * NPC 자동 명령 처리 함수 (크론)
 * NPC들에게 자동으로 명령 할당
 */
async function processNPCCommands() {
  try {
    const sessions = await Session.find({ 'data.isunited': { $nin: [2, 3] } });

    for (const session of sessions) {
      const sessionId = session.session_id;
      const gameEnv = session.data || {};

      try {
        const { NPCAutoCommandService } = await import('./services/ai/NPCAutoCommand.service');
        const result = await NPCAutoCommandService.assignCommandsToAllNPCs(sessionId, gameEnv);

        if (result.count > 0) {
          logger.debug(`NPC commands assigned for session ${sessionId}`, {
            assigned: result.count,
            errors: result.errors
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
          // Invalid sync queue item - 삭제
          await removeFromSyncQueue(item.key);
          continue;
        }

        const { type, data } = queueData;

        // 엔티티 타입별로 DB 저장
        switch (type) {
          case 'session':
            // data 필드는 Mixed 타입이므로 개별 업데이트하여 충돌 방지
            const { session_id: sSessionId, data: sData, ...restSessionFields } = data;
            const sessionUpdate: any = sanitizeForUpdate(restSessionFields, ['session_id']);
            
            // data 필드 내부의 각 속성을 개별적으로 설정
            if (sData) {
              const sanitizedData = sanitizeForUpdate(sData);
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
 */
async function consumeCommands(queue: any, groupName: string, consumerName: string) {
  try {
    // 비블로킹 방식으로 커맨드 소비 (한 번에 최대 10개)
    await queue.consume(groupName, consumerName, async (message: any) => {
      logger.debug('커맨드 수신', {
        commandId: message.commandId,
        category: message.category,
        type: message.type,
        generalId: message.generalId,
        sessionId: message.sessionId
      });

      // CommandExecutor를 통해 커맨드 실행
      const result = await CommandExecutor.execute({
        category: message.category,
        type: message.type,
        generalId: message.generalId,
        sessionId: message.sessionId,
        arg: message.arg
      });

      if (!result.success) {
        logger.error('커맨드 실행 실패', {
          commandId: message.commandId,
          error: result.error
        });
        throw new Error(result.error || 'Command execution failed');
      }

      logger.info('커맨드 실행 완료', {
        commandId: message.commandId,
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
    
    const commandModule = await import('./core/command');
    CommandRegistry = commandModule.CommandRegistry;
    console.log('[DAEMON START] CommandRegistry 로딩 완료');
    
    const executorModule = await import('./core/command/CommandExecutor');
    CommandExecutor = executorModule.CommandExecutor;
    console.log('[DAEMON START] CommandExecutor 로딩 완료');
    
    const engineModule = await import('./services/global/ExecuteEngine.service');
    ExecuteEngineService = engineModule.ExecuteEngineService;
    console.log('[DAEMON START] ExecuteEngineService 로딩 완료');
    
    const auctionModule = await import('./services/auction/AuctionEngine.service');
    processAuction = auctionModule.processAuction;
    console.log('[DAEMON START] AuctionEngine 로딩 완료');
    
    const tournamentModule = await import('./services/tournament/TournamentEngine.service');
    processTournament = tournamentModule.processTournament;
    console.log('[DAEMON START] TournamentEngine 로딩 완료');

    // 커맨드 레지스트리 초기화
    console.log('[DAEMON START] 커맨드 레지스트리 초기화 중...');
    await CommandRegistry.loadAll();
    const commandStats = CommandRegistry.getStats();
    console.log('[DAEMON START] ✅ 커맨드 시스템 초기화 완료', commandStats);
    logger.info('✅ 커맨드 시스템 초기화 완료', commandStats);

    // CommandQueue 초기화
    console.log('[DAEMON START] CommandQueue 초기화 중...');
    const { CommandQueue } = await import('./infrastructure/queue/command-queue');
    const queue = new CommandQueue('game:commands');
    await queue.init();
    console.log('[DAEMON START] ✅ CommandQueue 초기화 완료');
    logger.info('✅ CommandQueue 초기화 완료');

    // 1. 턴 처리 스케줄러 시작 (매분마다 - PHP 삼국지와 동일)
    // node-cron 형식: 초(옵션) 분 시 일 월 요일
    // 5개 필드: 분 시 일 월 요일 (표준)
    console.log('[DAEMON START] 턴 처리 스케줄러 등록 중...');
    const TURN_CRON_EXPRESSION = '* * * * *'; // 매분마다
    let isProcessingTurns = false; // 중복 실행 방지
    cron.schedule(TURN_CRON_EXPRESSION, () => {
      if (isProcessingTurns) {
        logger.debug('턴 처리가 이미 실행 중입니다. 스킵합니다.');
        return;
      }
      isProcessingTurns = true;
      processTurns()
        .catch(err => {
          logger.error('턴 처리 크론 작업 실행 중 오류', {
            error: err.message,
            stack: err.stack
          });
        })
        .finally(() => {
          isProcessingTurns = false;
        });
    });
    logger.info('✅ 턴 스케줄러 시작 (매분마다)', { schedule: TURN_CRON_EXPRESSION });

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

    // 4. NPC 자동 명령 스케줄러 시작
    const NPC_CRON_EXPRESSION = '*/5 * * * *'; // 5분마다
    cron.schedule(NPC_CRON_EXPRESSION, () => {
      processNPCCommands().catch(err => {
        logger.error('NPC 명령 처리 크론 작업 실행 중 오류', {
          error: err.message,
          stack: err.stack
        });
      });
    });
    logger.info('✅ NPC 자동 명령 스케줄러 시작', { schedule: NPC_CRON_EXPRESSION });

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
    console.log(`🔧 커맨드: ${commandStats.total}개 로드됨`);
    console.log(`   - General: ${commandStats.generalCount}개`);
    console.log(`   - Nation: ${commandStats.nationCount}개`);
    console.log(`   - LOGH: ${commandStats.loghCount}개`);
    console.log('');
    console.log('📋 활성화된 스케줄러:');
    console.log(`   ✅ 턴 처리: ${TURN_CRON_EXPRESSION} (10초마다)`);
    console.log(`   ✅ 커맨드 소비: ${COMMAND_CRON_EXPRESSION} (매초)`);
    console.log(`   ✅ 경매 처리: ${AUCTION_CRON_EXPRESSION} (매분)`);
    console.log(`   ✅ 토너먼트: ${TOURNAMENT_CRON_EXPRESSION} (매분)`);
    console.log(`   ✅ NPC 명령: ${NPC_CRON_EXPRESSION} (5분마다)`);
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
      turnCronSchedule: TURN_CRON_EXPRESSION,
      auctionCronSchedule: AUCTION_CRON_EXPRESSION,
      tournamentCronSchedule: TOURNAMENT_CRON_EXPRESSION,
      npcCronSchedule: NPC_CRON_EXPRESSION,
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
