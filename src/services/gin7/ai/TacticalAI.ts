/**
 * Tactical AI Service
 * 
 * 전투 중 실시간 전술 결정을 담당합니다:
 * - 진형 선택 및 변경
 * - 타겟 선정 및 집중 사격
 * - 에너지 배분 조정
 * - 퇴각 판단
 */

import { 
  BehaviorStatus,
  AIBlackboard,
  AIPersonality,
  TacticalContext,
  TacticalDecision,
  TacticalUnitSummary,
  AI_CONFIG,
  TacticalStyle,
  TacticalStyleConfig,
  TACTICAL_STYLE_CONFIGS,
} from '../../../types/gin7/npc-ai.types';
import { 
  BehaviorTree, 
  createBehaviorTree 
} from '../../../core/gin7/ai/BehaviorTree';
import { 
  FormationType,
  EnergyDistribution,
  DEFAULT_ENERGY_DISTRIBUTION,
} from '../../../types/gin7/tactical.types';
import { logger } from '../../../common/logger';

// ============================================================
// Tactical AI Service
// ============================================================

export class TacticalAIService {
  private tacticalTree: BehaviorTree;
  
  constructor() {
    this.tacticalTree = this.buildTacticalTree();
  }
  
  /**
   * 전술 스타일 설정 가져오기
   */
  private getStyleConfig(personality: AIPersonality): TacticalStyleConfig {
    const style = personality.tacticalStyle || 'DEFAULT';
    return TACTICAL_STYLE_CONFIGS[style] || TACTICAL_STYLE_CONFIGS.DEFAULT;
  }
  
  /**
   * 전술적 결정 수행
   */
  evaluate(blackboard: AIBlackboard): TacticalDecision[] {
    // 컨텍스트 검증
    if (!blackboard.tacticalContext) {
      logger.warn('[TacticalAI] No tactical context available');
      return [];
    }
    
    // 이전 결정 초기화
    blackboard.currentTacticalDecisions = [];
    
    // 컨텍스트 분석
    this.analyzeContext(blackboard);
    
    // 스타일 기반 전술 적용
    const styleConfig = this.getStyleConfig(blackboard.personality);
    this.applyStyleBasedTactics(blackboard, styleConfig);
    
    // 트리 실행
    const status = this.tacticalTree.tick(blackboard);
    
    logger.debug('[TacticalAI] Evaluation complete', {
      status,
      style: styleConfig.style,
      decisionsCount: blackboard.currentTacticalDecisions.length,
    });
    
    return blackboard.currentTacticalDecisions;
  }
  
  /**
   * 스타일 기반 전술 적용
   */
  private applyStyleBasedTactics(blackboard: AIBlackboard, styleConfig: TacticalStyleConfig): void {
    const ctx = blackboard.tacticalContext!;
    const decisions = blackboard.currentTacticalDecisions;
    
    // 전투 단계별 스타일 적용
    switch (ctx.battlePhase) {
      case 'OPENING':
        this.applyOpeningTactics(blackboard, styleConfig, decisions);
        break;
      case 'MIDGAME':
        this.applyMidgameTactics(blackboard, styleConfig, decisions);
        break;
      case 'ENDGAME':
      case 'DESPERATE':
        this.applyDesperateTactics(blackboard, styleConfig, decisions);
        break;
    }
    
    logger.debug('[TacticalAI] Style tactics applied', {
      style: styleConfig.nameKo,
      phase: ctx.battlePhase,
    });
  }
  
