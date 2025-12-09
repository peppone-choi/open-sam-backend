/**
 * HiddenVictoryService - 숨겨진 승리 조건 시스템
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 제3세력(페잔, 지구교)의 비밀 승리 조건을 관리합니다.
 *
 * 승리 조건:
 * 1. 페잔 경제 패권 - 양 진영 경제의 과반 장악
 * 2. 지구교 암약 - 양 진영 최고 권력자 암살/조종
 * 3. 균형의 파괴 - 양 진영이 공멸하도록 유도
 *
 * 원작 배경:
 * - 페잔: 상업 국가, 양 진영 사이에서 이익 추구
 * - 지구교: 고대 지구의 영광 회복을 꿈꾸는 비밀 종교 조직
 */

import { EventEmitter } from 'events';
import { logger } from '../../common/logger';

/**
 * 숨겨진 세력 타입
 */
export enum HiddenFaction {
  FEZZAN = 'FEZZAN',           // 자치령 페잔
  TERRA_CULT = 'TERRA_CULT',   // 지구교
}

/**
 * 승리 조건 타입
 */
export enum HiddenVictoryType {
  // 페잔 승리 조건
  ECONOMIC_HEGEMONY = 'ECONOMIC_HEGEMONY',       // 경제 패권
  BALANCE_OF_POWER = 'BALANCE_OF_POWER',         // 세력 균형 유지 (양 진영 지속적 소모전)
  DUAL_DEPENDENCY = 'DUAL_DEPENDENCY',           // 양 진영 모두 페잔 의존

  // 지구교 승리 조건
  SHADOW_CONTROL = 'SHADOW_CONTROL',             // 양 진영 수뇌부 조종
  TERRA_RESTORATION = 'TERRA_RESTORATION',       // 지구 복권 (지구 탈환)
  MUTUAL_DESTRUCTION = 'MUTUAL_DESTRUCTION',     // 상호 파멸 유도
}

/**
 * 페잔 경제 영향력 인터페이스
 */
export interface FezzanEconomicInfluence {
  sessionId: string;

  // 제국 영향력
  imperialDebtTotal: number;           // 제국 총 부채
  imperialInvestmentTotal: number;     // 제국 내 투자 총액
  imperialDevelopmentProjects: number; // 제국 개발 프로젝트 수
  imperialCorruptedOfficials: number;  // 매수한 제국 관료 수

  // 동맹 영향력
  allianceDebtTotal: number;           // 동맹 총 부채
  allianceInvestmentTotal: number;     // 동맹 내 투자 총액
  allianceDevelopmentProjects: number; // 동맹 개발 프로젝트 수
  allianceCorruptedPoliticians: number; // 매수한 동맹 정치인 수

  // 전체 경제 지표
  galaxyGdpShare: number;              // 은하 GDP 점유율 (0-100)
  tradeRouteControl: number;           // 교역로 장악률 (0-100)

  // 승리 진행도
  economicHegemonyProgress: number;    // 경제 패권 진행도 (0-100)
  dualDependencyProgress: number;      // 양 진영 의존 진행도 (0-100)

  lastUpdatedAt: Date;
}

/**
 * 지구교 암약 상태 인터페이스
 */
export interface TerraCultInfluence {
  sessionId: string;

  // 침투 현황
  imperialInfiltrators: string[];      // 제국 내 공작원 캐릭터 ID
  allianceInfiltrators: string[];      // 동맹 내 공작원 캐릭터 ID
  fezzanInfiltrators: string[];        // 페잔 내 공작원 캐릭터 ID

  // 암살/조종 대상
  controlledCharacters: Array<{
    characterId: string;
    faction: string;
    controlType: 'BLACKMAIL' | 'BRAINWASH' | 'DEBT' | 'IDEOLOGY';
    controlStrength: number;           // 0-100
  }>;

  // 주요 공작 현황
  assassinationAttempts: Array<{
    targetId: string;
    targetName: string;
    success: boolean;
    date: Date;
  }>;

  // 비밀 자금
  secretFunds: number;

  // 승리 진행도
  shadowControlProgress: number;       // 암흑 지배 진행도 (0-100)
  terraRestorationProgress: number;    // 지구 복권 진행도 (0-100)
  mutualDestructionProgress: number;   // 상호 파멸 진행도 (0-100)

  lastUpdatedAt: Date;
}

/**
 * 승리 조건 임계값
 */
