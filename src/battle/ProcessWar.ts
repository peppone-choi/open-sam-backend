/**
 * ProcessWar - 전투 처리 시스템
 * PHP process_war.php 직접 변환
 */

import { RandUtil } from '../utils/RandUtil';
import { LiteHashDRBG } from '../utils/LiteHashDRBG';
import { WarUnitGeneral } from './WarUnitGeneral';
import { WarUnitCity } from './WarUnitCity';
import { WarUnit } from './WarUnit';
import { DB } from '../config/db';
import { GameConst } from '../constants/GameConst';
import { Util } from '../utils/Util';
import { JosaUtil } from '../utils/JosaUtil';
import * as BattleEventHook from '../services/battle/BattleEventHook.service';
import { NationDestructionService } from '../services/nation/NationDestruction.service';
import { BattleSkillService, type BattleSkillContextState } from '../services/battle/BattleSkillService';
import { calculateBattleOrder, resolveDamageOutcome } from '../services/battle/BattleCalculationService';
import { ReplayBuilder, ReplayMetadata } from '../services/war/BattleReplay';

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
      if (nationDoc) {
        rawDefenderNation = nationDoc;
      } else {
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
      
      if (calculateBattleOrder(defenderCandidate, attacker) <= 0) {
        continue;
      }
      
      defenderCityGeneralList.push(defenderCandidate);
    }
  } catch (error) {
    console.error('Failed to load defender generals:', error);
  }
  
  // 수비 순서 정렬
  const defenderList: WarUnit[] = [...defenderCityGeneralList];
  
  if (defenderList.length > 0 && calculateBattleOrder(city, attacker) > 0) {
    defenderList.push(city);
  }
  
  defenderList.sort((lhs, rhs) => {
    return calculateBattleOrder(rhs, attacker) - calculateBattleOrder(lhs, attacker);
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
    if (calculateBattleOrder(nextDefender, attacker) <= 0) {
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
  
  // ReplayBuilder 초기화
  const replayBuilder = new ReplayBuilder({
    sessionId: attacker.getGeneral().getSessionID?.() || 'unknown',
    battleId: warSeed,
    date: new Date(),
    seed: warSeed,
    attacker: {
      id: attacker.getGeneral().getID?.() || 0,
      name: attacker.getName(),
      nationId: attacker.getNationVar('nation') || 0,
      nationName: attacker.getNationVar('name'),
      generalName: attacker.getName(),
      crew: attacker.getHP(),
      crewType: attacker.getCrewTypeName(),
    },
    defender: {
      cityId: city.getVar('city'),
      cityName: city.getName(),
      nationId: city.getVar('nation'),
      nationName: city.getNationVar('name'),
      defenders: [], // 진행하면서 추가
    }
  });

  let conquerCity = false;
  let battleSkillContext: BattleSkillContextState | null = null;
  
  const josaRo = JosaUtil.pick(city.getName(), '로');
  const josaYi = JosaUtil.pick(attacker.getName(), '이');
  
  logger?.pushGlobalActionLog?.(`<D><b>${attacker.getNationVar('name')}</b></>의 <Y>${attacker.getName()}</>${josaYi} <G><b>${city.getName()}</b></>${josaRo} 진격합니다.<span class='hidden_but_copyable'>(전투시드: ${warSeed})</span>`);
  logger?.pushGeneralActionLog?.(`<G><b>${city.getName()}</b></>${josaRo} <M>진격</>합니다.<span class='hidden_but_copyable'>(전투시드: ${warSeed})</span> <1>${date}</>`);
  
  let logWritten = false;
  const noRice = { value: false };
  
  // 전투 루프
  while (attacker.getPhase() < attacker.getMaxPhase()) {
    const turnResult = await processTurn({
      warSeed,
      attacker,
      defender,
      city,
      replayBuilder,
      logger,
      battleSkillContext,
      noRice,
      getNextDefender
    });

    // 상태 업데이트
    defender = turnResult.defender;
    battleSkillContext = turnResult.battleSkillContext;
    
    if (turnResult.conquerCity) {
      conquerCity = true;
    }

    if (turnResult.logWritten) {
      logWritten = true;
    }

    if (turnResult.shouldBreak) {
      break;
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
  
  // 리플레이 데이터 생성
  const replayData = replayBuilder.build();
  // TODO: replayData 저장 로직 추가

  return conquerCity;
}

interface BattleContext {
  warSeed: string;
  attacker: WarUnitGeneral;
  defender: WarUnit | null;
  city: WarUnitCity;
  replayBuilder: ReplayBuilder;
  logger: any;
  battleSkillContext: BattleSkillContextState | null;
  noRice: { value: boolean };
  getNextDefender: (prev: WarUnit | null, reqNext: boolean) => Promise<WarUnit | null>;
}

interface TurnResult {
  defender: WarUnit | null;
  battleSkillContext: BattleSkillContextState | null;
  shouldBreak: boolean;
  conquerCity: boolean;
  logWritten: boolean;
}

/**
 * processTurn - 턴(페이즈) 단위 처리 및 로깅
 */
async function processTurn(ctx: BattleContext): Promise<TurnResult> {
  const {
    warSeed,
    attacker,
    city,
    replayBuilder,
    logger,
    noRice,
    getNextDefender
  } = ctx;

  let {
    defender,
    battleSkillContext
  } = ctx;

  let shouldBreak = false;
  let conquerCity = false;
  let logWritten = false;

  replayBuilder.startTurn(attacker.getPhase());

  // 수비자가 없으면 도시 공성
  if (defender === null) {
    defender = city;
    defender.setSiege();
    battleSkillContext = null;
    
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
      shouldBreak = true;
      
      replayBuilder.addAction({
        type: 'win',
        actorId: attacker.getGeneral().getID?.() || 0,
        message: '병량 부족으로 승리'
      });

      return { defender, battleSkillContext, shouldBreak, conquerCity, logWritten };
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

    battleSkillContext = BattleSkillService.initializeBattle(attacker, defender);
  }
  
  // 페이즈 시작
  battleSkillContext = BattleSkillService.runPhaseTriggers(battleSkillContext);
  attacker.beginPhase();
  defender?.beginPhase();
  
  // 데미지 계산 (순수 계산 서비스 사용)
  const rawDefenderDamage = attacker.calcDamage();
  const rawAttackerDamage = defender?.calcDamage() || 0;

  const { attackerDamage, defenderDamage } = resolveDamageOutcome({
    attackerHP: attacker.getHP(),
    defenderHP: defender?.getHP() || 0,
    rawAttackerDamage,
    rawDefenderDamage
  });

  attacker.decreaseHP(attackerDamage);
  defender?.decreaseHP(defenderDamage);
  
  attacker.increaseKilled(defenderDamage);
  defender?.increaseKilled(attackerDamage);

  // Replay Log: Attack
  const attackerId = attacker.getGeneral().getID?.() || 0;
  const defenderId = defender instanceof WarUnitGeneral ? (defender.getGeneral().getID?.() || 0) : `city-${city.getVar('city')}`;
  
  if (attackerDamage > 0) {
    replayBuilder.logAttack(defenderId, attackerId, attackerDamage, defender?.getHP() || 0, attacker.getHP());
  }
  if (defenderDamage > 0) {
    replayBuilder.logAttack(attackerId, defenderId, defenderDamage, attacker.getHP(), defender?.getHP() || 0);
  }
  
  // 페이즈 로그
  const currPhase = attacker.getPhase() + 1;
  const phaseNickname = defender && defender.getPhase() < 0 ? '先' : `${currPhase} `;
  
  if (attackerDamage > 0 || defenderDamage > 0) {
    attacker.getLogger()?.pushGeneralBattleDetailLog?.(
      `${phaseNickname}: <Y1>【${attacker.getName()}】</> <C>${attacker.getHP()} (-${attackerDamage})</> VS <C>${defender?.getHP() || 0} (-${defenderDamage})</> <Y1>【${defender?.getName() || ''}】</>`
    );
    
    defender?.getLogger()?.pushGeneralBattleDetailLog?.(
      `${phaseNickname}: <Y1>【${defender.getName()}】</> <C>${defender.getHP()} (-${defenderDamage})</> VS <C>${attacker.getHP()} (-${attackerDamage})</> <Y1>【${attacker.getName()}】</>`
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
    
    replayBuilder.addAction({
      type: 'retreat',
      actorId: attackerId,
      message: noRice.value ? '군량 부족으로 퇴각' : '퇴각'
    });

    shouldBreak = true;
    return { defender, battleSkillContext, shouldBreak, conquerCity, logWritten };
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
        
        replayBuilder.addAction({
          type: 'win',
          actorId: attackerId,
          message: '도시 점령'
        });

        shouldBreak = true;
        return { defender, battleSkillContext, shouldBreak, conquerCity, logWritten };
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
      
      replayBuilder.addAction({
        type: 'lose',
        actorId: defenderId,
        message: '군량 부족 패퇴'
      });
    } else {
      logger?.pushGlobalActionLog?.(`<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}${josaYi6} 전멸했습니다.`);
      attacker.getLogger()?.pushGeneralActionLog?.(`<Y>${defender.getName()}</>의 ${defender.getCrewTypeName()}${josaYi6} 전멸했습니다.`, 1);
      defender.getLogger()?.pushGeneralActionLog?.("전멸했습니다.", 1);

      replayBuilder.addAction({
        type: 'lose',
        actorId: defenderId,
        message: '전멸'
      });
    }
    
    if (attacker.getPhase() >= attacker.getMaxPhase()) {
      shouldBreak = true;
      return { defender, battleSkillContext, shouldBreak, conquerCity, logWritten };
    }
    
    defender.finishBattle();
    defender = await getNextDefender(defender, true);
    battleSkillContext = null;
    
    if (defender !== null && !(defender instanceof WarUnitGeneral)) {
      throw new Error('다음 수비자를 받아오는데 실패');
    }
  }

  return { defender, battleSkillContext, shouldBreak, conquerCity, logWritten };
}

/**
 * ConquerCity - 도시 점령 처리
 * PHP process_war.php의 ConquerCity 함수 이식
 */
async function ConquerCity(
  admin: any,
  general: any,
  city: any,
  defenderCityGeneralList: any[]
): Promise<void> {
  const sessionId = general.getSessionID?.() || 'sangokushi_default';
  const { year, month, join_mode: joinMode } = admin;
  
  const attackerID = general.getID?.() || general.no || general.data?.no || 0;
  const attackerNationID = general.getNationID();
  const attackerGeneralName = general.getName?.() || general.name || '';
  const attackerNation = general.getStaticNation?.() || { name: '공격국', nation: attackerNationID };
  const attackerNationName = attackerNation.name || '공격국';
  const attackerLogger = general.getLogger?.();
  
  const cityID = city.city;
  const cityName = city.name || `도시${cityID}`;
  
  const defenderNationID = city.nation || 0;
  
  try {
    const { cityRepository } = await import('../repositories/city.repository');
    const { nationRepository } = await import('../repositories/nation.repository');
    const { generalRepository } = await import('../repositories/general.repository');
    
    // 수비국 정보 조회
    let defenderNation: any = null;
    let defenderNationName = '공백지';
    if (defenderNationID > 0) {
      defenderNation = await nationRepository.findByNationNum(sessionId, defenderNationID);
      defenderNationName = defenderNation?.name || '수비국';
    }
    
    const defenderNationDecoration = defenderNationID > 0
      ? `<D><b>${defenderNationName}</b></>의`
      : "공백지인";
    
    // 점령 로그 기록
    const josaUl = JosaUtil.pick(cityName, '을');
    const josaYiNation = JosaUtil.pick(attackerNationName, '이');
    const josaYiGen = JosaUtil.pick(attackerGeneralName, '이');
    const josaYiCity = JosaUtil.pick(cityName, '이');
    
    attackerLogger?.pushGeneralActionLog?.(`<G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`, 1);
    attackerLogger?.pushGeneralHistoryLog?.(`<G><b>${cityName}</b></>${josaUl} <S>점령</>`);
    attackerLogger?.pushGlobalActionLog?.(`<Y>${attackerGeneralName}</>${josaYiGen} <G><b>${cityName}</b></> 공략에 <S>성공</>했습니다.`);
    attackerLogger?.pushGlobalHistoryLog?.(`<S><b>【지배】</b></><D><b>${attackerNationName}</b></>${josaYiNation} <G><b>${cityName}</b></>${josaUl} 지배했습니다.`);
    attackerLogger?.pushNationalHistoryLog?.(`<Y>${attackerGeneralName}</>${josaYiGen} ${defenderNationDecoration} <G><b>${cityName}</b></> ${josaUl} <S>점령</>`);
    
    // 이벤트 훅 호출
    try {
      await BattleEventHook.onCityOccupied(sessionId, cityID, attackerNationID, attackerID);
    } catch (hookError) {
      console.error('[ProcessWar] BattleEventHook.onCityOccupied 처리 실패:', hookError);
    }
    
    // 수비 장수들 포로 처리
    const rng = new RandUtil(new LiteHashDRBG(`ConquerCity_${year}_${month}_${attackerNationID}_${attackerID}_${cityID}`));
    
    // PrisonerService import (동적)
    let PrisonerService: any = null;
    try {
      const module = await import('../services/general/Prisoner.service');
      PrisonerService = module.PrisonerService;
    } catch (e) {
      console.warn('[ConquerCity] PrisonerService 로드 실패, 직접 처리:', e);
    }
    
    for (const defGeneral of defenderCityGeneralList) {
      const defGeneralName = defGeneral.getName?.() || defGeneral.name || defGeneral.data?.name || '적장';
      const defGeneralID = defGeneral.getID?.() || defGeneral.no || defGeneral.data?.no || 0;
      const originalNationId = defGeneral.getNationID?.() || defGeneral.data?.nation || defenderNationID;
      
      // 군주는 포로가 되지 않음 (재야로 전환)
      const officerLevel = defGeneral.getVar?.('officer_level') ?? defGeneral.data?.officer_level ?? 1;
      if (officerLevel === 12) {
        // 군주는 재야로 전환
        if (typeof defGeneral.releasePrisoner === 'function') {
          defGeneral.releasePrisoner();
        } else {
          defGeneral.data = defGeneral.data || {};
          defGeneral.data.nation = 0;
          defGeneral.data.officer_level = 1;
          defGeneral.data.officer_city = 0;
          defGeneral.data.crew = 0;
          defGeneral.data.troop = 0;
        }
        attackerLogger?.pushGlobalActionLog?.(`<Y>${defGeneralName}</> 군주가 도주했습니다.`);
        await defGeneral.save?.();
        continue;
      }
      
      // 포로로 전환
      if (PrisonerService) {
        try {
          await PrisonerService.capturePrisoner(
            sessionId,
            defGeneral,
            attackerNationID,
            new Date()
          );
        } catch (captureError) {
          console.error('[ConquerCity] 포로 전환 실패:', captureError);
        }
      } else {
        // PrisonerService 없으면 직접 처리
        if (typeof defGeneral.setPrisoner === 'function') {
          defGeneral.setPrisoner(attackerNationID);
        } else {
          defGeneral.data = defGeneral.data || {};
          defGeneral.data.prisoner_of = attackerNationID;
          defGeneral.data.captured_at = new Date();
          defGeneral.data.original_nation = originalNationId;
          defGeneral.data.crew = 0;
          defGeneral.data.troop = 0;
        }
        await defGeneral.save?.();
      }
      
      // 포로 로그
      const josaYi = JosaUtil.pick(defGeneralName, '이');
      attackerLogger?.pushGlobalActionLog?.(`<Y>${defGeneralName}</>${josaYi} <R>포로</>가 되었습니다.`);
      
      // PHP: 등용장 발부 (50% 확률)
      if (joinMode !== 'onlyRandom' && rng.nextBool(0.5)) {
        try {
          const { messageRepository } = await import('../repositories/message.repository');
          await messageRepository.create({
            session_id: sessionId,
            type: 'scout',
            from_general: attackerID,
            to_general: defGeneralID,
            nation: attackerNationID,
            message: `${attackerGeneralName}이(가) 등용을 제안합니다. (포로)`,
            created_at: new Date()
          });
        } catch (msgError) {
          console.warn('[ConquerCity] 등용장 발부 실패:', msgError);
        }
      }
    }
    
    // 국가 멸망 체크 (마지막 도시인지 확인)
    if (defenderNationID > 0) {
      const remainingCities = await cityRepository.count({
        session_id: sessionId,
        nation: defenderNationID
      });
      
      // 현재 도시 포함해서 1개 남았다면 (이 도시가 마지막)
      if (remainingCities <= 1) {
        // 국가 멸망 처리 (NationDestructionService 사용)
        try {
          const destructionResult = await NationDestructionService.destroyNation(
            sessionId,
            defenderNationID,
            attackerNationID,
            attackerID
          );
          
          if (destructionResult.success) {
            console.log('[ProcessWar] 국가 멸망 처리 완료:', destructionResult);
            
            // 통일 체크
            const { isUnified, winnerNationId } = await NationDestructionService.checkUnification(sessionId);
            if (isUnified && winnerNationId) {
              await NationDestructionService.handleUnification(sessionId, winnerNationId);
            }
          } else {
            console.error('[ProcessWar] 국가 멸망 처리 실패:', destructionResult.error);
          }
        } catch (destructionError) {
          console.error('[ProcessWar] NationDestruction 처리 중 오류:', destructionError);
        }
      } else {
        // 멸망이 아닌 경우
        
        // 태수, 군사, 종사는 일반으로 해임
        await generalRepository.updateManyByFilter(
          {
            session_id: sessionId,
            'data.officer_city': cityID,
            'data.officer_level': { $in: [2, 3, 4] }  // 태수, 군사, 종사
          },
          {
            'data.officer_level': 1,
            'data.officer_city': 0
          }
        );
        
        // 수도였으면 긴급 천도
        if (defenderNation && defenderNation.capital === cityID) {
          await emergencyMoveCapital(
            sessionId,
            defenderNationID,
            defenderNationName,
            cityID,
            year,
            month,
            attackerLogger
          );
        }
      }
    }
    
    // 분쟁 국가 확인 (PHP getConquerNation)
    const conflict = city.conflict || {};
    const conquerNation = Object.keys(conflict).length > 0
      ? parseInt(Object.keys(conflict)[0], 10)
      : attackerNationID;
    
    // 공격자가 분쟁 1순위가 아니면 양도 처리
    if (conquerNation !== attackerNationID && conquerNation > 0) {
      const conquerNationData = await nationRepository.findByNationNum(sessionId, conquerNation);
      const conquerNationName = conquerNationData?.name || '양도국';
      
      const josaYi = JosaUtil.pick(conquerNationName, '이');
      attackerLogger?.pushGlobalHistoryLog?.(
        `<Y><b>【분쟁협상】</b></><D><b>${conquerNationName}</b></>${josaYi} 영토분쟁에서 우위를 점하여 <G><b>${cityName}</b></>${josaUl} 양도받았습니다.`
      );
    } else {
      // 공격자가 도시로 이동
      general.setVar?.('city', cityID);
      
      // 점령 장수를 태수로 자동 임명 (기존 태수가 아닌 경우)
      const currentOfficerLevel = general.getVar?.('officer_level') ?? 1;
      if (currentOfficerLevel < 4) {
        // 일반 장수인 경우 태수로 임명
        general.setVar?.('officer_level', 4); // 태수
        general.setVar?.('officer_city', cityID);
        
        const josaYi2 = JosaUtil.pick(attackerGeneralName, '이');
        attackerLogger?.pushGeneralActionLog?.(
          `<G><b>${cityName}</b></> <M>태수</>로 임명되었습니다.`
        );
        attackerLogger?.pushGlobalActionLog?.(
          `<Y>${attackerGeneralName}</>${josaYi2} <G><b>${cityName}</b></> 태수로 임명되었습니다.`
        );
      }
      
      await general.save?.();
    }
    
    // 도시 업데이트
    const cityUpdateData: any = {
      nation: conquerNation,
      supply: 1,
      term: 0,
      conflict: {},
      officer_set: 1 // 태수 설정됨
    };
    
    // 내정치 30% 감소
    if (city.agri) cityUpdateData.agri = Math.floor(city.agri * 0.7);
    if (city.comm) cityUpdateData.comm = Math.floor(city.comm * 0.7);
    if (city.secu) cityUpdateData.secu = Math.floor(city.secu * 0.7);
    
    // 성벽 감소 (대도시는 기본값, 소도시는 절반)
    if (city.level > 3) {
      cityUpdateData.def = 1000; // 대도시 기본 방어값
      cityUpdateData.wall = 1000; // 대도시 기본 성벽값
    } else {
      cityUpdateData.def = Math.floor((city.def_max || 1000) / 2);
      cityUpdateData.wall = Math.floor((city.wall_max || 1000) / 2);
    }
    
    await cityRepository.updateByCityNum(sessionId, cityID, cityUpdateData);
    
    // 통일 체크
    await checkUnification(sessionId, conquerNation, attackerLogger);
    
  } catch (error) {
    console.error('[ProcessWar] ConquerCity failed:', error);
    throw error;
  }
}

/**
 * 국가 멸망 처리
 * PHP process_war.php의 deleteNation 부분 이식
 */
async function deleteNation(
  sessionId: string,
  defenderNationID: number,
  defenderNation: any,
  attackerNationID: number,
  attackerNationName: string,
  attackerGeneralName: string,
  attackerID: number,
  admin: any,
  attackerLogger: any,
  rng: RandUtil
): Promise<void> {
  const { generalRepository } = await import('../repositories/general.repository');
  const { nationRepository } = await import('../repositories/nation.repository');
  
  const defenderNationName = defenderNation?.name || '멸망국';
  const { year, month, join_mode: joinMode } = admin;
  
  // 멸망 로그
  const josaUl = JosaUtil.pick(defenderNationName, '을');
  attackerLogger?.pushNationalHistoryLog?.(`<D><b>${defenderNationName}</b></>${josaUl} 정복`);
  attackerLogger?.pushGlobalHistoryLog?.(`<R><b>【멸망】</b></><D><b>${defenderNationName}</b></>${josaUl} <D><b>${attackerNationName}</b></>이(가) 멸망시켰습니다.`);
  
  // 멸망국 장수 목록 조회
  const oldNationGenerals = await generalRepository.findByFilter({
    session_id: sessionId,
    'data.nation': defenderNationID
  });
  
  let loseGeneralGold = 0;
  let loseGeneralRice = 0;
  
  for (const oldGeneral of oldNationGenerals) {
    const generalData = (oldGeneral.data || oldGeneral) as Record<string, any>;
    const generalGold = generalData.gold || 0;
    const generalRice = generalData.rice || 0;
    
    // 도주 시 금쌀 분실 (20~50%)
    const loseGold = Math.floor(generalGold * (0.2 + rng.next() * 0.3));
    const loseRice = Math.floor(generalRice * (0.2 + rng.next() * 0.3));
    
    // 재야로 전환
    if (typeof (oldGeneral as any).releasePrisoner === 'function') {
      (oldGeneral as any).releasePrisoner();
    } else {
      (oldGeneral as any).data = (oldGeneral as any).data || {};
      (oldGeneral as any).data.nation = 0;
      (oldGeneral as any).data.officer_level = 1;
      (oldGeneral as any).data.officer_city = 0;
      (oldGeneral as any).data.prisoner_of = 0;
    }
    
    // 금쌀 감소
    if ((oldGeneral as any).data) {
      (oldGeneral as any).data.gold = Math.max(0, generalGold - loseGold);
      (oldGeneral as any).data.rice = Math.max(0, generalRice - loseRice);
    }
    
    // 경험치/공헌도 감소
    const experience = generalData.experience || 0;
    const dedication = generalData.dedication || 0;
    if ((oldGeneral as any).data) {
      (oldGeneral as any).data.experience = Math.max(0, experience - Math.floor(experience * 0.1));
      (oldGeneral as any).data.dedication = Math.max(0, dedication - Math.floor(dedication * 0.5));
    }
    
    loseGeneralGold += loseGold;
    loseGeneralRice += loseRice;
    
    // 도주 로그
    const oldGeneralName = (oldGeneral as any).name || (oldGeneral as any).data?.name || '장수';
    const generalLogger = (oldGeneral as any).getLogger?.();
    generalLogger?.pushGeneralActionLog?.(
      `도주하며 금<C>${loseGold}</> 쌀<C>${loseRice}</>을 분실했습니다.`,
      1
    );
    
    await (oldGeneral as any).save?.();
    
    // NPC인 경우 일정 확률로 승전국에 임관
    const npcType = (oldGeneral as any).npc || (oldGeneral as any).data?.npc || 0;
    if (joinMode !== 'onlyRandom' && npcType >= 2 && npcType <= 8 && npcType !== 5) {
      if (rng.nextBool(0.3)) { // 30% 확률로 임관
        // 간소화: 즉시 임관 처리
        (oldGeneral as any).data = (oldGeneral as any).data || {};
        (oldGeneral as any).data.nation = attackerNationID;
        (oldGeneral as any).data.officer_level = 1;
        await (oldGeneral as any).save?.();
        
        const josaYi = JosaUtil.pick(oldGeneralName, '이');
        attackerLogger?.pushGlobalActionLog?.(`<Y>${oldGeneralName}</>${josaYi} <D><b>${attackerNationName}</b></>에 임관했습니다.`);
      }
    }
  }
  
  // 승전국 보상 계산
  const baseGold = GameConst.basegold || 1000;
  const baseRice = GameConst.baserice || 1000;
  
  const nationGold = defenderNation?.gold || 0;
  const nationRice = defenderNation?.rice || 0;
  
  const loseNationGold = Math.max(0, nationGold - baseGold);
  const loseNationRice = Math.max(0, nationRice - baseRice);
  
  // 기본량 제외 금쌀 50% + 장수들 분실 금쌀 50% 흡수
  const rewardGold = Math.floor((loseNationGold + loseGeneralGold) / 2);
  const rewardRice = Math.floor((loseNationRice + loseGeneralRice) / 2);
  
  // 승전국에 보상 지급
  const attackerNation = await nationRepository.findByNationNum(sessionId, attackerNationID);
  if (attackerNation) {
    await nationRepository.updateByNationNum(sessionId, attackerNationID, {
      gold: (attackerNation.gold || 0) + rewardGold,
      rice: (attackerNation.rice || 0) + rewardRice
    });
  }
  
  // 보상 로그 (수뇌부에게)
  const rewardGoldText = rewardGold.toLocaleString();
  const rewardRiceText = rewardRice.toLocaleString();
  attackerLogger?.pushGeneralActionLog?.(
    `<D><b>${defenderNationName}</b></> 정복으로 금<C>${rewardGoldText}</> 쌀<C>${rewardRiceText}</>을 획득했습니다.`,
    1
  );
  
  // 멸망국 레벨을 0으로 (실제 삭제 대신)
  await nationRepository.updateByNationNum(sessionId, defenderNationID, {
    level: 0
  });
  
  // 이벤트 훅 호출 (BattleEventHook.onNationDestroyed는 별도로 처리되므로 생략)
}

/**
 * 긴급 천도 처리
 * PHP process_war.php의 findNextCapital + 긴급천도 로직 이식
 */
async function emergencyMoveCapital(
  sessionId: string,
  nationID: number,
  nationName: string,
  capitalID: number,
  year: number,
  month: number,
  attackerLogger: any
): Promise<void> {
  const { cityRepository } = await import('../repositories/city.repository');
  const { nationRepository } = await import('../repositories/nation.repository');
  const { generalRepository } = await import('../repositories/general.repository');
  
  // 남은 도시 중 인구가 가장 많은 도시를 새 수도로
  const remainingCities = await cityRepository.findByFilter({
    session_id: sessionId,
    nation: nationID,
    city: { $ne: capitalID }
  });
  
  if (!remainingCities || remainingCities.length === 0) {
    console.warn(`[ProcessWar] 긴급천도 실패: ${nationName}의 남은 도시가 없음`);
    return;
  }
  
  // 인구 기준 정렬
  const sortedCities = [...remainingCities].sort((a, b) => (b.pop || 0) - (a.pop || 0));
  const newCapital = sortedCities[0];
  const newCapitalID = newCapital.city;
  const newCapitalName = newCapital.name || `도시${newCapitalID}`;
  
  // 천도 로그
  const josaRo = JosaUtil.pick(newCapitalName, '로');
  const josaYi = JosaUtil.pick(nationName, '이');
  attackerLogger?.pushGlobalHistoryLog?.(
    `<M><b>【긴급천도】</b></><D><b>${nationName}</b></>${josaYi} 수도가 함락되어 <G><b>${newCapitalName}</b></>${josaRo} 긴급천도하였습니다.`
  );
  
  // 국가 수도 변경 + 금쌀 50% 감소
  const nation = await nationRepository.findByNationNum(sessionId, nationID);
  if (nation) {
    await nationRepository.updateByNationNum(sessionId, nationID, {
      capital: newCapitalID,
      gold: Math.floor((nation.gold || 0) * 0.5),
      rice: Math.floor((nation.rice || 0) * 0.5)
    });
  }
  
  // 새 수도를 보급도시로
  await cityRepository.updateByCityNum(sessionId, newCapitalID, {
    supply: 1
  });
  
  // 수뇌부 (officer_level >= 5) 이동
  await generalRepository.updateManyByFilter(
    {
      session_id: sessionId,
      'data.nation': nationID,
      'data.officer_level': { $gte: 5 }
    },
    {
      'data.city': newCapitalID
    }
  );
  
  // 전체 장수 사기 감소
  const nationGenerals = await generalRepository.findByFilter({
    session_id: sessionId,
    'data.nation': nationID
  });
  
  for (const gen of nationGenerals) {
    const currentAtmos = gen.data?.atmos || 0;
    gen.data = gen.data || {};
    gen.data.atmos = Math.floor(currentAtmos * 0.8);
    await gen.save?.();
  }
}

/**
 * 통일 체크
 * 모든 활성 도시가 한 국가 소유인지 확인
 * BattleEventHook.checkUnified를 사용하여 처리
 */
async function checkUnification(
  sessionId: string,
  nationID: number,
  logger: any
): Promise<boolean> {
  // BattleEventHook.checkUnified가 통일 여부 확인 및 onUnified 호출을 담당
  try {
    await BattleEventHook.checkUnified?.(sessionId, nationID);
  } catch (hookError) {
    console.error('[ProcessWar] BattleEventHook.checkUnified 처리 실패:', hookError);
  }
  
  // 단순 체크만 반환
  const { cityRepository } = await import('../repositories/city.repository');
  
  const allCities = await cityRepository.findBySession(sessionId);
  if (!allCities || allCities.length === 0) {
    return false;
  }
  
  const nationCityCount = allCities.filter((c: any) => c.nation === nationID).length;
  return nationCityCount === allCities.length;
}

export { processWar_NG, ConquerCity };
