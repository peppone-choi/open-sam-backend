/**
 * Test Fixtures - 환경 (Environment)
 * 
 * 테스트용 게임 환경 객체 생성 유틸리티
 */

export interface ITestEnvOptions {
  year?: number;
  month?: number;
  session_id?: string;
  scenario_id?: string;
  turnterm?: number;
  develcost?: number;
  startyear?: number;
  maxTech?: number;
  ownedCities?: Array<{ city: number; name: string; nation: number; level: number }>;
  // 기타 설정
  [key: string]: any;
}

export class TestEnv {
  year: number;
  month: number;
  session_id: string;
  scenario_id: string;
  turnterm: number;
  develcost: number;
  startyear: number;
  maxTech: number;
  ownedCities: Array<{ city: number; name: string; nation: number; level: number }>;
  [key: string]: any;

  constructor(options: ITestEnvOptions = {}) {
    this.year = options.year ?? 184;
    this.month = options.month ?? 1;
    this.session_id = options.session_id ?? 'test_session';
    this.scenario_id = options.scenario_id ?? 'sangokushi';
    this.turnterm = options.turnterm ?? 60;
    this.develcost = options.develcost ?? 100;
    this.startyear = options.startyear ?? 184;
    this.maxTech = options.maxTech ?? 300;
    this.ownedCities = options.ownedCities ?? [
      { city: 1, name: '낙양', nation: 1, level: 5 },
    ];

    // 추가 옵션 적용
    Object.keys(options).forEach(key => {
      if (!(key in this)) {
        this[key] = options[key];
      }
    });
  }

  // 헬퍼 메서드들

  getYear(): number {
    return this.year;
  }

  getMonth(): number {
    return this.month;
  }

  getSessionID(): string {
    return this.session_id;
  }

  getTurnTerm(): number {
    return this.turnterm;
  }

  getDevelCost(): number {
    return this.develcost;
  }

  getMaxTech(): number {
    return this.maxTech;
  }

  getTurnTime(): string {
    return `${this.year}년 ${this.month}월`;
  }

  getOwnedCities(): Array<{ city: number; name: string; nation: number; level: number }> {
    return this.ownedCities;
  }
}

/**
 * 테스트용 환경 객체 생성
 */
export function createTestEnv(overrides: Partial<ITestEnvOptions> = {}): TestEnv {
  return new TestEnv(overrides);
}

/**
 * 다양한 preset 환경 생성
 */
export const EnvPresets = {
  /** 게임 시작 (184년 1월) */
  gameStart: () => createTestEnv({
    year: 184,
    month: 1,
  }),

  /** 중반 게임 (200년) */
  midGame: () => createTestEnv({
    year: 200,
    month: 6,
    maxTech: 200,
  }),

  /** 후반 게임 (220년) */
  lateGame: () => createTestEnv({
    year: 220,
    month: 1,
    maxTech: 300,
  }),

  /** 빠른 턴 (30분) */
  fastTurn: () => createTestEnv({
    turnterm: 30,
  }),

  /** 느린 턴 (120분) */
  slowTurn: () => createTestEnv({
    turnterm: 120,
  }),

  /** 낮은 개발 비용 */
  lowCost: () => createTestEnv({
    develcost: 50,
  }),

  /** 높은 개발 비용 */
  highCost: () => createTestEnv({
    develcost: 200,
  }),

  /** 여러 도시 보유 */
  multipleCities: () => createTestEnv({
    ownedCities: [
      { city: 1, name: '낙양', nation: 1, level: 7 },
      { city: 2, name: '장안', nation: 1, level: 6 },
      { city: 3, name: '업', nation: 1, level: 5 },
      { city: 4, name: '성도', nation: 1, level: 5 },
    ],
  }),
};

/**
 * 테스트용 세션 객체 (통합 테스트용)
 */
export interface ITestSession {
  id: string;
  general: any;
  city: any;
  nation: any;
  env: TestEnv;
  cleanup: () => Promise<void>;
  createGeneral: (options: any) => Promise<any>;
  getCity: (cityId: number) => Promise<any>;
  executeCommand: (generalNo: number, command: string, args?: any) => Promise<any>;
  startBattle: (attackerNo: number, targetCityId: number) => Promise<any>;
}

/**
 * 테스트 세션 생성 (Integration 테스트용)
 */
export function createTestSession(): Promise<ITestSession> {
  // 실제로는 DB 연결 등이 필요하지만, 단위 테스트용으로 mock 반환
  return Promise.resolve({
    id: 'test_session_' + Date.now(),
    general: null,
    city: null,
    nation: null,
    env: createTestEnv(),
    cleanup: async () => {},
    createGeneral: async (_options: any) => ({ no: 1 }),
    getCity: async (_cityId: number) => ({ city: 1 }),
    executeCommand: async (_generalNo: number, _command: string, _args?: any) => ({ success: true }),
    startBattle: async (_attackerNo: number, _targetCityId: number) => ({ 
      winner: 'attacker',
      rounds: 5,
      log: [],
    }),
  });
}

/**
 * LastTurn 객체 생성 (국가 커맨드용)
 */
export interface ILastTurn {
  command: string;
  arg: any;
  term: number;
  seq: number;
  duplicate: () => ILastTurn;
  getTerm: () => number;
  getSeq: () => number;
}

export function createLastTurn(options: Partial<ILastTurn> = {}): ILastTurn {
  const lastTurn: ILastTurn = {
    command: options.command ?? '휴식',
    arg: options.arg ?? null,
    term: options.term ?? 0,
    seq: options.seq ?? 0,
    duplicate: function() {
      return createLastTurn({
        command: this.command,
        arg: this.arg,
        term: this.term,
        seq: this.seq,
      });
    },
    getTerm: function() { return this.term; },
    getSeq: function() { return this.seq; },
  };
  return lastTurn;
}

