/**
 * SecurityCommandService - 치안/경비 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 치안/경비 커맨드:
 * - SECURITY_PATROL (경계출동): 치안 유지율 증가
 * - SUPPRESS_RIOT (무력진압): 치안 대폭 증가, 지지율 하락 가능
 * - PARADE (분열행진): 지지율 증가
 * - REQUISITION (징발): 점령지 물자 징발
 * - SPECIAL_GUARD (특별경비): 경비 강화
 */

import { EventEmitter } from 'events';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { COMMAND_DEFINITIONS, ICommandDefinition } from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface SecurityRequest {
  sessionId: string;
  characterId: string;    // 실행자
  planetId: string;       // 대상 행성
  commandId: string;      // 커맨드 ID
}

export interface SecurityResult {
  success: boolean;
  commandId: string;
  planetId: string;
  effects: {
    securityChange?: number;
    supportChange?: number;
    resourcesGained?: Record<string, number>;
  };
  cpCost: number;
  error?: string;
}

// 커맨드별 효과 정의
const SECURITY_EFFECTS: Record<string, {
  security: number;      // 치안 변화량
  support: number;       // 지지율 변화량
  requisition?: boolean; // 징발 여부
}> = {
  SECURITY_PATROL: { security: 10, support: 0 },
  SUPPRESS_RIOT: { security: 25, support: -10 },
  PARADE: { security: 5, support: 15 },
  REQUISITION: { security: -5, support: -15, requisition: true },
  SPECIAL_GUARD: { security: 20, support: -5 },
};

// ============================================================
// SecurityCommandService Class
// ============================================================

export class SecurityCommandService extends EventEmitter {
  private static instance: SecurityCommandService;

  private constructor() {
    super();
    logger.info('[SecurityCommandService] Initialized');
  }

  public static getInstance(): SecurityCommandService {
    if (!SecurityCommandService.instance) {
      SecurityCommandService.instance = new SecurityCommandService();
    }
    return SecurityCommandService.instance;
  }

  // ============================================================
  // 치안 커맨드 실행
  // ============================================================

  /**
   * 치안/경비 커맨드 실행
   */
  public async executeSecurityCommand(request: SecurityRequest): Promise<SecurityResult> {
    const { sessionId, characterId, planetId, commandId } = request;

    // 1. 커맨드 정의 확인
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    if (!commandDef || commandDef.category !== 'SECURITY') {
      return this.errorResult(commandId, planetId, 0, '유효하지 않은 치안 커맨드입니다.');
    }

    // 2. 행성 확인
    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return this.errorResult(commandId, planetId, commandDef.cost, '행성을 찾을 수 없습니다.');
    }

    // 3. 실행자 확인
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return this.errorResult(commandId, planetId, commandDef.cost, '캐릭터를 찾을 수 없습니다.');
    }

    // 4. 효과 적용
    const effect = SECURITY_EFFECTS[commandId];
    if (!effect) {
      return this.errorResult(commandId, planetId, commandDef.cost, '커맨드 효과를 찾을 수 없습니다.');
    }

    const result = await this.applySecurityEffect(planet, effect, character);

    // 5. 이벤트 발생
    this.emit('security:executed', {
      sessionId,
      characterId,
      characterName: character.name,
      planetId,
      planetName: planet.name,
      commandId,
      effects: result.effects,
    });

    logger.info(`[SecurityCommandService] ${commandId} executed on ${planet.name}: Security ${result.effects.securityChange}, Support ${result.effects.supportChange}`);

    return {
      success: true,
      commandId,
      planetId,
      effects: result.effects,
      cpCost: commandDef.cost,
    };
  }

  /**
   * 치안 효과 적용
   */
  private async applySecurityEffect(
    planet: IPlanet,
    effect: {
      security: number;
      support: number;
      requisition?: boolean;
    },
    character: IGin7Character,
  ): Promise<{ effects: SecurityResult['effects'] }> {
    const effects: SecurityResult['effects'] = {};

    // 치안 변화 (0-100 범위)
    if (effect.security !== 0) {
      const oldSecurity = planet.defenseRating || 50;
      // 캐릭터 통솔력에 따른 보너스
      const commandBonus = (character.stats?.command || 50) / 100;
      const actualChange = Math.floor(effect.security * (1 + commandBonus * 0.5));
      
      planet.defenseRating = Math.max(0, Math.min(100, oldSecurity + actualChange));
      effects.securityChange = actualChange;
    }

    // 지지율 변화 (0-100 범위)
    if (effect.support !== 0) {
      const oldSupport = planet.loyalty || 50;
      // 캐릭터 매력에 따른 보정
      const charmBonus = (character.stats?.charm || 50) / 100;
      let actualChange = Math.floor(effect.support * (1 + charmBonus * 0.3));
      
      // 무력진압의 경우 매력이 높으면 지지율 하락이 적음
      if (effect.support < 0) {
        actualChange = Math.floor(effect.support * (1 - charmBonus * 0.3));
      }
      
      planet.loyalty = Math.max(0, Math.min(100, oldSupport + actualChange));
      effects.supportChange = actualChange;
    }

    // 징발 (점령지 물자 획득)
    if (effect.requisition) {
      const resourcesGained = await this.performRequisition(planet);
      effects.resourcesGained = resourcesGained;
    }

    await planet.save();

    return { effects };
  }

  /**
   * 징발 실행
   */
  private async performRequisition(planet: IPlanet): Promise<Record<string, number>> {
    const gained: Record<string, number> = {};

    // 행성 자원의 일부를 징발
    const requisitionRate = 0.1; // 10%

    if (planet.resources) {
      if (planet.resources.food > 0) {
        const amount = Math.floor(planet.resources.food * requisitionRate);
        planet.resources.food -= amount;
        gained.food = amount;
      }
      if (planet.resources.minerals > 0) {
        const amount = Math.floor(planet.resources.minerals * requisitionRate);
        planet.resources.minerals -= amount;
        gained.minerals = amount;
      }
      if (planet.resources.energy > 0) {
        const amount = Math.floor(planet.resources.energy * requisitionRate);
        planet.resources.energy -= amount;
        gained.energy = amount;
      }
      if (planet.resources.credits > 0) {
        const amount = Math.floor(planet.resources.credits * requisitionRate);
        planet.resources.credits -= amount;
        gained.credits = amount;
      }
    }

    return gained;
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private errorResult(
    commandId: string,
    planetId: string,
    cpCost: number,
    error: string,
  ): SecurityResult {
    return {
      success: false,
      commandId,
      planetId,
      effects: {},
      cpCost,
      error,
    };
  }

  // ============================================================
  // 조회
  // ============================================================

  /**
   * 행성 치안 상태 조회
   */
  public async getPlanetSecurityStatus(sessionId: string, planetId: string): Promise<{
    security: number;
    support: number;
    isUnderRiot: boolean;
  } | null> {
    const planet = await Planet.findOne({ sessionId, planetId }).lean();
    if (!planet) return null;

    return {
      security: planet.defenseRating || 50,
      support: planet.loyalty || 50,
      isUnderRiot: (planet.defenseRating || 50) < 20,
    };
  }
}

export const securityCommandService = SecurityCommandService.getInstance();
export default SecurityCommandService;