  /**
   * 초반 전술 적용
   */
  private applyOpeningTactics(
    blackboard: AIBlackboard,
    styleConfig: TacticalStyleConfig,
    decisions: TacticalDecision[]
  ): void {
    const ctx = blackboard.tacticalContext!;
    const unitIds = ctx.ownUnits.filter(u => !u.isChaos && !u.isRetreating).map(u => u.unitId);
    
    if (unitIds.length === 0) return;
    
    switch (styleConfig.openingAction) {
      case 'AGGRESSIVE':
        // 선제 공격 - 라인하르트, 비텐펠트 스타일
        decisions.push({
          type: 'CHANGE_FORMATION',
          unitIds,
          formation: styleConfig.preferredFormations[0] || 'ASSAULT',
          reasoning: `${styleConfig.nameKo}: 초반 공세 진형으로 전환`,
        });
        decisions.push({
          type: 'CHANGE_ENERGY',
          unitIds,
          energyDistribution: this.getEnergyByBias(styleConfig.defaultEnergyBias),
          reasoning: `${styleConfig.nameKo}: 공격 에너지 배분`,
        });
        break;
        
      case 'DEFENSIVE':
        // 방어적 자세 - 메르카츠 스타일
        decisions.push({
          type: 'CHANGE_FORMATION',
          unitIds,
          formation: 'DEFENSIVE',
          reasoning: `${styleConfig.nameKo}: 초반 방어 진형으로 견제`,
        });
        decisions.push({
          type: 'HOLD_POSITION',
          unitIds,
          reasoning: `${styleConfig.nameKo}: 적의 첫 수를 관망`,
        });
        break;
        
      case 'MANEUVER':
        // 기동 시작 - 미터마이어 스타일
        decisions.push({
          type: 'CHANGE_FORMATION',
          unitIds,
          formation: 'WEDGE',
          reasoning: `${styleConfig.nameKo}: 기동전을 위한 쐐기 진형`,
        });
        decisions.push({
          type: 'MOVE_POSITION',
          unitIds,
          target: { x: 3000, y: 0, z: 2000 }, // 측면으로 이동
          reasoning: `${styleConfig.nameKo}: 측면 기동 개시`,
        });
        break;
        
      case 'OBSERVE':
        // 관찰 및 대기 - 양 웬리 스타일
        decisions.push({
          type: 'CHANGE_FORMATION',
          unitIds,
          formation: 'LINE',
          reasoning: `${styleConfig.nameKo}: 적 동향 파악을 위한 유연한 대형`,
        });
        decisions.push({
          type: 'CHANGE_ENERGY',
          unitIds,
          energyDistribution: {
            beam: 15,
            gun: 15,
            shield: 25,
            engine: 20,
            warp: 0,
            sensor: 25, // 센서 강화
          },
          reasoning: `${styleConfig.nameKo}: 정보 수집 우선`,
        });
        break;
    }
  }
  
  /**
   * 중반 전술 적용
   */
  private applyMidgameTactics(
    blackboard: AIBlackboard,
    styleConfig: TacticalStyleConfig,
    decisions: TacticalDecision[]
  ): void {
    const ctx = blackboard.tacticalContext!;
    const unitIds = ctx.ownUnits.filter(u => !u.isChaos && !u.isRetreating).map(u => u.unitId);
    
    if (unitIds.length === 0) return;
    
    // 중반 전술은 확률 기반으로 특수 기동 시도
    const roll = Math.random() * 100;
    
    switch (styleConfig.midgameAction) {
      case 'PRESS_ATTACK':
        // 지속적 압박 - 라인하르트, 비텐펠트 스타일
        if (roll < styleConfig.focusFireChance && ctx.enemyUnits.length > 0) {
          const weakestEnemy = [...ctx.enemyUnits].sort((a, b) => a.combatPower - b.combatPower)[0];
          decisions.push({
            type: 'FOCUS_FIRE',
            unitIds,
            target: weakestEnemy.unitId,
            reasoning: `${styleConfig.nameKo}: 집중 화력으로 각개 격파`,
          });
        }
        break;
        
      case 'HOLD_LINE':
        // 전선 유지 - 메르카츠 스타일
        if (roll < styleConfig.counterattackChance && ctx.advantageRatio > 0.8) {
          decisions.push({
            type: 'HOLD_POSITION',
            unitIds,
            energyDistribution: this.getEnergyByBias('DEFENSE'),
            reasoning: `${styleConfig.nameKo}: 전선 유지하며 반격 기회 포착`,
          });
        }
        break;
        
      case 'FLANKING':
        // 측면 공격 - 미터마이어 스타일
        if (roll < styleConfig.flankingChance) {
          // 함대를 둘로 나눠서 양쪽 측면 공격
          const halfCount = Math.ceil(unitIds.length / 2);
          const leftFlank = unitIds.slice(0, halfCount);
          const rightFlank = unitIds.slice(halfCount);
          
          if (leftFlank.length > 0) {
            decisions.push({
              type: 'MOVE_POSITION',
              unitIds: leftFlank,
              target: { x: -2000, y: 0, z: 3000 },
              reasoning: `${styleConfig.nameKo}: 좌측면 기동`,
            });
          }
          if (rightFlank.length > 0) {
            decisions.push({
              type: 'MOVE_POSITION',
              unitIds: rightFlank,
              target: { x: 2000, y: 0, z: 3000 },
              reasoning: `${styleConfig.nameKo}: 우측면 기동`,
            });
          }
        }
        break;
        
      case 'ADAPT':
        // 상황 적응 - 양 웬리, 로이엔탈 스타일
        if (ctx.advantageRatio > 1.2) {
          // 우세하면 공격
          decisions.push({
            type: 'CHANGE_ENERGY',
            unitIds,
            energyDistribution: this.getEnergyByBias('ATTACK'),
            reasoning: `${styleConfig.nameKo}: 전력 우위 활용, 공세 전환`,
          });
        } else if (ctx.advantageRatio < 0.8) {
          // 열세하면 방어적 기동
          decisions.push({
            type: 'CHANGE_FORMATION',
            unitIds,
            formation: 'DEFENSIVE',
            reasoning: `${styleConfig.nameKo}: 열세 상황, 방어 태세 전환`,
          });
          // 양 웬리 스타일: 반격 기회 노림
          if (styleConfig.style === 'YANG_WENLI' && roll < styleConfig.counterattackChance) {
            decisions.push({
              type: 'MOVE_POSITION',
              unitIds,
              target: { x: 0, y: 0, z: -2000 }, // 후퇴 기동
              reasoning: `${styleConfig.nameKo}: 유인 후퇴로 반격 기회 창출`,
            });
          }
        }
        break;
    }
  }
  
