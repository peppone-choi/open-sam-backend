/**
 * Strategic AI Service
 * 
 * NPC 진영의 전략적 결정을 담당합니다:
 * - 전력 평가 및 위협 분석
 * - 침공 결정 및 목표 선정
 * - 방어 배치 및 우선순위
 * - 내정 결정 (건설, 생산)
 */

import { 
  BehaviorStatus,
  AIBlackboard,
  AIPersonality,
  StrategicContext,
  StrategicDecision,
  EnemyAssessment,
  AI_CONFIG,
} from '../../../types/gin7/npc-ai.types';
import { 
  BehaviorTree, 
  createBehaviorTree 
} from '../../../core/gin7/ai/BehaviorTree';
import { Fleet, IFleet, SHIP_SPECS, ShipClass } from '../../../models/gin7/Fleet';
import { Planet, IPlanet } from '../../../models/gin7/Planet';
import { StarSystem, IStarSystem } from '../../../models/gin7/StarSystem';
import { logger } from '../../../common/logger';

// ============================================================
// Strategic AI Service
// ============================================================

export class StrategicAIService {
  private strategicTree: BehaviorTree;
  
  constructor() {
    this.strategicTree = this.buildStrategicTree();
  }
  
  /**
   * 전략적 결정 수행
   */
  async evaluate(blackboard: AIBlackboard): Promise<StrategicDecision[]> {
    // 컨텍스트 업데이트
    await this.updateContext(blackboard);
    
    // 트리 실행
    const status = this.strategicTree.tick(blackboard);
    
    logger.debug('[StrategicAI] Evaluation complete', {
      status,
      decisionsCount: blackboard.currentStrategicDecisions.length,
    });
    
    return blackboard.currentStrategicDecisions;
  }
  
  /**
   * 컨텍스트 업데이트
   */
  private async updateContext(blackboard: AIBlackboard): Promise<void> {
    if (!blackboard.strategicContext) {
      logger.warn('[StrategicAI] No strategic context available');
      return;
    }
    
    const ctx = blackboard.strategicContext;
    
    // 적 진영 평가 업데이트
    ctx.enemies = await this.assessEnemies(ctx);
    
    // 군사력 업데이트
    ctx.military = await this.assessMilitary(ctx);
  }
  
  /**
   * 적 진영 평가
   */
  private async assessEnemies(ctx: StrategicContext): Promise<EnemyAssessment[]> {
    const assessments: EnemyAssessment[] = [];
    
    for (const enemyFactionId of ctx.diplomacy.atWarWith) {
      // 적 함대 조회
      const enemyFleets = await Fleet.find({
        sessionId: ctx.sessionId,
        factionId: enemyFactionId,
      }).lean();
      
      // 적 행성 조회
      const enemyPlanets = await Planet.find({
        sessionId: ctx.sessionId,
        ownerFactionId: enemyFactionId,
      }).lean();
      
      // 전력 추정
      const estimatedPower = this.calculateFleetsPower(enemyFleets as unknown as IFleet[]);
      
      // 위협 수준 판정
      const ourPower = ctx.military.combatPower;
      const ratio = estimatedPower / Math.max(ourPower, 1);
      
      let threatLevel: EnemyAssessment['threatLevel'] = 'LOW';
      if (ratio > 2.0) threatLevel = 'CRITICAL';
      else if (ratio > 1.5) threatLevel = 'HIGH';
      else if (ratio > 0.8) threatLevel = 'MEDIUM';
      
      assessments.push({
        factionId: enemyFactionId,
        estimatedPower,
        knownFleets: enemyFleets.length,
        knownPlanets: enemyPlanets.map(p => p.planetId),
        threatLevel,
        recentActivity: [],
      });
    }
    
    return assessments;
  }
  
