/**
 * Admiral Personality Service
 * 
 * 제독 성격 시스템을 관리합니다:
 * - 역사적 제독 성격 데이터
 * - 성격별 전술 선호도
 * - 성격 기반 의사결정
 * - 양 웬리, 라인하르트 등 원작 캐릭터 AI
 */

import { EventEmitter } from 'events';
import {
  AdmiralPersonalityData,
  AdmiralDecisionWeights,
  AIPersonality,
  TacticalDecision,
  TacticalContext,
  PERSONALITY_PRESETS,
  TACTICAL_STYLE_CONFIGS,
  TacticalStyle,
} from '../../../types/gin7/npc-ai.types';
import { logger } from '../../../common/logger';

// ============================================================
// Historical Admiral Data
// ============================================================

export const HISTORICAL_ADMIRALS: Record<string, AdmiralPersonalityData> = {
  // 은하제국 제독들
  REINHARD_VON_LOHENGRAMM: {
    admiralId: 'REINHARD_VON_LOHENGRAMM',
    name: 'Reinhard von Lohengramm',
    nameKo: '라인하르트 폰 로엔그람',
    faction: 'GALACTIC_EMPIRE',
    isHistorical: true,
    canonDescription: '금발의 천재. 압도적인 전술적 재능과 카리스마로 은하제국을 재건한 황제.',
    personality: PERSONALITY_PRESETS.REINHARD.personality,
    preferredShipClasses: ['battleship', 'flagship'],
    signatureManeuvers: ['CENTER_BREAKTHROUGH', 'CONCENTRATED_ATTACK', 'OVERWHELMING_FORCE'],
    weaknesses: ['OVERCONFIDENCE', 'IMPATIENCE'],
    decisionWeights: {
      attackWeight: 85,
      defenseWeight: 40,
      retreatWeight: 20,
      flankWeight: 60,
      feintWeight: 50,
      ambushWeight: 40,
    },
  },
  
  WOLFGANG_MITTERMEYER: {
    admiralId: 'WOLFGANG_MITTERMEYER',
    name: 'Wolfgang Mittermeyer',
    nameKo: '볼프강 미터마이어',
    faction: 'GALACTIC_EMPIRE',
    isHistorical: true,
    canonDescription: '질풍 볼프. 신속한 기동전의 대가로, 황제의 쌍벽 중 한 명.',
    personality: PERSONALITY_PRESETS.MITTERMEYER.personality,
    preferredShipClasses: ['cruiser', 'destroyer'],
    signatureManeuvers: ['RAPID_FLANKING', 'LIGHTNING_STRIKE', 'PURSUIT'],
    weaknesses: ['LEAVING_REARGUARD'],
    decisionWeights: {
      attackWeight: 70,
      defenseWeight: 55,
      retreatWeight: 50,
      flankWeight: 95,
      feintWeight: 60,
      ambushWeight: 40,
    },
  },
  
  OSKAR_VON_REUENTHAL: {
    admiralId: 'OSKAR_VON_REUENTHAL',
    name: 'Oskar von Reuenthal',
    nameKo: '오스카 폰 로이엔탈',
    faction: 'GALACTIC_EMPIRE',
    isHistorical: true,
    canonDescription: '이색동공의 재능인. 황제의 쌍벽 중 한 명으로, 정공법을 선호.',
    personality: PERSONALITY_PRESETS.REUENTHAL.personality,
    preferredShipClasses: ['battleship', 'cruiser'],
    signatureManeuvers: ['FRONTAL_ASSAULT', 'COMBINED_ARMS', 'ADAPTIVE_FORMATION'],
    weaknesses: ['PRIDE', 'AMBITION'],
    decisionWeights: {
      attackWeight: 80,
      defenseWeight: 50,
      retreatWeight: 35,
      flankWeight: 50,
      feintWeight: 45,
      ambushWeight: 30,
    },
  },
  
  FRITZ_JOSEPH_BITTENFELD: {
    admiralId: 'FRITZ_JOSEPH_BITTENFELD',
    name: 'Fritz Joseph Bittenfeld',
    nameKo: '프리츠 요제프 비텐펠트',
    faction: 'GALACTIC_EMPIRE',
    isHistorical: true,
    canonDescription: '검은 창기병. 무모할 정도로 공격적인 돌격 전문가.',
    personality: PERSONALITY_PRESETS.BITTENFELD.personality,
    preferredShipClasses: ['battleship'],
    signatureManeuvers: ['RECKLESS_CHARGE', 'ALL_OUT_ATTACK', 'NO_RETREAT'],
    weaknesses: ['RECKLESSNESS', 'IGNORING_CASUALTIES'],
    decisionWeights: {
      attackWeight: 95,
      defenseWeight: 20,
      retreatWeight: 5,
      flankWeight: 30,
      feintWeight: 15,
      ambushWeight: 10,
    },
  },
  
  WILLIBALD_VON_MERKATZ: {
    admiralId: 'WILLIBALD_VON_MERKATZ',
    name: 'Willibald Joachim von Merkatz',
    nameKo: '빌리발트 요아힘 폰 메르카츠',
    faction: 'GALACTIC_EMPIRE',
    isHistorical: true,
    canonDescription: '노련한 제독. 신중하고 안정적인 지휘로 유명.',
    personality: PERSONALITY_PRESETS.MERKATZ.personality,
    preferredShipClasses: ['battleship', 'carrier'],
    signatureManeuvers: ['DEFENSIVE_FORMATION', 'CONTROLLED_RETREAT', 'COUNTERATTACK'],
    weaknesses: ['EXCESSIVE_CAUTION', 'SLOW_ADAPTATION'],
    decisionWeights: {
      attackWeight: 45,
      defenseWeight: 85,
      retreatWeight: 60,
      flankWeight: 35,
      feintWeight: 40,
      ambushWeight: 50,
    },
  },
  
  ADALBERT_VON_FAHRENHEIT: {
    admiralId: 'ADALBERT_VON_FAHRENHEIT',
    name: 'Adalbert von Fahrenheit',
    nameKo: '아달베르트 폰 파렌하이트',
    faction: 'GALACTIC_EMPIRE',
    isHistorical: true,
    canonDescription: '충성스러운 돌격가. 절대 퇴각하지 않는 것으로 유명.',
    personality: PERSONALITY_PRESETS.FAHRENHEIT.personality,
    preferredShipClasses: ['battleship', 'cruiser'],
    signatureManeuvers: ['LOYAL_CHARGE', 'LAST_STAND', 'SACRIFICE_PLAY'],
    weaknesses: ['NO_RETREAT_MENTALITY'],
    decisionWeights: {
      attackWeight: 75,
      defenseWeight: 50,
      retreatWeight: 0,
      flankWeight: 35,
      feintWeight: 20,
      ambushWeight: 25,
    },
  },
  
  // 자유행성동맹 제독들
  YANG_WENLI: {
    admiralId: 'YANG_WENLI',
    name: 'Yang Wen-li',
    nameKo: '양 웬리',
    faction: 'FREE_PLANETS_ALLIANCE',
    isHistorical: true,
    canonDescription: '기적의 양. 역사상 가장 뛰어난 전술가로, 비정통적 전략의 대가.',
    personality: PERSONALITY_PRESETS.YANG_WENLI.personality,
    preferredShipClasses: ['cruiser', 'destroyer'],
    signatureManeuvers: ['STRATEGIC_RETREAT', 'COUNTERATTACK', 'GUERRILLA', 'FEINT'],
    weaknesses: ['LACK_OF_AMBITION', 'PASSIVE_START'],
    decisionWeights: {
      attackWeight: 35,
      defenseWeight: 75,
      retreatWeight: 70,
      flankWeight: 80,
      feintWeight: 95,
      ambushWeight: 90,
    },
  },
  
  ALEXANDER_BEWCOCK: {
    admiralId: 'ALEXANDER_BEWCOCK',
    name: 'Alexander Bewcock',
    nameKo: '알렉산더 뷰코크',
    faction: 'FREE_PLANETS_ALLIANCE',
    isHistorical: true,
    canonDescription: '동맹 함대 최고의 제독. 노련하고 신중한 지휘관.',
    personality: {
      aggression: 50,
      caution: 70,
      creativity: 55,
      loyalty: 95,
      patience: 80,
      prefersFlanking: false,
      prefersDefensive: true,
      prefersGuerrilla: false,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'MERKATZ' as TacticalStyle,
    },
    preferredShipClasses: ['battleship', 'cruiser'],
    signatureManeuvers: ['STEADY_ADVANCE', 'DEFENSIVE_LINE', 'ORDERLY_RETREAT'],
    weaknesses: ['CONVENTIONAL_THINKING'],
    decisionWeights: {
      attackWeight: 50,
      defenseWeight: 75,
      retreatWeight: 55,
      flankWeight: 40,
      feintWeight: 35,
      ambushWeight: 40,
    },
  },
  
  DUSTY_ATTENBOROUGH: {
    admiralId: 'DUSTY_ATTENBOROUGH',
    name: 'Dusty Attenborough',
    nameKo: '더스티 아텐보로',
    faction: 'FREE_PLANETS_ALLIANCE',
    isHistorical: true,
    canonDescription: '양 웬리의 측근. 공격적이면서도 유연한 지휘관.',
    personality: {
      aggression: 65,
      caution: 50,
      creativity: 70,
      loyalty: 90,
      patience: 45,
      prefersFlanking: true,
      prefersDefensive: false,
      prefersGuerrilla: true,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'DEFAULT' as TacticalStyle,
    },
    preferredShipClasses: ['cruiser', 'destroyer'],
    signatureManeuvers: ['AGGRESSIVE_FLANK', 'PURSUIT', 'COORDINATED_ATTACK'],
    weaknesses: ['IMPULSIVENESS'],
    decisionWeights: {
      attackWeight: 65,
      defenseWeight: 50,
      retreatWeight: 45,
      flankWeight: 70,
      feintWeight: 55,
      ambushWeight: 60,
    },
  },
  
  WALTER_VON_SCHENKOPP: {
    admiralId: 'WALTER_VON_SCHENKOPP',
    name: 'Walter von Schenkopp',
    nameKo: '발터 폰 셴코프',
    faction: 'FREE_PLANETS_ALLIANCE',
    isHistorical: true,
    canonDescription: '로젠리터 연대장. 근접전과 기습의 달인.',
    personality: {
      aggression: 80,
      caution: 40,
      creativity: 75,
      loyalty: 85,
      patience: 30,
      prefersFlanking: true,
      prefersDefensive: false,
      prefersGuerrilla: true,
      willRetreat: true,
      acceptsSurrender: true,
      tacticalStyle: 'DEFAULT' as TacticalStyle,
    },
    preferredShipClasses: ['transport', 'corvette'],
    signatureManeuvers: ['BOARDING_ACTION', 'SURPRISE_ATTACK', 'CLOSE_QUARTERS'],
    weaknesses: ['OVERRELIANCE_ON_SHOCK_TACTICS'],
    decisionWeights: {
      attackWeight: 80,
      defenseWeight: 35,
      retreatWeight: 40,
      flankWeight: 65,
      feintWeight: 60,
      ambushWeight: 95,
    },
  },
};

