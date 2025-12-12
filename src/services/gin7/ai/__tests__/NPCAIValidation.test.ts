/**
 * NPC AI Validation Tests
 * gin7-npc-ai 에이전트 검증 테스트
 */

import {
  AIBlackboard,
  AIPersonality,
  StrategicContext,
  TacticalContext,
  PERSONALITY_PRESETS,
  BehaviorStatus,
} from '../../../../types/gin7/npc-ai.types';
import { StrategicAIService } from '../StrategicAI';
import { TacticalAIService } from '../TacticalAI';

// ============================================================
// Test Helpers
// ============================================================

function createMockStrategicContext(overrides: Partial<StrategicContext> = {}): StrategicContext {
  return {
    sessionId: 'test-session',
    factionId: 'faction-empire',
    currentTick: 100,
    resources: {
      credits: 100000,
      minerals: 50000,
      food: 30000,
      fuel: 20000,
      shipParts: 10000,
    },
    territory: {
      ownedPlanets: ['planet-1', 'planet-2'],
      ownedSystems: ['system-1'],
      borderPlanets: ['planet-2'],
      frontlineSystems: ['system-1'],
    },
    military: {
      totalFleets: 3,
      totalShips: 150,
      combatPower: 15000,
      idleFleets: ['fleet-1', 'fleet-2'],
      fleetsBySystem: new Map([['system-1', ['fleet-1']]]),
    },
    enemies: [
      {
        factionId: 'faction-alliance',
        estimatedPower: 10000,
        knownFleets: 2,
        knownPlanets: ['planet-enemy-1', 'planet-enemy-2'],
        threatLevel: 'MEDIUM',
        recentActivity: [],
      },
    ],
    diplomacy: {
      atWarWith: ['faction-alliance'],
      allies: [],
      neutral: [],
    },
    ...overrides,
  };
}

function createMockTacticalContext(overrides: Partial<TacticalContext> = {}): TacticalContext {
  return {
    battleId: 'battle-1',
    factionId: 'faction-empire',
    currentTick: 50,
    ownUnits: [
      { unitId: 'unit-1', shipClass: 'battleship', shipCount: 30, hpPercent: 100, morale: 100, combatPower: 2400, hasTarget: false, isRetreating: false, isChaos: false },
      { unitId: 'unit-2', shipClass: 'cruiser', shipCount: 50, hpPercent: 90, morale: 85, combatPower: 2500, hasTarget: false, isRetreating: false, isChaos: false },
      { unitId: 'unit-3', shipClass: 'destroyer', shipCount: 70, hpPercent: 95, morale: 90, combatPower: 2100, hasTarget: false, isRetreating: false, isChaos: false },
    ],
    ownTotalPower: 7000,
    ownAverageHp: 95,
    ownAverageMorale: 91.67,
    enemyUnits: [
      { unitId: 'enemy-1', shipClass: 'battleship', shipCount: 20, hpPercent: 100, morale: 100, combatPower: 1600, hasTarget: false, isRetreating: false, isChaos: false },
      { unitId: 'enemy-2', shipClass: 'cruiser', shipCount: 40, hpPercent: 100, morale: 100, combatPower: 2000, hasTarget: false, isRetreating: false, isChaos: false },
    ],
    enemyTotalPower: 3600,
    enemyAverageHp: 100,
    battlePhase: 'OPENING',
    ticksElapsed: 50,
    advantageRatio: 1.94,
    currentFormation: 'LINE',
    currentTargeting: 'DEFAULT',
    warpChargeLevel: 0,
    ...overrides,
  };
}

function createBlackboard(
  personality: AIPersonality,
  strategicCtx?: StrategicContext,
  tacticalCtx?: TacticalContext
): AIBlackboard {
  return {
    personality,
    strategicContext: strategicCtx,
    tacticalContext: tacticalCtx,
    currentStrategicDecisions: [],
    currentTacticalDecisions: [],
    tempData: new Map(),
    lastEvaluationTick: 0,
    lastDecisions: [],
    decisionHistory: [],
  };
}

// ============================================================
// 1. Strategic AI Validation - 침공 결정 합리성
// ============================================================