  /**
   * 위기 상황 전술 적용
   */
  private applyDesperateTactics(
    blackboard: AIBlackboard,
    styleConfig: TacticalStyleConfig,
    decisions: TacticalDecision[]
  ): void {
    const ctx = blackboard.tacticalContext!;
    const unitIds = ctx.ownUnits.filter(u => !u.isChaos && !u.isRetreating).map(u => u.unitId);
    
    if (unitIds.length === 0) return;
    
    // 퇴각 임계값 체크
    const shouldRetreat = styleConfig.retreatThreshold > 0 && 
                         ctx.ownAverageHp < styleConfig.retreatThreshold;
    
    switch (styleConfig.desperateAction) {
      case 'CHARGE':
        // 돌격 - 라인하르트, 비텐펠트, 로이엔탈 스타일
        if (!shouldRetreat) {
          decisions.push({
            type: 'CHARGE',
            unitIds,
            energyDistribution: {
              beam: 40,
              gun: 40,
              shield: 10,
              engine: 10,
              warp: 0,
              sensor: 0,
            },
            reasoning: `${styleConfig.nameKo}: 최후의 돌격! 전력을 다해 공격`,
          });
        } else {
          decisions.push({
            type: 'RETREAT',
            unitIds,
            energyDistribution: this.getRetreatEnergy(),
            reasoning: `${styleConfig.nameKo}: 전략적 후퇴로 재기 도모`,
          });
        }
        break;
        
      case 'RETREAT':
        // 퇴각 - 미터마이어 스타일 (기동력으로 생존)
        decisions.push({
          type: 'RETREAT',
          unitIds,
          energyDistribution: {
            beam: 10,
            gun: 10,
            shield: 20,
            engine: 35, // 엔진 강화
            warp: 25,
            sensor: 0,
          },
          reasoning: `${styleConfig.nameKo}: 고속 이탈로 병력 보존`,
        });
        break;
        
      case 'LAST_STAND':
        // 최후 항전 - 메르카츠, 파렌하이트 스타일
        decisions.push({
          type: 'HOLD_POSITION',
          unitIds,
          energyDistribution: {
            beam: 25,
            gun: 25,
            shield: 40, // 방어 극대화
            engine: 5,
            warp: 0,
            sensor: 5,
          },
          reasoning: `${styleConfig.nameKo}: 최후까지 버틴다! 항복은 없다`,
        });
        if (ctx.enemyUnits.length > 0) {
          const target = ctx.enemyUnits[0];
          decisions.push({
            type: 'FOCUS_FIRE',
            unitIds,
            target: target.unitId,
            reasoning: `${styleConfig.nameKo}: 최후의 일격을 노린다`,
          });
        }
        break;
        
      case 'GUERRILLA':
        // 게릴라전 - 양 웬리 스타일
        const scatterPositions = [
          { x: -3000, y: 0, z: 2000 },
          { x: 3000, y: 0, z: 2000 },
          { x: 0, y: 0, z: -3000 },
        ];
        
        // 분산 기동
        unitIds.forEach((unitId, index) => {
          const pos = scatterPositions[index % scatterPositions.length];
          decisions.push({
            type: 'MOVE_POSITION',
            unitIds: [unitId],
            target: pos,
            reasoning: `${styleConfig.nameKo}: 분산 기동으로 적 교란`,
          });
        });
        
        // 기회가 있으면 반격
        if (ctx.enemyUnits.length > 0 && Math.random() * 100 < styleConfig.counterattackChance) {
          const weakTarget = [...ctx.enemyUnits].sort((a, b) => a.combatPower - b.combatPower)[0];
          decisions.push({
            type: 'FOCUS_FIRE',
            unitIds: [unitIds[0]], // 일부만 반격
            target: weakTarget.unitId,
            reasoning: `${styleConfig.nameKo}: 분산 중 기회 포착, 반격!`,
          });
        }
        break;
    }
  }
  
