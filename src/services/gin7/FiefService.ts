/**
 * FiefService - 봉토(封土) 시스템 서비스
 * 매뉴얼 5280~5298행 기반
 *
 * 주요 기능:
 * - 봉토 수여 (封土授与): CP 640
 * - 봉토 직할령 전환 (封土直轄): CP 640
 * - 봉토 수입 계산
 * - 봉토 현황 조회
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { logger } from '../../common/logger';

/**
 * 봉토 경제 정보 인터페이스
 */
export interface FiefEconomy {
  population: number;        // 인구
  gdp: number;               // GDP (생산력)
  grossIncome: number;       // 총 수입
  imperialTribute: number;   // 황제 상납분
  armyMaintenance: number;   // 사병 유지비
  netIncome: number;         // 순수입 (귀족 몫)
  tributeRate: number;       // 상납률 (0.0 ~ 1.0)
  lastCalculatedAt: Date;
}

/**
 * 봉토 정보 인터페이스
 */
export interface FiefInfo {
  planetId: string;
  planetName: string;
  ownerId: string | null; // null이면 직할령
  ownerName?: string;
  grantedAt?: Date;
  annualIncome: number; // 연간 수입 (단순)
  
  // 확장 경제 정보
  economy?: FiefEconomy;
}

/**
 * 봉토 수여 결과
 */
export interface FiefGrantResult {
  success: boolean;
  error?: string;
  fief?: FiefInfo;
}

/**
 * 봉토 소유자 변경 이벤트 페이로드
 */
export interface FiefChangePayload {
  sessionId: string;
  planetId: string;
  previousOwnerId: string | null;
  newOwnerId: string | null;
  actionType: 'GRANT' | 'REVOKE';
  performedBy: string;
}

/**
 * 필요 작위 레벨 (남작 이상만 봉토 소유 가능)
 */
const FIEF_ELIGIBLE_TITLES = ['DUKE', 'MARQUIS', 'COUNT', 'VISCOUNT', 'BARON'];

/**
 * 봉토 관련 상수
 */
const FIEF_GRANT_CP_COST = 640;
const FIEF_REVOKE_CP_COST = 640;

/**
 * 봉토 경제 상수
 */
const FIEF_ECONOMY_CONSTANTS = {
  // 기본 상납률 (30%)
  DEFAULT_TRIBUTE_RATE: 0.30,
  // 최소 상납률 (특권 귀족)
  MIN_TRIBUTE_RATE: 0.15,
  // 최대 상납률 (불온 귀족)
  MAX_TRIBUTE_RATE: 0.50,
  // 인구 1000만당 기본 수입
  INCOME_PER_10M_POP: 10000,
  // GDP 계수
  GDP_MULTIPLIER: 0.1,
};

/**
 * FiefService 클래스
 */
export class FiefService extends EventEmitter {
  private static instance: FiefService;

  // 세션별 봉토 상태 관리
  private fiefRegistry: Map<string, Map<string, FiefInfo>> = new Map(); // sessionId -> (planetId -> FiefInfo)

  private constructor() {
    super();
    logger.info('[FiefService] Initialized');
  }

  public static getInstance(): FiefService {
    if (!FiefService.instance) {
      FiefService.instance = new FiefService();
    }
    return FiefService.instance;
  }

  /**
   * 세션 초기화 (시나리오 로드 시 호출)
   */
  public initializeSession(sessionId: string, initialFiefs: FiefInfo[]): void {
    const fiefMap = new Map<string, FiefInfo>();
    for (const fief of initialFiefs) {
      fiefMap.set(fief.planetId, fief);
    }
    this.fiefRegistry.set(sessionId, fiefMap);
    logger.info(`[FiefService] Session ${sessionId} initialized with ${initialFiefs.length} fiefs`);
  }

  /**
   * 세션 정리
   */
  public cleanupSession(sessionId: string): void {
    this.fiefRegistry.delete(sessionId);
    logger.info(`[FiefService] Session ${sessionId} cleaned up`);
  }