// ============================================================
// Admiral Personality Service
// ============================================================

export class AdmiralPersonalityService extends EventEmitter {
  private admirals: Map<string, AdmiralPersonalityData> = new Map();
  
  constructor() {
    super();
    this.loadHistoricalAdmirals();
  }
  
  /**
   * 역사적 제독 데이터 로드
   */
  private loadHistoricalAdmirals(): void {
    for (const [id, admiral] of Object.entries(HISTORICAL_ADMIRALS)) {
      this.admirals.set(id, admiral);
    }
    
    logger.info('[AdmiralPersonality] Historical admirals loaded', {
      count: Object.keys(HISTORICAL_ADMIRALS).length,
    });
  }
  
  // ============================================================
  // Admiral Management
  // ============================================================
  
  /**
   * 제독 가져오기
   */
  getAdmiral(admiralId: string): AdmiralPersonalityData | undefined {
    return this.admirals.get(admiralId);
  }
  
  /**
   * 모든 제독 목록
   */
  getAllAdmirals(): AdmiralPersonalityData[] {
    return Array.from(this.admirals.values());
  }
  
  /**
   * 진영별 제독 목록
   */
  getAdmiralsByFaction(faction: AdmiralPersonalityData['faction']): AdmiralPersonalityData[] {
    return Array.from(this.admirals.values())
      .filter(a => a.faction === faction);
  }
  
