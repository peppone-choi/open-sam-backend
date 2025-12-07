/**
 * Tactical AI Style Tests
 * 제독별 전술 스타일 테스트
 */

import { TacticalAIService } from '../TacticalAI';
import {
  AIBlackboard,
  AIPersonality,
  TacticalContext,
  TacticalDecision,
  PERSONALITY_PRESETS,
  TACTICAL_STYLE_CONFIGS,
  TacticalStyle,
} from '../../../../types/gin7/npc-ai.types';

describe('TacticalAI - Admiral Styles', () => {
  let tacticalAI: TacticalAIService;
  
  beforeEach(() => {
    tacticalAI = new TacticalAIService();
  });
  
  // 테스트용 블랙보드 생성 헬퍼
  const createBlackboard = (
    personality: AIPersonality,
    contextOverrides?: Partial<TacticalContext>
  ): AIBlackboard => {
    const defaultContext: TacticalContext = {
      battleId: 'test-battle',
      factionId: 'empire',
      currentTick: 100,
      ownUnits: [
        { unitId: 'unit-1', shipClass: 'battleship', shipCount: 10, hpPercent: 80, morale: 70, combatPower: 1000, hasTarget: false, isRetreating: false, isChaos: false },
        { unitId: 'unit-2', shipClass: 'cruiser', shipCount: 20, hpPercent: 75, morale: 65, combatPower: 800, hasTarget: false, isRetreating: false, isChaos: false },
        { unitId: 'unit-3', shipClass: 'destroyer', shipCount: 30, hpPercent: 70, morale: 60, combatPower: 600, hasTarget: false, isRetreating: false, isChaos: false },
      ],
      ownTotalPower: 2400,
      ownAverageHp: 75,
      ownAverageMorale: 65,
      enemyUnits: [
        { unitId: 'enemy-1', shipClass: 'battleship', shipCount: 8, hpPercent: 70, morale: 60, combatPower: 800, hasTarget: false, isRetreating: false, isChaos: false },
        { unitId: 'enemy-2', shipClass: 'cruiser', shipCount: 15, hpPercent: 65, morale: 55, combatPower: 600, hasTarget: false, isRetreating: false, isChaos: false },
      ],
      enemyTotalPower: 1400,
      enemyAverageHp: 67.5,
      battlePhase: 'OPENING',
      ticksElapsed: 100,
      advantageRatio: 1.71,
      currentFormation: 'LINE',
      currentTargeting: 'CLOSEST',
      warpChargeLevel: 0,
      ...contextOverrides,
    };
    
    return {
      tacticalContext: defaultContext,
      personality,
      currentStrategicDecisions: [],
      currentTacticalDecisions: [],
      tempData: new Map(),
      lastEvaluationTick: 0,
      lastDecisions: [],
      decisionHistory: [],
    };
  };
  
  describe('Reinhard Style (라인하르트 스타일)', () => {
    const personality = PERSONALITY_PRESETS.REINHARD.personality;
    
    it('초반에 공세적 진형을 선택해야 한다', () => {
      const blackboard = createBlackboard(personality, { battlePhase: 'OPENING' });
      
      const decisions = tacticalAI.evaluate(blackboard);
      
      // 공격적 진형 또는 에너지 배분 결정이 있어야 함
      const formationDecision = decisions.find(d => d.type === 'CHANGE_FORMATION');
      const energyDecision = decisions.find(d => d.type === 'CHANGE_ENERGY');
      
      expect(formationDecision || energyDecision).toBeDefined();
      if (formationDecision) {
        expect(['ASSAULT', 'WEDGE', 'OFFENSIVE']).toContain(formationDecision.formation);
      }
    });
    
    it('집중 화력 확률이 높아야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.REINHARD;
      expect(styleConfig.focusFireChance).toBeGreaterThanOrEqual(70);
    });
    
    it('위기 상황에서 돌격을 선택해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.REINHARD;
      expect(styleConfig.desperateAction).toBe('CHARGE');
    });
  });
  
  describe('Yang Wenli Style (양 웬리 스타일)', () => {
    const personality = PERSONALITY_PRESETS.YANG_WENLI.personality;
    
    it('초반에 관찰 태세를 취해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.YANG_WENLI;
      expect(styleConfig.openingAction).toBe('OBSERVE');
    });
    
    it('반격 확률이 매우 높아야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.YANG_WENLI;
      expect(styleConfig.counterattackChance).toBeGreaterThanOrEqual(90);
    });
    
    it('위기 상황에서 게릴라전을 선택해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.YANG_WENLI;
      expect(styleConfig.desperateAction).toBe('GUERRILLA');
    });
    
    it('퇴각 임계값이 높아야 한다 (일찍 퇴각 판단)', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.YANG_WENLI;
      expect(styleConfig.retreatThreshold).toBeGreaterThanOrEqual(40);
    });
  });
  
  describe('Mittermeyer Style (미터마이어 스타일)', () => {
    const personality = PERSONALITY_PRESETS.MITTERMEYER.personality;
    
    it('초반에 기동을 시작해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MITTERMEYER;
      expect(styleConfig.openingAction).toBe('MANEUVER');
    });
    
    it('측면 공격 확률이 매우 높아야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MITTERMEYER;
      expect(styleConfig.flankingChance).toBeGreaterThanOrEqual(80);
    });
    
    it('기동력 중심 에너지 배분이어야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MITTERMEYER;
      expect(styleConfig.defaultEnergyBias).toBe('MOBILITY');
    });
    
    it('위기 상황에서 퇴각을 선택해야 한다 (병력 보존)', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MITTERMEYER;
      expect(styleConfig.desperateAction).toBe('RETREAT');
    });
  });
  
  describe('Reuenthal Style (로이엔탈 스타일)', () => {
    const personality = PERSONALITY_PRESETS.REUENTHAL.personality;
    
    it('상황 적응형 중반 전술이어야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.REUENTHAL;
      expect(styleConfig.midgameAction).toBe('ADAPT');
    });
    
    it('균형잡힌 에너지 배분이어야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.REUENTHAL;
      expect(styleConfig.defaultEnergyBias).toBe('BALANCED');
    });
    
    it('선호 진형이 정공법 중심이어야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.REUENTHAL;
      expect(styleConfig.preferredFormations).toContain('LINE');
    });
  });
  
  describe('Bittenfeld Style (비텐펠트 스타일)', () => {
    const personality = PERSONALITY_PRESETS.BITTENFELD.personality;
    
    it('절대 퇴각하지 않아야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.BITTENFELD;
      expect(styleConfig.retreatThreshold).toBe(0);
    });
    
    it('측면 공격보다 정면 돌파를 선호해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.BITTENFELD;
      expect(styleConfig.flankingChance).toBeLessThanOrEqual(30);
    });
    
    it('모든 전투 단계에서 공격적이어야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.BITTENFELD;
      expect(styleConfig.openingAction).toBe('AGGRESSIVE');
      expect(styleConfig.midgameAction).toBe('PRESS_ATTACK');
      expect(styleConfig.desperateAction).toBe('CHARGE');
    });
    
    it('HP가 낮아도 퇴각하지 않아야 한다', () => {
      const blackboard = createBlackboard(personality, { 
        battlePhase: 'DESPERATE',
        ownAverageHp: 15, // 매우 낮은 HP
        ownAverageMorale: 30,
      });
      
      const decisions = tacticalAI.evaluate(blackboard);
      
      // 퇴각 결정이 없어야 함
      const retreatDecision = decisions.find(d => d.type === 'RETREAT');
      expect(retreatDecision).toBeUndefined();
    });
  });
  
  describe('Merkatz Style (메르카츠 스타일)', () => {
    const personality = PERSONALITY_PRESETS.MERKATZ.personality;
    
    it('초반에 방어적 자세를 취해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MERKATZ;
      expect(styleConfig.openingAction).toBe('DEFENSIVE');
    });
    
    it('위기 상황에서 최후 항전을 선택해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MERKATZ;
      expect(styleConfig.desperateAction).toBe('LAST_STAND');
    });
    
    it('반격 확률이 높아야 한다 (수비 후 반격)', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MERKATZ;
      expect(styleConfig.counterattackChance).toBeGreaterThanOrEqual(70);
    });
    
    it('방어 중심 에너지 배분이어야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.MERKATZ;
      expect(styleConfig.defaultEnergyBias).toBe('DEFENSE');
    });
  });
  
  describe('Fahrenheit Style (파렌하이트 스타일)', () => {
    const personality = PERSONALITY_PRESETS.FAHRENHEIT.personality;
    
    it('절대 퇴각하지 않아야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.FAHRENHEIT;
      expect(styleConfig.retreatThreshold).toBe(0);
    });
    
    it('위기 상황에서 최후 항전을 선택해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.FAHRENHEIT;
      expect(styleConfig.desperateAction).toBe('LAST_STAND');
    });
    
    it('공격적 전술을 선호해야 한다', () => {
      const styleConfig = TACTICAL_STYLE_CONFIGS.FAHRENHEIT;
      expect(styleConfig.openingAction).toBe('AGGRESSIVE');
      expect(styleConfig.defaultEnergyBias).toBe('ATTACK');
    });
  });
  
  describe('Style Configuration Completeness', () => {
    it('모든 스타일 설정이 완전해야 한다', () => {
      const styles: TacticalStyle[] = [
        'REINHARD', 'YANG_WENLI', 'MITTERMEYER', 'REUENTHAL',
        'BITTENFELD', 'MERKATZ', 'FAHRENHEIT', 'DEFAULT'
      ];
      
      styles.forEach(style => {
        const config = TACTICAL_STYLE_CONFIGS[style];
        
        expect(config).toBeDefined();
        expect(config.style).toBe(style);
        expect(config.name).toBeTruthy();
        expect(config.nameKo).toBeTruthy();
        expect(config.description).toBeTruthy();
        expect(['AGGRESSIVE', 'DEFENSIVE', 'MANEUVER', 'OBSERVE']).toContain(config.openingAction);
        expect(['PRESS_ATTACK', 'HOLD_LINE', 'FLANKING', 'ADAPT']).toContain(config.midgameAction);
        expect(['CHARGE', 'RETREAT', 'LAST_STAND', 'GUERRILLA']).toContain(config.desperateAction);
        expect(config.focusFireChance).toBeGreaterThanOrEqual(0);
        expect(config.focusFireChance).toBeLessThanOrEqual(100);
        expect(config.flankingChance).toBeGreaterThanOrEqual(0);
        expect(config.flankingChance).toBeLessThanOrEqual(100);
        expect(config.retreatThreshold).toBeGreaterThanOrEqual(0);
        expect(config.retreatThreshold).toBeLessThanOrEqual(100);
        expect(config.counterattackChance).toBeGreaterThanOrEqual(0);
        expect(config.counterattackChance).toBeLessThanOrEqual(100);
        expect(['ATTACK', 'DEFENSE', 'MOBILITY', 'BALANCED']).toContain(config.defaultEnergyBias);
        expect(config.preferredFormations.length).toBeGreaterThan(0);
      });
    });
    
    it('모든 PERSONALITY_PRESETS에 tacticalStyle이 있어야 한다', () => {
      Object.values(PERSONALITY_PRESETS).forEach(preset => {
        expect(preset.personality.tacticalStyle).toBeDefined();
      });
    });
  });
  
  describe('Battle Phase Transitions', () => {
    it('전투 단계별로 다른 전술을 적용해야 한다', () => {
      const personality = PERSONALITY_PRESETS.REINHARD.personality;
      const phases: TacticalContext['battlePhase'][] = ['OPENING', 'MIDGAME', 'ENDGAME', 'DESPERATE'];
      
      const decisionsByPhase: Record<string, TacticalDecision[]> = {};
      
      phases.forEach(phase => {
        const blackboard = createBlackboard(personality, { battlePhase: phase });
        decisionsByPhase[phase] = tacticalAI.evaluate(blackboard);
      });
      
      // 각 단계별로 결정이 있어야 함
      phases.forEach(phase => {
        expect(decisionsByPhase[phase].length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('Advantage Ratio Impact', () => {
    it('우세할 때와 열세할 때 다른 전술을 취해야 한다', () => {
      const personality = PERSONALITY_PRESETS.YANG_WENLI.personality;
      
      // 우세한 상황
      const advantageBlackboard = createBlackboard(personality, { 
        advantageRatio: 2.0,
        battlePhase: 'MIDGAME'
      });
      
      // 열세한 상황
      const disadvantageBlackboard = createBlackboard(personality, { 
        advantageRatio: 0.5,
        battlePhase: 'MIDGAME'
      });
      
      const advantageDecisions = tacticalAI.evaluate(advantageBlackboard);
      const disadvantageDecisions = tacticalAI.evaluate(disadvantageBlackboard);
      
      // 결정이 있어야 함
      expect(advantageDecisions.length).toBeGreaterThan(0);
      expect(disadvantageDecisions.length).toBeGreaterThan(0);
      
      // 열세일 때 방어적 결정이 있을 가능성이 높음
      const hasDefensiveDecision = disadvantageDecisions.some(d => 
        d.type === 'CHANGE_FORMATION' && d.formation === 'DEFENSIVE' ||
        d.type === 'HOLD_POSITION' ||
        d.reasoning?.includes('방어')
      );
      
      expect(hasDefensiveDecision).toBeTruthy();
    });
  });
});