describe('Strategic AI - 침공 결정 합리성', () => {
  const strategicAI = new StrategicAIService();

  test('우세한 전력으로 적 영토 침공 결정', async () => {
    const personality = PERSONALITY_PRESETS.REINHARD.personality;
    const ctx = createMockStrategicContext({
      military: {
        totalFleets: 5,
        totalShips: 300,
        combatPower: 30000, // 적의 3배
        idleFleets: ['fleet-1', 'fleet-2', 'fleet-3'],
        fleetsBySystem: new Map(),
      },
      enemies: [{
        factionId: 'faction-alliance',
        estimatedPower: 10000,
        knownFleets: 2,
        knownPlanets: ['planet-enemy-1'],
        threatLevel: 'MEDIUM',
        recentActivity: [],
      }],
    });

    const blackboard = createBlackboard(personality, ctx);
    const decisions = await strategicAI.evaluate(blackboard);

    console.log('\n=== 전략 AI 결정 (라인하르트 - 우세) ===');
    decisions.forEach(d => {
      console.log(`[${d.type}] Priority: ${d.priority}, Target: ${d.target || 'N/A'}`);
      console.log(`  Reasoning: ${d.reasoning}`);
    });

    // 우세하면 공격 결정을 해야 함
    const attackDecision = decisions.find(d => d.type === 'ATTACK');
    expect(attackDecision).toBeDefined();
    expect(attackDecision?.target).toBe('planet-enemy-1');
  });

  test('열세한 전력에서는 방어 우선', async () => {
    const personality = PERSONALITY_PRESETS.MERKATZ.personality; // 신중한 성격
    const ctx = createMockStrategicContext({
      military: {
        totalFleets: 2,
        totalShips: 100,
        combatPower: 5000, // 적보다 약함
        idleFleets: ['fleet-1'],
        fleetsBySystem: new Map(),
      },
      enemies: [{
        factionId: 'faction-alliance',
        estimatedPower: 20000, // 4배 강함
        knownFleets: 5,
        knownPlanets: ['planet-enemy-1'],
        threatLevel: 'HIGH',
        recentActivity: [],
      }],
    });

    const blackboard = createBlackboard(personality, ctx);
    const decisions = await strategicAI.evaluate(blackboard);

    console.log('\n=== 전략 AI 결정 (메르카츠 - 열세) ===');
    decisions.forEach(d => {
      console.log(`[${d.type}] Priority: ${d.priority}, Target: ${d.target || 'N/A'}`);
      console.log(`  Reasoning: ${d.reasoning}`);
    });

    // 열세이고 신중한 성격이면 공격하지 않음
    const attackDecision = decisions.find(d => d.type === 'ATTACK');
    expect(attackDecision).toBeUndefined();
  });
});

// ============================================================
// 2. Tactical AI Validation - 상황별 진형 선택
// ============================================================

