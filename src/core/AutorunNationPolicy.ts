/**
 * AutorunNationPolicy - 국가 AI 행동 정책
 * PHP GeneralAI.php의 AutorunNationPolicy 클래스 포팅
 * 
 * 수뇌/군주가 수행할 수 있는 행동의 우선순위와 가능 여부를 정의
 */

import { IGeneral } from '../models/general.model';
import { GameConst } from '../constants/GameConst';
import { AIOptions } from './AutorunGeneralPolicy';

/**
 * 국가 행동 타입 (수뇌 + 군주)
 */
export enum NationActionType {
  // 부대 발령
  부대전방발령 = '부대전방발령',
  부대후방발령 = '부대후방발령',
  부대구출발령 = '부대구출발령',

  // 유저장 발령
  부대유저장후방발령 = '부대유저장후방발령',
  유저장후방발령 = '유저장후방발령',
  유저장전방발령 = '유저장전방발령',
  유저장구출발령 = '유저장구출발령',
  유저장내정발령 = '유저장내정발령',

  // NPC 발령
  NPC후방발령 = 'NPC후방발령',
  NPC전방발령 = 'NPC전방발령',
  NPC구출발령 = 'NPC구출발령',
  NPC내정발령 = 'NPC내정발령',

  // 유저장 포상/몰수
  유저장긴급포상 = '유저장긴급포상',
  유저장포상 = '유저장포상',

  // NPC 포상/몰수
  NPC긴급포상 = 'NPC긴급포상',
  NPC포상 = 'NPC포상',
  NPC몰수 = 'NPC몰수',

  // 군주 행동
  불가침제의 = '불가침제의',
  선전포고 = '선전포고',
  천도 = '천도',
}

/**
 * 기본 우선순위 (PHP와 동일)
 */
export const DEFAULT_NATION_PRIORITY: NationActionType[] = [
  NationActionType.불가침제의,
  NationActionType.선전포고,
  NationActionType.천도,

  NationActionType.유저장긴급포상,
  NationActionType.부대전방발령,
  NationActionType.유저장구출발령,

  NationActionType.유저장후방발령,
  NationActionType.부대유저장후방발령,

  NationActionType.유저장전방발령,
  NationActionType.유저장포상,

  NationActionType.부대구출발령,
  NationActionType.부대후방발령,

  NationActionType.NPC긴급포상,
  NationActionType.NPC구출발령,
  NationActionType.NPC후방발령,

  NationActionType.NPC포상,

  NationActionType.NPC전방발령,

  NationActionType.유저장내정발령,
  NationActionType.NPC내정발령,
  NationActionType.NPC몰수,
];

/**
 * 즉시 턴 사용 가능한 행동들 (순서 무관)
 */
export const AVAILABLE_INSTANT_TURN_ACTIONS: Record<string, boolean> = {
  유저장긴급포상: true,
  유저장구출발령: true,
  유저장후방발령: true,
  유저장전방발령: true,
  유저장내정발령: true,
  유저장포상: true,
  NPC긴급포상: true,
  NPC구출발령: true,
  NPC후방발령: true,
  NPC내정발령: true,
  NPC포상: true,
  NPC전방발령: true,
};

/**
 * 정책 변수 기본값
 */
export interface NationPolicyValues {
  reqNationGold: number;
  reqNationRice: number;
  CombatForce: Record<number, [number, number, number]>; // generalID => [troopLeader, fromCity, toCity]
  SupportForce: Record<number, boolean>; // generalID => true
  DevelopForce: Record<number, boolean>; // generalID => true
  reqHumanWarUrgentGold: number;
  reqHumanWarUrgentRice: number;
  reqHumanWarRecommandGold: number;
  reqHumanWarRecommandRice: number;
  reqHumanDevelGold: number;
  reqHumanDevelRice: number;
  reqNPCWarGold: number;
  reqNPCWarRice: number;
  reqNPCDevelGold: number;
  reqNPCDevelRice: number;
  minimumResourceActionAmount: number;
  maximumResourceActionAmount: number;
  minNPCWarLeadership: number;
  minWarCrew: number;
  minNPCRecruitCityPopulation: number;
  safeRecruitCityPopulationRatio: number;
  properWarTrainAtmos: number;
  cureThreshold: number;
}

/**
 * 기본 정책 값
 */