  /**
   * 역사적 제독만 가져오기
   */
  getHistoricalAdmirals(): AdmiralPersonalityData[] {
    return Array.from(this.admirals.values())
      .filter(a => a.isHistorical);
  }
  
  /**
   * 커스텀 제독 등록
   */
  registerCustomAdmiral(admiral: AdmiralPersonalityData): void {
    this.admirals.set(admiral.admiralId, admiral);
    
    logger.info('[AdmiralPersonality] Custom admiral registered', {
      admiralId: admiral.admiralId,
      name: admiral.name,
    });
  }
  
  // ============================================================
  // Personality-Based Decision Making
  // ============================================================
  
  /**
   * 성격 기반 전술 결정 수정
   */
  modifyDecision(
    admiralId: string,
    baseDecision: TacticalDecision,
    context: TacticalContext
  ): TacticalDecision {
    const admiral = this.admirals.get(admiralId);
    if (!admiral) return baseDecision;
    
    const modifiedDecision = { ...baseDecision };
    const weights = admiral.decisionWeights;
    
    // 제독 성격에 따른 결정 수정
    switch (baseDecision.type) {
      case 'ATTACK_TARGET':
      case 'FOCUS_FIRE':
        modifiedDecision.reasoning = `[${admiral.nameKo}] ${baseDecision.reasoning}`;
        
        // 공격 성향에 따른 에너지 배분 조정
        if (modifiedDecision.energyDistribution) {
          const attackBias = weights.attackWeight / 100;
          modifiedDecision.energyDistribution.beam = Math.min(
            50, 
            Math.round(modifiedDecision.energyDistribution.beam * (0.8 + attackBias * 0.4))
          );
          modifiedDecision.energyDistribution.shield = Math.max(
            10,
            Math.round(modifiedDecision.energyDistribution.shield * (1.2 - attackBias * 0.4))
          );
        }
        break;
        
      case 'RETREAT':
        // 퇴각 의향이 낮으면 방어로 전환 가능
        if (weights.retreatWeight < 30 && context.ownAverageHp > 15) {
          modifiedDecision.type = 'HOLD_POSITION';
          modifiedDecision.reasoning = `[${admiral.nameKo}] 퇴각 거부 - 최후까지 항전`;
        } else {
          modifiedDecision.reasoning = `[${admiral.nameKo}] ${baseDecision.reasoning}`;
        }
        break;
        
      case 'CHANGE_FORMATION':
        // 시그니처 기동 적용
        if (admiral.signatureManeuvers.length > 0 && Math.random() < 0.3) {
          const maneuver = admiral.signatureManeuvers[
            Math.floor(Math.random() * admiral.signatureManeuvers.length)
          ];
          modifiedDecision.reasoning = `[${admiral.nameKo}] 시그니처 기동: ${maneuver}`;
        }
        break;
    }
    
    return modifiedDecision;
  }
  
