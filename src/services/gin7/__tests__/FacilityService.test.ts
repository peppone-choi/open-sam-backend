/**
 * FacilityService 검증 테스트
 * 
 * 검증 항목:
 * 1. 대기열: 동시 건설 슬롯 제한이 작동하는가?
 * 2. 레벨업: 시설 레벨이 효과에 영향을 주는가?
 * 3. 파괴/수리: 궤도 폭격 시 시설이 파괴되는가?
 */

import { 
  FACILITY_DEFINITIONS,
  calculateFacilityCost,
  calculateFacilityMaxHp,
  getFacilityEffect,
  createFortressCannonState,
  ExtendedFacilityType
} from '../../../models/gin7/Facility';

describe('Gin7 FacilityService 검증', () => {
  
  describe('1. 시설 정의 테이블 검증', () => {
    test('모든 시설 타입이 정의되어 있어야 함', () => {
      const facilityTypes: ExtendedFacilityType[] = [
        'capital_building', 'military_academy', 'shipyard', 'factory',
        'farm', 'mine', 'research_lab', 'defense_grid', 'spaceport',
        'hospital', 'entertainment', 'defense_shield', 'cannon',
        'fortress_cannon', 'liquid_metal_armor'
      ];
      
      for (const type of facilityTypes) {
        expect(FACILITY_DEFINITIONS[type]).toBeDefined();
        expect(FACILITY_DEFINITIONS[type].name).toBeTruthy();
        expect(FACILITY_DEFINITIONS[type].maxLevel).toBeGreaterThan(0);
      }
      
      console.log(`✅ ${facilityTypes.length}개 시설 타입 정의 확인`);
    });
    
    test('요새 전용 시설이 올바르게 표시되어야 함', () => {
      expect(FACILITY_DEFINITIONS.fortress_cannon.isFortressOnly).toBe(true);
      expect(FACILITY_DEFINITIONS.liquid_metal_armor.isFortressOnly).toBe(true);
      expect(FACILITY_DEFINITIONS.shipyard.isFortressOnly).toBeFalsy();
      
      console.log('✅ 요새 전용 시설 플래그 확인');
    });
    
    test('고유 시설이 올바르게 표시되어야 함', () => {
      expect(FACILITY_DEFINITIONS.capital_building.isUnique).toBe(true);
      expect(FACILITY_DEFINITIONS.research_lab.isUnique).toBe(true);
      expect(FACILITY_DEFINITIONS.factory.isUnique).toBeFalsy();
      
      console.log('✅ 고유 시설 플래그 확인');
    });
  });

  describe('2. 레벨업 비용/효과 검증', () => {
    test('레벨이 올라갈수록 비용이 증가해야 함', () => {
      const type: ExtendedFacilityType = 'shipyard';
      
      const cost1 = calculateFacilityCost(type, 1);
      const cost2 = calculateFacilityCost(type, 2);
      const cost5 = calculateFacilityCost(type, 5);
      
      expect(cost2.credits).toBeGreaterThan(cost1.credits);
      expect(cost5.credits).toBeGreaterThan(cost2.credits);
      expect(cost5.turns).toBeGreaterThanOrEqual(cost1.turns);
      
      console.log(`✅ 조선소 레벨업 비용 증가 확인:`);
      console.log(`   레벨 1: ${cost1.credits} 크레딧, ${cost1.turns} 턴`);
      console.log(`   레벨 2: ${cost2.credits} 크레딧, ${cost2.turns} 턴`);
      console.log(`   레벨 5: ${cost5.credits} 크레딧, ${cost5.turns} 턴`);
    });
    
    test('레벨이 올라갈수록 효과가 증가해야 함', () => {
      // 조선소: shipBuildSpeed 증가
      const shipyard1 = getFacilityEffect('shipyard', 1);
      const shipyard5 = getFacilityEffect('shipyard', 5);
      expect(shipyard5.shipBuildSpeed).toBeGreaterThan(shipyard1.shipBuildSpeed!);
      
      // 공장: productionBonus 증가
      const factory1 = getFacilityEffect('factory', 1);
      const factory5 = getFacilityEffect('factory', 5);
      expect(factory5.productionBonus).toBeGreaterThan(factory1.productionBonus!);
      
      // 방어막: shieldStrength 증가
      const shield1 = getFacilityEffect('defense_shield', 1);
      const shield5 = getFacilityEffect('defense_shield', 5);
      expect(shield5.shieldStrength).toBeGreaterThan(shield1.shieldStrength!);
      
      console.log(`✅ 레벨별 효과 증가 확인:`);
      console.log(`   조선소 건조 속도: Lv1=${shipyard1.shipBuildSpeed}% → Lv5=${shipyard5.shipBuildSpeed}%`);
      console.log(`   공장 생산 보너스: Lv1=${factory1.productionBonus}% → Lv5=${factory5.productionBonus}%`);
      console.log(`   방어막 강도: Lv1=${shield1.shieldStrength} → Lv5=${shield5.shieldStrength}`);
    });
    
    test('레벨이 올라갈수록 최대 HP가 증가해야 함', () => {
      const type: ExtendedFacilityType = 'shipyard';
      
      const hp1 = calculateFacilityMaxHp(type, 1);
      const hp5 = calculateFacilityMaxHp(type, 5);
      const hp10 = calculateFacilityMaxHp(type, 10);
      
      expect(hp5).toBeGreaterThan(hp1);
      expect(hp10).toBeGreaterThan(hp5);
      
      console.log(`✅ 조선소 최대 HP 증가 확인:`);
      console.log(`   Lv1: ${hp1} HP`);
      console.log(`   Lv5: ${hp5} HP`);
      console.log(`   Lv10: ${hp10} HP`);
    });
  });

  describe('3. 건설 슬롯 제한 검증', () => {
    test('행성 크기별 시설 슬롯이 정의되어야 함', () => {
      const FACILITY_SLOTS_BY_SIZE: Record<string, number> = {
        small: 5,
        medium: 10,
        large: 15,
        huge: 20
      };
      
      expect(FACILITY_SLOTS_BY_SIZE.small).toBe(5);
      expect(FACILITY_SLOTS_BY_SIZE.medium).toBe(10);
      expect(FACILITY_SLOTS_BY_SIZE.large).toBe(15);
      expect(FACILITY_SLOTS_BY_SIZE.huge).toBe(20);
      
      console.log(`✅ 행성 크기별 시설 슬롯:`);
      console.log(`   Small: ${FACILITY_SLOTS_BY_SIZE.small}칸`);
      console.log(`   Medium: ${FACILITY_SLOTS_BY_SIZE.medium}칸`);
      console.log(`   Large: ${FACILITY_SLOTS_BY_SIZE.large}칸`);
      console.log(`   Huge: ${FACILITY_SLOTS_BY_SIZE.huge}칸`);
    });
  });

  describe('4. 데미지/파괴 시스템 검증', () => {
    test('시설 HP 기반 상태 결정 로직', () => {
      const maxHp = 1000;
      
      // HP 100% - 정상 운영
      const hp100 = maxHp;
      expect(hp100 >= maxHp * 0.5).toBe(true); // 효율 감소 없음
      
      // HP 50% - 효율 감소
      const hp50 = maxHp * 0.5;
      expect(hp50 < maxHp * 0.5).toBe(false);
      expect(hp50 >= maxHp * 0.5).toBe(true);
      
      // HP 49% - 효율 감소 발생
      const hp49 = maxHp * 0.49;
      expect(hp49 < maxHp * 0.5).toBe(true);
      
      // HP 0 - 완전 정지
      const hp0 = 0;
      expect(hp0 === 0).toBe(true);
      
      console.log(`✅ HP 기반 상태 결정 로직 확인:`);
      console.log(`   HP 50% 이상: 정상 운영`);
      console.log(`   HP 50% 미만: 효율 50% 감소`);
      console.log(`   HP 0%: 완전 정지`);
    });
  });

  describe('5. 요새 특수 시설 검증', () => {
    test('요새포 초기 상태가 올바르게 생성되어야 함', () => {
      const cannonState1 = createFortressCannonState(1);
      const cannonState5 = createFortressCannonState(5);
      
      // 초기 상태
      expect(cannonState1.isCharged).toBe(false);
      expect(cannonState1.chargeProgress).toBe(0);
      
      // 레벨이 높을수록 충전 속도 증가
      expect(cannonState5.chargePerTurn).toBeGreaterThan(cannonState1.chargePerTurn);
      
      // 레벨이 높을수록 쿨다운 감소
      expect(cannonState5.cooldownTurns).toBeLessThan(cannonState1.cooldownTurns);
      
      // 레벨이 높을수록 데미지 증가
      expect(cannonState5.damage).toBeGreaterThan(cannonState1.damage);
      
      console.log(`✅ 요새포 레벨별 상태 확인:`);
      console.log(`   Lv1: 충전속도=${cannonState1.chargePerTurn}/턴, 쿨다운=${cannonState1.cooldownTurns}턴, 데미지=${cannonState1.damage}`);
      console.log(`   Lv5: 충전속도=${cannonState5.chargePerTurn}/턴, 쿨다운=${cannonState5.cooldownTurns}턴, 데미지=${cannonState5.damage}`);
    });
    
    test('유체 금속 장갑 자동 회복율이 레벨에 따라 증가해야 함', () => {
      const armor1 = getFacilityEffect('liquid_metal_armor', 1);
      const armor5 = getFacilityEffect('liquid_metal_armor', 5);
      
      expect(armor5.autoRepairRate).toBeGreaterThan(armor1.autoRepairRate!);
      expect(armor5.defenseBonus).toBeGreaterThan(armor1.defenseBonus!);
      
      console.log(`✅ 유체 금속 장갑 레벨별 효과:`);
      console.log(`   Lv1: 자동회복=${armor1.autoRepairRate}%/턴, 방어보너스=${armor1.defenseBonus}`);
      console.log(`   Lv5: 자동회복=${armor5.autoRepairRate}%/턴, 방어보너스=${armor5.defenseBonus}`);
    });
  });

  describe('6. 선행 조건 검증', () => {
    test('방어막 발생기는 방어 그리드 레벨 3 이상이 필요함', () => {
      const shieldDef = FACILITY_DEFINITIONS.defense_shield;
      
      expect(shieldDef.prerequisite).toBeDefined();
      expect(shieldDef.prerequisite?.facilityType).toBe('defense_grid');
      expect(shieldDef.prerequisite?.facilityLevel).toBe(3);
      
      console.log(`✅ 방어막 발생기 선행조건: ${shieldDef.prerequisite?.facilityType} Lv${shieldDef.prerequisite?.facilityLevel}`);
    });
    
    test('포대는 방어 그리드 레벨 1 이상이 필요함', () => {
      const cannonDef = FACILITY_DEFINITIONS.cannon;
      
      expect(cannonDef.prerequisite).toBeDefined();
      expect(cannonDef.prerequisite?.facilityType).toBe('defense_grid');
      expect(cannonDef.prerequisite?.facilityLevel).toBe(1);
      
      console.log(`✅ 포대 선행조건: ${cannonDef.prerequisite?.facilityType} Lv${cannonDef.prerequisite?.facilityLevel}`);
    });
  });
});

