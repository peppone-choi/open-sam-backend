/**
 * ProcessWar - 전투 처리 시스템
 * PHP process_war.php 직접 변환
 */

import { RandUtil } from '../utils/RandUtil';
import { LiteHashDRBG } from '../utils/LiteHashDRBG';
import { WarUnit } from './WarUnit';
import { WarUnitGeneral } from './WarUnitGeneral';
import { WarUnitCity } from './WarUnitCity';
import { DB } from '../config/db';
import { GameConst } from '../constants/GameConst';
import { Util } from '../utils/Util';
import { JosaUtil } from '../utils/JosaUtil';
import * as BattleEventHook from '../services/battle/BattleEventHook.service';
import { WarUnitTriggerCaller } from '../game/triggers/WarUnitTriggerCaller';
import { ensureTriggerEnv, type TriggerEnv } from '../game/triggers/TriggerEnv';

/**
 * extractBattleOrder - 수비 순서 결정
 * 
 * @param defender 수비자
 * @param attacker 공격자
 * @returns 수비 순서 점수 (높을수록 우선 수비)
 */
export function extractBattleOrder(defender: WarUnit, attacker: WarUnit): number {
  // 도시인 경우
  if (defender instanceof WarUnitCity) {
    if (!(attacker instanceof WarUnitGeneral)) {
      return 0;
    }
    const attackerGeneral = attacker.getGeneral();
    // onCalcOpposeStat 호출
    if (typeof attackerGeneral.onCalcOpposeStat === 'function') {
      return attackerGeneral.onCalcOpposeStat(defender.getGeneral(), 'cityBattleOrder', -1);
    }
    return -1;
  }
  
  // 장수인 경우
  const general = defender.getGeneral();
  const crew = general.data?.crew || 0;
  
  // 병력이 없으면 수비 불가
  if (crew === 0) {
    return 0;
  }
  
  // 군량이 부족하면 수비 불가
  const rice = general.data?.rice || 0;
  if (rice <= crew / 100) {
    return 0;
  }
  
  // 수비 훈련도 체크
  const defence_train = general.data?.defence_train || 999;
  const train = general.data?.train || 0;
  const atmos = general.data?.atmos || 0;
  
  if (train < defence_train) {
    return 0;
  }
  
  if (atmos < defence_train) {
    return 0;
  }
  
  // 능력치 합산
  const realLeadership = typeof general.getLeadership === 'function' 
    ? general.getLeadership(true) 
    : general.data?.leadership || 50;
  const realStrength = typeof general.getStrength === 'function'
    ? general.getStrength(true)
    : general.data?.strength || 50;
  const realIntel = typeof general.getIntel === 'function'
    ? general.getIntel(true)
    : general.data?.intel || 50;
    
  const fullLeadership = typeof general.getLeadership === 'function'
    ? general.getLeadership(false)
    : realLeadership;
  const fullStrength = typeof general.getStrength === 'function'
    ? general.getStrength(false)
    : realStrength;
  const fullIntel = typeof general.getIntel === 'function'
    ? general.getIntel(false)
    : realIntel;
  
  const realStat = realLeadership + realStrength + realIntel;
  const fullStat = fullLeadership + fullStrength + fullIntel;
  const totalStat = (realStat + fullStat) / 2;
  
  // 병력 보정
  const totalCrew = crew / 1000000 * Math.pow(train * atmos, 1.5);
  
  return totalStat + totalCrew / 100;
}

type BattleTriggerMethod = 'getBattleInitSkillTriggerList' | 'getBattlePhaseSkillTriggerList';

function resolveBattleTriggerCaller(unit: WarUnit | null | undefined, method: BattleTriggerMethod): WarUnitTriggerCaller | null {
  if (!unit) {
    return null;
  }
  const general = unit.getGeneral?.();
  if (!general || typeof general[method] !== 'function') {
    return null;
  }
  try {
    return general[method](unit) ?? null;
  } catch (error) {
    console.error(`[ProcessWar] Failed to resolve ${method}:`, error);
    return null;
  }
}