  /**
   * 군사력 평가
   */
  private async assessMilitary(ctx: StrategicContext): Promise<StrategicContext['military']> {
    const fleets = await Fleet.find({
      sessionId: ctx.sessionId,
      factionId: ctx.factionId,
    }).lean();
    
    const fleetsBySystem = new Map<string, string[]>();
    const idleFleets: string[] = [];
    let totalShips = 0;
    let combatPower = 0;
    
    for (const fleet of fleets) {
      // 함대별 처리
      totalShips += fleet.totalShips;
      combatPower += this.calculateFleetPower(fleet as unknown as IFleet);
      
      // 대기 중인 함대
      if (fleet.status === 'IDLE' || fleet.status === 'DOCKED') {
        idleFleets.push(fleet.fleetId);
      }
      
      // 성계별 함대 분류
      const systemId = fleet.location?.systemId;
      if (systemId) {
        if (!fleetsBySystem.has(systemId)) {
          fleetsBySystem.set(systemId, []);
        }
        fleetsBySystem.get(systemId)!.push(fleet.fleetId);
      }
    }
    
    return {
      totalFleets: fleets.length,
      totalShips,
      combatPower,
      idleFleets,
      fleetsBySystem,
    };
  }
  
  /**
   * 함대 전투력 계산
   */
  private calculateFleetPower(fleet: IFleet): number {
    const basePower: Record<ShipClass, number> = {
      flagship: 100,
      battleship: 80,
      carrier: 70,
      cruiser: 50,
      destroyer: 30,
      frigate: 20,
      corvette: 10,
      transport: 5,
      engineering: 5,
    };
    
    return fleet.units.reduce((sum, unit) => {
      const base = basePower[unit.shipClass] || 10;
      const hpMod = unit.hp / 100;
      const moraleMod = 0.5 + (unit.morale / 200);
      const vetMod = 1 + (unit.veterancy / 100);
      return sum + (base * unit.count * hpMod * moraleMod * vetMod);
    }, 0);
  }
  
  /**
   * 여러 함대의 총 전투력
   */
  private calculateFleetsPower(fleets: IFleet[]): number {
    return fleets.reduce((sum, fleet) => sum + this.calculateFleetPower(fleet), 0);
  }
  
  // ============================================================
  // Behavior Tree Construction
  // ============================================================
  
  private buildStrategicTree(): BehaviorTree {
    return createBehaviorTree('strategic-ai', 'Strategic AI Tree')
      // 메인 선택자
      .selector('Main Strategic Selector')
        // 1. 긴급 대응 (높은 우선순위)
        .sequence('Emergency Response')
          .condition('Is Under Attack?', this.isUnderAttack.bind(this))
          .action('Organize Defense', this.organizeDefense.bind(this))
        .end()
        
        // 2. 공격 기회 평가
        .sequence('Attack Opportunity')
          .condition('Has Idle Fleets?', this.hasIdleFleets.bind(this))
          .condition('Has Attack Target?', this.hasAttackTarget.bind(this))
          .condition('Has Sufficient Power?', this.hasSufficientPower.bind(this))
          .action('Plan Attack', this.planAttack.bind(this))
        .end()
        
        // 3. 방어 강화
        .sequence('Strengthen Defense')
          .condition('Border Systems Weak?', this.borderSystemsWeak.bind(this))
          .action('Reinforce Borders', this.reinforceBorders.bind(this))
        .end()
        
        // 4. 경제 발전
        .sequence('Economic Development')
          .condition('Has Build Capacity?', this.hasBuildCapacity.bind(this))
          .selector('Build Decision')
            .sequence('Build Military')
              .condition('Need More Ships?', this.needMoreShips.bind(this))
              .action('Order Ship Construction', this.orderShipConstruction.bind(this))
            .end()
            .sequence('Build Facilities')
              .condition('Need Infrastructure?', this.needInfrastructure.bind(this))
              .action('Order Facility Construction', this.orderFacilityConstruction.bind(this))
            .end()
          .end()
        .end()
        
        // 5. 기본 대기
        .action('Wait', this.waitAction.bind(this))
      .end()
      .build();
  }
  
  // ============================================================
  // Condition Functions
  // ============================================================
  
