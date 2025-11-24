/**
 * processWarNG - 전투 처리 로직
 * 
 * PHP 참조: core/hwe/process_war.php:228-502 processWar_NG()
 * 
 * 전투 페이즈:
 * 1. 병종 상성 계산
 * 2. 스킬 발동 (special_war)
 * 3. 피해 계산
 * 4. 사기 체크
 * 5. 로그 기록
 * 6. 승패 판정
 */

import { WarUnit } from './WarUnit';
import { WarUnitGeneral } from './WarUnitGeneral';
import { WarUnitCity } from './WarUnitCity';
import { RandUtil } from '../utils/RandUtil';
import { BattleSkillSystem } from './BattleSkillSystem';
import { Util } from '../utils/Util';

/**
 * 전투 결과
 */
export interface BattleResult {
  conquerCity: boolean;  // 도시 점령 여부
  attackerWon: boolean;  // 공격자 승리 여부
  totalPhases: number;   // 총 전투 페이즈
  attackerCasualties: number;  // 공격자 사상자
  defenderCasualties: number;  // 수비자 사상자
}

/**
 * 전투 처리 메인 함수
 * 
 * @param warSeed 전투 시드
 * @param attacker 공격자 유닛
 * @param getNextDefender 다음 수비자를 가져오는 함수
 * @param city 목표 도시
 * @returns 도시 점령 여부
 */
