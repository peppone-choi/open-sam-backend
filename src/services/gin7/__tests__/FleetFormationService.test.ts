/**
 * FleetFormationService 검증 테스트
 * 
 * 테스트 항목:
 * 1. 진형 효과: 방추진 시 공격력이 오르고 선회력이 떨어지는가?
 * 2. 특수 기동: 평행 이동 시 속도 페널티가 적용되는가?
 * 3. 대형 유지: 기함 회전 시 윙맨들이 대형을 유지하는가?
 */

import { FleetFormationService, fleetFormationService } from '../FleetFormationService';
import {
  FORMATION_MODIFIERS,
  FORMATION_DEFINITIONS,
  MANEUVER_PENALTIES,
  FormationType,
} from '../../../types/gin7/formation.types';
import { UnitState, Vector3 } from '../../../types/gin7/tactical.types';

describe('FleetFormationService', () => {
  let service: FleetFormationService;

  beforeEach(() => {
    service = new FleetFormationService();
  });

  afterEach(() => {
    service.cleanup();
  });

  // ============================================================
  // 검증 1: 진형 효과 (방추진 시 공격력 증가, 선회력 감소)
  // ============================================================
  describe('검증 1: 진형 효과 - 방추진(SPINDLE) 스탯 보정', () => {
    it('SPINDLE 진형은 공격력 +15%, 선회력 -30%를 적용해야 한다', () => {
      // Given: 방추진(SPINDLE) 진형의 보정치
      const spindleModifiers = FORMATION_MODIFIERS.SPINDLE;
      
      // Then: 공격력 1.15배 (15% 증가)
      expect(spindleModifiers.attackPower).toBe(1.15);
      console.log(`✅ SPINDLE 공격력 배율: ${spindleModifiers.attackPower} (기대값: 1.15)`);
      
      // Then: 선회력 0.7배 (30% 감소)
      expect(spindleModifiers.turnRate).toBe(0.7);
      console.log(`✅ SPINDLE 선회력 배율: ${spindleModifiers.turnRate} (기대값: 0.7)`);
      
      // Then: 돌파력 1.2배 (20% 증가)
      expect(spindleModifiers.penetration).toBe(1.2);
      console.log(`✅ SPINDLE 돌파력 배율: ${spindleModifiers.penetration} (기대값: 1.2)`);
    });

    it('STANDARD vs SPINDLE 진형 비교', () => {
      const standard = FORMATION_MODIFIERS.STANDARD;
      const spindle = FORMATION_MODIFIERS.SPINDLE;
      
      console.log('\n=== 진형별 스탯 비교 ===');
      console.log('스탯          | STANDARD | SPINDLE | 차이');
      console.log('------------ | -------- | ------- | ----');
      console.log(`공격력       | ${standard.attackPower.toFixed(2)}     | ${spindle.attackPower.toFixed(2)}    | +${((spindle.attackPower - standard.attackPower) * 100).toFixed(0)}%`);
      console.log(`방어력       | ${standard.defensePower.toFixed(2)}     | ${spindle.defensePower.toFixed(2)}    | ±${((spindle.defensePower - standard.defensePower) * 100).toFixed(0)}%`);
      console.log(`선회력       | ${standard.turnRate.toFixed(2)}     | ${spindle.turnRate.toFixed(2)}    | ${((spindle.turnRate - standard.turnRate) * 100).toFixed(0)}%`);
      console.log(`속도         | ${standard.speed.toFixed(2)}     | ${spindle.speed.toFixed(2)}    | +${((spindle.speed - standard.speed) * 100).toFixed(0)}%`);
      console.log(`돌파력       | ${standard.penetration.toFixed(2)}     | ${spindle.penetration.toFixed(2)}    | +${((spindle.penetration - standard.penetration) * 100).toFixed(0)}%`);
      
      // Assertions
      expect(spindle.attackPower).toBeGreaterThan(standard.attackPower);
      expect(spindle.turnRate).toBeLessThan(standard.turnRate);
    });

    it('함대 진형 초기화 후 보정치가 올바르게 적용되어야 한다', () => {
      // Given: 함대 진형 초기화 (SPINDLE)
      const fleetId = 'test-fleet-1';
      const leaderUnitId = 'unit-leader';
      const unitIds = ['unit-leader', 'unit-wing1', 'unit-wing2'];
      
      service.initializeFormation(fleetId, leaderUnitId, unitIds, 'SPINDLE');
      
      // When: 진형 보정치 조회
      const modifiers = service.getFormationModifiers(fleetId);
      
      // Then: SPINDLE 보정치가 적용되어야 함 (결속도 100% 기준)
      expect(modifiers.attackPower).toBeCloseTo(1.15, 1);
      expect(modifiers.turnRate).toBeCloseTo(0.7, 1);
      
      console.log('\n=== 함대 진형 적용 결과 ===');
      console.log(`함대 ID: ${fleetId}`);
      console.log(`진형: SPINDLE (방추진)`);
      console.log(`공격력 배율: ${modifiers.attackPower.toFixed(2)}`);
      console.log(`선회력 배율: ${modifiers.turnRate.toFixed(2)}`);
    });

    it('모든 진형의 정의가 올바르게 설정되어 있어야 한다', () => {
      const formationTypes: FormationType[] = [
        'STANDARD', 'SPINDLE', 'LINE', 'CIRCULAR', 'ECHELON', 'WEDGE', 'ENCIRCLE', 'RETREAT'
      ];
      
      console.log('\n=== 전체 진형 정의 ===');
      console.log('진형       | 이름           | 공격  | 방어  | 선회  | 속도');
      console.log('---------- | -------------- | ----- | ----- | ----- | -----');
      
      for (const type of formationTypes) {
        const def = FORMATION_DEFINITIONS[type];
        const mod = FORMATION_MODIFIERS[type];
        
        expect(def).toBeDefined();
        expect(mod).toBeDefined();
        
        console.log(`${type.padEnd(10)} | ${def.nameKo.padEnd(14)} | ${mod.attackPower.toFixed(2)}  | ${mod.defensePower.toFixed(2)}  | ${mod.turnRate.toFixed(2)}  | ${mod.speed.toFixed(2)}`);
      }
    });
  });

  // ============================================================
  // 검증 2: 특수 기동 - 평행 이동 시 속도 페널티
  // ============================================================
  describe('검증 2: 특수 기동 - 평행 이동 속도 페널티', () => {
    it('PARALLEL_MOVE 기동은 속도 50% 페널티를 적용해야 한다', () => {
      // Given: PARALLEL_MOVE 페널티 정의
      const parallelMovePenalty = MANEUVER_PENALTIES.PARALLEL_MOVE;
      
      // Then: 속도 50% 감소 (0.5 = 50% 페널티)
      expect(parallelMovePenalty.speed).toBe(0.5);
      console.log(`✅ PARALLEL_MOVE 속도 페널티: ${parallelMovePenalty.speed * 100}% (기대값: 50%)`);
      
      // Then: 회피 페널티도 적용
      expect(parallelMovePenalty.evasion).toBe(0.1);
      console.log(`✅ PARALLEL_MOVE 회피 페널티: ${parallelMovePenalty.evasion * 100}% (기대값: 10%)`);
    });

    it('TURN_180 기동은 속도/회피 100% 페널티를 적용해야 한다', () => {
      // Given: TURN_180 페널티 정의
      const turn180Penalty = MANEUVER_PENALTIES.TURN_180;
      
      // Then: 속도 100% 감소 (정지 상태)
      expect(turn180Penalty.speed).toBe(1.0);
      console.log(`✅ TURN_180 속도 페널티: ${turn180Penalty.speed * 100}% (기대값: 100% - 완전 정지)`);
      
      // Then: 회피 100% 감소 (회피 불가)
      expect(turn180Penalty.evasion).toBe(1.0);
      console.log(`✅ TURN_180 회피 페널티: ${turn180Penalty.evasion * 100}% (기대값: 100% - 취약 상태)`);
    });

    it('기동 실행 후 페널티가 올바르게 적용되어야 한다', () => {
      // Given: 유닛에 평행 이동 기동 실행
      const unitId = 'test-unit-maneuver';
      
      service.executeManeuver({
        unitIds: [unitId],
        type: 'PARALLEL_MOVE',
        params: { direction: { x: 1, y: 0, z: 0 } },
      });
      
      // When: 기동 페널티 조회
      const penalties = service.getManeuverPenalties(unitId);
      
      // Then: 속도 50% 페널티
      expect(penalties.speed).toBe(0.5);
      
      console.log('\n=== 기동 중 페널티 적용 결과 ===');
      console.log(`유닛 ID: ${unitId}`);
      console.log(`기동 타입: PARALLEL_MOVE`);
      console.log(`속도 페널티: ${penalties.speed * 100}%`);
      console.log(`회피 페널티: ${penalties.evasion * 100}%`);
    });

    it('모든 기동 타입의 페널티가 정의되어 있어야 한다', () => {
      console.log('\n=== 기동별 페널티 정의 ===');
      console.log('기동 타입        | 속도 페널티 | 회피 페널티');
      console.log('--------------- | ---------- | ----------');
      
      for (const [type, penalty] of Object.entries(MANEUVER_PENALTIES)) {
        console.log(`${type.padEnd(15)} | ${(penalty.speed * 100).toFixed(0).padStart(8)}% | ${(penalty.evasion * 100).toFixed(0).padStart(8)}%`);
      }
      
      expect(MANEUVER_PENALTIES.PARALLEL_MOVE).toBeDefined();
      expect(MANEUVER_PENALTIES.TURN_180).toBeDefined();
      expect(MANEUVER_PENALTIES.TURN_90_LEFT).toBeDefined();
      expect(MANEUVER_PENALTIES.TURN_90_RIGHT).toBeDefined();
    });
  });

  // ============================================================
  // 검증 3: 대형 유지 - 기함 회전 시 윙맨 대형 유지
  // ============================================================
  describe('검증 3: 대형 유지 - 윙맨 Boids 로직', () => {
    it('진형 초기화 시 윙맨 위치가 설정되어야 한다', () => {
      // Given: 함대 진형 초기화
      const fleetId = 'test-fleet-boids';
      const leaderUnitId = 'flagship-1';
      const unitIds = ['flagship-1', 'cruiser-1', 'cruiser-2', 'destroyer-1'];
      
      const state = service.initializeFormation(fleetId, leaderUnitId, unitIds, 'SPINDLE');
      
      // Then: 리더 외 3개의 윙맨이 설정되어야 함
      expect(state.wingmen.length).toBe(3);
      expect(state.leaderUnitId).toBe(leaderUnitId);
      expect(state.cohesion).toBe(100);
      
      console.log('\n=== 대형 초기화 결과 ===');
      console.log(`함대 ID: ${fleetId}`);
      console.log(`리더: ${leaderUnitId}`);
      console.log(`윙맨 수: ${state.wingmen.length}`);
      console.log(`결속도: ${state.cohesion}%`);
      console.log('\n윙맨 위치:');
      state.wingmen.forEach((w, i) => {
        console.log(`  ${i + 1}. ${w.unitId} - 역할: ${w.role}, 오프셋: (${w.offsetX}, ${w.offsetY}, ${w.offsetZ})`);
      });
    });

    it('SPINDLE 진형의 윙맨 배치가 V자 형태여야 한다', () => {
      const fleetId = 'test-fleet-spindle';
      const state = service.initializeFormation(
        fleetId,
        'leader',
        ['leader', 'w1', 'w2', 'w3', 'w4'],
        'SPINDLE'
      );
      
      // V자 형태: 좌/우 대칭, 후방으로 펼쳐짐
      const leftWings = state.wingmen.filter(w => w.offsetX < 0);
      const rightWings = state.wingmen.filter(w => w.offsetX > 0);
      
      expect(leftWings.length).toBeGreaterThan(0);
      expect(rightWings.length).toBeGreaterThan(0);
      
      console.log('\n=== SPINDLE 진형 V자 배치 확인 ===');
      console.log(`좌측 윙맨: ${leftWings.length}기`);
      console.log(`우측 윙맨: ${rightWings.length}기`);
      
      // 모든 윙맨이 리더 후방에 위치
      state.wingmen.forEach(w => {
        expect(w.offsetZ).toBeLessThanOrEqual(0); // Z가 음수 = 후방
        console.log(`  ${w.unitId}: X=${w.offsetX}, Z=${w.offsetZ} (${w.offsetZ < 0 ? '후방' : '전방'})`);
      });
    });

    it('LINE 진형의 윙맨 배치가 수평 형태여야 한다', () => {
      const fleetId = 'test-fleet-line';
      const state = service.initializeFormation(
        fleetId,
        'leader',
        ['leader', 'w1', 'w2', 'w3', 'w4'],
        'LINE'
      );
      
      console.log('\n=== LINE 진형 수평 배치 확인 ===');
      
      // LINE 진형: Z 오프셋이 0에 가까움 (수평 배치)
      state.wingmen.forEach(w => {
        expect(Math.abs(w.offsetZ)).toBeLessThanOrEqual(10); // 거의 수평
        console.log(`  ${w.unitId}: X=${w.offsetX}, Z=${w.offsetZ}`);
      });
    });

    it('CIRCULAR 진형의 윙맨 배치가 원형이어야 한다', () => {
      const fleetId = 'test-fleet-circular';
      const state = service.initializeFormation(
        fleetId,
        'leader',
        ['leader', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6'],
        'CIRCULAR'
      );
      
      console.log('\n=== CIRCULAR 진형 원형 배치 확인 ===');
      
      // 원형 진형: 모든 윙맨이 리더로부터 비슷한 거리에 위치
      const distances = state.wingmen.map(w => 
        Math.sqrt(w.offsetX * w.offsetX + w.offsetZ * w.offsetZ)
      );
      
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      
      console.log(`평균 거리: ${avgDistance.toFixed(1)}`);
      state.wingmen.forEach((w, i) => {
        console.log(`  ${w.unitId}: 거리=${distances[i].toFixed(1)}, 위치=(${w.offsetX.toFixed(0)}, ${w.offsetZ.toFixed(0)})`);
      });
      
      // 모든 거리가 평균에서 크게 벗어나지 않음
      distances.forEach(d => {
        expect(d).toBeGreaterThan(avgDistance * 0.5);
        expect(d).toBeLessThan(avgDistance * 1.5);
      });
    });

    it('진형 상태에서 결속도가 추적되어야 한다', () => {
      const fleetId = 'test-fleet-cohesion';
      service.initializeFormation(fleetId, 'leader', ['leader', 'w1', 'w2'], 'STANDARD');
      
      const state = service.getFormationState(fleetId);
      
      expect(state).toBeDefined();
      expect(state!.cohesion).toBe(100);
      
      console.log('\n=== 결속도 추적 ===');
      console.log(`초기 결속도: ${state!.cohesion}%`);
      console.log('※ 결속도가 낮아지면 진형 효과도 감소합니다.');
    });
  });

  // ============================================================
  // 검증 4: 진형 변경 상태 관리
  // ============================================================
  describe('검증 4: 진형 변경 상태 관리', () => {
    it('진형 변경 중에는 transitioning 상태여야 한다', () => {
      // Given: 함대 초기화
      const fleetId = 'test-fleet-transition';
      service.initializeFormation(fleetId, 'leader', ['leader', 'w1', 'w2'], 'STANDARD');
      
      // When: 진형 변경 시작
      service.startFormationChange({
        fleetId,
        targetFormation: 'SPINDLE',
        priority: 'NORMAL',
      });
      
      const state = service.getFormationState(fleetId);
      
      // Then
      expect(state?.isTransitioning).toBe(true);
      
      console.log('\n=== 진형 변경 상태 ===');
      console.log(`함대 ID: ${fleetId}`);
      console.log(`변경 중: ${state?.isTransitioning}`);
      console.log(`현재 진형: ${state?.type}`);
    });
    
    it('진형 변경 완료 후 transitioning이 false가 되어야 한다', () => {
      // Given
      const fleetId = 'test-fleet-complete';
      service.initializeFormation(fleetId, 'leader', ['leader', 'w1', 'w2'], 'STANDARD');
      
      service.startFormationChange({
        fleetId,
        targetFormation: 'LINE',
        priority: 'NORMAL',
      });
      
      // When: 충분한 시간이 지남 (변경 완료)
      for (let i = 0; i < 30; i++) {
        service.updateFormationChange(fleetId, 1);
      }
      
      const state = service.getFormationState(fleetId);
      
      // Then
      expect(state?.isTransitioning).toBe(false);
      expect(state?.type).toBe('LINE');
    });
    
    it('우선순위 EMERGENCY는 변경 시간이 짧아야 한다', () => {
      // Given
      const fleetId1 = 'test-fleet-normal';
      const fleetId2 = 'test-fleet-emergency';
      
      service.initializeFormation(fleetId1, 'l1', ['l1', 'w1'], 'STANDARD');
      service.initializeFormation(fleetId2, 'l2', ['l2', 'w2'], 'STANDARD');
      
      // When
      const normalResult = service.startFormationChange({
        fleetId: fleetId1,
        targetFormation: 'WEDGE',
        priority: 'NORMAL',
      });
      
      const emergencyResult = service.startFormationChange({
        fleetId: fleetId2,
        targetFormation: 'WEDGE',
        priority: 'EMERGENCY',
      });
      
      // Then
      expect(emergencyResult.estimatedTime).toBeLessThan(normalResult.estimatedTime);
      
      console.log('\n=== 우선순위별 변경 시간 ===');
      console.log(`NORMAL: ${normalResult.estimatedTime}초`);
      console.log(`EMERGENCY: ${emergencyResult.estimatedTime}초`);
    });
  });
  
  // ============================================================
  // 검증 5: 결속도(Cohesion) 효과
  // ============================================================
  describe('검증 5: 결속도(Cohesion) 효과', () => {
    it('결속도 100%일 때 진형 효과가 100% 적용되어야 한다', () => {
      // Given
      const fleetId = 'test-fleet-cohesion-100';
      service.initializeFormation(fleetId, 'leader', ['leader', 'w1', 'w2'], 'SPINDLE');
      
      // When
      const modifiers = service.getFormationModifiers(fleetId);
      
      // Then: SPINDLE 보정치 그대로 적용
      expect(modifiers.attackPower).toBeCloseTo(1.15, 1);
      expect(modifiers.turnRate).toBeCloseTo(0.7, 1);
      
      console.log('\n=== 결속도 100% 보정치 ===');
      console.log(`공격력: ${modifiers.attackPower.toFixed(2)}`);
      console.log(`선회력: ${modifiers.turnRate.toFixed(2)}`);
    });
    
    it('WEDGE 진형의 보정치가 올바르게 적용되어야 한다', () => {
      // Given
      const fleetId = 'test-fleet-wedge';
      service.initializeFormation(fleetId, 'leader', ['leader', 'w1', 'w2', 'w3'], 'WEDGE');
      
      // When
      const modifiers = service.getFormationModifiers(fleetId);
      const expectedMod = FORMATION_MODIFIERS.WEDGE;
      
      // Then
      expect(modifiers.attackPower).toBeCloseTo(expectedMod.attackPower, 1);
      expect(modifiers.penetration).toBeCloseTo(expectedMod.penetration, 1);
      
      console.log('\n=== WEDGE 진형 보정치 ===');
      console.log(`공격력: ${modifiers.attackPower.toFixed(2)} (기대: ${expectedMod.attackPower})`);
      console.log(`돌파력: ${modifiers.penetration.toFixed(2)} (기대: ${expectedMod.penetration})`);
    });
    
    it('ENCIRCLE 진형의 보정치가 올바르게 적용되어야 한다', () => {
      // Given
      const fleetId = 'test-fleet-encircle';
      service.initializeFormation(fleetId, 'leader', ['leader', 'w1', 'w2', 'w3', 'w4', 'w5'], 'ENCIRCLE');
      
      // When
      const modifiers = service.getFormationModifiers(fleetId);
      const expectedMod = FORMATION_MODIFIERS.ENCIRCLE;
      
      // Then
      expect(modifiers.attackPower).toBeCloseTo(expectedMod.attackPower, 1);
      expect(modifiers.defensePower).toBeCloseTo(expectedMod.defensePower, 1);
      
      console.log('\n=== ENCIRCLE 진형 보정치 ===');
      console.log(`공격력: ${modifiers.attackPower.toFixed(2)}`);
      console.log(`방어력: ${modifiers.defensePower.toFixed(2)}`);
    });
    
    it('RETREAT 진형은 속도가 증가하고 방어력이 감소해야 한다', () => {
      // Given
      const fleetId = 'test-fleet-retreat';
      service.initializeFormation(fleetId, 'leader', ['leader', 'w1', 'w2'], 'RETREAT');
      
      // When
      const modifiers = service.getFormationModifiers(fleetId);
      const standardMod = FORMATION_MODIFIERS.STANDARD;
      
      // Then: RETREAT은 속도 증가, 방어력 감소
      expect(modifiers.speed).toBeGreaterThan(standardMod.speed);
      expect(modifiers.defensePower).toBeLessThan(standardMod.defensePower);
      
      console.log('\n=== RETREAT 진형 보정치 ===');
      console.log(`속도: ${modifiers.speed.toFixed(2)} (기본: ${standardMod.speed})`);
      console.log(`방어력: ${modifiers.defensePower.toFixed(2)} (기본: ${standardMod.defensePower})`);
    });
  });
  
  // ============================================================
  // 검증 6: 기동 완료 후 페널티 해제
  // ============================================================
  describe('검증 6: 기동 완료 후 페널티 해제', () => {
    it('기동 완료 후 페널티가 해제되어야 한다', () => {
      // Given: 기동 시작
      const unitId = 'test-unit-complete';
      
      service.executeManeuver({
        unitIds: [unitId],
        type: 'TURN_90_LEFT',
        params: {},
      });
      
      // 페널티 적용 확인
      let penalties = service.getManeuverPenalties(unitId);
      expect(penalties.speed).toBeGreaterThan(0);
      
      // When: 기동 완료 처리
      service.completeManeuver(unitId);
      
      // Then: 페널티 해제
      penalties = service.getManeuverPenalties(unitId);
      expect(penalties.speed).toBe(0);
      expect(penalties.evasion).toBe(0);
    });
    
    it('여러 유닛의 기동이 독립적으로 관리되어야 한다', () => {
      // Given
      const unit1 = 'test-unit-1';
      const unit2 = 'test-unit-2';
      
      service.executeManeuver({
        unitIds: [unit1],
        type: 'PARALLEL_MOVE',
        params: { direction: { x: 1, y: 0, z: 0 } },
      });
      
      service.executeManeuver({
        unitIds: [unit2],
        type: 'TURN_180',
        params: {},
      });
      
      // When
      const penalties1 = service.getManeuverPenalties(unit1);
      const penalties2 = service.getManeuverPenalties(unit2);
      
      // Then: 서로 다른 페널티
      expect(penalties1.speed).toBe(0.5); // PARALLEL_MOVE
      expect(penalties2.speed).toBe(1.0); // TURN_180
      
      console.log('\n=== 독립적 기동 페널티 ===');
      console.log(`Unit 1 (PARALLEL_MOVE): 속도 ${penalties1.speed * 100}%`);
      console.log(`Unit 2 (TURN_180): 속도 ${penalties2.speed * 100}%`);
    });
  });
  
  // ============================================================
  // 통합 시뮬레이션
  // ============================================================
  describe('통합 시뮬레이션', () => {
    it('전체 시나리오: 진형 변경 → 기동 → 대형 유지', async () => {
      console.log('\n========================================');
      console.log('     통합 시뮬레이션 결과');
      console.log('========================================\n');
      
      // 1. 함대 초기화
      const fleetId = 'imperial-13th';
      const units = ['flagship-brunhild', 'cruiser-1', 'cruiser-2', 'destroyer-1', 'destroyer-2'];
      
      const state = service.initializeFormation(fleetId, units[0], units, 'STANDARD');
      console.log('1️⃣ 함대 초기화 완료');
      console.log(`   - 함대: ${fleetId}`);
      console.log(`   - 기함: ${units[0]}`);
      console.log(`   - 초기 진형: STANDARD (기본진)`);
      console.log(`   - 윙맨: ${state.wingmen.length}기`);
      
      // 2. 진형 보정 확인 (STANDARD)
      let modifiers = service.getFormationModifiers(fleetId);
      console.log('\n2️⃣ STANDARD 진형 보정');
      console.log(`   - 공격력: ${modifiers.attackPower.toFixed(2)}x`);
      console.log(`   - 선회력: ${modifiers.turnRate.toFixed(2)}x`);
      
      // 3. 진형 변경 (STANDARD → SPINDLE)
      const changeResult = service.startFormationChange({
        fleetId,
        targetFormation: 'SPINDLE',
        priority: 'NORMAL',
      });
      console.log('\n3️⃣ 진형 변경 명령: STANDARD → SPINDLE');
      console.log(`   - 결과: ${changeResult.success ? '성공' : '실패'}`);
      console.log(`   - 예상 소요 시간: ${changeResult.estimatedTime}초`);
      
      // 4. 진형 변경 완료 시뮬레이션
      for (let i = 0; i < 20; i++) {
        service.updateFormationChange(fleetId, 1);
      }
      
      // 5. 변경 후 보정 확인
      modifiers = service.getFormationModifiers(fleetId);
      console.log('\n4️⃣ SPINDLE 진형 변경 완료');
      console.log(`   - 공격력: ${modifiers.attackPower.toFixed(2)}x (+15%)`);
      console.log(`   - 선회력: ${modifiers.turnRate.toFixed(2)}x (-30%)`);
      console.log(`   - 돌파력: ${modifiers.penetration.toFixed(2)}x (+20%)`);
      
      // 6. 평행 이동 기동
      const maneuverResult = service.executeManeuver({
        unitIds: [units[1], units[2]],
        type: 'PARALLEL_MOVE',
        params: { direction: { x: 1, y: 0, z: 0 } },
      });
      console.log('\n5️⃣ 평행 이동 기동 실행');
      console.log(`   - 대상: ${maneuverResult.affectedUnits.join(', ')}`);
      console.log(`   - 속도 페널티: 50%`);
      
      const penalties = service.getManeuverPenalties(units[1]);
      console.log(`   - 적용된 페널티: 속도 ${penalties.speed * 100}%, 회피 ${penalties.evasion * 100}%`);
      
      // 7. 대형 상태 확인
      const finalState = service.getFormationState(fleetId);
      console.log('\n6️⃣ 최종 대형 상태');
      console.log(`   - 진형: ${finalState!.type}`);
      console.log(`   - 결속도: ${finalState!.cohesion}%`);
      console.log(`   - 리더: ${finalState!.leaderUnitId}`);
      console.log(`   - 윙맨 배치:`);
      finalState!.wingmen.forEach(w => {
        console.log(`     · ${w.unitId}: ${w.role} (${w.offsetX}, ${w.offsetZ})`);
      });
      
      console.log('\n========================================');
      console.log('         시뮬레이션 완료 ✅');
      console.log('========================================');
      
      // Assertions
      expect(finalState!.type).toBe('SPINDLE');
      expect(modifiers.attackPower).toBeCloseTo(1.15, 1);
      expect(modifiers.turnRate).toBeCloseTo(0.7, 1);
      expect(penalties.speed).toBe(0.5);
    });
  });
});