  /**
   * 에너지 배분 편향에 따른 분배값
   */
  private getEnergyByBias(bias: TacticalStyleConfig['defaultEnergyBias']): TacticalDecision['energyDistribution'] {
    switch (bias) {
      case 'ATTACK':
        return { beam: 35, gun: 30, shield: 15, engine: 10, warp: 0, sensor: 10 };
      case 'DEFENSE':
        return { beam: 15, gun: 15, shield: 40, engine: 10, warp: 10, sensor: 10 };
      case 'MOBILITY':
        return { beam: 20, gun: 15, shield: 15, engine: 35, warp: 5, sensor: 10 };
      case 'BALANCED':
      default:
        return { beam: 20, gun: 20, shield: 25, engine: 15, warp: 5, sensor: 15 };
    }
  }
  
  /**
   * 퇴각용 에너지 배분
   */
  private getRetreatEnergy(): TacticalDecision['energyDistribution'] {
    return { beam: 5, gun: 5, shield: 30, engine: 25, warp: 30, sensor: 5 };
  }
  
  /**
   * 컨텍스트 분석 및 파생 데이터 계산
   */
  private analyzeContext(blackboard: AIBlackboard): void {
    const ctx = blackboard.tacticalContext!;
    
    // 전투 단계 판정
    ctx.battlePhase = this.determineBattlePhase(ctx);
    
    // 전력비 계산
    ctx.advantageRatio = ctx.ownTotalPower / Math.max(ctx.enemyTotalPower, 1);
    
    logger.debug('[TacticalAI] Context analyzed', {
      battlePhase: ctx.battlePhase,
      advantageRatio: ctx.advantageRatio.toFixed(2),
    });
  }
  
  /**
   * 전투 단계 판정
   */
  private determineBattlePhase(ctx: TacticalContext): TacticalContext['battlePhase'] {
    // HP 기준
    const avgOwnHp = ctx.ownAverageHp;
    const avgEnemyHp = ctx.enemyAverageHp;
    const combinedHp = (avgOwnHp + avgEnemyHp) / 2;
    
    if (combinedHp > 80) return 'OPENING';
    if (combinedHp > 50) return 'MIDGAME';
    if (combinedHp > 25) return 'ENDGAME';
    return 'DESPERATE';
  }
  
  // ============================================================
  // Behavior Tree Construction
  // ============================================================
  
  private buildTacticalTree(): BehaviorTree {
    return createBehaviorTree('tactical-ai', 'Tactical AI Tree')
      .selector('Main Tactical Selector')
        // 1. 퇴각 체크 (최우선)
        .sequence('Retreat Check')
          .condition('Should Retreat?', this.shouldRetreat.bind(this))
          .action('Execute Retreat', this.executeRetreat.bind(this))
        .end()
        
        // 2. 위기 대응
        .sequence('Emergency Response')
          .condition('Is Desperate?', this.isDesperateSituation.bind(this))
          .action('Desperate Measures', this.desperateMeasures.bind(this))
        .end()
        
        // 3. 진형 조정
        .sequence('Formation Adjustment')
          .condition('Need Formation Change?', this.needFormationChange.bind(this))
          .action('Change Formation', this.changeFormation.bind(this))
        .end()
        
        // 4. 에너지 배분
        .sequence('Energy Management')
          .condition('Need Energy Adjustment?', this.needEnergyAdjustment.bind(this))
          .action('Adjust Energy', this.adjustEnergy.bind(this))
        .end()
        
        // 5. 타겟 선정
        .sequence('Target Selection')
          .condition('Need New Targets?', this.needNewTargets.bind(this))
          .selector('Target Strategy')
            .sequence('Focus Fire')
              .condition('Can Focus Fire?', this.canFocusFire.bind(this))
              .action('Focus Fire', this.executeFocusFire.bind(this))
            .end()
            .action('Default Targeting', this.defaultTargeting.bind(this))
          .end()
        .end()
        
        // 6. 기동
        .sequence('Maneuver')
          .condition('Should Reposition?', this.shouldReposition.bind(this))
          .action('Execute Maneuver', this.executeManeuver.bind(this))
        .end()
        
        // 7. 기본 공격
        .action('Continue Attack', this.continueAttack.bind(this))
      .end()
      .build();
  }
  