const VICTORY_THRESHOLDS = {
  // 페잔 승리 조건
  ECONOMIC_HEGEMONY: {
    minGdpShare: 40,                   // 은하 GDP 40% 이상
    minDebtControl: 50,                // 양 진영 총부채 대비 50% 이상 보유
    minInvestmentShare: 30,            // 양 진영 산업 투자 30% 이상
  },
  DUAL_DEPENDENCY: {
    minImperialDebt: 1000000,          // 제국 부채 최소 100만
    minAllianceDebt: 1000000,          // 동맹 부채 최소 100만
    minCorruptedOfficials: 10,         // 매수한 관료/정치인 총 10명 이상
  },

  // 지구교 승리 조건
  SHADOW_CONTROL: {
    minControlledLeaders: 2,           // 양 진영 지도부 2명 이상 조종
    minInfiltrators: 20,               // 총 침투 공작원 20명 이상
  },
  MUTUAL_DESTRUCTION: {
    minImperialLoss: 60,               // 제국 전력 60% 이상 손실
    minAllianceLoss: 60,               // 동맹 전력 60% 이상 손실
  },
};

/**
 * HiddenVictoryService 클래스
 */
export class HiddenVictoryService extends EventEmitter {
  private static instance: HiddenVictoryService;

  // 세션별 영향력 상태
  private fezzanInfluence: Map<string, FezzanEconomicInfluence> = new Map();
  private terraCultInfluence: Map<string, TerraCultInfluence> = new Map();

  // 승리 여부
  private victoryAchieved: Map<string, {
    faction: HiddenFaction;
    victoryType: HiddenVictoryType;
    achievedAt: Date;
  }> = new Map();

  private constructor() {
    super();
    logger.info('[HiddenVictoryService] Initialized');
  }

  public static getInstance(): HiddenVictoryService {
    if (!HiddenVictoryService.instance) {
      HiddenVictoryService.instance = new HiddenVictoryService();
    }
    return HiddenVictoryService.instance;
  }

  // ==================== 초기화 ====================

  /**
   * 세션 초기화
   */
  public initializeSession(sessionId: string): void {
    // 페잔 영향력 초기화
    this.fezzanInfluence.set(sessionId, {
      sessionId,
      imperialDebtTotal: 0,
      imperialInvestmentTotal: 0,
      imperialDevelopmentProjects: 0,
      imperialCorruptedOfficials: 0,
      allianceDebtTotal: 0,
      allianceInvestmentTotal: 0,
      allianceDevelopmentProjects: 0,
      allianceCorruptedPoliticians: 0,
      galaxyGdpShare: 15, // 초기 15%
      tradeRouteControl: 80, // 교역로 80% 장악 (원작 설정)
      economicHegemonyProgress: 0,
      dualDependencyProgress: 0,
      lastUpdatedAt: new Date(),
    });

    // 지구교 영향력 초기화
    this.terraCultInfluence.set(sessionId, {
      sessionId,
      imperialInfiltrators: [],
      allianceInfiltrators: [],
      fezzanInfiltrators: [],
      controlledCharacters: [],
      assassinationAttempts: [],
      secretFunds: 100000, // 초기 비밀 자금
      shadowControlProgress: 0,
      terraRestorationProgress: 0,
      mutualDestructionProgress: 0,
      lastUpdatedAt: new Date(),
    });

    logger.info(`[HiddenVictoryService] Session ${sessionId} initialized`);
  }

  // ==================== 페잔 영향력 ====================

  /**
   * 페잔 대출 기록 (FezzanFinancialService 연동)
   */
  public recordFezzanLoan(
    sessionId: string,
    faction: 'IMPERIAL' | 'ALLIANCE',
    amount: number,
  ): void {
    const influence = this.fezzanInfluence.get(sessionId);
    if (!influence) return;

    if (faction === 'IMPERIAL') {
      influence.imperialDebtTotal += amount;
    } else {
      influence.allianceDebtTotal += amount;
    }

    influence.lastUpdatedAt = new Date();
    this.updateFezzanVictoryProgress(sessionId);
  }

  /**
   * 페잔 투자 기록
   */
  public recordFezzanInvestment(
    sessionId: string,
    faction: 'IMPERIAL' | 'ALLIANCE',
    amount: number,
    projectCount: number = 1,
  ): void {
    const influence = this.fezzanInfluence.get(sessionId);
    if (!influence) return;

    if (faction === 'IMPERIAL') {
      influence.imperialInvestmentTotal += amount;
      influence.imperialDevelopmentProjects += projectCount;
    } else {
      influence.allianceInvestmentTotal += amount;
      influence.allianceDevelopmentProjects += projectCount;
    }

    influence.lastUpdatedAt = new Date();
    this.updateFezzanVictoryProgress(sessionId);
  }