function fireBattleTriggers(
  attackerCaller: WarUnitTriggerCaller | null,
  defenderCaller: WarUnitTriggerCaller | null,
  attacker: WarUnit,
  defender: WarUnit | null,
  env?: TriggerEnv | null
): TriggerEnv | null {
  if ((!attackerCaller && !defenderCaller) || !defender) {
    return env ?? null;
  }
  let currentEnv = ensureTriggerEnv(env || undefined);
  if (attackerCaller) {
    currentEnv = attackerCaller.fire(attacker.rng, currentEnv, [attacker, defender]);
  }
  if (defenderCaller) {
    currentEnv = defenderCaller.fire(attacker.rng, currentEnv, [attacker, defender]);
  }
  return currentEnv;
}

/**
 * processWar - 전투 처리 메인 함수
 */
export async function processWar(
  warSeed: string,
  attackerGeneral: any,
  rawAttackerNation: any,
  rawDefenderCity: any
): Promise<boolean> {
  const rng = new RandUtil(new LiteHashDRBG(warSeed));
  const db = DB.db();
  
  const attackerNationID = attackerGeneral.getNationID();
  const defenderNationID = rawDefenderCity.nation;
  
  // 수비국 정보 가져오기
  let rawDefenderNation: any;
  if (defenderNationID === 0) {
    rawDefenderNation = {
      nation: 0,
      name: '재야',
      capital: 0,
      level: 0,
      gold: 0,
      rice: 10000,
      type: GameConst.neutralNationType || 0,
      tech: 0,
      gennum: 1
    };
  } else {
    try {
      const { nationRepository } = await import('../repositories/nation.repository');
      const sessionId = attackerGeneral.getSessionID?.() || 'sangokushi_default';
      const nationDoc = await nationRepository.findByNationNum(sessionId, defenderNationID);
      rawDefenderNation = nationDoc || rawDefenderNation;
    } catch (error) {
      console.error('Failed to load defender nation:', error);
      rawDefenderNation = {
        nation: defenderNationID,
        name: '수비국',
        capital: 0,
        level: 0,
        gold: 0,
        rice: 10000,
        type: 0,
        tech: 0,
        gennum: 1
      };
    }
  }
  
  // 게임 환경 가져오기
  const { kvStorageRepository } = await import('../repositories/kvstorage.repository');
  const sessionId = attackerGeneral.getSessionID?.() || 'sangokushi_default';
  const startYear = await kvStorageRepository.getValue(sessionId, 'game_env', 'startyear') || 184;
  const year = await kvStorageRepository.getValue(sessionId, 'game_env', 'year') || 184;
  const month = await kvStorageRepository.getValue(sessionId, 'game_env', 'month') || 1;
  const joinMode = await kvStorageRepository.getValue(sessionId, 'game_env', 'join_mode') || 'normal';
  
  // 공격자 생성
  const attacker = new WarUnitGeneral(rng, attackerGeneral, rawAttackerNation, true);
  
  // 수비 도시 생성
  const city = new WarUnitCity(rng, rawDefenderCity, rawDefenderNation, year, month, startYear);
  
  // 수비 장수 목록 가져오기
  const { generalRepository } = await import('../repositories/general.repository');
  const defenderCityGeneralList: any[] = [];
  
  try {
    const defenderGenerals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': city.getVar('nation'),
      'data.city': city.getVar('city')
    });
    
    for (const defGeneral of defenderGenerals) {
      if (defGeneral.data.nation === 0) continue;
      
      defGeneral.setRawCity?.(rawDefenderCity);
      const defenderCandidate = new WarUnitGeneral(rng, defGeneral, rawDefenderNation, false);
      
      if (extractBattleOrder(defenderCandidate, attacker) <= 0) {
        continue;
      }
      
      defenderCityGeneralList.push(defenderCandidate);
    }
  } catch (error) {
    console.error('Failed to load defender generals:', error);
  }
  
  // 수비 순서 정렬
  const defenderList: WarUnit[] = [...defenderCityGeneralList];
  
  if (defenderList.length > 0 && extractBattleOrder(city, attacker) > 0) {
    defenderList.push(city);
  }
  
  defenderList.sort((lhs, rhs) => {
    return extractBattleOrder(rhs, attacker) - extractBattleOrder(lhs, attacker);
  });
  
  // 수비자 이터레이터
  let defenderIndex = 0;
  const getNextDefender = async (prevDefender: WarUnit | null, reqNext: boolean): Promise<WarUnit | null> => {
    if (prevDefender !== null) {
      await prevDefender.applyDB(db);
    }
    
    if (!reqNext) {
      return null;
    }
    
    if (defenderIndex >= defenderList.length) {
      return null;
    }
    
    const nextDefender = defenderList[defenderIndex];
    if (extractBattleOrder(nextDefender, attacker) <= 0) {
      return null;
    }
    
    defenderIndex++;
    return nextDefender;
  };
  
  // 실제 전투 처리
  const conquerCity = await processWar_NG(warSeed, attacker, getNextDefender, city);
  
  await attacker.applyDB(db);
  
  // 도시 업데이트
  rawDefenderCity = city.getRaw();
  const updateAttackerNation: any = {};
  const updateDefenderNation: any = {};
  
  // 군량 소모 계산
  if (city.getVar('supply')) {
    if (city.getPhase() > 0) {
      let rice = city.getKilled() / 100 * 0.8;
      const crewType = city.getCrewType();
      if (crewType) {
        rice *= crewType.rice || 1;
      }
      
      const tech = rawDefenderNation.tech || 0;
      const techLevel = Math.floor(tech / 1000);
      rice *= (1 + techLevel * 0.15);
      rice *= city.getCityTrainAtmos() / 100 - 0.2;
      rice = Util.round(rice);
      
      updateDefenderNation.rice = Math.max(0, rawDefenderNation.rice - rice);
    } else if (conquerCity) {
      if (rawDefenderNation.capital === rawDefenderCity.city) {
        updateDefenderNation.rice = rawDefenderNation.rice + 1000;
      } else {
        updateDefenderNation.rice = rawDefenderNation.rice + 500;
      }
    }
  }
  
  // 사망자 처리
  const totalDead = attacker.getKilled() + attacker.getDead();
  
  try {
    const { cityRepository } = await import('../repositories/city.repository');
    
    // 공격자 도시에 사망자 추가
    const attackerCityId = attackerGeneral.getCityID?.();
    if (attackerCityId) {
      await cityRepository.updateByCityNum(sessionId, attackerCityId, {
        dead: { $inc: Math.round(totalDead * 0.4) }
      });
    }
    
    // 수비자 도시에 사망자 추가
    await cityRepository.updateByCityNum(sessionId, rawDefenderCity.city, {
      dead: { $inc: Math.round(totalDead * 0.6) }
    });
  } catch (error) {
    console.error('Failed to update city deaths:', error);
  }
  
  // 기술 증가
  const attackerIncTech = attacker.getDead() * 0.012;
  const defenderIncTech = attacker.getKilled() * 0.009;
  
  updateAttackerNation.tech = { $inc: attackerIncTech / Math.max(GameConst.initialNationGenLimit || 5, rawAttackerNation.gennum) };
  updateDefenderNation.tech = { $inc: defenderIncTech / Math.max(GameConst.initialNationGenLimit || 5, rawDefenderNation.gennum) };
  
  // 국가 업데이트
  try {
    const { nationRepository } = await import('../repositories/nation.repository');
    
    if (Object.keys(updateAttackerNation).length > 0) {
      await nationRepository.updateByNationNum(sessionId, attackerNationID, updateAttackerNation);
    }
    
    if (defenderNationID !== 0 && Object.keys(updateDefenderNation).length > 0) {
      await nationRepository.updateByNationNum(sessionId, defenderNationID, updateDefenderNation);
    }
  } catch (error) {
    console.error('Failed to update nations:', error);
  }
  
  // 외교 관계 업데이트
  try {
    const { diplomacyRepository } = await import('../repositories/diplomacy.repository');
    
    await diplomacyRepository.updateDeaths(sessionId, attackerNationID, defenderNationID, attacker.getDead());
    await diplomacyRepository.updateDeaths(sessionId, defenderNationID, attackerNationID, attacker.getKilled());
  } catch (error) {
    console.error('Failed to update diplomacy:', error);
  }
  
  // 도시 점령 처리
  if (conquerCity) {
    await ConquerCity(
      { startyear: startYear, year, month, join_mode: joinMode },
      attackerGeneral,
      city.getRaw(),
      defenderCityGeneralList.map(wu => wu.getGeneral())
    );
  }
  
  return conquerCity;
}

