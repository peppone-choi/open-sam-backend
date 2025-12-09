/**
 * PlanetaryGovernmentService - 동맹 행성 자치정부 시스템
 * 커스텀 확장 (매뉴얼 외 기능)
 *
 * 주요 기능:
 * - 행성 자치정부 관리
 * - 지사 선거/임명
 * - 지방 예산 관리
 * - 행성방위대 관리
 *
 * 적용 대상: 자유행성동맹 (동맹)
 */

import { EventEmitter } from 'events';
import { Gin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

/**
 * 지사 상태
 */
export enum GovernorStatus {
  ACTIVE = 'ACTIVE',         // 재임 중
  SUSPENDED = 'SUSPENDED',   // 정직
  IMPEACHED = 'IMPEACHED',   // 탄핵
  RESIGNED = 'RESIGNED',     // 사임
  TERM_ENDED = 'TERM_ENDED', // 임기 만료
}

/**
 * 행성방위대 인터페이스
 */
export interface PlanetaryDefenseForce {
  ships: number;             // 방위함 수
  troops: number;            // 지상 병력
  morale: number;            // 사기 (0-100)
  training: number;          // 훈련도 (0-100)
  maintenanceCost: number;   // 월 유지비
  loyalty: 'GOVERNMENT' | 'GOVERNOR' | 'NEUTRAL'; // 충성 대상
}

/**
 * 행성 자치정부 인터페이스
 */
export interface PlanetaryGovernment {
  governmentId: string;
  sessionId: string;
  planetId: string;
  planetName: string;

  // 지사 정보
  governorId: string | null;
  governorName: string | null;
  governorStatus: GovernorStatus;
  electedAt: Date | null;
  termEndDate: Date | null;   // 임기 종료일

  // 정치 지표
  approvalRating: number;     // 지지율 (0-100)
  stability: number;          // 안정성 (0-100)
  corruption: number;         // 부패도 (0-100)

  // 예산
  localBudget: number;        // 지방 예산
  federalGrant: number;       // 연방 교부금
  localTaxRevenue: number;    // 지방세 수입
  expenditure: number;        // 지출

  // 행성방위대
  defenseForce: PlanetaryDefenseForce;

  // 인구/경제
  population: number;
  gdp: number;

  // 메타
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 선거 결과 인터페이스
 */
export interface ElectionResult {
  electionId: string;
  planetId: string;
  electionType: 'REGULAR' | 'SPECIAL'; // 정기/보궐
  candidates: Array<{
    characterId: string;
    characterName: string;
    votes: number;
    votePercentage: number;
  }>;
  winnerId: string;
  winnerName: string;
  totalVoters: number;
  turnout: number;            // 투표율
  heldAt: Date;
}

/**
 * 상수
 */
const GOVERNMENT_CONSTANTS = {
  // 지사 임기 (게임 내 년)
  GOVERNOR_TERM_YEARS: 4,
  // 방위대 최대 규모 (인구 100만당)
  DEFENSE_SHIPS_PER_1M: 5,
  DEFENSE_TROOPS_PER_1M: 500,
  // 연방 교부금 기준 (인구 100만당)
  FEDERAL_GRANT_PER_1M: 1000,
  // 지방세율 기준
  LOCAL_TAX_RATE: 0.1,
  // 방위대 유지비 (함선당, 병력당)
  SHIP_MAINTENANCE: 30,
  TROOP_MAINTENANCE: 0.5,
};

/**
 * PlanetaryGovernmentService 클래스
 */
export class PlanetaryGovernmentService extends EventEmitter {
  private static instance: PlanetaryGovernmentService;

  // 자치정부 저장소 (planetId -> Government)
  private governments: Map<string, PlanetaryGovernment> = new Map();
  // 선거 기록
  private electionHistory: Map<string, ElectionResult[]> = new Map();

  private constructor() {
    super();
    logger.info('[PlanetaryGovernmentService] Initialized');
  }

  public static getInstance(): PlanetaryGovernmentService {
    if (!PlanetaryGovernmentService.instance) {
      PlanetaryGovernmentService.instance = new PlanetaryGovernmentService();
    }
    return PlanetaryGovernmentService.instance;
  }

  // ==================== 자치정부 생성/관리 ====================

  /**
   * 행성 자치정부 초기화
   */
  public initializeGovernment(
    sessionId: string,
    planetId: string,
    planetName: string,
    population: number,
    gdp: number,
  ): PlanetaryGovernment {
    const governmentId = `PGOV-${planetId}-${Date.now()}`;
    const now = new Date();

    // 방위대 규모 계산
    const maxShips = Math.floor((population / 1000000) * GOVERNMENT_CONSTANTS.DEFENSE_SHIPS_PER_1M);
    const maxTroops = Math.floor((population / 1000000) * GOVERNMENT_CONSTANTS.DEFENSE_TROOPS_PER_1M);

    const government: PlanetaryGovernment = {
      governmentId,
      sessionId,
      planetId,
      planetName,
      governorId: null,
      governorName: null,
      governorStatus: GovernorStatus.TERM_ENDED,
      electedAt: null,
      termEndDate: null,
      approvalRating: 50,
      stability: 50,
      corruption: 20,
      localBudget: 0,
      federalGrant: Math.floor((population / 1000000) * GOVERNMENT_CONSTANTS.FEDERAL_GRANT_PER_1M),
      localTaxRevenue: Math.floor(gdp * GOVERNMENT_CONSTANTS.LOCAL_TAX_RATE),
      expenditure: 0,
      defenseForce: {
        ships: Math.floor(maxShips * 0.5), // 초기 50%
        troops: Math.floor(maxTroops * 0.5),
        morale: 50,
        training: 50,
        maintenanceCost: 0,
        loyalty: 'GOVERNMENT',
      },
      population,
      gdp,
      createdAt: now,
      updatedAt: now,
    };

    // 유지비 계산
    government.defenseForce.maintenanceCost = this.calculateDefenseMaintenanceCost(government.defenseForce);

    this.governments.set(planetId, government);
    this.electionHistory.set(planetId, []);

    logger.info(`[PlanetaryGovernmentService] Government initialized for ${planetName}`);

    return government;
  }

  // ==================== 지사 선거 ====================

  /**
   * 지사 선거 실시
   */
  public async holdElection(
    sessionId: string,
    planetId: string,
    candidateIds: string[],
    electionType: 'REGULAR' | 'SPECIAL' = 'REGULAR',
  ): Promise<ElectionResult | null> {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) {
      logger.warn(`[PlanetaryGovernmentService] Government not found: ${planetId}`);
      return null;
    }

    if (candidateIds.length === 0) {
      logger.warn(`[PlanetaryGovernmentService] No candidates for election: ${planetId}`);
      return null;
    }

    // 후보자 정보 조회
    const candidates = await Promise.all(
      candidateIds.map(async (id) => {
        const character = await Gin7Character.findOne({ sessionId, characterId: id });
        return {
          characterId: id,
          characterName: character?.name || 'Unknown',
          charm: character?.stats?.charm || 50,
          politics: character?.stats?.politics || 50,
        };
      })
    );

    // 득표 계산 (매력 + 정치력 + 랜덤)
    const totalVoters = Math.floor(government.population * 0.6); // 투표율 60% 가정
    let remainingVotes = totalVoters;
    const results = candidates.map((c, index) => {
      const baseScore = c.charm + c.politics;
      const randomFactor = Math.random() * 30;
      const score = baseScore + randomFactor;
      return { ...c, score, votes: 0 };
    });

    // 점수 비례 배분
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    results.forEach((r) => {
      r.votes = Math.floor((r.score / totalScore) * totalVoters);
    });

    // 정렬 (득표순)
    results.sort((a, b) => b.votes - a.votes);

    const electionId = `ELEC-${planetId}-${Date.now()}`;
    const winner = results[0];

    const electionResult: ElectionResult = {
      electionId,
      planetId,
      electionType,
      candidates: results.map((r) => ({
        characterId: r.characterId,
        characterName: r.characterName,
        votes: r.votes,
        votePercentage: (r.votes / totalVoters) * 100,
      })),
      winnerId: winner.characterId,
      winnerName: winner.characterName,
      totalVoters,
      turnout: 60,
      heldAt: new Date(),
    };

    // 당선자 지사 임명
    await this.appointGovernor(sessionId, planetId, winner.characterId, winner.characterName);

    // 선거 기록 저장
    const history = this.electionHistory.get(planetId) || [];
    history.push(electionResult);
    this.electionHistory.set(planetId, history);

    this.emit('ELECTION_HELD', {
      sessionId,
      planetId,
      electionResult,
    });

    logger.info(`[PlanetaryGovernmentService] Election held: ${winner.characterName} elected as governor of ${government.planetName}`);

    return electionResult;
  }

  /**
   * 지사 임명 (선거 당선 또는 임명)
   */
  public async appointGovernor(
    sessionId: string,
    planetId: string,
    characterId: string,
    characterName: string,
  ): Promise<boolean> {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return false;

    const now = new Date();
    const termEnd = new Date(now);
    termEnd.setFullYear(termEnd.getFullYear() + GOVERNMENT_CONSTANTS.GOVERNOR_TERM_YEARS);

    government.governorId = characterId;
    government.governorName = characterName;
    government.governorStatus = GovernorStatus.ACTIVE;
    government.electedAt = now;
    government.termEndDate = termEnd;
    government.updatedAt = now;

    // 초기 지지율
    government.approvalRating = 55;

    this.emit('GOVERNOR_APPOINTED', {
      sessionId,
      planetId,
      governorId: characterId,
      governorName: characterName,
      termEndDate: termEnd,
    });

    return true;
  }

  /**
   * 지사 해임/사임
   */
  public removeGovernor(
    sessionId: string,
    planetId: string,
    reason: 'IMPEACHED' | 'RESIGNED' | 'SUSPENDED',
  ): boolean {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return false;

    const previousGovernor = government.governorId;
    government.governorId = null;
    government.governorName = null;
    government.governorStatus = reason === 'IMPEACHED' ? GovernorStatus.IMPEACHED :
                                reason === 'RESIGNED' ? GovernorStatus.RESIGNED :
                                GovernorStatus.SUSPENDED;
    government.updatedAt = new Date();

    this.emit('GOVERNOR_REMOVED', {
      sessionId,
      planetId,
      previousGovernorId: previousGovernor,
      reason,
    });

    logger.info(`[PlanetaryGovernmentService] Governor removed from ${government.planetName}: ${reason}`);

    return true;
  }

  // ==================== 예산 관리 ====================

  /**
   * 연방 교부금 배정
   */
  public allocateFederalGrant(
    sessionId: string,
    planetId: string,
    amount: number,
  ): boolean {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return false;

    government.federalGrant = amount;
    government.localBudget += amount;
    government.updatedAt = new Date();

    this.emit('FEDERAL_GRANT_ALLOCATED', {
      sessionId,
      planetId,
      amount,
      newBudget: government.localBudget,
    });

    return true;
  }

  /**
   * 지방세 징수 (월간)
   */
  public collectLocalTax(sessionId: string, planetId: string): number {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return 0;

    const taxRevenue = Math.floor(government.gdp * GOVERNMENT_CONSTANTS.LOCAL_TAX_RATE);
    government.localTaxRevenue = taxRevenue;
    government.localBudget += taxRevenue;
    government.updatedAt = new Date();

    return taxRevenue;
  }

  /**
   * 예산 지출
   */
  public spendBudget(
    sessionId: string,
    planetId: string,
    amount: number,
    purpose: string,
  ): boolean {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return false;

    if (government.localBudget < amount) {
      return false;
    }

    government.localBudget -= amount;
    government.expenditure += amount;
    government.updatedAt = new Date();

    this.emit('BUDGET_SPENT', {
      sessionId,
      planetId,
      amount,
      purpose,
      remainingBudget: government.localBudget,
    });

    return true;
  }

  // ==================== 행성방위대 ====================

  /**
   * 방위대 충원
   */
  public reinforceDefenseForce(
    sessionId: string,
    planetId: string,
    ships: number,
    troops: number,
  ): boolean {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return false;

    // 한도 계산
    const maxShips = Math.floor(
      (government.population / 1000000) * GOVERNMENT_CONSTANTS.DEFENSE_SHIPS_PER_1M
    );
    const maxTroops = Math.floor(
      (government.population / 1000000) * GOVERNMENT_CONSTANTS.DEFENSE_TROOPS_PER_1M
    );

    const newShips = Math.min(government.defenseForce.ships + ships, maxShips);
    const newTroops = Math.min(government.defenseForce.troops + troops, maxTroops);

    government.defenseForce.ships = newShips;
    government.defenseForce.troops = newTroops;
    government.defenseForce.maintenanceCost = this.calculateDefenseMaintenanceCost(government.defenseForce);
    government.updatedAt = new Date();

    this.emit('DEFENSE_REINFORCED', {
      sessionId,
      planetId,
      ships: newShips,
      troops: newTroops,
    });

    return true;
  }

  /**
   * 방위대 충성 변경 (쿠데타 시)
   */
  public setDefenseLoyalty(
    sessionId: string,
    planetId: string,
    loyalty: 'GOVERNMENT' | 'GOVERNOR' | 'NEUTRAL',
  ): boolean {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return false;

    government.defenseForce.loyalty = loyalty;
    government.updatedAt = new Date();

    this.emit('DEFENSE_LOYALTY_CHANGED', {
      sessionId,
      planetId,
      loyalty,
    });

    logger.info(`[PlanetaryGovernmentService] Defense loyalty changed to ${loyalty} on ${government.planetName}`);

    return true;
  }

  /**
   * 방위대 유지비 계산
   */
  private calculateDefenseMaintenanceCost(force: PlanetaryDefenseForce): number {
    return (force.ships * GOVERNMENT_CONSTANTS.SHIP_MAINTENANCE) +
           (force.troops * GOVERNMENT_CONSTANTS.TROOP_MAINTENANCE);
  }

  // ==================== 정치 지표 ====================

  /**
   * 지지율 변동
   */
  public adjustApprovalRating(
    sessionId: string,
    planetId: string,
    delta: number,
    reason: string,
  ): number {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return 0;

    const oldRating = government.approvalRating;
    government.approvalRating = Math.max(0, Math.min(100, oldRating + delta));
    government.updatedAt = new Date();

    this.emit('APPROVAL_RATING_CHANGED', {
      sessionId,
      planetId,
      oldRating,
      newRating: government.approvalRating,
      reason,
    });

    return government.approvalRating;
  }

  /**
   * 안정성 변동
   */
  public adjustStability(
    sessionId: string,
    planetId: string,
    delta: number,
  ): number {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return 0;

    government.stability = Math.max(0, Math.min(100, government.stability + delta));
    government.updatedAt = new Date();

    return government.stability;
  }

  // ==================== CHECKLIST C: 지지율/치안 감소 API ====================

  /**
   * 지지율 감소 (SpyService 선동 등에서 사용)
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param amount 감소량 (양수 값으로 전달, 내부에서 음수로 처리)
   * @param reason 감소 사유 (로그/이벤트용)
   * @returns 변경 후 지지율 (실패 시 -1)
   * 
   * 사용 예시:
   * const newRating = await planetaryGovernmentService.decreaseSupport('session1', 'planet1', 10, '첩보 선동 활동');
   * if (newRating >= 0) { logger.info(`지지율 감소: ${newRating}%`); }
   */
  public decreaseSupport(
    sessionId: string,
    planetId: string,
    amount: number,
    reason: string = '외부 요인'
  ): number {
    if (amount <= 0) {
      logger.warn(`[PlanetaryGovernmentService] decreaseSupport: amount must be positive, got ${amount}`);
      return -1;
    }

    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) {
      logger.warn(`[PlanetaryGovernmentService] Government not found for planet: ${planetId}`);
      return -1;
    }

    const oldRating = government.approvalRating;
    // 지지율은 0 ~ 100 범위로 제한
    government.approvalRating = Math.max(0, Math.min(100, oldRating - amount));
    government.updatedAt = new Date();

    // 지지율 변동 이벤트 발행
    this.emit('SUPPORT_DECREASED', {
      sessionId,
      planetId,
      oldRating,
      newRating: government.approvalRating,
      amount,
      reason
    });

    logger.info(`[PlanetaryGovernmentService] Support decreased on ${government.planetName}: ${oldRating} -> ${government.approvalRating} (reason: ${reason})`);

    // 지지율이 낮아지면 안정성에도 영향
    if (government.approvalRating < 30 && oldRating >= 30) {
      // 지지율 30% 이하로 떨어지면 안정성도 감소
      this.adjustStability(sessionId, planetId, -5);
      logger.info(`[PlanetaryGovernmentService] Stability also decreased due to low support`);
    }

    return government.approvalRating;
  }

  /**
   * 치안 감소 (폭동/첩보 활동 등에서 사용)
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param amount 감소량 (양수 값으로 전달)
   * @param reason 감소 사유 (로그/이벤트용)
   * @returns { newPublicOrder: 변경 후 치안, riotTriggered: 폭동 발생 여부 }
   * 
   * 사용 예시:
   * const result = await planetaryGovernmentService.decreasePublicOrder('session1', 'planet1', 15, '사보타주');
   * if (result.riotTriggered) { logger.warn('폭동 임계값 도달!'); }
   */
  public decreasePublicOrder(
    sessionId: string,
    planetId: string,
    amount: number,
    reason: string = '외부 요인'
  ): { newPublicOrder: number; riotTriggered: boolean; riotLevel?: 'unrest' | 'protest' | 'riot' } {
    if (amount <= 0) {
      logger.warn(`[PlanetaryGovernmentService] decreasePublicOrder: amount must be positive, got ${amount}`);
      return { newPublicOrder: -1, riotTriggered: false };
    }

    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) {
      logger.warn(`[PlanetaryGovernmentService] Government not found for planet: ${planetId}`);
      return { newPublicOrder: -1, riotTriggered: false };
    }

    const oldStability = government.stability;
    // 안정성(치안)은 0 ~ 100 범위로 제한
    government.stability = Math.max(0, Math.min(100, oldStability - amount));
    government.updatedAt = new Date();

    // 폭동 임계값 체크
    let riotTriggered = false;
    let riotLevel: 'unrest' | 'protest' | 'riot' | undefined;

    // 치안 임계값에 따른 폭동 레벨 결정
    // 40 이하: 불안, 25 이하: 시위, 10 이하: 폭동
    if (government.stability <= 10 && oldStability > 10) {
      riotTriggered = true;
      riotLevel = 'riot';
      logger.warn(`[PlanetaryGovernmentService] RIOT triggered on ${government.planetName}! Stability: ${government.stability}`);
    } else if (government.stability <= 25 && oldStability > 25) {
      riotTriggered = true;
      riotLevel = 'protest';
      logger.warn(`[PlanetaryGovernmentService] PROTEST triggered on ${government.planetName}! Stability: ${government.stability}`);
    } else if (government.stability <= 40 && oldStability > 40) {
      riotTriggered = true;
      riotLevel = 'unrest';
      logger.info(`[PlanetaryGovernmentService] UNREST triggered on ${government.planetName}! Stability: ${government.stability}`);
    }

    // 치안 변동 이벤트 발행
    this.emit('PUBLIC_ORDER_DECREASED', {
      sessionId,
      planetId,
      planetName: government.planetName,
      oldStability,
      newStability: government.stability,
      amount,
      reason,
      riotTriggered,
      riotLevel
    });

    // 폭동 발생 시 별도 이벤트 발행 (다른 시스템에서 후속 처리 가능)
    if (riotTriggered && riotLevel) {
      this.emit('RIOT_THRESHOLD_REACHED', {
        sessionId,
        planetId,
        planetName: government.planetName,
        riotLevel,
        currentStability: government.stability,
        reason
      });
    }

    logger.info(`[PlanetaryGovernmentService] Public order decreased on ${government.planetName}: ${oldStability} -> ${government.stability} (reason: ${reason})`);

    return {
      newPublicOrder: government.stability,
      riotTriggered,
      riotLevel
    };
  }

  /**
   * 지지율 증가 (복지/선전 등에서 사용)
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param amount 증가량 (양수 값)
   * @param reason 증가 사유
   * @returns 변경 후 지지율
   */
  public increaseSupport(
    sessionId: string,
    planetId: string,
    amount: number,
    reason: string = '정책 효과'
  ): number {
    if (amount <= 0) {
      logger.warn(`[PlanetaryGovernmentService] increaseSupport: amount must be positive`);
      return -1;
    }

    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return -1;

    const oldRating = government.approvalRating;
    government.approvalRating = Math.max(0, Math.min(100, oldRating + amount));
    government.updatedAt = new Date();

    this.emit('SUPPORT_INCREASED', {
      sessionId,
      planetId,
      oldRating,
      newRating: government.approvalRating,
      amount,
      reason
    });

    return government.approvalRating;
  }

  /**
   * 치안 증가 (경찰력 배치 등에서 사용)
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param amount 증가량 (양수 값)
   * @param reason 증가 사유
   * @returns 변경 후 치안
   */
  public increasePublicOrder(
    sessionId: string,
    planetId: string,
    amount: number,
    reason: string = '치안 강화'
  ): number {
    if (amount <= 0) {
      logger.warn(`[PlanetaryGovernmentService] increasePublicOrder: amount must be positive`);
      return -1;
    }

    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return -1;

    const oldStability = government.stability;
    government.stability = Math.max(0, Math.min(100, oldStability + amount));
    government.updatedAt = new Date();

    this.emit('PUBLIC_ORDER_INCREASED', {
      sessionId,
      planetId,
      oldStability,
      newStability: government.stability,
      amount,
      reason
    });

    return government.stability;
  }

  /**
   * 현재 폭동 위험 수준 조회
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @returns 폭동 위험 정보
   */
  public getRiotRisk(
    sessionId: string,
    planetId: string
  ): { riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'; stability: number; support: number } | null {
    const government = this.governments.get(planetId);
    if (!government || government.sessionId !== sessionId) return null;

    // 복합 지표로 위험 수준 계산
    const combinedScore = (government.stability + government.approvalRating) / 2;
    
    let riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    if (combinedScore > 70) {
      riskLevel = 'none';
    } else if (combinedScore > 50) {
      riskLevel = 'low';
    } else if (combinedScore > 30) {
      riskLevel = 'medium';
    } else if (combinedScore > 15) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    return {
      riskLevel,
      stability: government.stability,
      support: government.approvalRating
    };
  }

  // ==================== 조회 ====================

  /**
   * 자치정부 조회
   */
  public getGovernment(planetId: string): PlanetaryGovernment | undefined {
    return this.governments.get(planetId);
  }

  /**
   * 세션 내 모든 자치정부 조회
   */
  public getSessionGovernments(sessionId: string): PlanetaryGovernment[] {
    return Array.from(this.governments.values()).filter(g => g.sessionId === sessionId);
  }

  /**
   * 특정 지사의 관할 행성 조회
   */
  public getGovernorPlanets(sessionId: string, governorId: string): PlanetaryGovernment[] {
    return Array.from(this.governments.values()).filter(
      g => g.sessionId === sessionId && g.governorId === governorId
    );
  }

  /**
   * 선거 기록 조회
   */
  public getElectionHistory(planetId: string): ElectionResult[] {
    return this.electionHistory.get(planetId) || [];
  }

  /**
   * 정부군 지지 행성 조회 (쿠데타 시)
   */
  public getGovernmentLoyalPlanets(sessionId: string): PlanetaryGovernment[] {
    return Array.from(this.governments.values()).filter(
      g => g.sessionId === sessionId && g.defenseForce.loyalty === 'GOVERNMENT'
    );
  }

  /**
   * 쿠데타 지지 행성 조회
   */
  public getNeutralOrDisloyal(sessionId: string): PlanetaryGovernment[] {
    return Array.from(this.governments.values()).filter(
      g => g.sessionId === sessionId && g.defenseForce.loyalty !== 'GOVERNMENT'
    );
  }
}

export const planetaryGovernmentService = PlanetaryGovernmentService.getInstance();
export default PlanetaryGovernmentService;