  /**
   * 봉토를 특정 캐릭터에게 수여합니다 (封土授与)
   * @param sessionId 세션 ID
   * @param granterId 수여자 캐릭터 ID (황제)
   * @param recipientId 수여받을 캐릭터 ID
   * @param planetId 봉토로 수여할 행성 ID
   * @returns 수여 결과
   */
  public async grantFief(
    sessionId: string,
    granterId: string,
    recipientId: string,
    planetId: string,
  ): Promise<FiefGrantResult> {
    try {
      // 1. 수여자 검증 (황제만 가능)
      const granter = await Gin7Character.findOne({ sessionId, characterId: granterId });
      if (!granter) {
        return { success: false, error: `수여자 캐릭터를 찾을 수 없습니다: ${granterId}` };
      }

      // 수여자가 황제 직위를 가지고 있는지 확인
      const granterPosition = granter.currentPosition as any;
      if (!granterPosition || (typeof granterPosition === 'object' ? granterPosition.positionId : granterPosition) !== 'EMPEROR') {
        return { success: false, error: '봉토 수여는 황제만 가능합니다.' };
      }

      // 2. 수여받을 캐릭터 검증
      const recipient = await Gin7Character.findOne({ sessionId, characterId: recipientId });
      if (!recipient) {
        return { success: false, error: `수여받을 캐릭터를 찾을 수 없습니다: ${recipientId}` };
      }

      // 3. 작위 검증 (남작 이상만 봉토 소유 가능)
      const recipientTitle = recipient.nobilityTitle as any;
      const titleId = typeof recipientTitle === 'object' ? recipientTitle?.id : recipientTitle;
      if (!recipientTitle || !FIEF_ELIGIBLE_TITLES.includes(titleId)) {
        return {
          success: false,
          error: '남작 이상의 작위를 가진 인물만 봉토를 소유할 수 있습니다.',
        };
      }

      // 4. CP 검증 및 차감
      const granterPcp = granter.commandPoints?.pcp || 0;
      if (granterPcp < FIEF_GRANT_CP_COST) {
        return {
          success: false,
          error: `CP가 부족합니다. 필요: ${FIEF_GRANT_CP_COST}, 보유: ${granterPcp}`,
        };
      }

      // 5. 행성 검증 (직할령인지 확인)
      const sessionFiefs = this.fiefRegistry.get(sessionId);
      if (!sessionFiefs) {
        return { success: false, error: '세션이 초기화되지 않았습니다.' };
      }

      const existingFief = sessionFiefs.get(planetId);
      if (existingFief && existingFief.ownerId !== null) {
        return {
          success: false,
          error: `이미 봉토로 수여된 행성입니다. 현재 소유자: ${existingFief.ownerName}`,
        };
      }

      // 6. CP 차감
      const existingCp = granter.commandPoints || { pcp: 0, mcp: 0, maxPcp: 100, maxMcp: 100, lastRecoveredAt: new Date() };
      granter.commandPoints = {
        ...existingCp,
        pcp: granterPcp - FIEF_GRANT_CP_COST,
        mcp: existingCp.mcp || 0,
      } as any;
      await granter.save();

      // 7. 봉토 등록
      const newFief: FiefInfo = {
        planetId,
        planetName: existingFief?.planetName || planetId,
        ownerId: recipientId,
        ownerName: recipient.name,
        grantedAt: new Date(),
        annualIncome: existingFief?.annualIncome || 1000, // 기본 수입
      };
      sessionFiefs.set(planetId, newFief);

      // 8. 캐릭터 봉토 목록 업데이트
      const recipientTitleObj = recipient.nobilityTitle as any;
      if (typeof recipientTitleObj === 'object') {
        if (!recipientTitleObj.fiefdoms) {
          recipientTitleObj.fiefdoms = [];
        }
        if (!recipientTitleObj.fiefdoms.includes(planetId)) {
          recipientTitleObj.fiefdoms.push(planetId);
          await recipient.save();
        }
      }

      // 9. 이벤트 발생
      const payload: FiefChangePayload = {
        sessionId,
        planetId,
        previousOwnerId: null,
        newOwnerId: recipientId,
        actionType: 'GRANT',
        performedBy: granterId,
      };
      this.emit('fief:granted', payload);

      logger.info(`[FiefService] Fief ${planetId} granted to ${recipientId} by ${granterId}`);
      return { success: true, fief: newFief };
    } catch (error) {
      logger.error(`[FiefService] Error granting fief: ${error}`);
      return { success: false, error: '봉토 수여 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 봉토를 직할령으로 회수합니다 (封土直轄)
   * @param sessionId 세션 ID
   * @param revokerId 회수자 캐릭터 ID (황제)
   * @param planetId 회수할 봉토 행성 ID
   * @returns 회수 결과
   */
  public async revokeFief(
    sessionId: string,
    revokerId: string,
    planetId: string,
  ): Promise<FiefGrantResult> {
    try {
      // 1. 회수자 검증 (황제만 가능)
      const revoker = await Gin7Character.findOne({ sessionId, characterId: revokerId });
      if (!revoker) {
        return { success: false, error: `회수자 캐릭터를 찾을 수 없습니다: ${revokerId}` };
      }

      const revokerPosition = revoker.currentPosition as any;
      if (!revokerPosition || (typeof revokerPosition === 'object' ? revokerPosition.positionId : revokerPosition) !== 'EMPEROR') {
        return { success: false, error: '봉토 회수는 황제만 가능합니다.' };
      }

      // 2. CP 검증 및 차감
      const revokerPcp = revoker.commandPoints?.pcp || 0;
      if (revokerPcp < FIEF_REVOKE_CP_COST) {
        return {
          success: false,
          error: `CP가 부족합니다. 필요: ${FIEF_REVOKE_CP_COST}, 보유: ${revokerPcp}`,
        };
      }

      // 3. 봉토 검증
      const sessionFiefs = this.fiefRegistry.get(sessionId);
      if (!sessionFiefs) {
        return { success: false, error: '세션이 초기화되지 않았습니다.' };
      }

      const existingFief = sessionFiefs.get(planetId);
      if (!existingFief || existingFief.ownerId === null) {
        return { success: false, error: '이미 직할령이거나 존재하지 않는 행성입니다.' };
      }

      const previousOwnerId = existingFief.ownerId;

      // 4. CP 차감
      const existingRevokerCp = revoker.commandPoints || { pcp: 0, mcp: 0, maxPcp: 100, maxMcp: 100, lastRecoveredAt: new Date() };
      revoker.commandPoints = {
        ...existingRevokerCp,
        pcp: revokerPcp - FIEF_REVOKE_CP_COST,
        mcp: existingRevokerCp.mcp || 0,
      } as any;
      await revoker.save();

      // 5. 기존 소유자의 봉토 목록에서 제거
      if (previousOwnerId) {
        const previousOwner = await Gin7Character.findOne({ sessionId, characterId: previousOwnerId });
        const prevOwnerTitle = previousOwner?.nobilityTitle as any;
        if (previousOwner && typeof prevOwnerTitle === 'object' && prevOwnerTitle?.fiefdoms) {
          prevOwnerTitle.fiefdoms = prevOwnerTitle.fiefdoms.filter(
            (f: string) => f !== planetId,
          );
          await previousOwner.save();
        }
      }

      // 6. 봉토 상태 업데이트 (직할령)
      const updatedFief: FiefInfo = {
        ...existingFief,
        ownerId: null,
        ownerName: undefined,
        grantedAt: undefined,
      };
      sessionFiefs.set(planetId, updatedFief);

      // 7. 이벤트 발생
      const payload: FiefChangePayload = {
        sessionId,
        planetId,
        previousOwnerId,
        newOwnerId: null,
        actionType: 'REVOKE',
        performedBy: revokerId,
      };
      this.emit('fief:revoked', payload);

      logger.info(`[FiefService] Fief ${planetId} revoked from ${previousOwnerId} by ${revokerId}`);
      return { success: true, fief: updatedFief };
    } catch (error) {
      logger.error(`[FiefService] Error revoking fief: ${error}`);
      return { success: false, error: '봉토 회수 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 특정 캐릭터의 봉토 목록을 조회합니다.
   * @param sessionId 세션 ID
   * @param characterId 캐릭터 ID
   * @returns 봉토 정보 목록
   */
  public getFiefsByOwner(sessionId: string, characterId: string): FiefInfo[] {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) return [];

    return Array.from(sessionFiefs.values()).filter((fief) => fief.ownerId === characterId);
  }

  /**
   * 특정 행성의 봉토 정보를 조회합니다.
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @returns 봉토 정보
   */
  public getFiefInfo(sessionId: string, planetId: string): FiefInfo | undefined {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) return undefined;

    return sessionFiefs.get(planetId);
  }

  /**
   * 세션의 전체 봉토 현황을 조회합니다.
   * @param sessionId 세션 ID
   * @returns 봉토 정보 목록
   */
  public getAllFiefs(sessionId: string): FiefInfo[] {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) return [];

    return Array.from(sessionFiefs.values());
  }

  /**
   * 캐릭터의 총 봉토 수입을 계산합니다.
   * @param sessionId 세션 ID
   * @param characterId 캐릭터 ID
   * @returns 연간 총 수입
   */
  public calculateTotalFiefIncome(sessionId: string, characterId: string): number {
    const fiefs = this.getFiefsByOwner(sessionId, characterId);
    return fiefs.reduce((total, fief) => total + fief.annualIncome, 0);
  }

  /**
   * 봉토 경제 상세 계산
   * @param sessionId 세션 ID
   * @param planetId 행성 ID
   * @param population 인구
   * @param gdp GDP/생산력
   * @param armyMaintenance 사병 유지비
   * @param customTributeRate 커스텀 상납률 (옵션)
   */
  public calculateFiefEconomy(
    sessionId: string,
    planetId: string,
    population: number,
    gdp: number,
    armyMaintenance: number = 0,
    customTributeRate?: number,
  ): FiefEconomy | null {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) return null;

    const fief = sessionFiefs.get(planetId);
    if (!fief) return null;

    // 총 수입 계산
    const incomeFromPop = (population / 10000000) * FIEF_ECONOMY_CONSTANTS.INCOME_PER_10M_POP;
    const incomeFromGdp = gdp * FIEF_ECONOMY_CONSTANTS.GDP_MULTIPLIER;
    const grossIncome = Math.floor(incomeFromPop + incomeFromGdp);

    // 상납률 결정
    const tributeRate = customTributeRate ?? FIEF_ECONOMY_CONSTANTS.DEFAULT_TRIBUTE_RATE;
    const imperialTribute = Math.floor(grossIncome * tributeRate);

    // 순수입 = 총수입 - 상납 - 사병유지비
    const netIncome = Math.max(0, grossIncome - imperialTribute - armyMaintenance);

    const economy: FiefEconomy = {
      population,
      gdp,
      grossIncome,
      imperialTribute,
      armyMaintenance,
      netIncome,
      tributeRate,
      lastCalculatedAt: new Date(),
    };

    // 봉토 정보 업데이트
    fief.economy = economy;
    fief.annualIncome = netIncome; // 연간 수입도 업데이트

    return economy;
  }

  /**
   * 상납률 변경 (황제 명령)
   */
  public setTributeRate(
    sessionId: string,
    planetId: string,
    newRate: number,
  ): boolean {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) return false;

    const fief = sessionFiefs.get(planetId);
    if (!fief || !fief.economy) return false;

    // 범위 제한
    const clampedRate = Math.max(
      FIEF_ECONOMY_CONSTANTS.MIN_TRIBUTE_RATE,
      Math.min(FIEF_ECONOMY_CONSTANTS.MAX_TRIBUTE_RATE, newRate)
    );

    fief.economy.tributeRate = clampedRate;

    this.emit('tribute:rate_changed', {
      sessionId,
      planetId,
      ownerId: fief.ownerId,
      newRate: clampedRate,
    });

    logger.info(`[FiefService] Tribute rate changed: ${planetId} -> ${clampedRate * 100}%`);

    return true;
  }

  /**
   * 상납 거부 처리 (반역 징후)
   */
  public refuseTribute(
    sessionId: string,
    planetId: string,
    ownerId: string,
  ): void {
    this.emit('tribute:refused', {
      sessionId,
      planetId,
      ownerId,
      timestamp: new Date(),
    });

    logger.warn(`[FiefService] Tribute refused by ${ownerId} for ${planetId}`);
  }

  /**
   * 월간 봉토 수입 처리 (TimeEngine에서 호출)
   */
  public async processMonthlyFiefIncome(sessionId: string): Promise<{
    totalTribute: number;
    fiefIncomes: Array<{ planetId: string; ownerId: string; netIncome: number }>;
  }> {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) {
      return { totalTribute: 0, fiefIncomes: [] };
    }

    let totalTribute = 0;
    const fiefIncomes: Array<{ planetId: string; ownerId: string; netIncome: number }> = [];

    for (const [planetId, fief] of sessionFiefs) {
      if (!fief.ownerId || !fief.economy) continue;

      // 월간으로 환산 (연간 / 12)
      const monthlyTribute = Math.floor(fief.economy.imperialTribute / 12);
      const monthlyNet = Math.floor(fief.economy.netIncome / 12);

      totalTribute += monthlyTribute;
      fiefIncomes.push({
        planetId,
        ownerId: fief.ownerId,
        netIncome: monthlyNet,
      });
    }

    this.emit('monthly:processed', {
      sessionId,
      totalTribute,
      fiefCount: fiefIncomes.length,
    });

    return { totalTribute, fiefIncomes };
  }