  // ============================================================
  // Condition Functions
  // ============================================================
  
  private shouldRetreat(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const styleConfig = this.getStyleConfig(personality);
    
    // 스타일 기반 퇴각 임계값 체크 (0이면 절대 퇴각 안함)
    if (styleConfig.retreatThreshold === 0) {
      logger.debug('[TacticalAI] Style forbids retreat', { style: styleConfig.nameKo });
      return false;
    }
    
    // 퇴각 의향이 없는 성격이면 false
    if (!personality.willRetreat) return false;
    
    // 스타일 기반 퇴각 임계값 사용
    const hpThreshold = styleConfig.retreatThreshold;
    
    // 신중함에 따른 사기 임계값 조정
    const cautionMod = 1 + (personality.caution - 50) / 100;
    const moraleThreshold = AI_CONFIG.RETREAT_MORALE_THRESHOLD * cautionMod;
    
    // HP 또는 사기가 임계값 이하
    if (ctx.ownAverageHp < hpThreshold) return true;
    if (ctx.ownAverageMorale < moraleThreshold) return true;
    
    // 압도적 열세 (양 웬리 스타일은 더 오래 버팀)
    const retreatRatio = styleConfig.style === 'YANG_WENLI' ? 0.2 : 0.3;
    if (ctx.advantageRatio < retreatRatio) return true;
    
    return false;
  }
  
  private isDesperateSituation(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.tacticalContext!;
    return ctx.battlePhase === 'DESPERATE';
  }
  
  private needFormationChange(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    
    // 전투 단계에 따른 진형 변경 필요성
    const idealFormation = this.getIdealFormation(ctx, personality);
    return ctx.currentFormation !== idealFormation;
  }
  
  private needEnergyAdjustment(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.tacticalContext!;
    
    // 전투 단계별로 에너지 배분 재검토
    return ctx.ticksElapsed % 50 === 0; // 50틱마다 재평가
  }
  
  private needNewTargets(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.tacticalContext!;
    
    // 타겟이 없는 유닛이 있는지
    const unitsWithoutTarget = ctx.ownUnits.filter(u => !u.hasTarget && !u.isChaos);
    return unitsWithoutTarget.length > 0;
  }
  
  private canFocusFire(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const styleConfig = this.getStyleConfig(personality);
    
    // 스타일별 집중 사격 확률 적용
    const roll = Math.random() * 100;
    if (roll > styleConfig.focusFireChance) return false;
    
    // 창의성이 낮고 스타일이 기본이면 추가 체크
    if (styleConfig.style === 'DEFAULT' && personality.creativity < 40) return false;
    
    // 집중 사격할 유닛이 충분히 있는지
    const availableUnits = ctx.ownUnits.filter(u => !u.isChaos && !u.isRetreating);
    return availableUnits.length >= AI_CONFIG.FOCUS_FIRE_THRESHOLD;
  }
  
  private shouldReposition(blackboard: AIBlackboard): boolean {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const styleConfig = this.getStyleConfig(personality);
    
    // 스타일별 측면 공격 확률 체크
    const roll = Math.random() * 100;
    
    // 미터마이어 스타일은 기동 선호
    if (styleConfig.style === 'MITTERMEYER') {
      return ctx.ticksElapsed % 80 === 0 || roll < styleConfig.flankingChance;
    }
    
    // 방어적 스타일은 우세 시 정위치 유지
    if (styleConfig.openingAction === 'DEFENSIVE' && ctx.advantageRatio > 0.8) {
      return false;
    }
    
    // 게릴라전 선호 시 자주 기동 (양 웬리)
    if (personality.prefersGuerrilla || styleConfig.style === 'YANG_WENLI') {
      return ctx.ticksElapsed % 100 === 0;
    }
    
    // 측면 공격 선호 시 기동
    if (roll < styleConfig.flankingChance && ctx.battlePhase === 'OPENING') {
      return true;
    }
    
    return false;
  }
  