  /**
   * 페잔 관료/정치인 매수 기록
   */
  public recordCorruption(
    sessionId: string,
    faction: 'IMPERIAL' | 'ALLIANCE',
    characterId: string,
  ): void {
    const influence = this.fezzanInfluence.get(sessionId);
    if (!influence) return;

    if (faction === 'IMPERIAL') {
      influence.imperialCorruptedOfficials++;
    } else {
      influence.allianceCorruptedPoliticians++;
    }

    influence.lastUpdatedAt = new Date();
    this.updateFezzanVictoryProgress(sessionId);

    this.emit('CORRUPTION_RECORDED', {
      sessionId,
      faction,
      characterId,
    });
  }

  /**
   * 페잔 GDP 점유율 업데이트
   */
  public updateGdpShare(sessionId: string, newShare: number): void {
    const influence = this.fezzanInfluence.get(sessionId);
    if (!influence) return;

    influence.galaxyGdpShare = Math.min(100, Math.max(0, newShare));
    influence.lastUpdatedAt = new Date();
    this.updateFezzanVictoryProgress(sessionId);
  }

  /**
   * 페잔 승리 진행도 업데이트
   */
  private updateFezzanVictoryProgress(sessionId: string): void {
    const influence = this.fezzanInfluence.get(sessionId);
    if (!influence) return;

    // 경제 패권 진행도
    const gdpProgress = (influence.galaxyGdpShare / VICTORY_THRESHOLDS.ECONOMIC_HEGEMONY.minGdpShare) * 100;
    const tradeProgress = (influence.tradeRouteControl / 100) * 100;
    influence.economicHegemonyProgress = Math.min(100, (gdpProgress + tradeProgress) / 2);

    // 양 진영 의존 진행도
    const imperialDependency = Math.min(100,
      (influence.imperialDebtTotal / VICTORY_THRESHOLDS.DUAL_DEPENDENCY.minImperialDebt) * 50 +
      (influence.imperialCorruptedOfficials / 5) * 50
    );
    const allianceDependency = Math.min(100,
      (influence.allianceDebtTotal / VICTORY_THRESHOLDS.DUAL_DEPENDENCY.minAllianceDebt) * 50 +
      (influence.allianceCorruptedPoliticians / 5) * 50
    );
    influence.dualDependencyProgress = Math.min(100, (imperialDependency + allianceDependency) / 2);

    // 승리 체크
    this.checkFezzanVictory(sessionId);
  }

  /**
   * 페잔 승리 조건 체크
   */
  private checkFezzanVictory(sessionId: string): void {
    const influence = this.fezzanInfluence.get(sessionId);
    if (!influence) return;

    // 이미 승리 달성 시 스킵
    if (this.victoryAchieved.has(sessionId)) return;

    // 경제 패권 체크
    if (influence.economicHegemonyProgress >= 100) {
      this.achieveVictory(sessionId, HiddenFaction.FEZZAN, HiddenVictoryType.ECONOMIC_HEGEMONY);
      return;
    }

    // 양 진영 의존 체크
    if (influence.dualDependencyProgress >= 100) {
      this.achieveVictory(sessionId, HiddenFaction.FEZZAN, HiddenVictoryType.DUAL_DEPENDENCY);
    }
  }

  // ==================== 지구교 영향력 ====================

  /**
   * 지구교 침투 공작원 추가
   */
  public addInfiltrator(
    sessionId: string,
    characterId: string,
    faction: 'IMPERIAL' | 'ALLIANCE' | 'FEZZAN',
  ): void {
    const influence = this.terraCultInfluence.get(sessionId);
    if (!influence) return;

    switch (faction) {
      case 'IMPERIAL':
        if (!influence.imperialInfiltrators.includes(characterId)) {
          influence.imperialInfiltrators.push(characterId);
        }
        break;
      case 'ALLIANCE':
        if (!influence.allianceInfiltrators.includes(characterId)) {
          influence.allianceInfiltrators.push(characterId);
        }
        break;
      case 'FEZZAN':
        if (!influence.fezzanInfiltrators.includes(characterId)) {
          influence.fezzanInfiltrators.push(characterId);
        }
        break;
    }

    influence.lastUpdatedAt = new Date();
    this.updateTerraCultVictoryProgress(sessionId);

    this.emit('INFILTRATOR_ADDED', {
      sessionId,
      characterId,
      faction,
    });
  }

