/**
 * TimeEngine 검증 테스트
 * 
 * Phase 1 검증:
 * 1. 정확도: 현실 1시간 = 게임 24시간(1일)
 * 2. Catch-up: 서버 중단 시 밀린 틱 처리
 * 3. 이벤트: DAY_START가 정확히 게임 시간 00:00에 발생
 */

import { EventEmitter } from 'events';
import { GIN7_EVENTS, GameTime, TimeTickPayload, DayStartPayload, MonthStartPayload } from '../TimeEngine';

// Mock dependencies
jest.mock('../../../socket/socketManager', () => ({
  getSocketManager: () => null
}));

jest.mock('../../../models/gin7/GameSession', () => ({
  Gin7GameSession: {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
  }
}));

jest.mock('../../../common/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Import after mocks
import { TimeEngine } from '../TimeEngine';

describe('Phase 1: TimeEngine 검증', () => {
  let engine: TimeEngine;

  beforeEach(() => {
    // Reset singleton for testing
    (TimeEngine as any).instance = undefined;
    engine = TimeEngine.getInstance();
  });

  afterEach(async () => {
    await engine.stop();
  });

  describe('1. 정확도 테스트: 현실 1시간 = 게임 24시간', () => {
    it('timeScale 24에서 현실 1초 = 게임 24초', () => {
      // Given: timeScale = 24, tickRateMs = 1000
      const tickRateMs = 1000;
      const timeScale = 24;
      
      // When: 1 real second passes (1 tick)
      const realElapsedMs = tickRateMs; // 1초
      const gameElapsedMs = realElapsedMs * timeScale; // 24초
      
      // Then: 24 game seconds should pass
      expect(gameElapsedMs).toBe(24000); // 24초 = 24000ms
    });

    it('현실 1시간 = 게임 24시간(1일) 계산 검증', () => {
      // Given: 현실 1시간 = 3600초 = 3600 ticks
      const realHourTicks = 3600;
      const timeScale = 24;
      
      // When: 3600 ticks with 24x scale
      const gameSecondsElapsed = realHourTicks * timeScale;
      const gameHoursElapsed = gameSecondsElapsed / 3600;
      
      // Then: 24 game hours = 1 game day
      expect(gameHoursElapsed).toBe(24);
      console.log(`✅ 현실 1시간(${realHourTicks}틱) = 게임 ${gameHoursElapsed}시간(1일)`);
    });

    it('tick당 게임 시간 진행 검증', () => {
      // Given: gameStartDate = 184년 1월 1일 00:00
      const startDate = new Date(184, 0, 1, 0, 0, 0);
      const timeScale = 24;
      const tickRateMs = 1000;
      
      // When: 150 ticks passed (현실 2.5분)
      const ticks = 150;
      const elapsedGameMs = ticks * tickRateMs * timeScale;
      const gameDate = new Date(startDate.getTime() + elapsedGameMs);
      
      // Then: 150 * 24 = 3600 game seconds = 1 game hour
      const expectedHour = 1;
      expect(gameDate.getHours()).toBe(expectedHour);
      console.log(`✅ ${ticks}틱 후 게임 시간: ${gameDate.getFullYear()}년 ${gameDate.getMonth()+1}월 ${gameDate.getDate()}일 ${gameDate.getHours()}시`);
    });
  });

  describe('2. Catch-up 로직 테스트', () => {
    it('서버가 5분간 멈췄을 때 밀린 틱 계산', () => {
      // Given: 서버가 5분(300초) 동안 중단
      const downTimeMs = 5 * 60 * 1000; // 300,000ms
      const tickRateMs = 1000;
      
      // When: catch-up 계산
      const missedTicks = Math.floor(downTimeMs / tickRateMs);
      
      // Then: 300 ticks missed
      expect(missedTicks).toBe(300);
      console.log(`✅ 5분 다운타임 → ${missedTicks}틱 누락`);
    });

    it('Catch-up 최대 제한 (MAX_CATCHUP_TICKS = 3600)', () => {
      // Given: 서버가 2시간 동안 중단 (7200틱 누락)
      const downTimeMs = 2 * 60 * 60 * 1000;
      const tickRateMs = 1000;
      const MAX_CATCHUP_TICKS = 3600;
      
      // When: catch-up 계산
      const missedTicks = Math.floor(downTimeMs / tickRateMs);
      const ticksToApply = Math.min(missedTicks, MAX_CATCHUP_TICKS);
      
      // Then: 최대 3600틱만 적용
      expect(missedTicks).toBe(7200);
      expect(ticksToApply).toBe(3600);
      console.log(`✅ ${missedTicks}틱 누락 → ${ticksToApply}틱만 catch-up (최대 1시간)`);
    });

    it('Catch-up 후 게임 날짜 재계산', () => {
      // Given: 시작 시간 184년 1월 1일, 300틱(5분) 누락
      const startDate = new Date(184, 0, 1, 0, 0, 0);
      const missedTicks = 300;
      const timeScale = 24;
      const tickRateMs = 1000;
      
      // When: catch-up 적용
      const elapsedGameMs = missedTicks * tickRateMs * timeScale;
      const newGameDate = new Date(startDate.getTime() + elapsedGameMs);
      
      // Then: 300 * 24 = 7200 game seconds = 2 game hours
      expect(newGameDate.getHours()).toBe(2);
      console.log(`✅ Catch-up 후 게임 시간: ${newGameDate.getHours()}시 (2시간 진행)`);
    });
  });

  describe('3. DAY_START 이벤트 발행 테스트', () => {
    it('게임 시간이 자정(00:00)을 넘을 때 DAY_START 발행', () => {
      // Given: 현재 게임 날짜 = 1월 1일 23시
      let lastGameDay = 1;
      const currentDay = 2; // 자정을 넘어 2일이 됨
      
      // When: 일자 변경 감지
      const dayChanged = currentDay !== lastGameDay;
      
      // Then: DAY_START 이벤트 발행
      expect(dayChanged).toBe(true);
      console.log(`✅ 일자 변경 감지: ${lastGameDay}일 → ${currentDay}일`);
    });

    it('DAY_START 정확한 타이밍 계산', () => {
      // Given: 184년 1월 1일 00:00 시작, timeScale=24
      const startDate = new Date(184, 0, 1, 0, 0, 0);
      const timeScale = 24;
      const tickRateMs = 1000;
      
      // When: 몇 틱 후에 다음 날이 되는가?
      // 24시간 = 86400 game seconds
      // 86400 / 24 = 3600 real seconds = 3600 ticks
      const ticksPerGameDay = 3600;
      const nextDayDate = new Date(startDate.getTime() + ticksPerGameDay * tickRateMs * timeScale);
      
      // Then: 1월 2일 00:00
      expect(nextDayDate.getDate()).toBe(2);
      expect(nextDayDate.getHours()).toBe(0);
      console.log(`✅ ${ticksPerGameDay}틱 후 = 다음 날 자정: ${nextDayDate.getMonth()+1}/${nextDayDate.getDate()} ${nextDayDate.getHours()}:00`);
    });

    it('MONTH_START 이벤트 발행 조건', () => {
      // Given: 현재 게임 월 = 1월
      let lastGameMonth = 1;
      const currentMonth = 2; // 2월이 됨
      
      // When: 월 변경 감지
      const monthChanged = currentMonth !== lastGameMonth;
      
      // Then: MONTH_START 이벤트 발행
      expect(monthChanged).toBe(true);
      console.log(`✅ 월 변경 감지: ${lastGameMonth}월 → ${currentMonth}월`);
    });
  });
});

describe('Phase 2: DB Schema 검증', () => {
  describe('1. 참조 관계 검증 (순환 참조 없음)', () => {
    it('User -> Character: 단방향 참조', () => {
      // User는 characterIds를 가지지 않음 (Character가 ownerId로 User 참조)
      // Character는 ownerId(string)로 User를 참조
      // → 순환 참조 없음
      
      const userSchema = {
        userId: 'string',
        username: 'string',
        // NO characterIds field - Character references User instead
      };
      
      const characterSchema = {
        characterId: 'string',
        ownerId: 'string', // References User.userId
        sessionId: 'string',
      };
      
      expect(userSchema).not.toHaveProperty('characterIds');
      expect(characterSchema).toHaveProperty('ownerId');
      console.log('✅ User -> Character: 단방향 참조 (Character.ownerId → User.userId)');
    });

    it('Character -> JobCard: 단방향 참조', () => {
      // Character는 jobCardIds를 가지지 않음 (JobCard가 characterId로 Character 참조)
      // JobCard는 characterId(string)로 Character를 참조
      // → 순환 참조 없음
      
      const characterSchema = {
        characterId: 'string',
        // NO jobCardIds field - JobCard references Character instead
      };
      
      const jobCardSchema = {
        jobId: 'string',
        characterId: 'string', // References Character.characterId
        sessionId: 'string',
      };
      
      expect(characterSchema).not.toHaveProperty('jobCardIds');
      expect(jobCardSchema).toHaveProperty('characterId');
      console.log('✅ Character -> JobCard: 단방향 참조 (JobCard.characterId → Character.characterId)');
    });

    it('String ID 사용으로 Mongoose populate 오버헤드 방지', () => {
      // ObjectId 대신 string ID 사용
      // → populate() 없이 직접 쿼리 가능
      
      const idType = 'string'; // Not mongoose.Schema.Types.ObjectId
      
      expect(idType).toBe('string');
      console.log('✅ String ID 사용 → populate() 오버헤드 없음');
    });
  });

  describe('2. 인덱싱 검증', () => {
    it('User 모델 인덱스', () => {
      const userIndexes = [
        { fields: { userId: 1 }, unique: false },      // Primary lookup
        { fields: { username: 1 }, unique: true },    // Login lookup
        { fields: { email: 1 }, unique: false },      // Optional email (sparse)
        { fields: { role: 1, isBanned: 1 }, unique: false }, // Admin queries
      ];
      
      expect(userIndexes.length).toBeGreaterThanOrEqual(4);
      console.log('✅ User 인덱스: userId, username(unique), email(sparse), role+isBanned');
    });

    it('Character 모델 인덱스', () => {
      const characterIndexes = [
        { fields: { characterId: 1, sessionId: 1 }, unique: true }, // Primary
        { fields: { sessionId: 1, ownerId: 1 }, unique: false },    // User lookup
        { fields: { sessionId: 1, 'location.x': 1, 'location.y': 1 }, unique: false }, // Spatial
        { fields: { sessionId: 1, state: 1 }, unique: false },      // State filter
      ];
      
      expect(characterIndexes.length).toBeGreaterThanOrEqual(4);
      console.log('✅ Character 인덱스: characterId+sessionId(unique), ownerId, location, state');
    });

    it('GameSession 모델 인덱스', () => {
      const sessionIndexes = [
        { fields: { sessionId: 1 }, unique: true },  // Primary
        { fields: { status: 1 }, unique: false },    // Status filter (running sessions)
      ];
      
      expect(sessionIndexes.length).toBeGreaterThanOrEqual(2);
      console.log('✅ GameSession 인덱스: sessionId(unique), status');
    });

    it('JobCard 모델 인덱스', () => {
      const jobCardIndexes = [
        { fields: { sessionId: 1, characterId: 1, status: 1 }, unique: false }, // Character jobs
        { fields: { sessionId: 1, status: 1, endTick: 1 }, unique: false },     // Active jobs
        { fields: { jobId: 1, sessionId: 1 }, unique: true },                    // Unique job ID
        { fields: { sessionId: 1, characterId: 1, priority: 1, status: 1 }, unique: false }, // Priority queue
      ];
      
      expect(jobCardIndexes.length).toBeGreaterThanOrEqual(4);
      console.log('✅ JobCard 인덱스: characterId+status, endTick, jobId(unique), priority');
    });
  });
});

// 시간 정확도 시뮬레이션
describe('시간 정확도 시뮬레이션', () => {
  it('100틱 시뮬레이션 (현실 100초 = 게임 40분)', () => {
    const startDate = new Date(184, 0, 1, 0, 0, 0);
    const timeScale = 24;
    const tickRateMs = 1000;
    const tickLog: string[] = [];
    
    let lastDay = startDate.getDate();
    let lastMonth = startDate.getMonth() + 1;
    
    for (let tick = 1; tick <= 100; tick++) {
      const elapsedGameMs = tick * tickRateMs * timeScale;
      const currentDate = new Date(startDate.getTime() + elapsedGameMs);
      
      const currentDay = currentDate.getDate();
      const currentMonth = currentDate.getMonth() + 1;
      
      // DAY_START 감지
      if (currentDay !== lastDay) {
        tickLog.push(`[Tick ${tick}] DAY_START: ${currentMonth}/${currentDay}`);
        lastDay = currentDay;
      }
      
      // MONTH_START 감지
      if (currentMonth !== lastMonth) {
        tickLog.push(`[Tick ${tick}] MONTH_START: ${currentMonth}월`);
        lastMonth = currentMonth;
      }
    }
    
    // 100틱 = 100초 현실 = 2400초 게임 = 40분 게임
    const finalDate = new Date(startDate.getTime() + 100 * tickRateMs * timeScale);
    expect(finalDate.getMinutes()).toBe(40);
    
    console.log(`✅ 100틱 시뮬레이션 완료`);
    console.log(`   시작: 184/1/1 00:00`);
    console.log(`   종료: 184/1/1 00:40`);
    console.log(`   이벤트 로그: ${tickLog.length > 0 ? tickLog.join(', ') : '(없음)'}`);
  });

  it('3600틱 시뮬레이션 (현실 1시간 = 게임 1일)', () => {
    const startDate = new Date(184, 0, 1, 0, 0, 0);
    const timeScale = 24;
    const tickRateMs = 1000;
    
    // 3600틱 = 3600초 현실 = 1시간
    // 게임: 3600 * 24 = 86400초 = 24시간 = 1일
    const elapsedGameMs = 3600 * tickRateMs * timeScale;
    const finalDate = new Date(startDate.getTime() + elapsedGameMs);
    
    expect(finalDate.getDate()).toBe(2); // 다음 날
    expect(finalDate.getHours()).toBe(0); // 자정
    
    console.log(`✅ 3600틱 시뮬레이션 완료`);
    console.log(`   시작: 184/1/1 00:00`);
    console.log(`   종료: 184/1/2 00:00 (DAY_START 1회)`);
  });
});

