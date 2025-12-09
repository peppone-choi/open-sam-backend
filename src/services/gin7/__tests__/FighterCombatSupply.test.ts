/**
 * FighterCombatService + CombatSupplyService 통합 테스트
 * 
 * Agent 03 - Gin7 Combat Supply & Fighter Launch
 * 
 * 테스트 시나리오:
 * 1. 연료 충분 상태에서 전투정 출격 → 물자 감소 확인
 * 2. 연료 부족 상태에서 출격 시도 → 실패/에러 메시지 확인
 * 3. 뇌격정 출격 시 물자 소모 확인 (일률 15)
 * 4. 모함 위치 기반 전투정 스폰 위치 확인
 */

import { FighterCombatService, FighterType, fighterCombatService } from '../FighterCombatService';
import { CombatSupplyService, combatSupplyService } from '../CombatSupplyService';

describe('FighterCombatService + CombatSupplyService Integration', () => {
  const testSessionId = 'test-session-001';
  const testBattleId = 'test-battle-001';
  const testCarrierId = 'carrier-001';
  const testOwnerId = 'owner-001';
  const testFaction = 'IMPERIAL';

  beforeEach(() => {
    // 세션 및 전투 초기화
    combatSupplyService.initializeSession(testSessionId);
    fighterCombatService.initializeBattle(testBattleId);

    // 모함 등록 (전투정 50대, 뇌격정 20대)
    fighterCombatService.registerCarrier(
      testBattleId,
      testCarrierId,
      'IMPERIAL_CARRIER',
      50,
      20,
    );

    // 유닛 물자 초기화 (100% 물자)
    combatSupplyService.initializeUnitSupply(
      testSessionId,
      testCarrierId,
      'IMPERIAL_CARRIER',
      1.0, // 100% supply
    );
  });

  afterEach(() => {
    combatSupplyService.cleanupSession(testSessionId);
    fighterCombatService.cleanupBattle(testBattleId);
  });

  describe('전투정 출격 - 충분한 물자', () => {
    it('전투정 5대 출격 시 50 물자 소모', () => {
      const initialSupply = combatSupplyService.getUnitSupplyStatus(testSessionId, testCarrierId);
      const initialFuel = initialSupply?.currentFuel ?? 0;

      const result = fighterCombatService.launchFighters(
        testBattleId,
        testSessionId,
        testCarrierId,
        testOwnerId,
        testFaction,
        FighterType.FIGHTER,
        5,
        undefined,
        { x: 100, y: 200 },
      );

      expect(result.success).toBe(true);
      expect(result.ammoConsumed).toBe(50); // 10 * 5
      expect(result.remainingSupply).toBe(initialFuel - 50);
      expect(result.fighter).toBeDefined();
      expect(result.fighter?.count).toBe(5);

      // 물자 상태 확인
      const afterSupply = combatSupplyService.getUnitSupplyStatus(testSessionId, testCarrierId);
      expect(afterSupply?.currentFuel).toBe(initialFuel - 50);
    });

    it('전투정 스폰 위치가 모함 위치 기반으로 설정됨', () => {
      const carrierPos = { x: 500, y: 300 };
      
      const result = fighterCombatService.launchFighters(
        testBattleId,
        testSessionId,
        testCarrierId,
        testOwnerId,
        testFaction,
        FighterType.FIGHTER,
        1,
        undefined,
        carrierPos,
      );

      expect(result.success).toBe(true);
      expect(result.fighter).toBeDefined();
      
      // 스폰 위치가 모함 근처인지 확인 (오프셋 ±10)
      const fighter = result.fighter!;
      expect(fighter.positionX).toBeGreaterThanOrEqual(carrierPos.x - 10);
      expect(fighter.positionX).toBeLessThanOrEqual(carrierPos.x + 10);
      expect(fighter.positionY).toBeGreaterThanOrEqual(carrierPos.y - 10);
      expect(fighter.positionY).toBeLessThanOrEqual(carrierPos.y + 10);
    });
  });

  describe('전투정 출격 - 물자 부족', () => {
    it('연료 부족 시 출격 실패', () => {
      // 연료를 낮은 상태로 설정
      const supply = combatSupplyService.getUnitSupplyStatus(testSessionId, testCarrierId);
      if (supply) {
        supply.currentFuel = 30; // 전투정 3대 분량만 남김
      }

      // 5대 출격 시도 (50 필요)
      const result = fighterCombatService.launchFighters(
        testBattleId,
        testSessionId,
        testCarrierId,
        testOwnerId,
        testFaction,
        FighterType.FIGHTER,
        5,
      );

      expect(result.success).toBe(false);
      expect(result.ammoConsumed).toBe(0);
      expect(result.error).toContain('연료 부족');
      expect(result.remainingSupply).toBe(30);
      expect(result.fighter).toBeUndefined();

      // 물자가 소모되지 않았는지 확인
      const afterSupply = combatSupplyService.getUnitSupplyStatus(testSessionId, testCarrierId);
      expect(afterSupply?.currentFuel).toBe(30);
    });

    it('부족한 만큼만 출격하면 성공', () => {
      const supply = combatSupplyService.getUnitSupplyStatus(testSessionId, testCarrierId);
      if (supply) {
        supply.currentFuel = 30;
      }

      // 3대만 출격 (30 필요)
      const result = fighterCombatService.launchFighters(
        testBattleId,
        testSessionId,
        testCarrierId,
        testOwnerId,
        testFaction,
        FighterType.FIGHTER,
        3,
      );

      expect(result.success).toBe(true);
      expect(result.ammoConsumed).toBe(30);
      expect(result.remainingSupply).toBe(0);
    });
  });

  describe('뇌격정 출격', () => {
    it('뇌격정 출격 시 일률 15 물자 소모', () => {
      const initialSupply = combatSupplyService.getUnitSupplyStatus(testSessionId, testCarrierId);
      const initialFuel = initialSupply?.currentFuel ?? 0;

      const result = fighterCombatService.launchFighters(
        testBattleId,
        testSessionId,
        testCarrierId,
        testOwnerId,
        testFaction,
        FighterType.TORPEDO,
        4,
        undefined,
        { x: 100, y: 100 },
      );

      expect(result.success).toBe(true);
      expect(result.ammoConsumed).toBe(60); // 15 * 4
      expect(result.remainingSupply).toBe(initialFuel - 60);
      expect(result.fighter?.type).toBe(FighterType.TORPEDO);
    });
  });

  describe('모함 수용량 확인', () => {
    it('전투정 수용량 초과 시 출격 실패', () => {
      // 모함에 전투정 50대만 있음
      const result = fighterCombatService.launchFighters(
        testBattleId,
        testSessionId,
        testCarrierId,
        testOwnerId,
        testFaction,
        FighterType.FIGHTER,
        100, // 100대 요청
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('전투정이 부족합니다');
    });
  });

  describe('물자 상태 로그 확인', () => {
    it('출격 후 소모 로그가 기록됨', () => {
      fighterCombatService.launchFighters(
        testBattleId,
        testSessionId,
        testCarrierId,
        testOwnerId,
        testFaction,
        FighterType.FIGHTER,
        5,
      );

      const logs = combatSupplyService.getConsumptionLogs(testSessionId, testCarrierId);
      expect(logs.length).toBeGreaterThan(0);
      
      const launchLog = logs.find(l => l.consumptionType === 'FIGHTER_LAUNCH');
      expect(launchLog).toBeDefined();
      expect(launchLog?.amount).toBe(50);
      expect(launchLog?.description).toContain('전투정');
    });
  });
});

/**
 * 수동 테스트 헬퍼 함수
 * Jest 없이 간단히 테스트할 때 사용
 */
export function runManualTest(): void {
  console.log('=== FighterCombatService Manual Test ===\n');
  
  const sessionId = 'manual-test-session';
  const battleId = 'manual-test-battle';
  const carrierId = 'manual-carrier';

  // 초기화
  combatSupplyService.initializeSession(sessionId);
  fighterCombatService.initializeBattle(battleId);
  fighterCombatService.registerCarrier(battleId, carrierId, 'IMPERIAL_CARRIER', 50, 20);
  combatSupplyService.initializeUnitSupply(sessionId, carrierId, 'IMPERIAL_CARRIER', 1.0);

  console.log('1. Initial state:');
  const initial = combatSupplyService.getUnitSupplyStatus(sessionId, carrierId);
  console.log(`   Fuel: ${initial?.currentFuel}/${initial?.maxFuel}\n`);

  console.log('2. Launch 5 fighters (should consume 50):');
  const result1 = fighterCombatService.launchFighters(
    battleId, sessionId, carrierId, 'owner', 'IMPERIAL', 
    FighterType.FIGHTER, 5, undefined, { x: 100, y: 200 }
  );
  console.log(`   Success: ${result1.success}`);
  console.log(`   Consumed: ${result1.ammoConsumed}`);
  console.log(`   Remaining: ${result1.remainingSupply}`);
  console.log(`   Position: (${result1.fighter?.positionX.toFixed(1)}, ${result1.fighter?.positionY.toFixed(1)})\n`);

  console.log('3. Set fuel to 30 and try launching 5 fighters (should fail):');
  const supply = combatSupplyService.getUnitSupplyStatus(sessionId, carrierId);
  if (supply) supply.currentFuel = 30;
  
  const result2 = fighterCombatService.launchFighters(
    battleId, sessionId, carrierId, 'owner', 'IMPERIAL', 
    FighterType.FIGHTER, 5
  );
  console.log(`   Success: ${result2.success}`);
  console.log(`   Error: ${result2.error}`);
  console.log(`   Remaining: ${result2.remainingSupply}\n`);

  console.log('4. Launch 3 fighters (should succeed with remaining 0):');
  const result3 = fighterCombatService.launchFighters(
    battleId, sessionId, carrierId, 'owner', 'IMPERIAL', 
    FighterType.FIGHTER, 3
  );
  console.log(`   Success: ${result3.success}`);
  console.log(`   Consumed: ${result3.ammoConsumed}`);
  console.log(`   Remaining: ${result3.remainingSupply}\n`);

  // 정리
  combatSupplyService.cleanupSession(sessionId);
  fighterCombatService.cleanupBattle(battleId);

  console.log('=== Test Complete ===');
}

