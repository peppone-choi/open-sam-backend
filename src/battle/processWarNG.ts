/**
 * processWarNG - 전투 처리 래퍼 모듈
 *
 * PHP 참조: core/hwe/process_war.php:228-502 processWar_NG()
 *
 * 실제 전투 페이즈/스킬/피해 계산 로직은 `ProcessWar.ts` 안의
 * `processWar_NG` 가 담당하고, 이 모듈은 테스트에서 사용하기 쉬운
 * 얇은 래퍼와 요약 결과 타입을 제공한다.
 */

import type { WarUnit } from './WarUnit';
import { WarUnitGeneral } from './WarUnitGeneral';
import { WarUnitCity } from './WarUnitCity';
import { processWar_NG as coreProcessWarNG } from './ProcessWar';

/**
 * 전투 결과 요약 객체
 * - 실제 전투 로그/페이즈별 상세 정보는 `ActionLogger` 에 기록된다.
 */
export interface BattleResult {
  conquerCity: boolean;          // 도시 점령 여부
  attackerWon: boolean;          // 공격자 승리 여부(단순 지표)
  totalPhases: number;           // 공격자가 진행한 페이즈 수
  attackerCasualties: number;    // 공격자 손실 병력
  defenderCasualties: number;    // 수비측 손실 병력(장수·성벽 포함)
}

/**
 * 전투 밸런스/플래그 설정용 설정 객체.
 * 현재는 확장 포인트로만 사용하며, 실제 밸런스 상수는 PHP 포팅
 * 코드(`GameConst`, specialWar 트리거 등)를 그대로 따른다.
 */
export interface BattleConfig {
  /**
   * (미래 확장) 특기/스킬 트리거를 비활성화할지 여부.
   * 현재 구현에서는 항상 PHP와 동일하게 스킬을 활성화한다.
   */
  disableSkills?: boolean;
}

/**
 * 전투 처리 메인 함수 (래퍼)
 *
 * - RNG 는 `WarUnitGeneral` 생성 시 주입한 `RandUtil` 이 사용된다.
 * - 실제 로직은 `ProcessWar.processWar_NG` 에 위임한다.
 * - 테스트 편의를 위해 `getNextDefender` 는 동기 함수 시그니처를 사용하고,
 *   내부에서 비동기 래퍼로 변환한다.
 */
export async function processWarNG(
  warSeed: string,
  attacker: WarUnitGeneral,
  getNextDefender: (prevDefender: WarUnit | null, reqNext: boolean) => WarUnit | null,
  city: WarUnitCity,
  _config?: BattleConfig,
): Promise<boolean> {
  const asyncGetter = async (prev: WarUnit | null, reqNext: boolean): Promise<WarUnit | null> => {
    return Promise.resolve(getNextDefender(prev, reqNext));
  };

  // NOTE: `coreProcessWarNG` 는 PHP `processWar_NG` 와 1:1 로직을 공유한다.
  return coreProcessWarNG(warSeed, attacker, asyncGetter, city);
}

/**
 * 전투 종료 후 `WarUnit` 상태를 기반으로 간단한 요약 결과를 생성한다.
 *
 * 이 요약은 API / 테스트에서 사용하기 위한 것으로,
 * 실제 프론트엔드 전투 리플레이는 `ActionLogger` 에 누적된 로그를 사용한다.
 */
export function calculateBattleResult(
  attacker: WarUnit,
  defender: WarUnit | null,
  conquerCity: boolean,
): BattleResult {
  const attackerCasualties = attacker.getDead();
  const defenderCasualties = attacker.getKilled();

  // 매우 단순한 승패 판정 보조 지표
  const attackerWon = !!conquerCity || defenderCasualties > attackerCasualties;

  return {
    conquerCity,
    attackerWon,
    totalPhases: attacker.getPhase(),
    attackerCasualties,
    defenderCasualties,
  };
}
