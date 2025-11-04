import { Session } from '../../models/session.model';
import { General } from '../../models/general.model';
import { GeneralTurn } from '../../models/general_turn.model';
import { NationTurn } from '../../models/nation_turn.model';
import { GeneralLog } from '../../models/general-log.model';
import { KVStorage } from '../../models/kv-storage.model';
import { getCommand, getNationCommand } from '../../commands';
import { City } from '../../models/city.model';
import { Nation } from '../../models/nation.model';
import Redis from 'ioredis';

const MAX_TURN = 30;
const MAX_CHIEF_TURN = 12;
const LOCK_KEY = 'execute_engine_lock';
const LOCK_TTL = 60;

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    });
  }
  return redisClient;
}

/**
 * 턴 실행 엔진
 * PHP TurnExecutionHelper::executeAllCommand 완전 구현
 */
export class ExecuteEngineService {
  /**
   * 메인 실행 함수
   */
  static async execute(data: any, _user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const redis = getRedisClient();
    const lockKey = `${LOCK_KEY}:${sessionId}`;
    
    let lockAcquired = false;
    try {
      // TTL이 0 이하인 락은 만료된 것으로 간주하고 강제 삭제
      const currentLock = await redis.get(lockKey);
      if (currentLock) {
        const ttl = await redis.ttl(lockKey);
        if (ttl <= 0) {
          // 만료된 락 강제 삭제
          console.log(`[${new Date().toISOString()}] Removing expired lock: ${lockKey}, TTL: ${ttl}s`);
          await redis.del(lockKey);
        }
      }
      
      const lock = await redis.set(lockKey, '1', 'EX', LOCK_TTL, 'NX');
      if (!lock) {
        const currentValue = await redis.get(lockKey);
        const ttl = await redis.ttl(lockKey);
        console.log(`[${new Date().toISOString()}] Lock already exists: ${lockKey}, value: ${currentValue}, TTL: ${ttl}s`);
        return {
          success: true,
          result: false,
          updated: false,
          locked: true,
          reason: 'Another instance is processing'
        };
      }
      lockAcquired = true;
      console.log(`[${new Date().toISOString()}] Lock acquired: ${lockKey}`);
      const session = await (Session as any).findOne({ session_id: sessionId });
      if (!session) {
        return {
          success: false,
          result: false,
          reason: 'Session not found',
          reqRefresh: true
        };
      }

      const sessionData = session.data as any || {};
      const now = new Date();
      
      // 턴 시각 이전이면 아무것도 하지 않음
      const turntime = new Date(sessionData.turntime || now);
      if (now < turntime) {
        return {
          success: true,
          result: false,
          updated: false,
          locked: false,
          turntime: turntime.toISOString()
        };
      }

      // 천통시에는 동결
      if (sessionData.isunited === 2 || sessionData.isunited === 3) {
        return {
          success: true,
          result: false,
          updated: false,
          locked: true,
          turntime: turntime.toISOString()
        };
      }

      let executed = false;
      const result = await this.executeAllCommands(sessionId, session, sessionData);
      
      return {
        success: true,
        result: result.executed,
        updated: result.executed,
        locked: false,
        turntime: result.turntime
      };
    } catch (error: any) {
      console.error('ExecuteEngine error:', error);
      return {
        success: false,
        result: false,
        reason: error.message
      };
    } finally {
      if (lockAcquired) {
        await redis.del(lockKey);
        console.log(`[${new Date().toISOString()}] Lock released: ${lockKey}`);
      }
    }
  }