  /**
   * 봉토 순수입 조회 (사병 서비스 연동용)
   */
  public getFiefNetIncome(sessionId: string, ownerId: string): number {
    const fiefs = this.getFiefsByOwner(sessionId, ownerId);
    return fiefs.reduce((total, fief) => {
      return total + (fief.economy?.netIncome || fief.annualIncome);
    }, 0);
  }

  /**
   * 직할령 행성 목록을 조회합니다.
   * @param sessionId 세션 ID
   * @returns 직할령 봉토 정보 목록
   */
  public getImperialDomains(sessionId: string): FiefInfo[] {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) return [];

    return Array.from(sessionFiefs.values()).filter((fief) => fief.ownerId === null);
  }

  /**
   * 행성 점령 시 봉토 상태 처리
   * (점령된 행성은 자동으로 직할령으로 전환)
   * @param sessionId 세션 ID
   * @param planetId 점령된 행성 ID
   * @param occupyingFaction 점령 진영
   */
  public async handlePlanetOccupation(
    sessionId: string,
    planetId: string,
    occupyingFaction: 'IMPERIAL' | 'ALLIANCE',
  ): Promise<void> {
    const sessionFiefs = this.fiefRegistry.get(sessionId);
    if (!sessionFiefs) return;

    const existingFief = sessionFiefs.get(planetId);
    if (!existingFief) return;

    // 기존 소유자의 봉토 목록에서 제거
    if (existingFief.ownerId) {
      const previousOwner = await Gin7Character.findOne({
        sessionId,
        characterId: existingFief.ownerId,
      });
      const prevOwnerTitle = previousOwner?.nobilityTitle as any;
      if (previousOwner && typeof prevOwnerTitle === 'object' && prevOwnerTitle?.fiefdoms) {
        prevOwnerTitle.fiefdoms = prevOwnerTitle.fiefdoms.filter(
          (f: string) => f !== planetId,
        );
        await previousOwner.save();
      }
    }

    // 제국이 점령하면 직할령으로, 동맹이 점령하면 봉토 시스템에서 제거
    if (occupyingFaction === 'IMPERIAL') {
      const updatedFief: FiefInfo = {
        ...existingFief,
        ownerId: null,
        ownerName: undefined,
        grantedAt: undefined,
      };
      sessionFiefs.set(planetId, updatedFief);
      logger.info(`[FiefService] Planet ${planetId} converted to imperial domain after occupation`);
    } else {
      // 동맹군 점령 시 봉토 레지스트리에서 제거
      sessionFiefs.delete(planetId);
      logger.info(`[FiefService] Planet ${planetId} removed from fief registry (Alliance occupation)`);
    }
  }
}

export const fiefService = FiefService.getInstance();
export default FiefService;