  /**
   * 지구교 캐릭터 조종
   */
  public controlCharacter(
    sessionId: string,
    characterId: string,
    faction: string,
    controlType: 'BLACKMAIL' | 'BRAINWASH' | 'DEBT' | 'IDEOLOGY',
    controlStrength: number = 50,
  ): void {
    const influence = this.terraCultInfluence.get(sessionId);
    if (!influence) return;

    // 기존 조종 대상인지 확인
    const existing = influence.controlledCharacters.find(c => c.characterId === characterId);
    if (existing) {
      existing.controlStrength = Math.min(100, controlStrength);
      existing.controlType = controlType;
    } else {
      influence.controlledCharacters.push({
        characterId,
        faction,
        controlType,
        controlStrength,
      });
    }

    influence.lastUpdatedAt = new Date();
    this.updateTerraCultVictoryProgress(sessionId);

    this.emit('CHARACTER_CONTROLLED', {
      sessionId,
      characterId,
      faction,
      controlType,
      controlStrength,
    });

    logger.info(`[HiddenVictoryService] Terra Cult controls ${characterId} (${controlType}, ${controlStrength}%)`);
  }

  /**
   * 지구교 암살 시도
   */
  public attemptAssassination(
    sessionId: string,
    targetId: string,
    targetName: string,
    successRate: number = 30,
  ): { success: boolean } {
    const influence = this.terraCultInfluence.get(sessionId);
    if (!influence) return { success: false };

    const success = Math.random() * 100 < successRate;

    influence.assassinationAttempts.push({
      targetId,
      targetName,
      success,
      date: new Date(),
    });

    influence.lastUpdatedAt = new Date();

    this.emit('ASSASSINATION_ATTEMPTED', {
      sessionId,
      targetId,
      targetName,
      success,
    });

    if (success) {
      logger.warn(`[HiddenVictoryService] Terra Cult assassination successful: ${targetName}`);
      this.updateTerraCultVictoryProgress(sessionId);
    } else {
      logger.info(`[HiddenVictoryService] Terra Cult assassination failed: ${targetName}`);
    }

    return { success };
  }

  /**
   * 전쟁 피해 기록 (상호 파멸 조건용)
   */
  public recordWarDamage(
    sessionId: string,
    imperialLossPercentage: number,
    allianceLossPercentage: number,
  ): void {
    const influence = this.terraCultInfluence.get(sessionId);
    if (!influence) return;

    // 상호 파멸 진행도 계산
    const imperialProgress = Math.min(100,
      (imperialLossPercentage / VICTORY_THRESHOLDS.MUTUAL_DESTRUCTION.minImperialLoss) * 100
    );
    const allianceProgress = Math.min(100,
      (allianceLossPercentage / VICTORY_THRESHOLDS.MUTUAL_DESTRUCTION.minAllianceLoss) * 100
    );

    influence.mutualDestructionProgress = Math.min(imperialProgress, allianceProgress);
    influence.lastUpdatedAt = new Date();

    this.checkTerraCultVictory(sessionId);
  }

  /**
   * 지구교 승리 진행도 업데이트
   */
  private updateTerraCultVictoryProgress(sessionId: string): void {
    const influence = this.terraCultInfluence.get(sessionId);
    if (!influence) return;

    // 총 침투 공작원 수
    const totalInfiltrators =
      influence.imperialInfiltrators.length +
      influence.allianceInfiltrators.length +
      influence.fezzanInfiltrators.length;

    // 고위직 조종 대상 수
    const highLevelControlled = influence.controlledCharacters.filter(
      c => c.controlStrength >= 70
    ).length;

    // 암흑 지배 진행도
    const infiltratorProgress = Math.min(100,
      (totalInfiltrators / VICTORY_THRESHOLDS.SHADOW_CONTROL.minInfiltrators) * 50
    );
    const controlProgress = Math.min(100,
      (highLevelControlled / VICTORY_THRESHOLDS.SHADOW_CONTROL.minControlledLeaders) * 50
    );
    influence.shadowControlProgress = Math.min(100, infiltratorProgress + controlProgress);

    // 승리 체크
    this.checkTerraCultVictory(sessionId);
  }

  /**
   * 지구교 승리 조건 체크
   */
  private checkTerraCultVictory(sessionId: string): void {
    const influence = this.terraCultInfluence.get(sessionId);
    if (!influence) return;

    if (this.victoryAchieved.has(sessionId)) return;

    // 암흑 지배 체크
    if (influence.shadowControlProgress >= 100) {
      this.achieveVictory(sessionId, HiddenFaction.TERRA_CULT, HiddenVictoryType.SHADOW_CONTROL);
      return;
    }

    // 상호 파멸 체크
    if (influence.mutualDestructionProgress >= 100) {
      this.achieveVictory(sessionId, HiddenFaction.TERRA_CULT, HiddenVictoryType.MUTUAL_DESTRUCTION);
    }
  }