  /**
   * 모든 커맨드 실행 (executeAllCommand)
   */
  private static async executeAllCommands(sessionId: string, session: any, sessionData: any) {
    const now = new Date();
    const turntermInMinutes = sessionData.turnterm || 60; // 분 단위
    const turnterm = turntermInMinutes * 60; // 초 단위로 변환
    
    let prevTurn = this.cutTurn(new Date(sessionData.turntime || now), turnterm);
    let nextTurn = this.addTurn(prevTurn, turnterm);
    
    const maxActionTime = 50; // 최대 실행 시간 (초)
    const limitActionTime = new Date(now.getTime() + maxActionTime * 1000);
    
    let executed = false;
    let currentTurn: string | null = null;

    // 현재 턴 이전 월턴까지 모두 처리
    while (nextTurn <= now) {
      const [executionOver, lastTurn] = await this.executeGeneralCommandUntil(
        sessionId,
        nextTurn,
        limitActionTime,
        sessionData.year || 180,
        sessionData.month || 1,
        turnterm,
        sessionData
      );

      if (executionOver) {
        if (lastTurn) {
          executed = true;
          currentTurn = lastTurn;
          sessionData.turntime = lastTurn;
          session.data = sessionData;
          await session.save();
        }
        return { executed, turntime: currentTurn || sessionData.turntime };
      }

      // 월 처리 이벤트
      await this.runEventHandler(sessionId, 'PRE_MONTH', sessionData);
      await this.preUpdateMonthly(sessionId, sessionData);
      this.turnDate(nextTurn, sessionData);
      
      // 분기 통계 (1월)
      if (sessionData.month === 1) {
        await this.checkStatistic(sessionId, sessionData);
      }
      
      await this.runEventHandler(sessionId, 'MONTH', sessionData);
      await this.postUpdateMonthly(sessionId, sessionData);
      
      // 다음 달로
      prevTurn = nextTurn;
      nextTurn = this.addTurn(prevTurn, turnterm);
      sessionData.turntime = prevTurn.toISOString();
    }

    // 현재 시간의 월턴 이후 분 단위 장수 처리
    this.turnDate(prevTurn, sessionData);
    
    const [executionOver, lastTurn] = await this.executeGeneralCommandUntil(
      sessionId,
      now,
      limitActionTime,
      sessionData.year,
      sessionData.month,
      turnterm,
      sessionData
    );

    if (lastTurn) {
      executed = true;
      currentTurn = lastTurn;
      sessionData.turntime = lastTurn;
    }

    session.data = sessionData;
    await session.save();

    return { executed, turntime: currentTurn || sessionData.turntime };
  }

  /**
   * 특정 시각까지 장수 커맨드 실행
   */
  private static async executeGeneralCommandUntil(
    sessionId: string,
    date: Date,
    limitActionTime: Date,
    year: number,
    month: number,
    turnterm: number,
    gameEnv: any
  ): Promise<[boolean, string | null]> {
    
    // turntime이 date보다 이전인 장수들을 조회
    // turntime은 data.turntime 또는 top-level turntime일 수 있음
    const generals = await (General as any).find({
      session_id: sessionId,
      $or: [
        { 'data.turntime': { $lt: date } },
        { turntime: { $lt: date } }
      ]
    }).sort({ 'data.turntime': 1, no: 1 });

    let currentTurn: string | null = null;

    for (const general of generals) {
      const currActionTime = new Date();
      if (currActionTime > limitActionTime) {
        return [true, currentTurn];
      }

      // 장수 턴 실행
      await this.executeGeneralTurn(sessionId, general, year, month, turnterm, gameEnv);
      
      currentTurn = general.data?.turntime || general.turntime || new Date().toISOString();
      
      // 턴 당기기 (0번 턴 삭제, 1->0, 2->1, ...)
      await this.pullGeneralCommand(sessionId, general.no, 1);
      const nationId = general.nation || general.data?.nation || 0;
      const officerLevel = general.data?.officer_level || 0;
      await this.pullNationCommand(sessionId, nationId, officerLevel, 1);
      
      // 턴 시간 업데이트
      await this.updateTurnTime(sessionId, general, turnterm, gameEnv);
      
      await general.save();
    }

    return [false, currentTurn];
  }

  /**
   * 개별 장수 턴 실행
   */
  private static async executeGeneralTurn(
    sessionId: string,
    general: any,
    year: number,
    month: number,
    turnterm: number,
    gameEnv: any
  ) {
    const generalId = general.no;
    
    // 전처리 (부상 경감, 병력/군량 소모 등)
    await this.preprocessCommand(sessionId, general, year, month);
    
    // 블럭 처리
    if (await this.processBlocked(sessionId, general, year, month)) {
      return;
    }

    // 국가 커맨드 실행 (수뇌부만)
    const nationId = general.nation || general.data?.nation || 0;
    const officerLevel = general.data?.officer_level || 0;
    const hasNationTurn = nationId && officerLevel >= 5;
    if (hasNationTurn) {
      await this.processNationCommand(sessionId, general, year, month);
    }

    // 장수 커맨드 실행 (0번 턴)
    await this.processGeneralCommand(sessionId, general, year, month, gameEnv);
    
    // 계승 포인트 증가
    if (!general.data.inheritance) general.data.inheritance = {};
    if (!general.data.inheritance.lived_month) general.data.inheritance.lived_month = 0;
    general.data.inheritance.lived_month += 1;
    general.markModified('data');
  }