/**
 * processWar_NG - 실제 전투 처리 로직
 */
async function processWar_NG(
  warSeed: string,
  attacker: WarUnitGeneral,
  getNextDefender: (prev: WarUnit | null, reqNext: boolean) => Promise<WarUnit | null>,
  city: WarUnitCity
): Promise<boolean> {
  const logger = attacker.getLogger();
  const date = attacker.getGeneral().getTurnTime?.('HM') || '';
  
  let defender = await getNextDefender(null, true);
  let conquerCity = false;
  let battleTriggerEnv: TriggerEnv | null = null;
  let attackerPhaseCaller: WarUnitTriggerCaller | null = null;
  let defenderPhaseCaller: WarUnitTriggerCaller | null = null;
  
  const josaRo = JosaUtil.pick(city.getName(), '로');
  const josaYi = JosaUtil.pick(attacker.getName(), '이');
  
  logger?.pushGlobalActionLog?.(`<D><b>${attacker.getNationVar('name')}</b></>의 <Y>${attacker.getName()}</>${josaYi} <G><b>${city.getName()}</b></>${josaRo} 진격합니다.<span class='hidden_but_copyable'>(전투시드: ${warSeed})</span>`);
  logger?.pushGeneralActionLog?.(`<G><b>${city.getName()}</b></>${josaRo} <M>진격</>합니다.<span class='hidden_but_copyable'>(전투시드: ${warSeed})</span> <1>${date}</>`);
  
  let logWritten = false;
  const noRice = { value: false };
  
  // 전투 루프
  while (attacker.getPhase() < attacker.getMaxPhase()) {
    logWritten = false;
    
    // 수비자가 없으면 도시 공성
    if (defender === null) {
      defender = city;
      defender.setSiege();
      battleTriggerEnv = null;
      attackerPhaseCaller = null;
      defenderPhaseCaller = null;
      
      // 병량 부족으로 패퇴 체크
      if (city.getNationVar('rice') <= 0 && city.getVar('supply')) {
        attacker.setOppose(defender);
        defender.setOppose(attacker);
        
        attacker.addTrain(1);
        attacker.addWin();
        defender.addLose();
        (defender as WarUnitCity).heavyDecreaseWealth();
        
        logger?.pushGlobalActionLog?.(`병량 부족으로 <G><b>${defender.getName()}</b></>의 수비병들이 <R>패퇴</>합니다.`);
        
        const josaUl = JosaUtil.pick(defender.getName(), '을');
        const josaYi2 = JosaUtil.pick(defender.getNationVar('name'), '이');
        logger?.pushGlobalHistoryLog?.(`<M><b>【패퇴】</b></><D><b>${defender.getNationVar('name')}</b></>${josaYi2} 병량 부족으로 <G><b>${defender.getName()}</b></>${josaUl} 뺏기고 말았습니다.`);
        
        conquerCity = true;
        break;
      }
    }
    
    // 새로운 전투 시작
    if (defender && defender.getPhase() === 0 && defender.getOppose() === null) {
      defender.setPrePhase(attacker.getPhase());
      
      attacker.addTrain(1);
      defender.addTrain(1);
      
      // 전투 로그
      const attackerName = attacker.getName();
      const attackerCrewTypeName = attacker.getCrewTypeName();
      
      if (defender instanceof WarUnitGeneral) {
        const defenderName = defender.getName();
        const defenderCrewTypeName = defender.getCrewTypeName();
        
        const josaWa = JosaUtil.pick(attackerCrewTypeName, '와');
        const josaYi3 = JosaUtil.pick(defenderCrewTypeName, '이');
        logger?.pushGlobalActionLog?.(`<Y>${attackerName}</>의 ${attackerCrewTypeName}${josaWa} <Y>${defenderName}</>의 ${defenderCrewTypeName}${josaYi3} 대결합니다.`);
        
        const josaRo2 = JosaUtil.pick(attackerCrewTypeName, '로');
        const josaUl = JosaUtil.pick(defenderCrewTypeName, '을');
        attacker.getLogger()?.pushGeneralActionLog?.(`${attackerCrewTypeName}${josaRo2} <Y>${defenderName}</>의 ${defenderCrewTypeName}${josaUl} <M>공격</>합니다.`);
        
        const josaRo3 = JosaUtil.pick(defenderCrewTypeName, '로');
        const josaUl2 = JosaUtil.pick(attackerCrewTypeName, '을');
        defender.getLogger()?.pushGeneralActionLog?.(`${defenderCrewTypeName}${josaRo3} <Y>${attackerName}</>의 ${attackerCrewTypeName}${josaUl2} <M>수비</>합니다.`);
      } else {
        const josaYi4 = JosaUtil.pick(attackerName, '이');
        const josaRo4 = JosaUtil.pick(attackerCrewTypeName, '로');
        logger?.pushGlobalActionLog?.(`<Y>${attackerName}</>${josaYi4} ${attackerCrewTypeName}${josaRo4} 성벽을 공격합니다.`);
        logger?.pushGeneralActionLog?.(`${attackerCrewTypeName}${josaRo4} 성벽을 <M>공격</>합니다.`, 1);
      }
      
      attacker.setOppose(defender);
      defender.setOppose(attacker);

      const attackerInitCaller = resolveBattleTriggerCaller(attacker, 'getBattleInitSkillTriggerList');
      const defenderInitCaller = resolveBattleTriggerCaller(defender, 'getBattleInitSkillTriggerList');
      battleTriggerEnv = fireBattleTriggers(attackerInitCaller, defenderInitCaller, attacker, defender, null);
      attackerPhaseCaller = resolveBattleTriggerCaller(attacker, 'getBattlePhaseSkillTriggerList');
      defenderPhaseCaller = resolveBattleTriggerCaller(defender, 'getBattlePhaseSkillTriggerList');
    }
    
    // 페이즈 시작
    battleTriggerEnv = fireBattleTriggers(attackerPhaseCaller, defenderPhaseCaller, attacker, defender, battleTriggerEnv);
    attacker.beginPhase();
    defender?.beginPhase();
    
    // 데미지 계산
    const deadDefender = attacker.calcDamage();
    const deadAttacker = defender?.calcDamage() || 0;
    
    let attackerHP = attacker.getHP();
    let defenderHP = defender?.getHP() || 0;
    
    // 병력 부족 시 데미지 보정
    if (deadAttacker > attackerHP || deadDefender > defenderHP) {
      const deadAttackerRatio = deadAttacker / Math.max(1, attackerHP);
      const deadDefenderRatio = deadDefender / Math.max(1, defenderHP);
      
      let finalDeadAttacker = deadAttacker;
      let finalDeadDefender = deadDefender;
      
      if (deadDefenderRatio > deadAttackerRatio) {
        finalDeadAttacker /= deadDefenderRatio;
        finalDeadDefender = defenderHP;
      } else {
        finalDeadDefender /= deadAttackerRatio;
        finalDeadAttacker = attackerHP;
      }
      
      attacker.decreaseHP(Math.min(Math.ceil(finalDeadAttacker), attackerHP));
      defender?.decreaseHP(Math.min(Math.ceil(finalDeadDefender), defenderHP));
      
      attacker.increaseKilled(Math.min(Math.ceil(finalDeadDefender), defenderHP));
      defender?.increaseKilled(Math.min(Math.ceil(finalDeadAttacker), attackerHP));
    } else {
      attacker.decreaseHP(Math.min(Math.ceil(deadAttacker), attackerHP));
      defender?.decreaseHP(Math.min(Math.ceil(deadDefender), defenderHP));
      
      attacker.increaseKilled(Math.min(Math.ceil(deadDefender), defenderHP));
      defender?.increaseKilled(Math.min(Math.ceil(deadAttacker), attackerHP));
    }
    
    // 페이즈 로그
    const currPhase = attacker.getPhase() + 1;
    const phaseNickname = defender && defender.getPhase() < 0 ? '先' : `${currPhase} `;
    
    if (deadAttacker > 0 || deadDefender > 0) {
      attacker.getLogger()?.pushGeneralBattleDetailLog?.(
        `${phaseNickname}: <Y1>【${attacker.getName()}】</> <C>${attacker.getHP()} (-${Math.ceil(deadAttacker)})</> VS <C>${defender?.getHP() || 0} (-${Math.ceil(deadDefender)})</> <Y1>【${defender?.getName() || ''}】</>`
      );
      
      defender?.getLogger()?.pushGeneralBattleDetailLog?.(
        `${phaseNickname}: <Y1>【${defender.getName()}】</> <C>${defender.getHP()} (-${Math.ceil(deadDefender)})</> VS <C>${attacker.getHP()} (-${Math.ceil(deadAttacker)})</> <Y1>【${attacker.getName()}】</>`
      );
    }
    
    attacker.addPhase();
    defender?.addPhase();
    
    // 공격자 패배 체크
    if (!attacker.continueWar(noRice)) {
      logWritten = true;
      
      attacker.logBattleResult();
      defender?.logBattleResult();
      
      attacker.addLose();
      defender?.addWin();
      
      attacker.tryWound();
      defender?.tryWound();
      
      const josaYi5 = JosaUtil.pick(attacker.getCrewTypeName(), '이');
      logger?.pushGlobalActionLog?.(`<Y>${attacker.getName()}</>의 ${attacker.getCrewTypeName()}${josaYi5} 퇴각했습니다.`);
      
      if (noRice.value) {
        attacker.getLogger()?.pushGeneralActionLog?.("군량 부족으로 퇴각합니다.", 1);
      } else {
        attacker.getLogger()?.pushGeneralActionLog?.("퇴각했습니다.", 1);
      }
      
      defender?.getLogger()?.pushGeneralActionLog?.(`<Y>${attacker.getName()}</>의 ${attacker.getCrewTypeName()}${josaYi5} 퇴각했습니다.`, 1);
      
      break;
    }
    
    // 수비자 패배 체크
    if (defender && !defender.continueWar(noRice)) {
      logWritten = true;
      
      attacker.logBattleResult();
      defender.logBattleResult();
      
      if (!(defender instanceof WarUnitCity) || defender.isSiege()) {
        attacker.addWin();
        defender.addLose();
        
        attacker.tryWound();
        defender.tryWound();
        
        if (defender === city) {
          attacker.addLevelExp(1000);
          conquerCity = true;
          break;
        }
      }
      
      const josaYi6 = JosaUtil.pick(defender.getCrewTypeName(), '이');
      
      if (defender instanceof WarUnitCity && !defender.isSiege()) {
        // 실제 공성을 위해 다시 초기화
        defender.setOppose(null);
      } else if (noRice.value) {
        logger?.pushGlobalActionLog?.(`<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}${josaYi6} 패퇴했습니다.`);
        attacker.getLogger()?.pushGeneralActionLog?.(`<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}${josaYi6} 패퇴했습니다.`, 1);
        defender.getLogger()?.pushGeneralActionLog?.("군량 부족으로 패퇴합니다.", 1);
      } else {
        logger?.pushGlobalActionLog?.(`<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}${josaYi6} 전멸했습니다.`);
        attacker.getLogger()?.pushGeneralActionLog?.(`<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}${josaYi6} 전멸했습니다.`, 1);
        defender.getLogger()?.pushGeneralActionLog?.("전멸했습니다.", 1);
      }
      
      if (attacker.getPhase() >= attacker.getMaxPhase()) {
        break;
      }
      
      defender.finishBattle();
      defender = await getNextDefender(defender, true);
      battleTriggerEnv = null;
      attackerPhaseCaller = null;
      defenderPhaseCaller = null;
      
      if (defender !== null && !(defender instanceof WarUnitGeneral)) {
        throw new Error('다음 수비자를 받아오는데 실패');
      }
    }
  }
  
  // 전투 종료 처리
  if (!logWritten) {
    attacker.logBattleResult();
    defender?.logBattleResult();
    
    attacker.tryWound();
    defender?.tryWound();
  }
  
  attacker.finishBattle();
  defender?.finishBattle();
  
  // 분쟁 처리
  if (city.getDead() || defender instanceof WarUnitCity) {
    if (city !== defender) {
      city.setOppose(attacker);
      city.setSiege();
      city.finishBattle();
    }
    
    const newConflict = city.addConflict();
    if (newConflict) {
      const nationName = attacker.getNationVar('name');
      const josaYi7 = JosaUtil.pick(nationName, '이');
      logger?.pushGlobalHistoryLog?.(`<M><b>【분쟁】</b></><D><b>${nationName}</b></>${josaYi7} <G><b>${city.getName()}</b></> 공략에 가담하여 분쟁이 발생하고 있습니다.`);
    }
  }
  
  await getNextDefender(defender, false);
  
  return conquerCity;
}