  /**
   * 제독 성격에 따른 우선 전술 선택
   */
  suggestTactic(
    admiralId: string,
    context: TacticalContext
  ): { tactic: string; weight: number; reasoning: string } | null {
    const admiral = this.admirals.get(admiralId);
    if (!admiral) return null;
    
    const weights = admiral.decisionWeights;
    const suggestions: { tactic: string; weight: number; reasoning: string }[] = [];
    
    // 상황별 전술 제안
    
    // 공격 우위 시
    if (context.advantageRatio > 1.3) {
      suggestions.push({
        tactic: 'ATTACK',
        weight: weights.attackWeight,
        reasoning: '전력 우위 - 공세 전환 권장',
      });
      
      if (weights.flankWeight > 50) {
        suggestions.push({
          tactic: 'FLANKING',
          weight: weights.flankWeight,
          reasoning: '측면 공격으로 적 진형 붕괴 가능',
        });
      }
    }
    
    // 열세 시
    else if (context.advantageRatio < 0.7) {
      if (weights.retreatWeight > 50) {
        suggestions.push({
          tactic: 'RETREAT',
          weight: weights.retreatWeight,
          reasoning: '전력 열세 - 전략적 후퇴 권장',
        });
      }
      
      if (weights.feintWeight > 60) {
        suggestions.push({
          tactic: 'FEINT',
          weight: weights.feintWeight,
          reasoning: '양동 작전으로 적 분산 유도',
        });
      }
      
      if (weights.defenseWeight > 70) {
        suggestions.push({
          tactic: 'DEFENSIVE',
          weight: weights.defenseWeight,
          reasoning: '방어적 태세로 시간 벌기',
        });
      }
    }
    
    // 균형 상태
    else {
      if (weights.ambushWeight > 60) {
        suggestions.push({
          tactic: 'AMBUSH',
          weight: weights.ambushWeight,
          reasoning: '매복 기회 포착 가능',
        });
      }
      
      suggestions.push({
        tactic: 'ADAPT',
        weight: 50,
        reasoning: '상황 관찰 후 대응',
      });
    }
    
    // 가장 높은 가중치의 전술 선택
    if (suggestions.length === 0) return null;
    
    suggestions.sort((a, b) => b.weight - a.weight);
    return suggestions[0];
  }
  