  /**
   * 도시와 국가 정보 로드
   */
  private static async loadCityAndNation(general: any, sessionId: string) {
    if (general.data._cached_city && general.data._cached_nation) {
      return;
    }

    const cityId = general.data.city || 0;
    const nationId = general.nation || 0;

    if (cityId) {
      const city = await (City as any).findOne({ session_id: sessionId, city: cityId });
      if (city) {
        general.setRawCity(city);
      }
    }

    if (nationId) {
      const nation = await (Nation as any).findOne({ session_id: sessionId, nation: nationId });
      if (nation) {
        general.data._cached_nation = nation;
        general.markModified('data');
      }
    }
  }

  /**
   * 전처리 (부상 경감, 병력 군량 소모)
   */
  private static async preprocessCommand(sessionId: string, general: any, year: number, month: number) {
    // 부상 경감
    if (general.data.injury > 0) {
      const reduction = Math.min(3, general.data.injury);
      general.data.injury = Math.max(0, general.data.injury - reduction);
      general.markModified('data');
    }

    // 병력 군량 소모
    const crew = general.data.crew || 0;
    if (crew > 0) {
      const consumption = Math.ceil(crew / 500); // 500명당 군량 1
      general.data.rice = Math.max(0, (general.data.rice || 0) - consumption);
      general.markModified('data');
      
      // 군량 부족시 병력 감소
      if (general.data.rice <= 0) {
        const crewLoss = Math.ceil(crew * 0.05); // 5% 손실
        general.data.crew = Math.max(0, crew - crewLoss);
        general.markModified('data');
        
        await this.pushGeneralActionLog(
          sessionId,
          general.no,
          `<R>군량 부족</>으로 병력 ${crewLoss}명이 이탈했습니다.`,
          year,
          month
        );
      }
    }
  }

  /**
   * 블럭 처리
   */
  private static async processBlocked(sessionId: string, general: any, year: number, month: number): Promise<boolean> {
    const blocked = general.data.block || 0;
    if (blocked < 2) {
      return false;
    }

    const killturn = general.data.killturn || 0;
    general.data.killturn = Math.max(0, killturn - 1);
    general.markModified('data');

    let message = '';
    if (blocked === 2) {
      message = '현재 멀티, 또는 비매너로 인한 <R>블럭</> 대상자입니다.';
    } else if (blocked === 3) {
      message = '현재 악성유저로 분류되어 <R>블럭</> 대상자입니다.';
    } else {
      return false;
    }

    await this.pushGeneralActionLog(sessionId, general.no, message, year, month);
    return true;
  }