export const DEFAULT_NATION_POLICY_VALUES: NationPolicyValues = {
  reqNationGold: 10000,
  reqNationRice: 12000,
  CombatForce: {},
  SupportForce: {},
  DevelopForce: {},
  reqHumanWarUrgentGold: 0,
  reqHumanWarUrgentRice: 0,
  reqHumanWarRecommandGold: 0,
  reqHumanWarRecommandRice: 0,
  reqHumanDevelGold: 10000,
  reqHumanDevelRice: 10000,
  reqNPCWarGold: 0,
  reqNPCWarRice: 0,
  reqNPCDevelGold: 0,
  reqNPCDevelRice: 500,
  minimumResourceActionAmount: 1000,
  maximumResourceActionAmount: 10000,
  minNPCWarLeadership: 40,
  minWarCrew: 1500,
  minNPCRecruitCityPopulation: 50000,
  safeRecruitCityPopulationRatio: 0.5,
  properWarTrainAtmos: 90,
  cureThreshold: 10,
};

/**
 * Alias for backward compatibility
 */
export const DEFAULT_NATION_POLICY = DEFAULT_NATION_POLICY_VALUES;

/**
 * 서버/국가 정책 오버라이드
 */
export interface NationPolicyOverride {
  priority?: NationActionType[];
  values?: Partial<NationPolicyValues>;
}

/**
 * 국가 AI 행동 정책 클래스
 */
export class AutorunNationPolicy implements NationPolicyValues {
  // 행동 가능 여부 플래그들
  public can부대전방발령: boolean = true;
  public can부대후방발령: boolean = true;
  public can부대구출발령: boolean = true;

  public can부대유저장후방발령: boolean = true;
  public can유저장후방발령: boolean = true;
  public can유저장전방발령: boolean = true;
  public can유저장구출발령: boolean = true;
  public can유저장내정발령: boolean = true;

  public canNPC후방발령: boolean = true;
  public canNPC전방발령: boolean = true;
  public canNPC구출발령: boolean = true;
  public canNPC내정발령: boolean = true;

  public can유저장긴급포상: boolean = true;
  public can유저장포상: boolean = true;

  public canNPC긴급포상: boolean = true;
  public canNPC포상: boolean = true;
  public canNPC몰수: boolean = true;

  public can불가침제의: boolean = true;
  public can선전포고: boolean = true;
  public can천도: boolean = true;

  // 우선순위
  public priority: NationActionType[];

  // 정책 변수들
  public reqNationGold: number;
  public reqNationRice: number;
  public CombatForce: Record<number, [number, number, number]>;
  public SupportForce: Record<number, boolean>;
  public DevelopForce: Record<number, boolean>;
  public reqHumanWarUrgentGold: number;
  public reqHumanWarUrgentRice: number;
  public reqHumanWarRecommandGold: number;
  public reqHumanWarRecommandRice: number;
  public reqHumanDevelGold: number;
  public reqHumanDevelRice: number;
  public reqNPCWarGold: number;
  public reqNPCWarRice: number;
  public reqNPCDevelGold: number;
  public reqNPCDevelRice: number;
  public minimumResourceActionAmount: number;
  public maximumResourceActionAmount: number;
  public minNPCWarLeadership: number;
  public minWarCrew: number;
  public minNPCRecruitCityPopulation: number;
  public safeRecruitCityPopulationRatio: number;
  public properWarTrainAtmos: number;
  public cureThreshold: number;

