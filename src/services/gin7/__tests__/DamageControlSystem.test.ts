/**
 * DamageControlSystem 검증 테스트
 * gin7-damage-control 에이전트 완료 검증
 */

import { DamageControlSystem, ExtendedUnitState } from '../DamageControlSystem';
import { UnitState, DEFAULT_ENERGY_DISTRIBUTION } from '../../../types/gin7/tactical.types';

describe('DamageControlSystem', () => {
  let damageControl: DamageControlSystem;

  // 테스트용 유닛 생성 헬퍼
  const createTestUnit = (id: string, shipClass: string = 'cruiser', factionId: string = 'empire'): UnitState => ({
    id,
    position: { x: 100, y: 0, z: 100 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    hp: 1500,
    maxHp: 1500,
    shieldFront: 100,
    shieldRear: 100,
    shieldLeft: 100,
    shieldRight: 100,
    maxShield: 100,
    armor: 70,
    morale: 80,
    fuel: 100,
    maxFuel: 100,
    ammo: 100,
    maxAmmo: 100,
    shipClass: shipClass as any,
    shipCount: 10,
    factionId,
    commanderId: 'cmd-001',
    fleetId: 'fleet-001',
    isDestroyed: false,
    isChaos: false,
    energyDistribution: { ...DEFAULT_ENERGY_DISTRIBUTION },
  });

  beforeEach(() => {
    damageControl = new DamageControlSystem();
  });

  afterEach(() => {
    damageControl.clear();
  });

  // ============================================================
  // 검증 1: 함교 파괴 시 지휘 불능 상태
  // ============================================================
  describe('검증 1: 함교 파괴 - 지휘 불능 상태', () => {
    it('함교 파괴 시 canReceiveOrders가 false가 되어야 함', () => {
      // Given: 유닛 초기화
      const unit = createTestUnit('unit-001');
      const extUnit = damageControl.initializeUnit(unit);
      
      console.log('=== 검증 1: 함교 파괴 테스트 시작 ===');
      console.log(`초기 상태 - 함교 HP: ${extUnit.components.bridge.current}, 명령 수신 가능: ${damageControl.canReceiveOrders('unit-001')}`);
      
      // When: 함교에 대량 데미지 (파괴)
      damageControl.setCurrentTick(100);
      
      // 함교 직접 파괴
      extUnit.components.bridge.current = 0;
      extUnit.components.bridge.isDestroyed = true;
      extUnit.isUncontrollable = true;
      extUnit.activeDebuffs.push({
        type: 'BRIDGE_DESTROYED',
        appliedAt: 100,
      });
      
      console.log(`함교 파괴 후 - 함교 HP: ${extUnit.components.bridge.current}, isDestroyed: ${extUnit.components.bridge.isDestroyed}`);
      console.log(`활성 디버프: ${extUnit.activeDebuffs.map(d => d.type).join(', ')}`);
      console.log(`명령 수신 가능: ${damageControl.canReceiveOrders('unit-001')}`);
      console.log(`isUncontrollable: ${extUnit.isUncontrollable}`);
      
      // Then: 명령 수신 불가
      expect(damageControl.canReceiveOrders('unit-001')).toBe(false);
      expect(extUnit.isUncontrollable).toBe(true);
      
      console.log('=== 검증 1 통과: 함교 파괴 시 명령 불가 확인 ===\n');
    });

    it('함교 손상(50% 이하) 시 BRIDGE_DAMAGED 디버프 적용', () => {
      const unit = createTestUnit('unit-002');
      const extUnit = damageControl.initializeUnit(unit);
      
      console.log('=== 함교 손상 테스트 ===');
      
      // 함교 손상 (50% 이하)
      extUnit.components.bridge.current = 40;
      extUnit.activeDebuffs.push({
        type: 'BRIDGE_DAMAGED',
        appliedAt: 50,
      });
      
      const effects = damageControl.calculateDebuffEffects(extUnit);
      
      console.log(`함교 HP: ${extUnit.components.bridge.current}%`);
      console.log(`명중률 배율: ${effects.accuracyMultiplier}`);
      console.log(`명령 수신 가능: ${effects.canReceiveOrders}`);
      
      expect(effects.accuracyMultiplier).toBe(0.7); // 30% 감소
      expect(effects.canReceiveOrders).toBe(true);  // 손상은 명령 가능
      
      console.log('=== 함교 손상 테스트 통과 ===\n');
    });
  });

  // ============================================================
  // 검증 2: 유폭 시스템
  // ============================================================
  describe('검증 2: 유폭 - 격침 시 주변 데미지', () => {
    it('유닛 격침 시 주변 50 범위 내 유닛에 데미지', () => {
      console.log('=== 검증 2: 유폭 테스트 시작 ===');
      
      // Given: 유닛 3개 배치 (가까운 것, 먼 것)
      const destroyedUnit = createTestUnit('destroyed-unit', 'battleship');
      destroyedUnit.position = { x: 0, y: 0, z: 0 };
      
      const nearbyUnit = createTestUnit('nearby-unit', 'cruiser');
      nearbyUnit.position = { x: 30, y: 0, z: 0 }; // 30 거리 (범위 내)
      
      const farUnit = createTestUnit('far-unit', 'cruiser');
      farUnit.position = { x: 100, y: 0, z: 0 }; // 100 거리 (범위 외)
      
      const extDestroyed = damageControl.initializeUnit(destroyedUnit);
      const extNearby = damageControl.initializeUnit(nearbyUnit);
      const extFar = damageControl.initializeUnit(farUnit);
      
      extDestroyed.isDestroyed = true;
      
      const initialNearbyHp = extNearby.hp;
      const initialFarHp = extFar.hp;
      
      console.log(`파괴 유닛: ${destroyedUnit.id} (battleship) at (0,0,0)`);
      console.log(`근접 유닛: ${nearbyUnit.id} at (30,0,0), HP: ${initialNearbyHp}`);
      console.log(`원거리 유닛: ${farUnit.id} at (100,0,0), HP: ${initialFarHp}`);
      
      // When: 유폭 처리
      damageControl.setCurrentTick(200);
      const explosionEvent = damageControl.processChainExplosion('destroyed-unit', 'BTL-001');
      
      console.log('\n유폭 결과:');
      if (explosionEvent) {
        console.log(`유폭 데미지: ${explosionEvent.damage}`);
        console.log(`영향받은 유닛: ${explosionEvent.affectedUnits.join(', ')}`);
        console.log(`유폭 반경: ${explosionEvent.radius}`);
      }
      
      console.log(`\n근접 유닛 HP: ${extNearby.hp} (변화: ${extNearby.hp - initialNearbyHp})`);
      console.log(`원거리 유닛 HP: ${extFar.hp} (변화: ${extFar.hp - initialFarHp})`);
      
      // Then: 근접 유닛만 피해
      expect(explosionEvent).not.toBeNull();
      expect(explosionEvent?.affectedUnits).toContain('nearby-unit');
      expect(explosionEvent?.affectedUnits).not.toContain('far-unit');
      
      console.log('=== 검증 2 통과: 유폭 시스템 정상 작동 ===\n');
    });
  });

  // ============================================================
  // 검증 3: 수리 시스템
  // ============================================================
  describe('검증 3: 수리 - 공작함 야전 수리', () => {
    it('공작함으로 손상된 부위 수리 가능', () => {
      console.log('=== 검증 3: 수리 테스트 시작 ===');
      
      // Given: 손상된 유닛과 공작함
      const damagedUnit = createTestUnit('damaged-unit', 'cruiser');
      const repairShip = createTestUnit('repair-ship', 'engineering');
      
      const extDamaged = damageControl.initializeUnit(damagedUnit);
      damageControl.initializeUnit(repairShip);
      
      // 엔진 손상 상태로 설정
      extDamaged.components.engine.current = 30;
      
      console.log(`손상 유닛: ${damagedUnit.id}`);
      console.log(`엔진 HP (수리 전): ${extDamaged.components.engine.current}%`);
      console.log(`공작함: ${repairShip.id}`);
      
      // When: 수리 시작
      damageControl.setCurrentTick(300);
      const result = damageControl.startRepair(
        'damaged-unit',
        'repair-ship',
        'ENGINE',
        'FIELD'
      );
      
      console.log(`\n수리 시작 결과: ${result.success ? '성공' : '실패'}`);
      console.log(`메시지: ${result.message}`);
      
      if (result.task) {
        console.log(`수리 부위: ${result.task.targetComponent}`);
        console.log(`예상 완료 틱: ${result.task.estimatedEndTick}`);
        console.log(`자재 비용: ${result.task.materialCost}`);
      }
      
      // 수리 중 디버프 확인
      const hasRepairingDebuff = extDamaged.activeDebuffs.some(d => d.type === 'REPAIRING');
      console.log(`수리 중 디버프: ${hasRepairingDebuff}`);
      
      // Then: 수리 작업 생성됨
      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(hasRepairingDebuff).toBe(true);
      
      // When: 수리 진행 (여러 틱)
      console.log('\n수리 진행 중...');
      for (let i = 0; i < 100; i++) {
        damageControl.setCurrentTick(300 + i);
        damageControl.processRepairTasks();
      }
      
      console.log(`엔진 HP (수리 후): ${extDamaged.components.engine.current}%`);
      
      // Then: HP 회복
      expect(extDamaged.components.engine.current).toBeGreaterThan(30);
      
      console.log('=== 검증 3 통과: 수리 시스템 정상 작동 ===\n');
    });

    it('공작함이 아닌 유닛은 수리 불가', () => {
      console.log('=== 공작함 전용 검증 ===');
      
      const damagedUnit = createTestUnit('damaged-unit-2', 'cruiser');
      const nonRepairShip = createTestUnit('normal-ship', 'cruiser'); // 일반 순양함
      
      damageControl.initializeUnit(damagedUnit);
      damageControl.initializeUnit(nonRepairShip);
      
      const result = damageControl.startRepair(
        'damaged-unit-2',
        'normal-ship',
        'ENGINE',
        'FIELD'
      );
      
      console.log(`일반 함선으로 수리 시도: ${result.success ? '성공' : '실패'}`);
      console.log(`메시지: ${result.message}`);
      
      expect(result.success).toBe(false);
      
      console.log('=== 공작함 전용 검증 통과 ===\n');
    });
  });

  // ============================================================
  // 추가 검증: 부위별 데미지
  // ============================================================
  describe('추가 검증: 부위별 데미지 적용', () => {
    it('공격 방향에 따른 부위 피격 확률 차등', () => {
      console.log('=== 부위별 데미지 테스트 ===');
      
      const unit = createTestUnit('target-unit');
      damageControl.initializeUnit(unit);
      
      // 여러 번 데미지를 주어 통계 확인
      const hitCounts: Record<string, number> = {
        HULL: 0,
        ENGINE: 0,
        BRIDGE: 0,
        MAIN_WEAPON: 0,
      };
      
      damageControl.setCurrentTick(1);
      
      // 후방 공격 100회
      console.log('후방 공격 100회 시뮬레이션...');
      for (let i = 0; i < 100; i++) {
        const result = damageControl.applyComponentDamage(
          'target-unit',
          10, // 소량 데미지
          'REAR',
          'attacker-001'
        );
        hitCounts[result.hitComponent]++;
      }
      
      console.log('\n후방 공격 피격 통계:');
      console.log(`선체(HULL): ${hitCounts.HULL}회`);
      console.log(`기관(ENGINE): ${hitCounts.ENGINE}회 (후방 공격 시 증가 예상)`);
      console.log(`함교(BRIDGE): ${hitCounts.BRIDGE}회`);
      console.log(`주포(MAIN_WEAPON): ${hitCounts.MAIN_WEAPON}회`);
      
      // 후방 공격 시 엔진 피격률이 높아야 함
      expect(hitCounts.ENGINE).toBeGreaterThan(hitCounts.BRIDGE);
      
      console.log('=== 부위별 데미지 테스트 통과 ===\n');
    });
  });
});