/**
 * ConquerCity - 도시 점령 처리
 */
async function ConquerCity(
  admin: any,
  general: any,
  city: any,
  defenderCityGeneralList: any[]
): Promise<void> {
  // TODO: 도시 점령 로직 구현
  // 현재는 기본 구현만 제공
  
  const sessionId = general.getSessionID?.() || 'sangokushi_default';
  const attackerNationID = general.getNationID();
  const cityID = city.city;
  
  try {
    const { cityRepository } = await import('../repositories/city.repository');
    
    // 도시 소유권 변경
    await cityRepository.updateByCityNum(sessionId, cityID, {
      nation: attackerNationID,
      conflict: {}
    });
    
    // 수비 장수들을 재야로
    for (const defGeneral of defenderCityGeneralList) {
      defGeneral.data.nation = 0;
      defGeneral.data.officer_level = 1;
      await defGeneral.save?.();
    }

    const resolvedGeneralId = general.getID?.() || general.no || general.data?.no || 0;
    try {
      await BattleEventHook.onCityOccupied(sessionId, cityID, attackerNationID, resolvedGeneralId);
    } catch (hookError) {
      console.error('[ProcessWar] BattleEventHook 처리 실패:', hookError);
    }
    
    // 로그 기록
    const logger = general.getLogger?.();
    if (logger) {
      const cityName = city.name;
      const josaUl = JosaUtil.pick(cityName, '을');
      logger.pushGeneralActionLog?.(`<G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`, 1);
      logger.pushGeneralHistoryLog?.(`<G><b>${cityName}</b></>${josaUl} <S>점령</>`);
      logger.pushGlobalActionLog?.(`<Y>${general.getName()}</>이(가) <G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`);
      logger.pushGlobalHistoryLog?.(`<S><b>【지배】</b></><D><b>${general.getStaticNation?.().name || '아군'}</b></>이(가) <G><b>${cityName}</b></>${josaUl} 지배했습니다.`);
    }
  } catch (error) {
    console.error('ConquerCity failed:', error);
    throw error;
  }
}

export { processWar_NG, ConquerCity };