  /**
   * 생성자
   */
  constructor(
    general: IGeneral,
    aiOptions: AIOptions,
    nationPolicy: NationPolicyOverride | null,
    serverPolicy: NationPolicyOverride | null,
    nation: any,
    env: any
  ) {
    // 기본 정책 값 초기화
    Object.assign(this, DEFAULT_NATION_POLICY_VALUES);

    // 서버 정책 오버라이드
    if (serverPolicy?.values) {
      for (const [key, value] of Object.entries(serverPolicy.values)) {
        if (key in this) {
          (this as any)[key] = value;
        } else {
          console.warn(`[AutorunNationPolicy] ${key}이 없음`);
        }
      }
    }

    // 서버 정책 우선순위 오버라이드
    if (serverPolicy?.priority) {
      this.priority = serverPolicy.priority;
    } else {
      this.priority = [...DEFAULT_NATION_PRIORITY];
    }

    // 국가 정책 오버라이드
    if (nationPolicy?.values) {
      for (const [key, value] of Object.entries(nationPolicy.values)) {
        if (key in this) {
          (this as any)[key] = value;
        } else {
          console.warn(`[AutorunNationPolicy] ${key}이 없음`);
        }
      }
    }

    // 국가 정책 우선순위 오버라이드
    if (nationPolicy?.priority) {
      this.priority = nationPolicy.priority;
    }

    // 동적 계산: NPC 개발 비용 (env.develcost 기반)
    if (this.reqNPCDevelGold === 0 && env?.develcost) {
      this.reqNPCDevelGold = env.develcost * 30;
    }

    // 동적 계산: NPC 전쟁 자원 (기본 병종 비용 기반)
    if (this.reqNPCWarGold === 0 || this.reqNPCWarRice === 0) {
      // FUTURE: GameUnitConst 구현 후 실제 병종 비용 계산
      // 현재는 임시로 고정값 사용
      const defaultStatNPCMax = 80; // FUTURE: GameConst에서 가져오기
      const estimatedGoldPerCrew = 100;
      const estimatedRicePerCrew = 50;

      if (this.reqNPCWarGold === 0) {
        const reqGold = estimatedGoldPerCrew * defaultStatNPCMax * 100;
        this.reqNPCWarGold = Math.round(reqGold * 4 / 100) * 100;
      }
      if (this.reqNPCWarRice === 0) {
        const reqRice = estimatedRicePerCrew * defaultStatNPCMax * 100;
        this.reqNPCWarRice = Math.round(reqRice * 4 / 100) * 100;
      }
    }

    // 동적 계산: 유저장 긴급 전쟁 자원
    if (this.reqHumanWarUrgentGold === 0 || this.reqHumanWarUrgentRice === 0) {
      // FUTURE: GameUnitConst 구현 후 실제 병종 비용 계산
      const defaultStatMax = 100; // FUTURE: GameConst에서 가져오기
      const estimatedGoldPerCrew = 100;
      const estimatedRicePerCrew = 50;

      if (this.reqHumanWarUrgentGold === 0) {
        const reqGold = estimatedGoldPerCrew * defaultStatMax * 100;
        this.reqHumanWarUrgentGold = Math.round(reqGold * 3 * 2 / 100) * 100;
      }
      if (this.reqHumanWarUrgentRice === 0) {
        const reqRice = estimatedRicePerCrew * defaultStatMax * 100;
        this.reqHumanWarUrgentRice = Math.round(reqRice * 3 * 2 / 100) * 100;
      }
    }

    // 동적 계산: 유저장 권장 전쟁 자원
    if (this.reqHumanWarRecommandGold === 0) {
      this.reqHumanWarRecommandGold =
        Math.round(this.reqHumanWarUrgentGold * 2 / 100) * 100;
    }
    if (this.reqHumanWarRecommandRice === 0) {
      this.reqHumanWarRecommandRice =
        Math.round(this.reqHumanWarUrgentRice * 2 / 100) * 100;
    }

    // NPC (npc >= 2)는 모든 행동 활성화 유지
    if ((general.npc || 0) >= 2) {
      return;
    }

    // 유저장이 수뇌 권한이 없으면 모든 국가 행동 비활성화
    if (!aiOptions.chief) {
      this.can부대전방발령 = false;
      this.can부대후방발령 = false;

      this.can부대유저장후방발령 = false;
      this.can유저장후방발령 = false;
      this.can유저장전방발령 = false;
      this.can유저장구출발령 = false;
      this.can유저장내정발령 = false;

      this.canNPC후방발령 = false;
      this.canNPC전방발령 = false;
      this.canNPC구출발령 = false;
      this.canNPC내정발령 = false;

      this.can유저장긴급포상 = false;
      this.can유저장포상 = false;

      this.canNPC긴급포상 = false;
      this.canNPC포상 = false;
      this.canNPC몰수 = false;

      this.can선전포고 = false;
      this.can천도 = false;
    }
  }

  /**
   * 특정 행동이 가능한지 체크
   */
  public canPerform(action: NationActionType): boolean {
    const key = `can${action}` as keyof this;
    return this[key] === true;
  }

  /**
   * 가능한 행동들을 우선순위 순서로 반환
   */
  public getAvailableActions(): NationActionType[] {
    return this.priority.filter((action) => this.canPerform(action));
  }

  /**
   * 즉시 턴 사용 가능한 행동인지 체크
   */
  public isInstantTurnAction(action: NationActionType): boolean {
    return AVAILABLE_INSTANT_TURN_ACTIONS[action] === true;
  }
}