  /**
   * 제독의 약점 체크
   */
  checkWeakness(
    admiralId: string,
    context: TacticalContext
  ): { weakness: string; exploitable: boolean; suggestion: string } | null {
    const admiral = this.admirals.get(admiralId);
    if (!admiral) return null;
    
    for (const weakness of admiral.weaknesses) {
      switch (weakness) {
        case 'OVERCONFIDENCE':
          if (context.advantageRatio > 1.5 && context.battlePhase === 'MIDGAME') {
            return {
              weakness,
              exploitable: true,
              suggestion: '과신으로 인한 방어 소홀 가능성',
            };
          }
          break;
          
        case 'IMPATIENCE':
          if (context.battlePhase === 'OPENING') {
            return {
              weakness,
              exploitable: true,
              suggestion: '조급한 공격으로 진형 붕괴 유도 가능',
            };
          }
          break;
          
        case 'RECKLESSNESS':
          if (context.ownAverageHp < 50) {
            return {
              weakness,
              exploitable: true,
              suggestion: '무모한 돌격으로 자멸 가능성',
            };
          }
          break;
          
        case 'EXCESSIVE_CAUTION':
          if (context.advantageRatio > 1.2) {
            return {
              weakness,
              exploitable: true,
              suggestion: '우위에도 소극적 대응 예상',
            };
          }
          break;
          
        case 'NO_RETREAT_MENTALITY':
          if (context.ownAverageHp < 30) {
            return {
              weakness,
              exploitable: true,
              suggestion: '퇴각 거부로 전멸 위험',
            };
          }
          break;
          
        case 'LACK_OF_AMBITION':
          if (context.advantageRatio > 2.0) {
            return {
              weakness,
              exploitable: true,
              suggestion: '결정적 승기 놓칠 가능성',
            };
          }
          break;
      }
    }
    
    return null;
  }
  
  // ============================================================
  // Character-Specific AI Behaviors
  // ============================================================
  
  /**
   * 양 웬리 스타일 의사결정
   */
  yangWenliDecision(context: TacticalContext): TacticalDecision | null {
    const admiral = this.admirals.get('YANG_WENLI');
    if (!admiral) return null;
    
    // 양 웬리 특성: 적 실수 유도, 후퇴 후 반격
    
    // 열세 상황 - 유인 후퇴
    if (context.advantageRatio < 0.8) {
      return {
        type: 'MOVE_POSITION',
        unitIds: context.ownUnits.filter(u => !u.isChaos).map(u => u.unitId),
        target: { x: 0, y: 0, z: -3000 }, // 후방으로 이동
        energyDistribution: {
          beam: 10,
          gun: 10,
          shield: 30,
          engine: 25,
          warp: 15,
          sensor: 10,
        },
        reasoning: '[양 웬리] 유인 후퇴 - 적의 추격을 유도하여 진형 붕괴 노림',
      };
    }
    
    // 적이 추격해온 경우 - 반격
    if (context.battlePhase === 'MIDGAME' && context.advantageRatio > 0.9) {
      const weakestEnemy = context.enemyUnits
        .sort((a, b) => a.combatPower - b.combatPower)[0];
      
      if (weakestEnemy) {
        return {
          type: 'FOCUS_FIRE',
          unitIds: context.ownUnits.filter(u => !u.isChaos).map(u => u.unitId),
          target: weakestEnemy.unitId,
          energyDistribution: {
            beam: 35,
            gun: 30,
            shield: 15,
            engine: 10,
            warp: 0,
            sensor: 10,
          },
          reasoning: '[양 웬리] 반격 타이밍 - 집중 화력으로 각개 격파',
        };
      }
    }
    
    return null;
  }
  