  // ==================== 승리 처리 ====================

  /**
   * 승리 달성
   */
  private achieveVictory(
    sessionId: string,
    faction: HiddenFaction,
    victoryType: HiddenVictoryType,
  ): void {
    this.victoryAchieved.set(sessionId, {
      faction,
      victoryType,
      achievedAt: new Date(),
    });

    this.emit('HIDDEN_VICTORY_ACHIEVED', {
      sessionId,
      faction,
      victoryType,
      message: this.getVictoryMessage(faction, victoryType),
    });

    logger.warn(`[HiddenVictoryService] *** HIDDEN VICTORY ACHIEVED ***`);
    logger.warn(`[HiddenVictoryService] Session: ${sessionId}`);
    logger.warn(`[HiddenVictoryService] Faction: ${faction}`);
    logger.warn(`[HiddenVictoryService] Victory Type: ${victoryType}`);
  }

  /**
   * 승리 메시지 생성
   */
  private getVictoryMessage(faction: HiddenFaction, victoryType: HiddenVictoryType): string {
    if (faction === HiddenFaction.FEZZAN) {
      switch (victoryType) {
        case HiddenVictoryType.ECONOMIC_HEGEMONY:
          return '페잔이 은하 경제를 완전히 장악했습니다. 제국과 동맹 모두 페잔 없이는 경제를 유지할 수 없게 되었습니다.';
        case HiddenVictoryType.DUAL_DEPENDENCY:
          return '제국과 동맹 모두 페잔에 깊이 의존하게 되었습니다. 페잔은 이제 양 진영의 실질적 지배자입니다.';
        case HiddenVictoryType.BALANCE_OF_POWER:
          return '페잔은 양 진영의 균형을 교묘히 유지하며 영원한 이익을 확보했습니다.';
      }
    } else {
      switch (victoryType) {
        case HiddenVictoryType.SHADOW_CONTROL:
          return '지구교가 양 진영의 핵심 인물들을 조종하여 은하계를 암흑에서 지배하게 되었습니다.';
        case HiddenVictoryType.MUTUAL_DESTRUCTION:
          return '제국과 동맹의 전쟁으로 인해 인류 문명이 붕괴했습니다. 지구교는 폐허에서 새로운 질서를 세울 것입니다.';
        case HiddenVictoryType.TERRA_RESTORATION:
          return '지구가 다시 인류 문명의 중심으로 복권되었습니다. 테라의 영광이 회복됩니다.';
      }
    }
    return '숨겨진 세력이 승리했습니다.';
  }

  // ==================== 조회 ====================

  /**
   * 페잔 영향력 조회
   */
  public getFezzanInfluence(sessionId: string): FezzanEconomicInfluence | undefined {
    return this.fezzanInfluence.get(sessionId);
  }

  /**
   * 지구교 영향력 조회
   */
  public getTerraCultInfluence(sessionId: string): TerraCultInfluence | undefined {
    return this.terraCultInfluence.get(sessionId);
  }

  /**
   * 승리 상태 조회
   */
  public getVictoryStatus(sessionId: string): {
    achieved: boolean;
    faction?: HiddenFaction;
    victoryType?: HiddenVictoryType;
    achievedAt?: Date;
  } {
    const victory = this.victoryAchieved.get(sessionId);
    if (!victory) {
      return { achieved: false };
    }
    return {
      achieved: true,
      ...victory,
    };
  }

  /**
   * 승리 진행도 요약 조회
   */
  public getVictoryProgressSummary(sessionId: string): {
    fezzan: {
      economicHegemony: number;
      dualDependency: number;
    };
    terraCult: {
      shadowControl: number;
      mutualDestruction: number;
    };
  } {
    const fezzanInf = this.fezzanInfluence.get(sessionId);
    const terraInf = this.terraCultInfluence.get(sessionId);

    return {
      fezzan: {
        economicHegemony: fezzanInf?.economicHegemonyProgress || 0,
        dualDependency: fezzanInf?.dualDependencyProgress || 0,
      },
      terraCult: {
        shadowControl: terraInf?.shadowControlProgress || 0,
        mutualDestruction: terraInf?.mutualDestructionProgress || 0,
      },
    };
  }
}

export const hiddenVictoryService = HiddenVictoryService.getInstance();
export default HiddenVictoryService;