export async function processWarNG(
  warSeed: string,
  attacker: WarUnitGeneral,
  getNextDefender: (prevDefender: WarUnit | null, reqNext: boolean) => WarUnit | null,
  city: WarUnitCity
): Promise<boolean> {
  const logger = attacker.getLogger();
  let conquerCity = false;

  // 첫 번째 수비자 가져오기
  let defender: WarUnit | null = getNextDefender(null, true);

  // 전투 시작 로그
  const cityName = city.getName();
  const attackerName = attacker.getName();
  const attackerNationName = attacker.getNationVar('name');
  
  logger.pushGlobalActionLog?.(
    `<D><b>${attackerNationName}</b></>의 <Y>${attackerName}</>이 <G><b>${cityName}</b></>로 진격합니다.<span class='hidden_but_copyable'>(전투시드: ${warSeed})</span>`
  );
  logger.pushGeneralActionLog?.(
    `<G><b>${cityName}</b></>로 <M>진격</>합니다.<span class='hidden_but_copyable'>(전투시드: ${warSeed})</span>`
  );

  let logWritten = false;

  // 전투 페이즈 루프
  while (attacker.getPhase() < attacker.getMaxPhase()) {
    logWritten = false;

    // 수비자가 없으면 성벽 공격
    if (defender === null) {
      defender = city;
      defender.setSiege();

      // 군량 부족으로 패퇴
      if (city.getNationVar('rice') <= 0 && city.getVar('supply')) {
        attacker.setOppose(defender);
        defender.setOppose(attacker);

        attacker.addTrain(1);
        attacker.addWin();
        defender.addLose();

        logger.pushGlobalActionLog?.(
          `병량 부족으로 <G><b>${defender.getName()}</b></>의 수비병들이 <R>패퇴</>합니다.`
        );
        logger.pushGlobalHistoryLog?.(
          `<M><b>【패퇴】</b></><D><b>${defender.getNationVar('name')}</b></>이 병량 부족으로 <G><b>${defender.getName()}</b></>을 뺏기고 말았습니다.`
        );

        conquerCity = true;
        break;
      }
    }

    // 새로운 수비자와의 전투 시작
    if (defender.getPhase() === 0 && defender.getOppose() === null) {
      defender.setPrePhase(attacker.getPhase());

      attacker.addTrain(1);
      defender.addTrain(1);

      // 병종 상성 체크
      const attackerCrewType = attacker.getCrewType();
      const defenderCrewType = defender.getCrewType();

      // 전투 시작 로그
      const attackerCrewTypeName = attacker.getCrewTypeName();
      const defenderCrewTypeName = defender.getCrewTypeName();

      if (defender instanceof WarUnitGeneral) {
        logger.pushGlobalActionLog?.(
          `<Y>${attackerName}</>의 ${attackerCrewTypeName}와 <Y>${defender.getName()}</>의 ${defenderCrewTypeName}이 대결합니다.`
        );
        attacker.getLogger()?.pushGeneralActionLog?.(
          `${attackerCrewTypeName}로 <Y>${defender.getName()}</>의 ${defenderCrewTypeName}을 <M>공격</>합니다.`
        );
        defender.getLogger()?.pushGeneralActionLog?.(
          `${defenderCrewTypeName}로 <Y>${attackerName}</>의 ${attackerCrewTypeName}을 <M>수비</>합니다.`
        );
      } else {
        logger.pushGlobalActionLog?.(
          `<Y>${attackerName}</>이 ${attackerCrewTypeName}로 성벽을 공격합니다.`
        );
        logger.pushGeneralActionLog?.(
          `${attackerCrewTypeName}로 성벽을 <M>공격</>합니다.`
        );
      }

      // 전투 초기화
      attacker.setOppose(defender);
      defender.setOppose(attacker);

      // 전투 초기 스킬 발동
      BattleSkillSystem.applyBattleInitSkills(attacker, defender, attacker.rng);
    }

    // 전투 페이즈 시작
    attacker.beginPhase();
    defender.beginPhase();

    // 전투 페이즈 스킬 발동
    BattleSkillSystem.applyBattlePhaseSkills(attacker, defender, attacker.rng);

    // 피해 계산
    let deadDefender = attacker.calcDamage();
    let deadAttacker = defender.calcDamage();

    const attackerHP = attacker.getHP();
    const defenderHP = defender.getHP();

    // HP 부족 시 피해 조정
    if (deadAttacker > attackerHP || deadDefender > defenderHP) {
      const deadAttackerRatio = deadAttacker / Math.max(1, attackerHP);
      const deadDefenderRatio = deadDefender / Math.max(1, defenderHP);

      if (deadDefenderRatio > deadAttackerRatio) {
        // 수비자가 더 병력 부족
        deadAttacker /= deadDefenderRatio;
        deadDefender = defenderHP;
      } else {
        // 공격자가 더 병력 부족
        deadDefender /= deadAttackerRatio;
        deadAttacker = attackerHP;
      }
    }

    deadAttacker = Math.min(Math.ceil(deadAttacker), attackerHP);
    deadDefender = Math.min(Math.ceil(deadDefender), defenderHP);

    // HP 감소
    attacker.decreaseHP(deadAttacker);
    defender.decreaseHP(deadDefender);

    attacker.increaseKilled(deadDefender);
    defender.increaseKilled(deadAttacker);

    // 페이즈 번호
    let phaseNickname: string;
    if (defender.getPhase() < 0) {
      phaseNickname = '先';
    } else {
      const currPhase = attacker.getPhase() + 1;
      phaseNickname = `${currPhase} `;
    }

    // 전투 상세 로그
    if (deadAttacker > 0 || deadDefender > 0) {
      attacker.getLogger()?.pushGeneralBattleDetailLog?.(
        `${phaseNickname}: <Y1>【${attacker.getName()}】</> <C>${attacker.getHP()} (-${deadAttacker})</> VS <C>${defender.getHP()} (-${deadDefender})</> <Y1>【${defender.getName()}】</>`
      );

      defender.getLogger()?.pushGeneralBattleDetailLog?.(
        `${phaseNickname}: <Y1>【${defender.getName()}】</> <C>${defender.getHP()} (-${deadDefender})</> VS <C>${attacker.getHP()} (-${deadAttacker})</> <Y1>【${attacker.getName()}】</>`
      );
    }

    // 페이즈 증가
    attacker.addPhase();
    defender.addPhase();

    // 공격자 전투 계속 체크
    const noRice = { value: false };
    if (!attacker.continueWar(noRice)) {
      logWritten = true;

      attacker.logBattleResult();
      defender.logBattleResult();

      attacker.addLose();
      defender.addWin();

      attacker.tryWound();
      defender.tryWound();

      logger.pushGlobalActionLog?.(
        `<Y>${attacker.getName()}</>의 ${attacker.getCrewTypeName()}이 퇴각했습니다.`
      );
      if (noRice.value) {
        attacker.getLogger()?.pushGeneralActionLog?.('군량 부족으로 퇴각합니다.');
      } else {
        attacker.getLogger()?.pushGeneralActionLog?.('퇴각했습니다.');
      }
      defender.getLogger()?.pushGeneralActionLog?.(
        `<Y>${attacker.getName()}</>의 ${attacker.getCrewTypeName()}이 퇴각했습니다.`
      );

      break;
    }

    // 수비자 전투 계속 체크
    if (!defender.continueWar(noRice)) {
      logWritten = true;

      attacker.logBattleResult();
      defender.logBattleResult();

      if (!(defender instanceof WarUnitCity) || defender.isSiege()) {
        attacker.addWin();
        defender.addLose();

        attacker.tryWound();
        defender.tryWound();

        if (defender === city) {
          if (attacker instanceof WarUnitGeneral) {
            attacker.addLevelExp(1000);
          }
          conquerCity = true;
          break;
        }
      }

      if (defender instanceof WarUnitCity && !defender.isSiege()) {
        // 실제 공성을 위해 다시 초기화
        defender.setOppose(null);
      } else if (noRice.value) {
        logger.pushGlobalActionLog?.(
          `<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}이 패퇴했습니다.`
        );
        attacker.getLogger()?.pushGeneralActionLog?.(
          `<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}이 패퇴했습니다.`
        );
        defender.getLogger()?.pushGeneralActionLog?.('군량 부족으로 패퇴합니다.');
      } else {
        logger.pushGlobalActionLog?.(
          `<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}이 전멸했습니다.`
        );
        attacker.getLogger()?.pushGeneralActionLog?.(
          `<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}이 전멸했습니다.`
        );
        defender.getLogger()?.pushGeneralActionLog?.('전멸했습니다.');
      }

      if (attacker.getPhase() >= attacker.getMaxPhase()) {
        break;
      }

      defender.finishBattle();
      defender = getNextDefender(defender, true);

      if (defender !== null && !(defender instanceof WarUnitGeneral) && !(defender instanceof WarUnitCity)) {
        throw new Error('다음 수비자를 받아오는데 실패');
      }
    }
  }

  // 마지막 페이즈의 전투 마무리
  if (!logWritten) {
    attacker.logBattleResult();
    defender?.logBattleResult();

    attacker.tryWound();
    defender?.tryWound();
  }

  attacker.finishBattle();
  defender?.finishBattle();

  // 성벽 피해 및 분쟁 처리
  if (city.getDead() || defender instanceof WarUnitCity) {
    if (city !== defender) {
      city.setOppose(attacker);
      city.setSiege();
      city.finishBattle();
    }

    const newConflict = city.addConflict?.();
    if (newConflict) {
      const nationName = attacker.getNationVar('name');
      logger.pushGlobalHistoryLog?.(
        `<M><b>【분쟁】</b></><D><b>${nationName}</b></>이 <G><b>${city.getName()}</b></> 공략에 가담하여 분쟁이 발생하고 있습니다.`
      );
    }
  }

  getNextDefender(defender, false);

  return conquerCity;
}

/**
 * 전투 결과를 계산하여 반환
 */
export function calculateBattleResult(
  attacker: WarUnit,
  defender: WarUnit | null,
  conquerCity: boolean
): BattleResult {
  return {
    conquerCity,
    attackerWon: attacker.getKilled() > (defender?.getDead() || 0),
    totalPhases: attacker.getPhase(),
    attackerCasualties: attacker.getDead(),
    defenderCasualties: attacker.getKilled()
  };
}