  private isUnderAttack(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    
    // 적 함대가 우리 영토에 있는지 확인
    for (const enemy of ctx.enemies) {
      // 적의 최근 활동에 공격이 있으면 true
      if (enemy.recentActivity.some(a => a.includes('ATTACK'))) {
        return true;
      }
    }
    
    // 전선 성계에 적 함대가 탐지되었는지
    // (실제 구현에서는 인텔 시스템과 연동)
    return false;
  }
  
  private hasIdleFleets(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    return ctx.military.idleFleets.length > 0;
  }
  
  private hasAttackTarget(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    
    // 적 행성이 있는지
    for (const enemy of ctx.enemies) {
      if (enemy.knownPlanets.length > 0) {
        return true;
      }
    }
    return false;
  }
  
  private hasSufficientPower(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    
    const personality = blackboard.personality;
    
    // 공격성에 따른 필요 전력비 조정
    // 공격성 높으면 적은 우위로도 공격
    const aggressionMod = 1.5 - (personality.aggression / 100);
    const requiredRatio = AI_CONFIG.ATTACK_POWER_THRESHOLD * aggressionMod;
    
    // 가장 약한 적과의 전력비
    const weakestEnemy = ctx.enemies.reduce(
      (min, e) => e.estimatedPower < min.estimatedPower ? e : min,
      ctx.enemies[0]
    );
    
    if (!weakestEnemy) return false;
    
    const powerRatio = ctx.military.combatPower / Math.max(weakestEnemy.estimatedPower, 1);
    return powerRatio >= requiredRatio;
  }
  
  private borderSystemsWeak(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    
    const personality = blackboard.personality;
    
    // 신중함이 높으면 방어 우선
    if (personality.caution < 50) return false;
    
    // 전선 성계의 방어력 체크
    for (const systemId of ctx.territory.frontlineSystems) {
      const fleetsInSystem = ctx.military.fleetsBySystem.get(systemId) || [];
      if (fleetsInSystem.length < AI_CONFIG.MIN_DEFENSE_FLEETS) {
        return true;
      }
    }
    
    return false;
  }
  
  private hasBuildCapacity(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    
    // 자원이 충분한지
    return ctx.resources.credits > 10000 && 
           ctx.resources.minerals > 5000;
  }
  
  private needMoreShips(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    
    // 적 총 전력 대비 우리 전력
    const totalEnemyPower = ctx.enemies.reduce((sum, e) => sum + e.estimatedPower, 0);
    const ourPower = ctx.military.combatPower;
    
    // 우리 전력이 적보다 낮으면 건조 필요
    return ourPower < totalEnemyPower * 1.2;
  }
  
  private needInfrastructure(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.strategicContext;
    if (!ctx) return false;
    
    // 경제력 대비 영토 크기 체크
    // (실제 구현에서는 시설 데이터 참조)
    return ctx.territory.ownedPlanets.length > 0;
  }
  
  // ============================================================
  // Action Functions
  // ============================================================
  
  private organizeDefense(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.strategicContext;
    if (!ctx) return BehaviorStatus.FAILURE;
    
    const personality = blackboard.personality;
    const decisions = blackboard.currentStrategicDecisions;
    
    // 가용 함대 중 가장 가까운 것을 방어에 투입
    for (const fleetId of ctx.military.idleFleets) {
      // 최대 방어 함대 수 제한
      const existingDefense = decisions.filter(d => d.type === 'DEFEND').length;
      if (existingDefense >= 3) break;
      
      decisions.push({
        type: 'DEFEND',
        priority: 90,
        fleetIds: [fleetId],
        target: ctx.territory.frontlineSystems[0],
        reasoning: `Defense organization triggered by attack`,
        parameters: {
          aggressiveDefense: personality.aggression > 60,
        },
      });
    }
    
    logger.info('[StrategicAI] Defense organized', {
      defenseFleetsCount: decisions.filter(d => d.type === 'DEFEND').length,
    });
    
    return BehaviorStatus.SUCCESS;
  }
  