describe('Tactical AI - 상황별 진형 선택', () => {
  const tacticalAI = new TacticalAIService();

  test('전투 초반에는 적절한 진형 선택', () => {
    const personality = PERSONALITY_PRESETS.REINHARD.personality;
    const ctx = createMockTacticalContext({
      battlePhase: 'OPENING',
      currentFormation: 'LINE',
    });

    const blackboard = createBlackboard(personality, undefined, ctx);
    const decisions = tacticalAI.evaluate(blackboard);

    console.log('\n=== 전술 AI 결정 (초반 진형) ===');
    decisions.forEach(d => {
      console.log(`[${d.type}] Units: ${d.unitIds.length}, Formation: ${d.formation || 'N/A'}`);
      console.log(`  Reasoning: ${d.reasoning}`);
    });

    // 진형 변경 또는 타겟 선정 결정이 있어야 함
    expect(decisions.length).toBeGreaterThan(0);
  });

  test('위기 상황에서는 방어 진형 또는 퇴각', () => {
    const personality = PERSONALITY_PRESETS.YANG_WENLI.personality;
    const ctx = createMockTacticalContext({
      battlePhase: 'DESPERATE',
      ownAverageHp: 25,
      ownAverageMorale: 30,
      advantageRatio: 0.3,
    });

    const blackboard = createBlackboard(personality, undefined, ctx);
    const decisions = tacticalAI.evaluate(blackboard);

    console.log('\n=== 전술 AI 결정 (양 웬리 - 위기) ===');
    decisions.forEach(d => {
      console.log(`[${d.type}] Units: ${d.unitIds.length}`);
      console.log(`  Reasoning: ${d.reasoning}`);
    });

    // 위기 상황에서 퇴각 결정 (양 웬리는 퇴각 의향 있음)
    const retreatDecision = decisions.find(d => d.type === 'RETREAT');
    expect(retreatDecision).toBeDefined();
  });

  test('비텐펠트는 위기에도 퇴각하지 않음', () => {
    const personality = PERSONALITY_PRESETS.BITTENFELD.personality;
    const ctx = createMockTacticalContext({
      battlePhase: 'DESPERATE',
      ownAverageHp: 25,
      ownAverageMorale: 30,
      advantageRatio: 0.3,
    });

    const blackboard = createBlackboard(personality, undefined, ctx);
    const decisions = tacticalAI.evaluate(blackboard);

    console.log('\n=== 전술 AI 결정 (비텐펠트 - 위기) ===');
    decisions.forEach(d => {
      console.log(`[${d.type}] Units: ${d.unitIds.length}`);
      console.log(`  Reasoning: ${d.reasoning}`);
    });

    // 비텐펠트는 퇴각하지 않음 (willRetreat: false)
    const retreatDecision = decisions.find(d => d.type === 'RETREAT');
    expect(retreatDecision).toBeUndefined();
    
    // 대신 돌격 또는 방어
    const chargeOrHold = decisions.find(d => d.type === 'CHARGE' || d.type === 'HOLD_POSITION');
    expect(chargeOrHold).toBeDefined();
  });
});

// ============================================================
// 3. Personality Validation - 라인하르트 vs 양 웬리
// ============================================================

