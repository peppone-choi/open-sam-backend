/**
 * Test Fixtures - 장수 (General)
 * 
 * 테스트용 장수 객체 생성 유틸리티
 */

export interface ITestGeneralOptions {
  no?: number;
  name?: string;
  nation?: number;
  city?: number;
  gold?: number;
  rice?: number;
  crew?: number;
  crewtype?: number;
  leadership?: number;
  strength?: number;
  intel?: number;
  politics?: number;
  charm?: number;
  train?: number;
  atmos?: number;
  officer_level?: number;
  npc?: number;
  injury?: number;
  experience?: number;
  dedication?: number;
  // 숙련도
  dex0?: number;
  dex1?: number;
  dex2?: number;
  dex3?: number;
  dex4?: number;
  // 아이템
  weapon?: string;
  book?: string;
  horse?: string;
  // 기타
  [key: string]: any;
}

export class TestGeneral {
  private _vars: Map<string, any>;
  private _cachedCity: any = null;
  private _cachedNation: any = null;
  private _resultTurn: any = null;
  private _lastTurn: any = null;

  constructor(options: ITestGeneralOptions = {}) {
    const defaults: ITestGeneralOptions = {
      no: 1,
      name: 'TestGeneral',
      nation: 0,
      city: 1,
      gold: 1000,
      rice: 1000,
      crew: 0,
      crewtype: 0,
      leadership: 50,
      strength: 50,
      intel: 50,
      politics: 50,
      charm: 50,
      train: 0,
      atmos: 0,
      officer_level: 0,
      npc: 0,
      injury: 0,
      experience: 0,
      dedication: 0,
      dex0: 0,
      dex1: 0,
      dex2: 0,
      dex3: 0,
      dex4: 0,
      weapon: 'None',
      book: 'None',
      horse: 'None',
    };

    this._vars = new Map<string, any>(Object.entries({ ...defaults, ...options }));
  }

  // PHP General 호환 메서드들

  getVar(key: string): any {
    return this._vars.get(key) ?? 0;
  }

  setVar(key: string, value: any): void {
    this._vars.set(key, value);
  }

  increaseVar(key: string, amount: number): void {
    const current = this._vars.get(key) ?? 0;
    this._vars.set(key, current + amount);
  }

  increaseVarWithLimit(key: string, amount: number, min?: number | null, max?: number | null): void {
    let current = this._vars.get(key) ?? 0;
    current += amount;
    if (min !== null && min !== undefined) {
      current = Math.max(min, current);
    }
    if (max !== null && max !== undefined) {
      current = Math.min(max, current);
    }
    this._vars.set(key, current);
  }

  getID(): number {
    return this._vars.get('no') ?? 1;
  }

  getNationID(): number {
    return this._vars.get('nation') ?? 0;
  }

  getCityID(): number {
    return this._vars.get('city') ?? 1;
  }

  getLeadership(): number {
    return this._vars.get('leadership') ?? 50;
  }

  getStrength(): number {
    return this._vars.get('strength') ?? 50;
  }

  getIntel(): number {
    return this._vars.get('intel') ?? 50;
  }

  getPolitics(): number {
    return this._vars.get('politics') ?? 50;
  }

  getCharm(): number {
    return this._vars.get('charm') ?? 50;
  }

  getCity(): any {
    return this._cachedCity;
  }

  setCity(city: any): void {
    this._cachedCity = city;
  }

  getNation(): any {
    return this._cachedNation;
  }

  setNation(nation: any): void {
    this._cachedNation = nation;
  }

  getCrewTypeObj(): any {
    const crewtype = this._vars.get('crewtype') ?? 0;
    const crewTypes = [
      { id: 0, name: '보병', armType: 0, cost: 1 },
      { id: 1, name: '궁병', armType: 1, cost: 1.2 },
      { id: 2, name: '기병', armType: 2, cost: 1.5 },
      { id: 3, name: '귀병', armType: 3, cost: 2 },
      { id: 4, name: '차병', armType: 4, cost: 3 },
    ];
    return crewTypes[crewtype] ?? crewTypes[0];
  }