  /**
   * 라인하르트 스타일 의사결정
   */
  reinhardDecision(context: TacticalContext): TacticalDecision | null {
    const admiral = this.admirals.get('REINHARD_VON_LOHENGRAMM');
    if (!admiral) return null;
    
    // 라인하르트 특성: 압도적 화력, 중앙 돌파
    
    // 우세 상황 - 중앙 돌파
    if (context.advantageRatio > 1.2) {
      return {
        type: 'CHARGE',
        unitIds: context.ownUnits.filter(u => !u.isChaos).map(u => u.unitId),
        energyDistribution: {
          beam: 40,
          gun: 35,
          shield: 10,
          engine: 10,
          warp: 0,
          sensor: 5,
        },
        reasoning: '[라인하르트] 중앙 돌파 - 압도적 화력으로 적 진형 분쇄',
      };
    }
    
    // 균형 상황 - 집중 화력
    if (context.advantageRatio > 0.9 && context.enemyUnits.length > 0) {
      const priorityTarget = context.enemyUnits
        .filter(u => u.shipClass === 'flagship' || u.shipClass === 'battleship')
        .sort((a, b) => b.combatPower - a.combatPower)[0] 
        || context.enemyUnits[0];
      
      return {
        type: 'FOCUS_FIRE',
        unitIds: context.ownUnits.filter(u => !u.isChaos).map(u => u.unitId),
        target: priorityTarget.unitId,
        energyDistribution: {
          beam: 35,
          gun: 30,
          shield: 15,
          engine: 10,
          warp: 0,
          sensor: 10,
        },
        reasoning: '[라인하르트] 집중 화력 - 적 주력함 우선 격파',
      };
    }
    
    return null;
  }
  
  /**
   * 미터마이어 스타일 의사결정
   */
  mittermeyerDecision(context: TacticalContext): TacticalDecision | null {
    const admiral = this.admirals.get('WOLFGANG_MITTERMEYER');
    if (!admiral) return null;
    
    // 미터마이어 특성: 고속 기동, 측면 공격
    
    // 측면 공격 기동
    const unitIds = context.ownUnits.filter(u => !u.isChaos).map(u => u.unitId);
    const halfCount = Math.ceil(unitIds.length / 2);
    
    return {
      type: 'MOVE_POSITION',
      unitIds: unitIds.slice(0, halfCount),
      target: { x: 4000, y: 0, z: 2000 }, // 측면으로 기동
      energyDistribution: {
        beam: 20,
        gun: 15,
        shield: 15,
        engine: 40,
        warp: 0,
        sensor: 10,
      },
      reasoning: '[미터마이어] 고속 측면 기동 - 적 측면 포위 시도',
    };
  }
  
  /**
   * 비텐펠트 스타일 의사결정
   */
  bittenfeldDecision(context: TacticalContext): TacticalDecision | null {
    const admiral = this.admirals.get('FRITZ_JOSEPH_BITTENFELD');
    if (!admiral) return null;
    
    // 비텐펠트 특성: 무조건 돌격, 퇴각 없음
    
    // 항상 돌격
    return {
      type: 'CHARGE',
      unitIds: context.ownUnits.filter(u => !u.isChaos).map(u => u.unitId),
      energyDistribution: {
        beam: 45,
        gun: 40,
        shield: 5,
        engine: 10,
        warp: 0,
        sensor: 0,
      },
      reasoning: '[비텐펠트] 검은 창기병 돌격! 퇴각은 없다!',
    };
  }
  
  // ============================================================
  // Utility
  // ============================================================
  
  /**
   * 제독 성격 요약
   */
  getAdmiralSummary(admiralId: string): string | null {
    const admiral = this.admirals.get(admiralId);
    if (!admiral) return null;
    
    const personality = admiral.personality;
    const traits: string[] = [];
    
    if (personality.aggression > 70) traits.push('공격적');
    else if (personality.aggression < 40) traits.push('신중');
    
    if (personality.creativity > 70) traits.push('창의적');
    if (personality.caution > 70) traits.push('방어적');
    if (personality.patience > 70) traits.push('인내심 강함');
    
    if (personality.prefersFlanking) traits.push('측면 공격 선호');
    if (personality.prefersGuerrilla) traits.push('게릴라전 선호');
    if (!personality.willRetreat) traits.push('퇴각 거부');
    
    return `${admiral.nameKo}: ${traits.join(', ')}`;
  }
  
  /**
   * 정리
   */
  destroy(): void {
    this.admirals.clear();
    this.removeAllListeners();
    logger.info('[AdmiralPersonality] Service destroyed');
  }
}

// Singleton export
export const admiralPersonalityService = new AdmiralPersonalityService();