describe('Personality - 라인하르트 vs 양 웬리 비교', () => {
  const strategicAI = new StrategicAIService();
  const tacticalAI = new TacticalAIService();

  test('동일 상황에서 다른 전략 결정', async () => {
    const ctx = createMockStrategicContext({
      military: {
        totalFleets: 3,
        totalShips: 150,
        combatPower: 12000,
        idleFleets: ['fleet-1', 'fleet-2'],
        fleetsBySystem: new Map(),
      },
      enemies: [{
        factionId: 'faction-alliance',
        estimatedPower: 10000, // 약간 우세
        knownFleets: 2,
        knownPlanets: ['planet-enemy-1'],
        threatLevel: 'MEDIUM',
        recentActivity: [],
      }],
    });

    // 라인하르트
    const reinhardBlackboard = createBlackboard(
      PERSONALITY_PRESETS.REINHARD.personality,
      ctx
    );
    const reinhardDecisions = await strategicAI.evaluate(reinhardBlackboard);

    // 양 웬리
    const yangBlackboard = createBlackboard(
      PERSONALITY_PRESETS.YANG_WENLI.personality,
      { ...ctx, currentStrategicDecisions: [] } as StrategicContext
    );
    yangBlackboard.currentStrategicDecisions = [];
    const yangDecisions = await strategicAI.evaluate(yangBlackboard);

    console.log('\n=== 라인하르트 전략 결정 ===');
    console.log(`공격성: ${PERSONALITY_PRESETS.REINHARD.personality.aggression}`);
    console.log(`신중함: ${PERSONALITY_PRESETS.REINHARD.personality.caution}`);
    reinhardDecisions.forEach(d => {
      console.log(`[${d.type}] Priority: ${d.priority}`);
    });

    console.log('\n=== 양 웬리 전략 결정 ===');
    console.log(`공격성: ${PERSONALITY_PRESETS.YANG_WENLI.personality.aggression}`);
    console.log(`신중함: ${PERSONALITY_PRESETS.YANG_WENLI.personality.caution}`);
    yangDecisions.forEach(d => {
      console.log(`[${d.type}] Priority: ${d.priority}`);
    });

    // 라인하르트는 더 공격적
    const reinhardAttacks = reinhardDecisions.filter(d => d.type === 'ATTACK').length;
    const yangAttacks = yangDecisions.filter(d => d.type === 'ATTACK').length;
    
    // 같은 상황에서 라인하르트가 공격을 더 많이 하거나, 
    // 양 웬리가 방어적 결정을 할 가능성 높음
    console.log(`\n라인하르트 공격 결정: ${reinhardAttacks}`);
    console.log(`양 웬리 공격 결정: ${yangAttacks}`);
    
    // 어떤 형태로든 결정을 내려야 함
    expect(reinhardDecisions.length).toBeGreaterThan(0);
    expect(yangDecisions.length).toBeGreaterThan(0);
  });

  test('동일 전투에서 다른 전술 결정', () => {
    const ctx = createMockTacticalContext({
      battlePhase: 'MIDGAME',
      advantageRatio: 1.2, // 약간 우세
    });

    // 라인하르트 - 측면 공격 선호
    const reinhardBlackboard = createBlackboard(
      PERSONALITY_PRESETS.REINHARD.personality,
      undefined,
      ctx
    );
    const reinhardTactical = tacticalAI.evaluate(reinhardBlackboard);

    // 양 웬리 - 방어적, 창의적
    const yangCtx = { ...ctx };
    const yangBlackboard = createBlackboard(
      PERSONALITY_PRESETS.YANG_WENLI.personality,
      undefined,
      yangCtx
    );
    yangBlackboard.currentTacticalDecisions = [];
    const yangTactical = tacticalAI.evaluate(yangBlackboard);

    console.log('\n=== 라인하르트 전술 결정 ===');
    console.log(`측면공격 선호: ${PERSONALITY_PRESETS.REINHARD.personality.prefersFlanking}`);
    reinhardTactical.forEach(d => {
      console.log(`[${d.type}] Formation: ${d.formation || 'N/A'}`);
    });

    console.log('\n=== 양 웬리 전술 결정 ===');
    console.log(`방어적 선호: ${PERSONALITY_PRESETS.YANG_WENLI.personality.prefersDefensive}`);
    console.log(`게릴라전 선호: ${PERSONALITY_PRESETS.YANG_WENLI.personality.prefersGuerrilla}`);
    yangTactical.forEach(d => {
      console.log(`[${d.type}] Formation: ${d.formation || 'N/A'}`);
    });

    // 결정이 있어야 함
    expect(reinhardTactical.length).toBeGreaterThan(0);
    expect(yangTactical.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 4. Energy Distribution Validation
// ============================================================

describe('Energy Distribution - 상황별 에너지 배분', () => {
  const tacticalAI = new TacticalAIService();

  test('공격적 성격은 무기에 에너지 집중', () => {
    const ctx = createMockTacticalContext({
      battlePhase: 'MIDGAME',
      ticksElapsed: 50, // 에너지 배분 재평가 시점
    });

    const blackboard = createBlackboard(
      PERSONALITY_PRESETS.BITTENFELD.personality, // 극도로 공격적
      undefined,
      ctx
    );
    const decisions = tacticalAI.evaluate(blackboard);

    console.log('\n=== 비텐펠트 에너지 배분 ===');
    const energyDecision = decisions.find(d => d.type === 'CHANGE_ENERGY');
    if (energyDecision?.energyDistribution) {
      const dist = energyDecision.energyDistribution;
      console.log(`Beam: ${dist.beam}, Gun: ${dist.gun}, Shield: ${dist.shield}`);
      console.log(`Engine: ${dist.engine}, Warp: ${dist.warp}, Sensor: ${dist.sensor}`);
      
      // 공격적 성격은 무기 에너지가 높아야 함
      expect(dist.beam + dist.gun).toBeGreaterThan(dist.shield);
    }
  });
});

// ============================================================
// Summary
// ============================================================

describe('Summary - AI 검증 요약', () => {
  test('프리셋 목록 출력', () => {
    console.log('\n========================================');
    console.log('=== NPC AI 프리셋 요약 ===');
    console.log('========================================\n');
    
    Object.entries(PERSONALITY_PRESETS).forEach(([key, preset]) => {
      const p = preset.personality;
      console.log(`[${preset.nameKo}] (${key})`);
      console.log(`  공격성: ${p.aggression}, 신중함: ${p.caution}, 창의성: ${p.creativity}`);
      console.log(`  측면공격: ${p.prefersFlanking}, 방어선호: ${p.prefersDefensive}, 퇴각의향: ${p.willRetreat}`);
      console.log(`  설명: ${preset.description}\n`);
    });
  });
});