  onCalcDomestic(_action: string, _key: string, value: number): number {
    return value;
  }

  addExperience(_amount: number): void {}
  addDedication(_amount: number): void {}
  checkStatChange(): void {}
  setAuxVar(_key: string, _value: any): void {}
  addDex(_armType: number, _amount: number): void {}
  updateMaxDomesticCritical(): void {}

  getLogger(): any {
    return {
      pushGeneralActionLog: jest.fn(),
      pushNationalHistoryLog: jest.fn(),
      pushGlobalHistoryLog: jest.fn(),
      flush: jest.fn(),
    };
  }

  getTurnTime(): string {
    return '184년 1월';
  }

  getSessionID(): string {
    return 'test_session';
  }

  genGenericUniqueRNG(): any {
    return {
      nextRange: jest.fn(() => 1.0),
      choiceUsingWeight: jest.fn(() => 'normal'),
      choiceUsingWeightPair: jest.fn(() => [['normal', 2], 0.33]),
    };
  }

  _setResultTurn(turn: any): void {
    this._resultTurn = turn;
  }

  getResultTurn(): any {
    return this._resultTurn ?? { term: 0, command: '휴식', arg: null };
  }

  getLastTurn(): any {
    return this._lastTurn ?? { term: 0, command: '휴식', arg: null };
  }

  // 직접 접근용 (테스트에서만 사용)
  get _rawVars(): Map<string, any> {
    return this._vars;
  }
}

/**
 * 테스트용 장수 객체 생성
 */
export function createTestGeneral(overrides: Partial<ITestGeneralOptions> = {}): TestGeneral {
  return new TestGeneral(overrides);
}

/**
 * 다양한 preset 장수 생성
 */
export const GeneralPresets = {
  /** 재야 장수 (국가 미소속) */
  wanderer: () => createTestGeneral({
    nation: 0,
    officer_level: 0,
    gold: 500,
    rice: 500,
  }),

  /** 일반 장수 */
  normal: () => createTestGeneral({
    nation: 1,
    officer_level: 1,
    gold: 5000,
    rice: 3000,
    crew: 1000,
    train: 50,
    atmos: 50,
  }),

  /** 군주 */
  lord: () => createTestGeneral({
    nation: 1,
    officer_level: 12,
    gold: 50000,
    rice: 30000,
    crew: 10000,
    train: 100,
    atmos: 100,
    leadership: 90,
    strength: 85,
    intel: 80,
  }),

  /** 수뇌부 (군사/참모 등) */
  officer: () => createTestGeneral({
    nation: 1,
    officer_level: 5,
    gold: 10000,
    rice: 8000,
    crew: 5000,
  }),

  /** 무장 (높은 무력) */
  warrior: () => createTestGeneral({
    nation: 1,
    strength: 95,
    intel: 40,
    leadership: 70,
    crew: 8000,
    train: 100,
    atmos: 100,
  }),

  /** 지장 (높은 지력) */
  strategist: () => createTestGeneral({
    nation: 1,
    strength: 40,
    intel: 95,
    leadership: 70,
    crew: 5000,
  }),

  /** 통솔장 (높은 통솔) */
  commander: () => createTestGeneral({
    nation: 1,
    leadership: 95,
    strength: 70,
    intel: 70,
    crew: 10000,
    train: 100,
    atmos: 100,
  }),

  /** 빈곤한 장수 (자원 부족) */
  poor: () => createTestGeneral({
    nation: 1,
    gold: 0,
    rice: 0,
    crew: 0,
  }),

  /** 부상당한 장수 */
  injured: () => createTestGeneral({
    nation: 1,
    injury: 80,
    crew: 1000,
  }),

  /** NPC 장수 */
  npc: () => createTestGeneral({
    nation: 1,
    npc: 1,
    crew: 5000,
  }),
};

