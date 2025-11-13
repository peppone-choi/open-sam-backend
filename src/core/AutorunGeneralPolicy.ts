/**
 * AutorunGeneralPolicy - 장수 AI 행동 정책
 * PHP GeneralAI.php의 AutorunGeneralPolicy 클래스 포팅
 * 
 * 장수가 수행할 수 있는 행동의 우선순위와 가능 여부를 정의
 */

import { IGeneral } from '../models/general.model';

/**
 * 장수 행동 타입 (일반장 + NPC)
 */
export enum GeneralActionType {
  // 내정 관련
  일반내정 = '일반내정',
  긴급내정 = '긴급내정',     // 민심 ~50
  전쟁내정 = '전쟁내정',     // 인구 ~50%, 민심 ~90

  // 자원 관리
  금쌀구매 = '금쌀구매',
  상인무시 = '상인무시',

  // 병력 관리
  징병 = '징병',
  모병 = '모병',
  한계징병 = '한계징병',
  고급병종 = '고급병종',
  전투준비 = '전투준비',
  소집해제 = '소집해제',

  // 전투
  출병 = '출병',

  // NPC 전용
  NPC헌납 = 'NPC헌납',
  NPC사망대비 = 'NPC사망대비',

  // 워프
  후방워프 = '후방워프',
  전방워프 = '전방워프',
  내정워프 = '내정워프',

  // 기타
  귀환 = '귀환',
  국가선택 = '국가선택',
  집합 = '집합',
  건국 = '건국',
  선양 = '선양',
}

/**
 * 기본 우선순위 (PHP와 동일)
 */
export const DEFAULT_GENERAL_PRIORITY: GeneralActionType[] = [
  GeneralActionType.NPC사망대비,
  GeneralActionType.귀환,
  GeneralActionType.금쌀구매,
  GeneralActionType.출병,
  GeneralActionType.긴급내정,
  GeneralActionType.전투준비,
  GeneralActionType.전방워프,
  GeneralActionType.NPC헌납,
  GeneralActionType.징병,
  GeneralActionType.후방워프,
  GeneralActionType.전쟁내정,
  GeneralActionType.소집해제,
  GeneralActionType.일반내정,
  GeneralActionType.내정워프,
];

/**
 * AI 옵션 타입
 */
export interface AIOptions {
  develop?: boolean;      // 내정 허용
  warp?: boolean;         // 워프 허용
  recruit?: boolean;      // 징병 허용
  recruit_high?: boolean; // 모병 허용
  train?: boolean;        // 훈련 허용
  battle?: boolean;       // 전투 허용
  chief?: boolean;        // 수뇌 권한
}

/**
 * 서버/국가 정책 오버라이드
 */
export interface PolicyOverride {
  priority?: GeneralActionType[];
  values?: Record<string, any>;
}

/**
 * 장수 AI 행동 정책 클래스
 */
export class AutorunGeneralPolicy {
  // 행동 가능 여부 플래그들
  public canNPC사망대비: boolean = true;
  public can일반내정: boolean = true;
  public can긴급내정: boolean = true;
  public can전쟁내정: boolean = true;

  public can금쌀구매: boolean = true;
  public can상인무시: boolean = true;

  public can징병: boolean = true;
  public can모병: boolean = false;
  public can한계징병: boolean = false;
  public can고급병종: boolean = false;
  public can전투준비: boolean = true;
  public can소집해제: boolean = true;

  public can출병: boolean = true;

  public canNPC헌납: boolean = true;

  public can후방워프: boolean = true;
  public can전방워프: boolean = true;
  public can내정워프: boolean = true;

  public can귀환: boolean = true;

  public can국가선택: boolean = true;
  public can집합: boolean = false;
  public can건국: boolean = true;
  public can선양: boolean = false;

  public priority: GeneralActionType[];