  private planAttack(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.strategicContext;
    if (!ctx) return BehaviorStatus.FAILURE;
    
    const personality = blackboard.personality;
    const decisions = blackboard.currentStrategicDecisions;
    
    // 가장 약한 적의 가장 가까운 행성을 목표로
    const weakestEnemy = ctx.enemies.reduce(
      (min, e) => e.estimatedPower < min.estimatedPower ? e : min,
      ctx.enemies[0]
    );
    
    if (!weakestEnemy || weakestEnemy.knownPlanets.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    // 공격 함대 선정
    const attackFleets = ctx.military.idleFleets.slice(
      0, 
      Math.min(AI_CONFIG.MAX_SIMULTANEOUS_ATTACKS, ctx.military.idleFleets.length)
    );
    
    if (attackFleets.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    // 공격 결정
    decisions.push({
      type: 'ATTACK',
      priority: 80 + Math.floor(personality.aggression / 10),
      fleetIds: attackFleets,
      target: weakestEnemy.knownPlanets[0],
      parameters: {
        targetFaction: weakestEnemy.factionId,
        useFlanking: personality.prefersFlanking,
      },
      reasoning: `Attack planned against ${weakestEnemy.factionId}'s territory`,
    });
    
    logger.info('[StrategicAI] Attack planned', {
      target: weakestEnemy.knownPlanets[0],
      fleetsCount: attackFleets.length,
    });
    
    return BehaviorStatus.SUCCESS;
  }
  
  private reinforceBorders(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.strategicContext;
    if (!ctx) return BehaviorStatus.FAILURE;
    
    const decisions = blackboard.currentStrategicDecisions;
    
    // 취약한 전선 성계 강화
    for (const systemId of ctx.territory.frontlineSystems) {
      const fleetsInSystem = ctx.military.fleetsBySystem.get(systemId) || [];
      
      if (fleetsInSystem.length < AI_CONFIG.MIN_DEFENSE_FLEETS) {
        // 가용 함대에서 증원
        const reinforceFleet = ctx.military.idleFleets.find(
          fId => !decisions.some(d => d.fleetIds?.includes(fId))
        );
        
        if (reinforceFleet) {
          decisions.push({
            type: 'REINFORCE',
            priority: 70,
            fleetIds: [reinforceFleet],
            target: systemId,
            reasoning: `Reinforcing border system ${systemId}`,
          });
        }
      }
    }
    
    return BehaviorStatus.SUCCESS;
  }
  
  private orderShipConstruction(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.strategicContext;
    if (!ctx) return BehaviorStatus.FAILURE;
    
    const decisions = blackboard.currentStrategicDecisions;
    
    // 가장 필요한 함선 종류 결정
    // (실제 구현에서는 현재 함대 구성 분석)
    const shipClass: ShipClass = 'cruiser'; // 기본적으로 순양함 건조
    
    decisions.push({
      type: 'BUILD_FLEET',
      priority: 50,
      parameters: {
        shipClass,
        count: 10,
      },
      reasoning: `Building ${shipClass} to strengthen military`,
    });
    
    return BehaviorStatus.SUCCESS;
  }
  
  private orderFacilityConstruction(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.strategicContext;
    if (!ctx) return BehaviorStatus.FAILURE;
    
    const decisions = blackboard.currentStrategicDecisions;
    
    // 개발이 필요한 행성 선정
    const targetPlanet = ctx.territory.ownedPlanets[0];
    if (!targetPlanet) return BehaviorStatus.FAILURE;
    
    decisions.push({
      type: 'BUILD_FACILITY',
      priority: 40,
      target: targetPlanet,
      parameters: {
        facilityType: 'shipyard',
      },
      reasoning: `Building shipyard on ${targetPlanet}`,
    });
    
    return BehaviorStatus.SUCCESS;
  }
  
  private waitAction(blackboard: AIBlackboard): BehaviorStatus {
    const decisions = blackboard.currentStrategicDecisions;
    
    // 할 일이 없으면 대기
    if (decisions.length === 0) {
      decisions.push({
        type: 'WAIT',
        priority: 10,
        reasoning: 'No strategic actions required at this time',
      });
    }
    
    return BehaviorStatus.SUCCESS;
  }
}

// Singleton export
export const strategicAIService = new StrategicAIService();