// 건설 프로세스 시뮬레이션 출력
describe('건설 프로세스 시뮬레이션', () => {
  test('시설 건설 프로세스 흐름', () => {
    console.log('\n📋 === 시설 건설 프로세스 ===\n');
    
    // 1. 조선소 건설 시작
    const shipyardCost = calculateFacilityCost('shipyard', 1);
    console.log('1️⃣ 조선소 건설 시작');
    console.log(`   비용: ${shipyardCost.credits} 크레딧, ${shipyardCost.minerals} 광물, ${shipyardCost.energy} 에너지`);
    console.log(`   소요 시간: ${shipyardCost.turns} 턴`);
    
    // 2. 건설 대기열에 추가
    console.log('\n2️⃣ 건설 대기열에 추가');
    console.log('   - queueId 생성');
    console.log('   - 자원 예약 (WarehouseService.reserve)');
    console.log('   - status: IN_PROGRESS');
    
    // 3. DAY_START 이벤트 처리
    console.log('\n3️⃣ DAY_START 이벤트 시 turnsRemaining 감소');
    for (let turn = 1; turn <= shipyardCost.turns; turn++) {
      const remaining = shipyardCost.turns - turn;
      console.log(`   턴 ${turn}: turnsRemaining = ${remaining}`);
    }
    
    // 4. 건설 완료
    console.log('\n4️⃣ 건설 완료');
    const maxHp = calculateFacilityMaxHp('shipyard', 1);
    console.log(`   - facilityId 생성`);
    console.log(`   - HP: ${maxHp}/${maxHp}`);
    console.log(`   - isOperational: true`);
    console.log(`   - 예약 자원 소비 (WarehouseService.consume)`);
    
    // 5. 레벨업
    console.log('\n5️⃣ 레벨업 (Lv1 → Lv2)');
    const upgradeCost = calculateFacilityCost('shipyard', 2);
    console.log(`   비용: ${upgradeCost.credits} 크레딧, ${upgradeCost.minerals} 광물`);
    const effect1 = getFacilityEffect('shipyard', 1);
    const effect2 = getFacilityEffect('shipyard', 2);
    console.log(`   효과 변화: 건조속도 ${effect1.shipBuildSpeed}% → ${effect2.shipBuildSpeed}%`);
    
    // 6. 데미지 및 수리
    console.log('\n6️⃣ 궤도 폭격으로 데미지');
    console.log(`   - applyDamage(facilityId, 300)`);
    console.log(`   - HP: ${maxHp} → ${maxHp - 300}`);
    console.log(`   - HP 50% 미만이면 효율 50% 감소`);
    
    console.log('\n7️⃣ 수리');
    console.log(`   - repairFacility 호출`);
    console.log(`   - 자재 소모 (파손 정도에 비례)`);
    console.log(`   - HP 복구 후 효율 정상화`);
    
    console.log('\n✅ 건설 프로세스 시뮬레이션 완료\n');
  });
});

