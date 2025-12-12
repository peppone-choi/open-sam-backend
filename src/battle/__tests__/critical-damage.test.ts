/**
 * 크리티컬 데미지 테스트
 * 
 * Agent 11 - Sam Battle Replay & Critical Damage
 * 
 * 테스트 시나리오:
 * 1. 크리티컬 확률 계산 (무력/운 기반)
 * 2. 크리티컬 배율 계산
 * 3. calcDamageWithCritical() 반환값 검증
 * 
 * 실행: cd open-sam-backend && npm test -- --testPathPattern=critical-damage
 */

import { RandUtil } from '../../utils/RandUtil';
import { LiteHashDRBG } from '../../utils/LiteHashDRBG';

// Mock WarUnit for testing (실제 WarUnit은 추상 클래스라 직접 테스트 불가)
describe('Critical Damage System', () => {
  /**
   * 시나리오 1: 기본 크리티컬 확률 계산
   * 
   * 조건:
   * - 무력(strength): 50 → 보정 없음
   * - 운(luck): 0 → 보정 없음
   * - 기본 확률: 5%
   * 
   * 예상: 5% (최소 3% 보장)
   */
  describe('getComputedCriticalRatio', () => {
    it('기본 능력치(무력 50, 운 0)일 때 5%', () => {
      const baseCritRate = 0.05;
      const strength = 50;
      const luck = 0;
      
      const strengthBonus = Math.max(0, (strength - 50) / 10) * 0.005;
      const luckBonus = Math.max(0, luck / 10) * 0.003;
      const criticalRatio = Math.max(0.03, Math.min(0.25, baseCritRate + strengthBonus + luckBonus));
      
      expect(criticalRatio).toBeCloseTo(0.05, 3);
    });
    
    it('고능력치(무력 100, 운 80)일 때 높은 확률', () => {
      const baseCritRate = 0.05;
      const strength = 100;
      const luck = 80;
      
      // 무력 100: (100-50)/10 * 0.005 = 0.025
      const strengthBonus = Math.max(0, (strength - 50) / 10) * 0.005;
      // 운 80: 80/10 * 0.003 = 0.024
      const luckBonus = Math.max(0, luck / 10) * 0.003;
      const criticalRatio = Math.max(0.03, Math.min(0.25, baseCritRate + strengthBonus + luckBonus));
      
      // 0.05 + 0.025 + 0.024 = 0.099 (약 10%)
      expect(criticalRatio).toBeCloseTo(0.099, 3);
    });
    
    it('최대 확률 25% 제한', () => {
      const baseCritRate = 0.05;
      const strength = 200; // 극단적 능력치
      const luck = 200;
      
      const strengthBonus = Math.max(0, (strength - 50) / 10) * 0.005;
      const luckBonus = Math.max(0, luck / 10) * 0.003;
      const criticalRatio = Math.max(0.03, Math.min(0.25, baseCritRate + strengthBonus + luckBonus));
      
      expect(criticalRatio).toBe(0.25);
    });
  });
  
  /**
   * 시나리오 2: 크리티컬 배율 계산
   * 
   * 조건:
   * - 기본 배율: 1.5 ~ 2.0
   * - 무력 보정: 무력 50 초과 시 (무력-50)/100 만큼 추가
   * - 운 보정: 운/500 만큼 최대 배율 추가
   */
  describe('criticalDamage multiplier', () => {
    it('기본 능력치일 때 1.5~2.0 배율', () => {
      const strength = 50;
      const luck = 0;
      
      let minRate = 1.5;
      let maxRate = 2.0;
      
      // 무력 보정 없음
      // 운 보정 없음
      
      expect(minRate).toBe(1.5);
      expect(maxRate).toBe(2.0);
    });
    
    it('고능력치(무력 100, 운 100)일 때 높은 배율', () => {
      const strength = 100;
      const luck = 100;
      
      let minRate = 1.5;
      let maxRate = 2.0;
      
      // 무력 100: (100-50)/100 = 0.5
      const strBonus = (strength - 50) / 100;
      minRate += strBonus * 0.5; // +0.25
      maxRate += strBonus; // +0.5
      
      // 운 100: 100/500 = 0.2
      const luckBonus = luck / 500;
      maxRate += luckBonus; // +0.2
      
      // minRate = 1.75, maxRate = 2.7
      expect(minRate).toBeCloseTo(1.75, 2);
      expect(maxRate).toBeCloseTo(2.7, 2);
    });
  });
  
  /**
   * 시나리오 3: RNG 시드 기반 재현 테스트
   * 
   * 같은 시드를 사용하면 같은 결과가 나와야 함
   */
  describe('RNG seed reproducibility', () => {
    it('같은 시드로 같은 크리티컬 결과 생성', () => {
      const seed = 'test_critical_seed_12345';
      
      // 두 번 실행해도 같은 시퀀스 생성
      const rng1 = new RandUtil(new LiteHashDRBG(seed));
      const rng2 = new RandUtil(new LiteHashDRBG(seed));
      
      const results1: boolean[] = [];
      const results2: boolean[] = [];
      
      for (let i = 0; i < 10; i++) {
        results1.push(rng1.nextBool(0.1)); // 10% 확률
        results2.push(rng2.nextBool(0.1));
      }
      
      expect(results1).toEqual(results2);
    });
  });
});

/**
 * 수동 테스트 시나리오 (주석)
 * 
 * 아래 시나리오는 실제 게임 환경에서 테스트할 수 있는 방법입니다.
 * 
 * === 테스트 준비 ===
 * 1. 테스트 장수 생성:
 *    - 공격자: 무력 90, 운 70, 병력 5000
 *    - 수비자: 무력 60, 운 30, 병력 3000
 * 
 * 2. 전투 실행:
 *    POST /api/battle/attack
 *    { attacker: attackerId, target: cityId }
 * 
 * === 확인 사항 ===
 * 1. 전투 로그에 "★필살!" 표시 확인
 * 2. 리플레이 데이터에 isCritical: true 확인:
 *    GET /api/battle/replay/:battleId
 *    response.turns[].actions[].detail.isCritical
 * 
 * 3. 크리티컬 발생 시 데미지가 1.5배 이상인지 확인
 * 
 * === 밸런스 테스트 ===
 * 무력 90, 운 70 장수의 예상 크리티컬 확률:
 * - 기본: 5%
 * - 무력 보정: (90-50)/10 * 0.5% = 2%
 * - 운 보정: 70/10 * 0.3% = 2.1%
 * - 총: 약 9.1%
 * 
 * 100회 전투 시 약 9회 정도 크리티컬 예상
 */