  // ============================================================
  // Action Functions
  // ============================================================
  
  private executeRetreat(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.tacticalContext!;
    const decisions = blackboard.currentTacticalDecisions;
    
    // 모든 유닛에 퇴각 명령
    const allUnitIds = ctx.ownUnits
      .filter(u => !u.isRetreating)
      .map(u => u.unitId);
    
    if (allUnitIds.length === 0) {
      return BehaviorStatus.SUCCESS;
    }
    
    decisions.push({
      type: 'RETREAT',
      unitIds: allUnitIds,
      energyDistribution: {
        beam: 0,
        gun: 0,
        shield: 30,
        engine: 30,
        warp: 40,
        sensor: 0,
      },
      reasoning: 'Retreating due to critical situation',
    });
    
    logger.info('[TacticalAI] Retreat ordered', { unitCount: allUnitIds.length });
    return BehaviorStatus.SUCCESS;
  }
  
  private desperateMeasures(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const decisions = blackboard.currentTacticalDecisions;
    
    // 공격적 성격이면 돌격, 아니면 방어 집중
    const unitIds = ctx.ownUnits
      .filter(u => !u.isChaos && !u.isRetreating)
      .map(u => u.unitId);
    
    if (unitIds.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    if (personality.aggression > 60 && !personality.willRetreat) {
      // 돌격 (죽기 살기)
      decisions.push({
        type: 'CHARGE',
        unitIds,
        energyDistribution: {
          beam: 40,
          gun: 40,
          shield: 10,
          engine: 10,
          warp: 0,
          sensor: 0,
        },
        reasoning: 'Desperate charge - all or nothing',
      });
    } else {
      // 방어적 자세로 버티기
      decisions.push({
        type: 'HOLD_POSITION',
        unitIds,
        energyDistribution: {
          beam: 15,
          gun: 15,
          shield: 40,
          engine: 10,
          warp: 10,
          sensor: 10,
        },
        reasoning: 'Defensive stance in desperate situation',
      });
    }
    
    return BehaviorStatus.SUCCESS;
  }
  
  private changeFormation(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const decisions = blackboard.currentTacticalDecisions;
    
    const newFormation = this.getIdealFormation(ctx, personality);
    const unitIds = ctx.ownUnits
      .filter(u => !u.isChaos && !u.isRetreating)
      .map(u => u.unitId);
    
    if (unitIds.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    decisions.push({
      type: 'CHANGE_FORMATION',
      unitIds,
      formation: newFormation,
      reasoning: `Changing to ${newFormation} formation for ${ctx.battlePhase} phase`,
    });
    
    logger.debug('[TacticalAI] Formation changed', { newFormation });
    return BehaviorStatus.SUCCESS;
  }
  
  private adjustEnergy(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const decisions = blackboard.currentTacticalDecisions;
    
    const distribution = this.getIdealEnergyDistribution(ctx, personality);
    const unitIds = ctx.ownUnits
      .filter(u => !u.isChaos && !u.isRetreating)
      .map(u => u.unitId);
    
    if (unitIds.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    decisions.push({
      type: 'CHANGE_ENERGY',
      unitIds,
      energyDistribution: distribution,
      reasoning: `Adjusting energy for ${ctx.battlePhase} phase`,
    });
    
    return BehaviorStatus.SUCCESS;
  }
  
  private executeFocusFire(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.tacticalContext!;
    const decisions = blackboard.currentTacticalDecisions;
    
    // 가장 약한 적 유닛 선택
    const sortedEnemies = [...ctx.enemyUnits]
      .sort((a, b) => a.combatPower - b.combatPower);
    
    if (sortedEnemies.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    const priorityTarget = sortedEnemies[0];
    const unitIds = ctx.ownUnits
      .filter(u => !u.isChaos && !u.isRetreating && !u.hasTarget)
      .map(u => u.unitId);
    
    if (unitIds.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    decisions.push({
      type: 'FOCUS_FIRE',
      unitIds,
      target: priorityTarget.unitId,
      reasoning: `Focus fire on weakest enemy (${priorityTarget.shipClass})`,
    });
    
    logger.debug('[TacticalAI] Focus fire ordered', {
      target: priorityTarget.unitId,
      attackers: unitIds.length,
    });
    
    return BehaviorStatus.SUCCESS;
  }
  
  private defaultTargeting(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const decisions = blackboard.currentTacticalDecisions;
    
    // 타겟 우선순위 결정
    const targetPriority = this.getTargetPriority(personality);
    const sortedEnemies = this.sortEnemiesByPriority(ctx.enemyUnits, targetPriority);
    
    if (sortedEnemies.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    // 각 유닛에 타겟 배정
    const unitsNeedingTarget = ctx.ownUnits.filter(u => !u.hasTarget && !u.isChaos);
    
    for (let i = 0; i < unitsNeedingTarget.length; i++) {
      const unit = unitsNeedingTarget[i];
      const target = sortedEnemies[i % sortedEnemies.length]; // 분산 공격
      
      decisions.push({
        type: 'ATTACK_TARGET',
        unitIds: [unit.unitId],
        target: target.unitId,
        reasoning: `Targeting ${target.shipClass} with priority: ${targetPriority}`,
      });
    }
    
    return BehaviorStatus.SUCCESS;
  }
  
  private executeManeuver(blackboard: AIBlackboard): BehaviorStatus {
    const ctx = blackboard.tacticalContext!;
    const personality = blackboard.personality;
    const decisions = blackboard.currentTacticalDecisions;
    
    const unitIds = ctx.ownUnits
      .filter(u => !u.isChaos && !u.isRetreating)
      .map(u => u.unitId);
    
    if (unitIds.length === 0) {
      return BehaviorStatus.FAILURE;
    }
    
    // 측면 공격 기동 또는 거리 조절
    let maneuverType: string;
    let targetPosition: { x: number; y: number; z: number };
    
    if (personality.prefersFlanking) {
      maneuverType = 'flanking';
      targetPosition = { x: 3000, y: 0, z: 2000 }; // 측면 위치 (예시)
    } else if (personality.prefersGuerrilla) {
      maneuverType = 'guerrilla';
      targetPosition = { x: Math.random() * 5000, y: 0, z: Math.random() * 5000 };
    } else {
      maneuverType = 'advance';
      targetPosition = { x: 2000, y: 0, z: 0 }; // 전진 (예시)
    }
    
    decisions.push({
      type: 'MOVE_POSITION',
      unitIds,
      target: targetPosition,
      reasoning: `Executing ${maneuverType} maneuver`,
    });
    
    return BehaviorStatus.SUCCESS;
  }
  
  private continueAttack(blackboard: AIBlackboard): BehaviorStatus {
    // 특별한 조치 없이 현재 공격 지속
    return BehaviorStatus.SUCCESS;
  }
  
  // ============================================================
  // Helper Functions
  // ============================================================
  
  private getIdealFormation(ctx: TacticalContext, personality: AIPersonality): string {
    const styleConfig = this.getStyleConfig(personality);
    const preferredFormations = styleConfig.preferredFormations;
    
    // 전투 단계와 스타일에 따른 이상적 진형
    if (ctx.battlePhase === 'OPENING') {
      // 스타일 첫 번째 선호 진형 사용
      if (styleConfig.openingAction === 'AGGRESSIVE') {
        return preferredFormations[0] || 'ASSAULT';
      }
      if (styleConfig.openingAction === 'DEFENSIVE') {
        return 'DEFENSIVE';
      }
      if (styleConfig.openingAction === 'MANEUVER') {
        return 'WEDGE';
      }
      return preferredFormations[0] || 'LINE';
    }
    
    if (ctx.battlePhase === 'MIDGAME') {
      // 상황에 따른 진형 조정
      if (ctx.advantageRatio > 1.3 && styleConfig.defaultEnergyBias === 'ATTACK') {
        return 'ASSAULT';
      }
      if (ctx.advantageRatio < 0.7) {
        return preferredFormations.includes('DEFENSIVE') ? 'DEFENSIVE' : 'CIRCLE';
      }
      return preferredFormations[1] || preferredFormations[0] || 'LINE';
    }
    
    if (ctx.battlePhase === 'ENDGAME' || ctx.battlePhase === 'DESPERATE') {
      // 위기 상황 스타일별 대응
      if (styleConfig.desperateAction === 'CHARGE') {
        return 'ASSAULT';
      }
      if (styleConfig.desperateAction === 'LAST_STAND') {
        return 'DEFENSIVE';
      }
      if (ctx.advantageRatio > 1.5) return 'ASSAULT';
      if (ctx.advantageRatio < 0.6) return 'DEFENSIVE';
      return 'CIRCLE';
    }
    
    return preferredFormations[0] || 'LINE';
  }
  
  private getIdealEnergyDistribution(
    ctx: TacticalContext, 
    personality: AIPersonality
  ): EnergyDistribution {
    const styleConfig = this.getStyleConfig(personality);
    
    // 전투 단계와 스타일에 따른 에너지 배분
    if (ctx.battlePhase === 'OPENING') {
      // 초반: 스타일별 기본 배분 적용
      if (styleConfig.openingAction === 'AGGRESSIVE') {
        return this.getEnergyByBias('ATTACK');
      }
      if (styleConfig.openingAction === 'DEFENSIVE') {
        return this.getEnergyByBias('DEFENSE');
      }
      if (styleConfig.openingAction === 'MANEUVER') {
        return this.getEnergyByBias('MOBILITY');
      }
      // OBSERVE: 센서 강화
      return {
        beam: 15,
        gun: 15,
        shield: 20,
        engine: 20,
        warp: 0,
        sensor: 30,
      };
    }
    
    if (ctx.battlePhase === 'MIDGAME') {
      // 중반: 스타일 기본 편향 + 상황 보정
      const baseDist = this.getEnergyByBias(styleConfig.defaultEnergyBias);
      
      // 우세하면 공격 강화, 열세하면 방어 강화
      if (ctx.advantageRatio > 1.3) {
        baseDist!.beam = Math.min(40, baseDist!.beam + 10);
        baseDist!.gun = Math.min(35, baseDist!.gun + 5);
        baseDist!.shield = Math.max(10, baseDist!.shield - 10);
      } else if (ctx.advantageRatio < 0.7) {
        baseDist!.shield = Math.min(45, baseDist!.shield + 15);
        baseDist!.beam = Math.max(10, baseDist!.beam - 10);
      }
      
      return baseDist;
    }
    
    if (ctx.battlePhase === 'ENDGAME') {
      // 후반: 결전 또는 방어
      if (ctx.advantageRatio > 1.2) {
        return { beam: 30, gun: 25, shield: 15, engine: 15, warp: 0, sensor: 15 };
      }
      return { beam: 15, gun: 15, shield: 35, engine: 15, warp: 10, sensor: 10 };
    }
    
    // DESPERATE: 스타일별 대응
    if (styleConfig.desperateAction === 'RETREAT') {
      return this.getRetreatEnergy();
    }
    if (styleConfig.desperateAction === 'LAST_STAND') {
      return { beam: 25, gun: 25, shield: 40, engine: 5, warp: 0, sensor: 5 };
    }
    if (styleConfig.desperateAction === 'GUERRILLA') {
      return { beam: 15, gun: 15, shield: 20, engine: 30, warp: 10, sensor: 10 };
    }
    // CHARGE
    return { beam: 35, gun: 35, shield: 10, engine: 10, warp: 0, sensor: 10 };
  }
  
  private getTargetPriority(personality: AIPersonality): string {
    // 성격에 따른 타겟 우선순위
    if (personality.aggression > 70) return 'FLAGSHIP_FIRST';
    if (personality.creativity > 70) return 'WEAK_FIRST';
    if (personality.caution > 70) return 'THREAT_FIRST';
    return 'CLOSEST_FIRST';
  }
  
  private sortEnemiesByPriority(
    enemies: TacticalUnitSummary[], 
    priority: string
  ): TacticalUnitSummary[] {
    switch (priority) {
      case 'FLAGSHIP_FIRST':
        return [...enemies].sort((a, b) => {
          if (a.shipClass === 'flagship' && b.shipClass !== 'flagship') return -1;
          if (a.shipClass !== 'flagship' && b.shipClass === 'flagship') return 1;
          return b.combatPower - a.combatPower;
        });
        
      case 'WEAK_FIRST':
        return [...enemies].sort((a, b) => a.combatPower - b.combatPower);
        
      case 'THREAT_FIRST':
        return [...enemies].sort((a, b) => b.combatPower - a.combatPower);
        
      case 'CLOSEST_FIRST':
      default:
        return enemies; // 원래 순서 유지 (실제로는 거리 계산 필요)
    }
  }
}

// Singleton export
export const tacticalAIService = new TacticalAIService();