  /**
   * NPC 상태에 따른 정책 조정
   */
  private doNPCState(general: IGeneral): void {
    const npc = general.npc || 0;
    const nationID = general.nation || 0;

    // 방랑군 대장 (npcType = 5)
    if (npc === 5) {
      this.can집합 = true;
      this.can선양 = true;
      this.can국가선택 = false;
      return;
    }

    // 유저장 (npcType = 1)은 사망대비 불필요
    if (npc === 1) {
      this.canNPC사망대비 = false;
    }

    // 국가에 소속되어 있으면 국가 선택/건국 불가
    if (nationID !== 0) {
      this.can국가선택 = false;
      this.can건국 = false;
    }
  }

  /**
   * 생성자
   */
  constructor(
    general: IGeneral,
    aiOptions: AIOptions,
    nationPolicy: PolicyOverride | null,
    serverPolicy: PolicyOverride | null,
    nation: any,
    env: any
  ) {
    // 기본 우선순위 설정
    this.priority = [...DEFAULT_GENERAL_PRIORITY];

    // 서버 정책 우선순위 오버라이드
    if (serverPolicy?.priority) {
      const validPriority = serverPolicy.priority.filter((item) => {
        const key = `can${item}` as keyof this;
        if (!(key in this)) {
          console.warn(`[AutorunGeneralPolicy] ${item}이 없음`);
          return false;
        }
        return true;
      });
      if (validPriority.length > 0) {
        this.priority = validPriority;
      }
    }

    // 국가 정책 우선순위 오버라이드
    if (nationPolicy?.priority) {
      const validPriority = nationPolicy.priority.filter((item) => {
        const key = `can${item}` as keyof this;
        if (!(key in this)) {
          console.warn(`[AutorunGeneralPolicy] ${item}이 없음`);
          return false;
        }
        return true;
      });
      if (validPriority.length > 0) {
        this.priority = validPriority;
      }
    }

    // NPC (npc >= 2)는 NPC 정책 적용
    if ((general.npc || 0) >= 2) {
      this.doNPCState(general);
      return;
    }

    // 유저장 (npcType = 0 or 1)은 기본적으로 모든 행동 불가
    // AI 옵션에 따라 선택적으로 활성화
    this.can일반내정 = false;
    this.can긴급내정 = false;
    this.can전쟁내정 = false;

    this.can금쌀구매 = false;
    this.can상인무시 = false;

    this.can징병 = false;
    this.can모병 = false;
    this.can한계징병 = true;  // 유저장은 한계징병 가능
    this.can고급병종 = true;    // 유저장은 고급병종 가능
    this.can전투준비 = false;

    this.can출병 = false;

    this.canNPC헌납 = false;

    this.can후방워프 = false;
    this.can전방워프 = false;
    this.can내정워프 = false;

    this.can국가선택 = false;
    this.can집합 = false;
    this.can건국 = false;
    this.can선양 = false;

    // AI 옵션에 따라 행동 활성화
    for (const [key, value] of Object.entries(aiOptions)) {
      if (!value) continue;

      switch (key) {
        case 'develop':
          this.can일반내정 = true;
          // 유저장은 '긴급'을 하지 않음
          this.can전쟁내정 = true;
          this.can금쌀구매 = true;
          break;

        case 'warp':
          this.can후방워프 = true;
          this.can전방워프 = true;
          this.can내정워프 = true;
          this.can금쌀구매 = true;
          this.can상인무시 = true;
          break;

        case 'recruit_high':
          this.can모병 = true;
        // fallthrough intentional
        case 'recruit':
          this.can징병 = true;
          this.can소집해제 = true;
          this.can금쌀구매 = true;
          break;

        case 'train':
          this.can전투준비 = true;
          this.can금쌀구매 = true;
          break;

        case 'battle':
          this.can출병 = true;
          this.can금쌀구매 = true;
          break;
      }
    }
  }

  /**
   * 특정 행동이 가능한지 체크
   */
  public canPerform(action: GeneralActionType): boolean {
    const key = `can${action}` as keyof this;
    return this[key] === true;
  }

  /**
   * 가능한 행동들을 우선순위 순서로 반환
   */
  public getAvailableActions(): GeneralActionType[] {
    return this.priority.filter((action) => this.canPerform(action));
  }
}