  /**
   * 국가 커맨드 실행
   */
  private static async processNationCommand(sessionId: string, general: any, year: number, month: number) {
    const nationId = general.nation;
    const officerLevel = general.data.officer_level;

    // 0번 턴 조회
    const nationTurn = await (NationTurn as any).findOne({
      session_id: sessionId,
      'data.nation_id': nationId,
      'data.officer_level': officerLevel,
      'data.turn_idx': 0
    });

    if (!nationTurn) {
      return;
    }

    const action = nationTurn.data.action || '휴식';
    const arg = nationTurn.data.arg || {};

    if (action === '휴식') {
      return;
    }

    const CommandClass = getNationCommand(action);
    if (!CommandClass) {
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>알 수 없는 국가 커맨드:</> ${action}`,
        year,
        month
      );
      return;
    }

    try {
      await this.loadCityAndNation(general, sessionId);
      const env = { year, month, session_id: sessionId };
      const command = new CommandClass(general, env, arg);
      
      if (!command.hasFullConditionMet()) {
        await this.pushGeneralActionLog(
          sessionId,
          general.no,
          command.getFailString(),
          year,
          month
        );
        return;
      }

      const rng = { choiceUsingWeightPair: (pairs: any[]) => pairs[0][0], choiceUsingWeight: (obj: any) => Object.keys(obj)[0] };
      await command.run(rng);
    } catch (error: any) {
      console.error(`Nation command ${action} failed:`, error);
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>국가 커맨드 실행 실패:</> ${action} (${error.message})`,
        year,
        month
      );
    }
  }

  /**
   * 장수 커맨드 실행
   */
  private static async processGeneralCommand(
    sessionId: string,
    general: any,
    year: number,
    month: number,
    gameEnv: any
  ) {
    // generalId는 top-level no 또는 data.no일 수 있음
    const generalId = general.no || general.data?.no;
    
    if (!generalId) {
      console.error('processGeneralCommand: generalId not found', { general: general._id });
      return;
    }
    
    // 0번 턴 조회
    let generalTurn = await (GeneralTurn as any).findOne({
      session_id: sessionId,
      'data.general_id': generalId,
      'data.turn_idx': 0
    });

    // 명령이 없으면 휴식으로 자동 생성
    if (!generalTurn) {
      generalTurn = await (GeneralTurn as any).create({
        session_id: sessionId,
        data: {
          general_id: generalId,
          turn_idx: 0,
          action: '휴식',
          brief: '휴식',
          arg: {}
        }
      });
    }

    const action = generalTurn.data.action || '휴식';
    const arg = generalTurn.data.arg || {};

    // killturn 처리
    const killturn = gameEnv.killturn || 30;
    const npcType = general.npc || 0;
    const currentKillturn = general.data.killturn || killturn;

    if (npcType >= 2) {
      general.data.killturn = Math.max(0, currentKillturn - 1);
    } else if (currentKillturn > killturn) {
      general.data.killturn = Math.max(0, currentKillturn - 1);
    } else if (action === '휴식') {
      general.data.killturn = Math.max(0, currentKillturn - 1);
    } else {
      general.data.killturn = killturn;
    }
    general.markModified('data');

    if (action === '휴식') {
      return;
    }

    const CommandClass = getCommand(action);
    if (!CommandClass) {
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>알 수 없는 커맨드:</> ${action}`,
        year,
        month
      );
      return;
    }

    try {
      await this.loadCityAndNation(general, sessionId);
      const env = { year, month, session_id: sessionId, ...gameEnv };
      const command = new CommandClass(general, env, arg);
      
      if (!command.hasFullConditionMet()) {
        await this.pushGeneralActionLog(
          sessionId,
          general.no,
          command.getFailString(),
          year,
          month
        );
        return;
      }

      const rng = { choiceUsingWeightPair: (pairs: any[]) => pairs[0][0], choiceUsingWeight: (obj: any) => Object.keys(obj)[0] };
      await command.run(rng);
    } catch (error: any) {
      console.error(`Command ${action} failed:`, error);
      await this.pushGeneralActionLog(
        sessionId,
        general.no,
        `<R>커맨드 실행 실패:</> ${action} (${error.message})`,
        year,
        month
      );
    }
  }

  /**
   * 턴 시간 업데이트
   */
  private static async updateTurnTime(sessionId: string, general: any, turnterm: number, gameEnv: any) {
    const year = gameEnv.year || 180;
    const killturn = general.data.killturn || 0;

    // 삭턴 장수 처리
    if (killturn <= 0) {
      // NPC 유저 삭턴시 NPC로 전환
      if (general.npc === 1 && general.data.deadyear > year) {
        await this.pushGeneralActionLog(
          sessionId,
          general.no,
          `${general.data.owner_name}이 ${general.name}의 육체에서 <S>유체이탈</>합니다!`,
          year,
          gameEnv.month
        );

        general.data.killturn = (general.data.deadyear - year) * 12;
        general.npc = general.data.npc_org || 2;
        general.owner = '0';
        general.data.owner_name = null;
        general.markModified('data');
      } else {
        // 장수 삭제
        await general.deleteOne();
        return;
      }
    }

    // 은퇴 처리 (나이 제한)
    const retirementYear = 70;
    if ((general.data.age || 20) >= retirementYear && general.npc === 0) {
      // TODO: 환생 처리
      general.data.age = 15;
      general.data.killturn = 120;
      general.markModified('data');
    }

    // 턴 시간 증가
    const currentTurntime = new Date(general.data?.turntime || general.turntime || new Date());
    const newTurntime = this.addTurn(currentTurntime, turnterm);
    
    if (general.data) {
      general.data.turntime = newTurntime.toISOString();
      general.markModified('data');
    } else {
      general.turntime = newTurntime;
    }
  }

  /**
   * 턴 당기기 (장수)
   */
  private static async pullGeneralCommand(sessionId: string, generalId: number, turnCnt: number) {
    if (turnCnt === 0 || turnCnt >= MAX_TURN) {
      return;
    }

    // turnCnt보다 작은 턴들을 MAX_TURN으로 밀고 휴식으로 변경
    await (GeneralTurn as any).updateMany(
      {
        session_id: sessionId,
        'data.general_id': generalId,
        'data.turn_idx': { $lt: turnCnt }
      },
      {
        $inc: { 'data.turn_idx': MAX_TURN },
        $set: {
          'data.action': '휴식',
          'data.arg': {},
          'data.brief': '휴식'
        }
      }
    );

    // 모든 턴을 turnCnt만큼 당김
    await (GeneralTurn as any).updateMany(
      {
        session_id: sessionId,
        'data.general_id': generalId
      },
      {
        $inc: { 'data.turn_idx': -turnCnt }
      }
    );
  }

  /**
   * 턴 당기기 (국가)
   */
  private static async pullNationCommand(sessionId: string, nationId: number, officerLevel: number, turnCnt: number) {
    if (!nationId || officerLevel < 5 || turnCnt === 0 || turnCnt >= MAX_CHIEF_TURN) {
      return;
    }

    await (NationTurn as any).updateMany(
      {
        session_id: sessionId,
        'data.nation_id': nationId,
        'data.officer_level': officerLevel,
        'data.turn_idx': { $lt: turnCnt }
      },
      {
        $inc: { 'data.turn_idx': MAX_CHIEF_TURN },
        $set: {
          'data.action': '휴식',
          'data.arg': {},
          'data.brief': '휴식'
        }
      }
    );

    await (NationTurn as any).updateMany(
      {
        session_id: sessionId,
        'data.nation_id': nationId,
        'data.officer_level': officerLevel
      },
      {
        $inc: { 'data.turn_idx': -turnCnt }
      }
    );
  }

  /**
   * 이벤트 핸들러 실행
   * PHP TurnExecutionHelper::runEventHandler와 동일
   */
  private static async runEventHandler(sessionId: string, target: string, gameEnv: any) {
    const { Event } = await import('../../models/event.model');
    const { EventHandler } = await import('../../core/event/EventHandler');
    
    // target을 PHP의 EventTarget 형식으로 변환
    const targetMap: Record<string, string> = {
      'PRE_MONTH': 'PRE_MONTH',
      'MONTH': 'MONTH',
      'OCCUPY_CITY': 'OCCUPY_CITY',
      'DESTROY_NATION': 'DESTROY_NATION',
      'UNITED': 'UNITED'
    };
    
    const dbTarget = targetMap[target] || target;
    
    // 이벤트 조회
    const events = await (Event as any).find({
      session_id: sessionId,
      target: dbTarget
    }).sort({ priority: -1, _id: 1 });
    
    if (events.length === 0) {
      return false;
    }
    
    // 환경 변수 준비
    const e_env = { ...gameEnv };
    
    // 각 이벤트 실행
    for (const rawEvent of events) {
      const eventID = rawEvent._id.toString();
      const cond = rawEvent.condition;
      const action = rawEvent.action;
      
      const event = new EventHandler(cond, Array.isArray(action) ? action : [action]);
      e_env.currentEventID = eventID;
      
      try {
        await event.tryRunEvent(e_env);
      } catch (error: any) {
        console.error(`Event ${eventID} failed:`, error);
      }
    }
    
    return true;
  }

  /**
   * 월 전처리
   */
  private static async preUpdateMonthly(sessionId: string, gameEnv: any) {
    await (General as any).updateMany(
      { session_id: sessionId },
      {
        $inc: {
          'data.penalty': -1,
          'data.age_month': 1
        }
      }
    );

    await (General as any).updateMany(
      { session_id: sessionId, 'data.penalty': { $lt: 0 } },
      { $set: { 'data.penalty': 0 } }
    );

    if (gameEnv.month === 1) {
      await (General as any).updateMany(
        { session_id: sessionId },
        { $inc: { 'data.age': 1 }, $set: { 'data.age_month': 0 } }
      );
    }

    await (Nation as any).updateMany(
      { session_id: sessionId },
      {
        $inc: {
          'data.consecu_turn_count': -1,
          'data.last_war_month': -1
        }
      }
    );

    await (Nation as any).updateMany(
      { session_id: sessionId, 'data.consecu_turn_count': { $lt: 0 } },
      { $set: { 'data.consecu_turn_count': 0 } }
    );
  }

  /**
   * 월 후처리
   */
  private static async postUpdateMonthly(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const month = gameEnv.month;
    
    const cities = await (City as any).find({ session_id: sessionId });
    
    for (const city of cities) {
      city.pop = Math.min(city.pop + Math.floor(city.agri / 10), city.pop_max);
      city.agri = Math.min(city.agri + Math.floor(city.agri / 100), city.agri_max);
      city.comm = Math.min(city.comm + Math.floor(city.comm / 100), city.comm_max);
      city.secu = Math.max(city.secu - 5, 0);
      city.def = Math.max(city.def - 3, 0);
      
      await city.save();
    }

    const nations = await (Nation as any).find({ session_id: sessionId });
    for (const nation of nations) {
      if (nation.data.rice) {
        nation.data.rice = Math.max((nation.data.rice || 0) - Math.floor((nation.data.gennum || 0) * 10), 0);
        nation.markModified('data');
        await nation.save();
      }
    }
  }

  /**
   * 분기 통계
   * TODO: 실제 통계 생성 로직 구현 필요
   */
  private static async checkStatistic(sessionId: string, gameEnv: any) {
    const year = gameEnv.year;
    const quarter = Math.floor((gameEnv.month - 1) / 3) + 1;
    
    // 실제 통계 생성 로직은 아직 구현되지 않았으므로 로그만 출력 (필요시 제거 가능)
    // console.log(`Generating statistics for ${year}Q${quarter}`);
  }

  /**
   * 턴 날짜 계산 (년/월 증가)
   */
  private static turnDate(turntime: Date, gameEnv: any) {
    gameEnv.month = (gameEnv.month || 1) + 1;
    if (gameEnv.month > 12) {
      gameEnv.month = 1;
      gameEnv.year = (gameEnv.year || 180) + 1;
    }
  }

  /**
   * 턴 시간 자르기 (turnterm 간격으로 정렬)
   */
  private static cutTurn(time: Date, turnterm: number): Date {
    const timestamp = Math.floor(time.getTime() / 1000);
    const cutTimestamp = Math.floor(timestamp / turnterm) * turnterm;
    return new Date(cutTimestamp * 1000);
  }

  /**
   * 턴 시간 더하기
   */
  private static addTurn(time: Date, turnterm: number): Date {
    return new Date(time.getTime() + turnterm * 1000);
  }

  /**
   * 장수 액션 로그 추가
   */
  private static async pushGeneralActionLog(
    sessionId: string,
    generalId: number,
    message: string,
    year: number,
    month: number
  ) {
    const date = `${year}년 ${month}월`;
    const fullMessage = `${message} <1>${date}</>`;
    
    try {
      const maxId = await (GeneralLog as any).findOne({ session_id: sessionId })
        .sort({ id: -1 })
        .limit(1);
      
      const newId = (maxId?.id || 0) + 1;

      await (GeneralLog as any).create({
        id: newId,
        session_id: sessionId,
        general_id: generalId,
        log_type: 'action',
        message: fullMessage,
        data: { year, month },
        created_at: new Date()
      });
    } catch (error) {
      console.error('pushGeneralActionLog error:', error);
    }
  }
}
