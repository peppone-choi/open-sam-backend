/**
 * extractBattleOrder - 수비 순서 결정 로직
 * 
 * PHP 참조: core/hwe/process_war.php:192-226 extractBattleOrder()
 * 
 * 수비 순서 결정 요소:
 * - 병력 수 (crew)
 * - 군량 보유량 (rice)
 * - 훈련도 (defence_train)
 * - 능력치 합산 (leadership + strength + intel)
 */

import { WarUnit } from './WarUnit';
import { WarUnitCity } from './WarUnitCity';
import { WarUnitGeneral } from './WarUnitGeneral';

/**
 * 수비 순서 점수를 계산
 * 점수가 높을수록 먼저 수비에 나선다
 * 
 * @param defender 수비 유닛
 * @param attacker 공격 유닛
 * @returns 수비 순서 점수 (0 = 수비 불가)
 */
export function extractBattleOrder(defender: WarUnit, attacker: WarUnit): number {
  // 성벽 수비는 특수 처리
  if (defender instanceof WarUnitCity) {
    if (!(attacker instanceof WarUnitGeneral)) {
      return 0;
    }
    const attackerGeneral = attacker.getGeneral();
    
    // onCalcOpposeStat 호출 (PHP: $attackerGeneral->onCalcOpposeStat($defender->getGeneral(), 'cityBattleOrder', -1))
    if (typeof attackerGeneral.onCalcOpposeStat === 'function') {
      return attackerGeneral.onCalcOpposeStat(
        defender.getGeneral(), 
        'cityBattleOrder', 
        -1
      );
    }
    return -1;
  }

  // 장수 유닛의 수비 가능 여부 체크
  const general = defender.getGeneral();
  
  // 1. 병력이 0이면 수비 불가
  const crew = general.getVar?.('crew') ?? general.data?.crew ?? 0;
  if (crew === 0) {
    return 0;
  }

  // 2. 군량이 부족하면 수비 불가 (병력 100명당 군량 1 필요)
  const rice = general.getVar?.('rice') ?? general.data?.rice ?? 0;
  if (rice <= crew / 100) {
    return 0;
  }

  // 3. 훈련도 체크
  const defenceTrain = general.getVar?.('defence_train') ?? general.data?.defence_train ?? 0;
  const train = general.getVar?.('train') ?? general.data?.train ?? 70;
  if (train < defenceTrain) {
    return 0;
  }

  // 4. 사기 체크
  const atmos = general.getVar?.('atmos') ?? general.data?.atmos ?? 70;
  if (atmos < defenceTrain) {
    return 0;
  }

  // 5. 수비 순서 점수 계산
  // 능력치 합산 (현재 능력치 + 최대 능력치의 평균)
  const realLeadership = general.getLeadership?.() ?? general.data?.leadership ?? 50;
  const realStrength = general.getStrength?.() ?? general.data?.strength ?? 50;
  const realIntel = general.getIntel?.() ?? general.data?.intel ?? 50;
  
  const fullLeadership = general.getLeadership?.(false) ?? realLeadership;
  const fullStrength = general.getStrength?.(false) ?? realStrength;
  const fullIntel = general.getIntel?.(false) ?? realIntel;
  
  const realStat = realLeadership + realStrength + realIntel;
  const fullStat = fullLeadership + fullStrength + fullIntel;
  const totalStat = (realStat + fullStat) / 2;

  // 병력 보정 (병력 * (훈련도 * 사기) ^ 1.5) / 1,000,000
  // PHP: $totalCrew = $general->getVar('crew') / 1000000 * (($general->getVar('train') * $general->getVar('atmos')) ** 1.5);
  const totalCrew = (crew / 1000000) * Math.pow(train * atmos, 1.5);

  // 최종 점수
  return totalStat + totalCrew / 100;
}

/**
 * 수비 유닛 목록을 수비 순서대로 정렬
 * 
 * @param defenders 수비 유닛 목록
 * @param attacker 공격 유닛
 * @returns 수비 순서대로 정렬된 유닛 목록
 */
export function sortDefendersByBattleOrder(
  defenders: WarUnit[], 
  attacker: WarUnit
): WarUnit[] {
  return defenders
    .filter(defender => extractBattleOrder(defender, attacker) > 0)
    .sort((lhs, rhs) => {
      const lhsOrder = extractBattleOrder(lhs, attacker);
      const rhsOrder = extractBattleOrder(rhs, attacker);
      return rhsOrder - lhsOrder; // 내림차순 (높은 점수가 먼저)
    });
}
