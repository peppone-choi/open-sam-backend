/**
 * ProcessWarService - 출병 후 전투 처리
 * PHP process_war.php 포팅
 * 
 * 전투 방식:
 * 1. 자동 전투 (processWar_NG): Phase 기반 자동 계산
 * 2. 전술 전투 (40x40): BattleInstance를 생성하여 턴제 전투
 */

import { RandUtil } from '../../utils/RandUtil';
import { StartBattleService } from '../battle/StartBattle.service';
import { StartSimulationService } from '../battle/StartSimulation.service';
import { AutoBattleService } from '../battle/AutoBattle.service';
import type { BattleConfig, BattleGeneralInput } from '../../battle/types';
import { GameEventEmitter } from '../gameEventEmitter';
import { LogFormatType } from '../../types/log.types';
import { unitStackRepository } from '../../repositories/unit-stack.repository';
import { cityDefenseRepository } from '../../repositories/city-defense.repository';
import { resolveFallbackDefender } from '../helpers/garrison.helper';
import * as BattleEventHook from '../battle/BattleEventHook.service';
import { processWar as runWarUnitBattle } from '../../battle';

export interface WarUnit {
  getName(): string;
  getNationVar(key: string): any;
  getPhase(): number;
  getMaxPhase(): number;
  getHP(): number;
  getCrew(): number;
  getOppose(): WarUnit | null;
  setOppose(unit: WarUnit): void;
  beginPhase(): void;
  calcDamage(): number;
  addTrain(amount: number): void;
  addWin(): void;
  addLose(): void;
  applyDB(db: any): void;
}

export interface ProcessWarParams {
  warSeed: string;
  attackerGeneral: any; // GeneralBase
  attackerNation: any;
  defenderCity: any;
}

// 기본값은 true로 두고, 명시적으로 false를 주면 비활성화하도록 한다.
const enableLegacyProcessWar = process.env.ENABLE_LEGACY_PROCESS_WAR !== 'false';

export class ProcessWarService {
  /**
   * 출병 후 전투 처리 메인 함수
   * 무조건 40x40 전술 전투로 진행
   */
  static async process(
    rng: RandUtil,
    attackerGeneral: any,
    attackerNation: any,
    defenderCity: any,
    options: { warSeed?: string } = {}
  ): Promise<void> {
    const sessionId = attackerGeneral.session_id;
    const attackerNationID = attackerGeneral.nation || attackerGeneral.getNationID?.();
    const defenderNationID = defenderCity.nation;
    const defenderCityID = defenderCity.city;

    const attackerGeneralId = attackerGeneral.no || attackerGeneral.getID?.();
    const initialAttackerCrew = attackerGeneralId
      ? await this.getGeneralTotalCrew(sessionId, attackerGeneralId)
      : 0;

    const warSeed = options.warSeed ?? rng.uuid();
 
    const logger = attackerGeneral.getLogger?.() || console;



    const defenseState = await cityDefenseRepository.ensure(sessionId, defenderCityID, defenderCity.name ?? `도시${defenderCityID}`);

    // === 1. 방어군 확인 ===
    const { generalRepository } = await import('../../repositories/general.repository');
    const defenderGenerals = await generalRepository.findByFilter({
      session_id: sessionId,
      nation: defenderNationID,
      city: defenderCityID,
      crew: { $gt: 0 }
    });

    await this.ensureGeneralTroopSnapshot(sessionId, attackerGeneral);
    const defenderStacksHydration = defenderGenerals.map((general: any) =>
      this.ensureGeneralTroopSnapshot(sessionId, general)
    );
    await Promise.all(defenderStacksHydration);

    const garrisonStacks = await unitStackRepository.findByOwner(sessionId, 'city', defenderCityID);
    const garrisonUnits = this.buildCityGarrisonUnits(defenderCity, garrisonStacks, defenderNationID);
    const fallbackDefender = resolveFallbackDefender(sessionId, defenderCity);

    // === 2. 공백지 체크 - 한나라 잔존 세력과 자동 전투 ===
    if (defenderGenerals.length === 0 && garrisonUnits.length === 0 && defenderNationID === 0) {
      if (!fallbackDefender) {
        logger.pushGeneralActionLog?.(
          `<G><b>${defenderCity.name}</b></>에는 저항군이 없어 무혈입성했습니다.`
        );
        await this.conquerCity(sessionId, defenderCityID, attackerNationID, attackerGeneralId);
        await this.restoreCityDefense(sessionId, defenderCityID);
        attackerGeneral.city = defenderCityID;
        const generalNo = attackerGeneral.no || attackerGeneral.getID?.();
        if (generalNo) {
          await unitStackRepository.updateOwnerCity(sessionId, 'general', generalNo, defenderCityID);
          await attackerGeneral.applyDB?.();
        }
        return;
      }
      const cityLevel = (defenderCity as any).level || 5;
      const cityId = (defenderCity as any).city || 0;
      
      // 로그용 방어 세력 표시
      let defenderType = fallbackDefender.label;
      if (cityLevel >= 10 && (cityId === 3 || cityId === 4)) {
        defenderType = cityId === 3 ? '<R>한 사예교위 휘하 하남윤</>' : '<R>한 사예교위 휘하 경조윤</>';
      }
      
      const militiaUnit = {
        no: -999,
        name: fallbackDefender.unit.name,
        nation: 0,
        crew: fallbackDefender.unit.crew,
        crewtype: fallbackDefender.unit.crewtype,
        train: fallbackDefender.unit.train,
        atmos: fallbackDefender.unit.morale,
        leadership: fallbackDefender.unit.leadership,
        strength: fallbackDefender.unit.strength,
        intel: fallbackDefender.unit.intel,
      };

      logger.pushGlobalActionLog?.(
        `<D><b>${attackerNation.name}</b></>의 <Y>${attackerGeneral.name}</>이(가) 공백지 <G><b>${defenderCity.name}</b></>에 진격합니다. [${defenderType} ${militiaUnit.crew}명 저항]`
      );

      // 자동 전투 실행
      const battleResult = await this.executeAutoBattle(
        sessionId,
        attackerGeneral,
        militiaUnit,
        defenderCity,
        rng,
        defenseState
      );

      this.pushAutoBattleLogs(logger, {
        cityName: defenderCity.name,
        defenderLabel: defenderType,
        result: battleResult.winner,
        attackerLoss: battleResult.attackerLoss,
        defenderLoss: battleResult.defenderLoss,
        battleLabel: '공백지 전투'
      });

      if (battleResult.winner === 'attacker') {
        logger.pushGeneralActionLog?.(
          `${defenderType}을(를) 격파하고 <G><b>${defenderCity.name}</b></>을(를) 점령했습니다! [피해: ${battleResult.attackerLoss}명]`
        );

        // 도시 점령
        await this.conquerCity(sessionId, defenderCityID, attackerNationID, attackerGeneralId);
        await this.restoreCityDefense(sessionId, defenderCityID);
        
        // 공격자 이동 및 병력 손실 반영 (UnitStack)
        attackerGeneral.city = defenderCityID;
        const generalNo = attackerGeneral.no || attackerGeneral.getID?.();
        if (generalNo) {
          await unitStackRepository.updateOwnerCity(sessionId, 'general', generalNo, defenderCityID);
          await this.applyBattleLossToGeneral(sessionId, generalNo, battleResult.attackerLoss);
          const newCrew = await this.getGeneralTotalCrew(sessionId, generalNo);
          attackerGeneral.crew = newCrew;
        } else {
          await this.applyBattleLossToGeneral(sessionId, generalNo as any, battleResult.attackerLoss);
        }
        await attackerGeneral.applyDB?.();
      } else {
        logger.pushGeneralActionLog?.(
          `${defenderType}에게 패배했습니다! [손실: ${battleResult.attackerLoss}명]`
        );
        
        // 병력 손실만 반영 (UnitStack)
        const generalNo = attackerGeneral.no || attackerGeneral.getID?.();
        await this.applyBattleLossToGeneral(sessionId, generalNo, battleResult.attackerLoss);
        
        // 레거시 crew 값도 업데이트
        const newCrew = await this.getGeneralTotalCrew(sessionId, generalNo);
        attackerGeneral.crew = newCrew;
        await attackerGeneral.applyDB?.();
      }

      await this.applySiegeDamage(sessionId, defenderCity, battleResult.attackerLoss, battleResult.defenderLoss, battleResult.winner === 'attacker');
      
      return;
    }

    // === 3. 자동 전투 조건 체크 ===
    const shouldUseAutoBattle = this.checkAutoBattleCondition(
      attackerGeneral,
      defenderGenerals,
      attackerNation,
      defenderNationID
    );
    const forceAutoBattle = process.env.FORCE_AUTO_BATTLE === 'true';

    if (!forceAutoBattle && enableLegacyProcessWar && !shouldUseAutoBattle) {
      await this.executeLegacyProcessWar({
        sessionId,
        warSeed,
        attackerGeneral,
        attackerNation,
        defenderCity,
        defenderCityID,
        logger,
        initialAttackerCrew
      });
      return;
    }

    if (forceAutoBattle && !shouldUseAutoBattle) {
      logger.pushGeneralActionLog?.(
        `<G><b>${defenderCity.name}</b></> 공략은 임시로 자동 전투로만 처리됩니다.`
      );
    }

    if (forceAutoBattle || shouldUseAutoBattle) {
      const defendersForBattle = (defenderGenerals.length || garrisonUnits.length)
        ? [...defenderGenerals, ...garrisonUnits]
        : defenderGenerals;

      if (defendersForBattle.length === 0) {
        logger.pushGeneralActionLog?.(`<G><b>${defenderCity.name}</b></>에는 저항군이 없어 무혈입성했습니다.`);
        await this.conquerCity(sessionId, defenderCityID, attackerNationID, attackerGeneralId);
        await this.restoreCityDefense(sessionId, defenderCityID);
        attackerGeneral.city = defenderCityID;
        await attackerGeneral.applyDB?.();
        return;
      }

      // 자동 전투 실행
      const battleResult = await this.executeMultiUnitAutoBattle(
        sessionId,
        attackerGeneral,
        defendersForBattle,
        defenderCity,
        rng,
        defenseState
      );

      const defenderSummary = this.summarizeDefenders(defendersForBattle);
      this.pushAutoBattleLogs(logger, {
        cityName: defenderCity.name,
        defenderLabel: defenderSummary,
        result: battleResult.winner,
        attackerLoss: battleResult.attackerLoss,
        defenderLoss: battleResult.defenderLoss,
        battleLabel: '자동 전투'
      });

      const totalDefenderCrewBefore = defendersForBattle.reduce((sum, unit) => sum + this.getUnitCrewValue(unit), 0);
      const garrisonCrewBefore = garrisonUnits.reduce((sum, unit) => sum + (unit.crew ?? 0), 0);
      if (garrisonCrewBefore > 0 && totalDefenderCrewBefore > 0) {
        const garrisonLoss = Math.round(battleResult.defenderLoss * (garrisonCrewBefore / totalDefenderCrewBefore));
        await this.applyBattleLossToCityGarrison(sessionId, defenderCityID, garrisonLoss);
      }

      await this.applySiegeDamage(
        sessionId,
        defenderCity,
        battleResult.attackerLoss,
        battleResult.defenderLoss,
        battleResult.winner === 'attacker'
      );

      if (battleResult.winner === 'attacker') {
        logger.pushGlobalActionLog?.(
          `<D><b>${attackerNation.name}</b></>의 <Y>${attackerGeneral.name}</>이(가) <G><b>${defenderCity.name}</b></>을(를) 점령했습니다! [자동 전투]`
        );
        logger.pushGeneralActionLog?.(
          `<G><b>${defenderCity.name}</b></>을(를) 점령했습니다! [자동 전투] [손실: ${battleResult.attackerLoss}명]`
        );

        // 도시 점령
        await this.conquerCity(sessionId, defenderCityID, attackerNationID, attackerGeneralId);
        await this.restoreCityDefense(sessionId, defenderCityID);
        
        // 공격자 이동 및 병력 손실 반영 (UnitStack)
        attackerGeneral.city = defenderCityID;
        const generalNo = attackerGeneral.no || attackerGeneral.getID?.();
        if (generalNo) {
          await unitStackRepository.updateOwnerCity(sessionId, 'general', generalNo, defenderCityID);
          await this.applyBattleLossToGeneral(sessionId, generalNo, battleResult.attackerLoss);
          const newCrew = await this.getGeneralTotalCrew(sessionId, generalNo);
          attackerGeneral.crew = newCrew;
        } else {
          await this.applyBattleLossToGeneral(sessionId, generalNo as any, battleResult.attackerLoss);
        }
        await attackerGeneral.applyDB?.();
      } else {
        logger.pushGeneralActionLog?.(
          `<G><b>${defenderCity.name}</b></> 공격 실패 [자동 전투] [손실: ${battleResult.attackerLoss}명]`
        );
        
        // 병력 손실만 반영 (UnitStack)
        const generalNo = attackerGeneral.no || attackerGeneral.getID?.();
        await this.applyBattleLossToGeneral(sessionId, generalNo, battleResult.attackerLoss);
        
        // 레거시 crew 값도 업데이트
        const newCrew = await this.getGeneralTotalCrew(sessionId, generalNo);
        attackerGeneral.crew = newCrew;
        await attackerGeneral.applyDB?.();
      }

      return;
    }


    // === 4. 진입 방향 계산 ===
    const entryDirection = await this.calculateEntryDirection(
      attackerGeneral,
      defenderCity
    );

    // === 5. 실시간 전술 전투 생성 (연속좌표 기반 IBattle) ===
    const startResult = await StartBattleService.execute({
      session_id: sessionId,
      attackerNationId: attackerNationID,
      defenderNationId: defenderNationID,
      targetCityId: defenderCityID,
      attackerGeneralIds: [attackerGeneral.no],
    });

    if (!startResult || !startResult.success) {
      logger.pushGeneralActionLog?.(
        `<G><b>${defenderCity.name}</b></>에 대한 전술 전투 생성에 실패했습니다. 자동 전투로 대체됩니다.`
      );
      return;
    }

    const battleId = startResult.battleId;

    logger.pushGlobalActionLog?.(
      `<D><b>${attackerNation.name}</b></>의 <Y>${attackerGeneral.name}</>이(가) <G><b>${defenderCity.name}</b></>에 진격합니다. [전술 전투] (ID: ${battleId})`
    );
    logger.pushGeneralActionLog?.(
      `<G><b>${defenderCity.name}</b></>로 진격합니다. [전술 전투 시작] (ID: ${battleId})`
    );

    // NPC/플레이어 모두 일단 자동 배치 + 시뮬레이터 시작
    try {
      await StartSimulationService.execute({ battleId });
    } catch (error: any) {
      console.error('[ProcessWar] 전술 전투 시뮬레이션 시작 실패:', error?.message || error);
    }

    // 세션 전체에 전투 시작 알림 (도시 전술 UI용)
    try {
      const participants = [
        attackerGeneral.no,
        ...defenderGenerals.map((g: any) => g.no),
      ];
      GameEventEmitter.broadcastBattleStart(sessionId, battleId, participants);
    } catch (error: any) {
      console.error('[ProcessWar] 전투 시작 브로드캐스트 실패:', error?.message || error);
    }
  }

  /**
   * 자동 전투 조건 체크
   * 
   * 조건:
   * 1. NPC vs NPC 전투
   * 2. 방어군 총 병력 < 공격군의 40%
   * 3. 방어군 최강 장수 무력 < 70
   */
  private static checkAutoBattleCondition(
    attackerGeneral: any,
    defenderGenerals: any[],
    attackerNation: any,
    defenderNationID: number
  ): boolean {
    // 유저가 한 명이라도 참여하면 무조건 전술 전투
    const attackerNpc = attackerGeneral.npc ?? attackerGeneral.data?.npc ?? 0;
    const attackerOwner = attackerGeneral.owner ?? attackerGeneral.data?.owner;
    const attackerIsUser = attackerNpc === 0 || (attackerNpc === 1 && attackerOwner && attackerOwner !== '0' && attackerOwner !== 'NPC');

    const defenderHasUser = defenderGenerals.some((g) => {
      const npc = g.npc ?? g.data?.npc ?? 0;
      const owner = g.owner ?? g.data?.owner;
      const isUser = npc === 0 || (npc === 1 && owner && owner !== '0' && owner !== 'NPC');
      return isUser;
    });

    if (attackerIsUser || defenderHasUser) {
      return false;
    }

    // 방어군 병력 계산
    const attackerTroops = attackerGeneral.crew || 0;
    const defenderTotalTroops = defenderGenerals.reduce((sum, g) => sum + (g.crew || 0), 0);

    // 조건 1: 방어군이 공격군의 40% 미만
    if (defenderTotalTroops < attackerTroops * 0.4) {
      return true;
    }

    // 조건 2: 방어군 최강 장수가 약함 (무력 < 70)
    const maxDefenderStrength = Math.max(...defenderGenerals.map(g => g.strength || 50));
    if (maxDefenderStrength < 70 && defenderTotalTroops < attackerTroops * 0.6) {
      return true;
    }

    return false;
  }

  /**
   * 자동 전투 실행 (단일 유닛 - 호족 사병)
   */
  private static async executeAutoBattle(
    sessionId: string,
    attacker: any,
    defender: any,
    city: any,
    rng: RandUtil,
    defenseState?: any
  ): Promise<{ winner: 'attacker' | 'defender'; attackerLoss: number; defenderLoss: number }> {
    return this.executeBattleSimulation(sessionId, [attacker], [defender], city, rng, defenseState);
  }

  /**
   * 자동 전투 실행 (다중 유닛)
   */
  private static async executeMultiUnitAutoBattle(
    sessionId: string,
    attacker: any,
    defenders: any[],
    city: any,
    rng: RandUtil,
    defenseState?: any
  ): Promise<{ winner: 'attacker' | 'defender'; attackerLoss: number; defenderLoss: number }> {
    return this.executeBattleSimulation(sessionId, [attacker], defenders, city, rng, defenseState);
  }

  private static async executeBattleSimulation(
    sessionId: string,
    attackers: any[],
    defenders: any[],
    city: any,
    rng: RandUtil,
    defenseState?: any
  ): Promise<{ winner: 'attacker' | 'defender'; attackerLoss: number; defenderLoss: number }> {
    const attackerSide = {
      side: 'attackers' as const,
      nation: {
        nationId: attackers[0]?.nation ?? attackers[0]?.nationId ?? 0,
        name: attackers[0]?.nationName ?? '공격국',
        type: attackers[0]?.nationType,
        level: attackers[0]?.nationLevel,
        tech: attackers[0]?.tech ?? 0,
        capitalCityId: attackers[0]?.capital
      },
      generals: attackers.map((unit, idx) =>
        this.buildGeneralInput(unit, { defaultId: 100000 + idx, fallbackNationId: attackers[0]?.nation ?? 0 })
      )
    };

    const defenderSide = {
      side: 'defenders' as const,
      nation: {
        nationId: defenders[0]?.nation ?? defenders[0]?.nationId ?? city?.nation ?? 0,
        name: defenders[0]?.nationName ?? city?.name ?? '방어군',
        type: defenders[0]?.nationType,
        level: defenders[0]?.nationLevel,
        tech: defenders[0]?.tech ?? 0,
        capitalCityId: defenders[0]?.capital
      },
      generals: defenders.map((unit, idx) =>
        this.buildGeneralInput(unit, { defaultId: 200000 + idx, fallbackNationId: defenders[0]?.nation ?? city?.nation ?? 0 })
      )
    };

    const battleConfig: BattleConfig = {
      attackers: attackerSide,
      defenders: defenderSide,
      city: city
        ? {
            cityId: city.city ?? 0,
            name: city.name ?? '도시',
            level: city.level ?? 0,
            defence: defenseState?.wall_hp ?? city.def ?? 0,
            wall: defenseState?.wall_hp ?? city.wall ?? 0,
            nationId: city.nation ?? 0,
            gate: defenseState?.gate_hp,
            wallMax: defenseState?.wall_max,
            gateMax: defenseState?.gate_max,
            towerLevel: defenseState?.tower_level,
          }
        : undefined,
      scenarioId: sessionId || 'sangokushi_default',
      seed: `${sessionId}-${Date.now()}-${rng.next()}`
    };

    const result = AutoBattleService.simulate(battleConfig);
    const summary = result.summary;

    const winner: 'attacker' | 'defender' = summary.winner === 'attackers' ? 'attacker' : 'defender';

    return {
      winner,
      attackerLoss: Math.round(summary.attackerCasualties),
      defenderLoss: Math.round(summary.defenderCasualties)
    };
  }

  private static pushAutoBattleLogs(
    logger: any,
    options: {
      cityName: string;
      defenderLabel: string;
      result: 'attacker' | 'defender';
      attackerLoss: number;
      defenderLoss: number;
      battleLabel: string;
    }
  ): void {
    if (
      !logger ||
      typeof logger.pushGeneralBattleResultLog !== 'function' ||
      typeof logger.pushGeneralBattleDetailLog !== 'function'
    ) {
      return;
    }

    const { cityName, defenderLabel, result, attackerLoss, defenderLoss, battleLabel } = options;
    const outcome = result === 'attacker' ? '승리' : '패배';

    logger.pushGeneralBattleResultLog(
      `[${battleLabel}] <G><b>${cityName}</b></> ${outcome}`,
      LogFormatType.PLAIN
    );

    const detailLines = [
      `[${battleLabel}] 상대: ${defenderLabel}`,
      `[${battleLabel}] 결과: ${outcome}`,
      `[${battleLabel}] 아군 손실 ${this.formatNumber(attackerLoss)}명 / 적군 손실 ${this.formatNumber(defenderLoss)}명`
    ];

    for (const line of detailLines) {
      logger.pushGeneralBattleDetailLog(line, LogFormatType.PLAIN);
    }
  }

  private static summarizeDefenders(defenderGenerals: any[]): string {
    if (!defenderGenerals || defenderGenerals.length === 0) {
      return '방어군';
    }

    const names = defenderGenerals
      .map((general) => general?.name)
      .filter((name) => typeof name === 'string' && name.length > 0) as string[];

    if (names.length === 0) {
      return `방어군 ${defenderGenerals.length}명`;
    }

    if (names.length <= 3) {
      return names.join(', ');
    }

    return `${names.slice(0, 3).join(', ')} 외 ${names.length - 3}명`;
  }

  private static formatNumber(value: number): string {
    return new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.round(value || 0)));
  }

  private static buildGeneralInput(
    unit: any,
    options: { defaultId?: number; fallbackNationId?: number } = {}
  ): BattleGeneralInput {
    const crew = Math.max(0, unit.crew ?? unit.troops ?? 0);
    return {
      generalId: unit.no ?? unit.generalId ?? options.defaultId ?? 0,
      name: unit.name ?? 'Unknown',
      nationId: unit.nation ?? unit.nationId ?? options.fallbackNationId ?? 0,
      crewTypeId: unit.crewtype ?? unit.crewTypeId ?? 110,
      crew,
      train: unit.train ?? unit.training ?? 70,
      atmos: unit.atmos ?? unit.morale ?? 70,
      leadership: unit.leadership ?? 60,
      strength: unit.strength ?? 60,
      intel: unit.intel ?? unit.intelligence ?? 50,
      dex1: unit.dex1 ?? 0,
      dex2: unit.dex2 ?? 0,
      dex3: unit.dex3 ?? 0,
      dex4: unit.dex4 ?? 0,
      dex5: unit.dex5 ?? 0,
      rice: unit.rice ?? Math.max(100, Math.floor(crew / 2)),
      injury: unit.injury ?? 0
    };
  }

  /**
   * 진입 방향 계산
   * 공격자의 현재 도시와 목표 도시의 상대적 위치로 결정
   */
  private static async calculateEntryDirection(
    attackerGeneral: any,
    targetCity: any
  ): Promise<any> {
    // 공격자 현재 도시
    const currentCityID = attackerGeneral.city;
    const targetCityID = targetCity.city;

    if (currentCityID === targetCityID) {
      // 같은 도시면 북쪽에서 진입
      return 'north';
    }

    try {
      const { cityRepository } = await import('../../repositories/city.repository');
      const currentCity = await cityRepository.findByCityNum(
        attackerGeneral.session_id,
        currentCityID
      );

      if (!currentCity || !targetCity.coord) {
        return 'north'; // 기본값
      }

      // 좌표 기반 방향 계산
      const dx = ((targetCity as any).coord?.x || 0) - ((currentCity as any).coord?.x || 0);
      const dy = ((targetCity as any).coord?.y || 0) - ((currentCity as any).coord?.y || 0);

      // 8방향 중 선택
      if (Math.abs(dx) > Math.abs(dy)) {
        // 좌우가 더 큼
        return dx > 0 ? 'east' : 'west';
      } else {
        // 상하가 더 큼
        return dy > 0 ? 'south' : 'north';
      }
    } catch (error) {
      console.error('[ProcessWar] 진입 방향 계산 실패:', error);
      return 'north';
    }
  }

  /**
   * 도시 점령 처리 (전술 전투 승리 시 호출)
   */
  private static async executeLegacyProcessWar(params: {
    sessionId: string;
    warSeed: string;
    attackerGeneral: any;
    attackerNation: any;
    defenderCity: any;
    defenderCityID: number;
    logger: any;
    initialAttackerCrew: number;
  }): Promise<void> {
    const {
      sessionId,
      warSeed,
      attackerGeneral,
      attackerNation,
      defenderCity,
      defenderCityID,
      logger,
      initialAttackerCrew,
    } = params;

    const attackerNationPlain = this.toPlainDoc(attackerNation);
    const defenderCityPlain = this.toPlainDoc(defenderCity);
    logger.pushGeneralActionLog?.(
      `<G><b>${defenderCity.name}</b></> 공략을 고전 전투 규칙으로 진행합니다. <span class='hidden_but_copyable'>(전투시드: ${warSeed})</span>`
    );

    try {
      const conquerCity = await runWarUnitBattle(
        warSeed,
        attackerGeneral,
        attackerNationPlain,
        defenderCityPlain
      );

      const attackerGeneralId = attackerGeneral.no || attackerGeneral.getID?.();
      if (attackerGeneralId) {
        const { generalRepository } = await import('../../repositories/general.repository');
        const updatedGeneral = await generalRepository.findBySessionAndNo(sessionId, attackerGeneralId);
        const updatedCrew = updatedGeneral?.data?.crew ?? updatedGeneral?.crew ?? attackerGeneral.data?.crew ?? attackerGeneral.crew ?? 0;
        const attackerLoss = Math.max(0, initialAttackerCrew - updatedCrew);
        if (attackerLoss > 0) {
          await this.applyBattleLossToGeneral(sessionId, attackerGeneralId, attackerLoss);
        } else {
          await this.ensureGeneralTroopSnapshot(sessionId, updatedGeneral || attackerGeneral);
        }
        const normalizedCrew = await this.getGeneralTotalCrew(sessionId, attackerGeneralId);
        attackerGeneral.crew = normalizedCrew;
        attackerGeneral.data = attackerGeneral.data || {};
        attackerGeneral.data.crew = normalizedCrew;
      }

      if (conquerCity) {
        await this.restoreCityDefense(sessionId, defenderCityID);
        if (attackerGeneralId) {
          await unitStackRepository.updateOwnerCity(sessionId, 'general', attackerGeneralId, defenderCityID);
        }
        attackerGeneral.city = defenderCityID;
        attackerGeneral.data = attackerGeneral.data || {};
        attackerGeneral.data.city = defenderCityID;
        logger.pushGeneralActionLog?.(`<G><b>${defenderCity.name}</b></>을(를) 점령했습니다! [Legacy 전투]`);
      } else {
        logger.pushGeneralActionLog?.(`<G><b>${defenderCity.name}</b></> 공략에 실패했습니다. [Legacy 전투]`);
      }
    } catch (error: any) {
      logger.pushGeneralActionLog?.(`<R>Legacy 전투 처리 중 오류 발생:</> ${error.message}`);
      throw error;
    }
  }

  private static toPlainDoc(doc: any): any {
    if (!doc) {
      return {};
    }
    if (typeof doc.toObject === 'function') {
      return doc.toObject({ depopulate: true, flattenMaps: true });
    }
    if (doc.data) {
      return doc.data;
    }
    return doc;
  }

  private static async restoreCityDefense(sessionId: string, cityId: number): Promise<void> {
    const defenseState = await cityDefenseRepository.findByCity(sessionId, cityId);
    if (!defenseState) {
      return;
    }
    await cityDefenseRepository.update(sessionId, cityId, {
      wall_hp: defenseState.wall_max,
      gate_hp: defenseState.gate_max,
      last_repair_at: new Date(),
    });
  }

  static async conquerCity(
    sessionId: string,
    cityId: number,
    attackerNationId: number,
    attackerGeneralId?: number
  ): Promise<void> {
    try {
      const { cityRepository } = await import('../../repositories/city.repository');
      const { generalRepository } = await import('../../repositories/general.repository');
      
      // 도시 정보 가져오기
      const city = await cityRepository.findByCityNum(sessionId, cityId);
      if (!city) {
        throw new Error(`도시를 찾을 수 없습니다: ${cityId}`);
      }

      const oldNationId = (city as any).nation;

      // 도시 국가 변경
      await cityRepository.updateByCityNum(sessionId, cityId, {
        nation: attackerNationId,
        state: 0, // 일반 상태로 복구
        term: 0,
      });

      // 방어군 장수들을 재야로 (포로)
      const defenderGenerals = await generalRepository.findByFilter({
        session_id: sessionId,
        nation: oldNationId,
        city: cityId
      });

      for (const general of defenderGenerals) {
      await generalRepository.updateById(general._id.toString(), {
        nation: 0, // 재야
        city: cityId, // 도시는 유지
        crew: Math.floor(((general as any).crew || 0) * 0.3), // 병사 70% 손실
      });
    }

    console.log(`[ProcessWar] 도시 점령: ${(city as any).name} (${oldNationId} -> ${attackerNationId})`);

    const resolvedGeneralId = attackerGeneralId ?? 0;
    try {
      await BattleEventHook.onCityOccupied(sessionId, cityId, attackerNationId, resolvedGeneralId);
    } catch (hookError) {
      console.error('[ProcessWar] BattleEventHook 처리 실패:', hookError);
    }

    // 수도 함락 체크

      const { nationRepository } = await import('../../repositories/nation.repository');
      const defenderNation = await nationRepository.findByNationNum(sessionId, oldNationId);
      
      if (defenderNation && defenderNation.capital === cityId) {
        console.log(`[ProcessWar] 수도 함락! 국가 ${oldNationId} 멸망 처리 필요`);
        // 국가 멸망 처리 (별도 마이그레이션 (v2.0))
      }
    } catch (error) {
      console.error('[ProcessWar] 도시 점령 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 장수의 총 병력 수 계산 (UnitStack 기반)
   */
  private static async getGeneralTotalCrew(sessionId: string, generalNo: number): Promise<number> {
    const stacks = await unitStackRepository.findByOwner(sessionId, 'general', generalNo);
    return stacks.reduce((sum, stack) => {
      const hp = (stack as any).hp;
      if (typeof hp === 'number') {
        return sum + hp;
      }
      return sum + (stack.unit_size * stack.stack_count);
    }, 0);
  }

  private static async ensureGeneralTroopSnapshot(sessionId: string, general: any): Promise<void> {
    if (!general) {
      return;
    }
    const generalNo = general.no ?? general.getID?.();
    if (!generalNo) {
      return;
    }
    const stacks = await unitStackRepository.findByOwner(sessionId, 'general', generalNo);
    if (!stacks.length) {
      return;
    }
    const totalTroops = stacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);
    if (totalTroops <= 0) {
      return;
    }

    const primary = stacks[0];
    general.crew = totalTroops;
    general.data = general.data || {};
    general.data.crew = totalTroops;

    if (primary) {
      const crewTypeId = primary.crew_type_id ?? general.crewtype;
      const train = primary.train ?? general.train;
      const atmos = primary.morale ?? general.atmos;

      general.crewtype = crewTypeId;
      general.train = train;
      general.atmos = atmos;

      general.data.crewtype = crewTypeId;
      general.data.train = train;
      general.data.atmos = atmos;
    }
  }

  /**
   * 장수의 병력에 손실 적용 (UnitStack에 비례 분배)
   */
  private static async applyBattleLossToGeneral(
    sessionId: string,
    generalNo: number,
    totalLoss: number
  ): Promise<void> {
    const stacks = await unitStackRepository.findByOwner(sessionId, 'general', generalNo);
    if (!stacks.length) return;

    const totalCrew = stacks.reduce((sum, stack) => {
      const hp = (stack as any).hp;
      if (typeof hp === 'number') {
        return sum + hp;
      }
      return sum + (stack.unit_size * stack.stack_count);
    }, 0);

    if (totalCrew === 0) return;

    const lossRatio = Math.min(1, totalLoss / totalCrew);

    for (const stack of stacks) {
      const stackDoc = await unitStackRepository.findById(stack._id?.toString?.() || (stack as any)._id);
      if (!stackDoc) continue;

      const currentHp = stackDoc.hp;
      const stackLoss = Math.floor(currentHp * lossRatio);
      stackDoc.hp = Math.max(0, currentHp - stackLoss);

      // HP가 0이 되면 스택 삭제
      if (stackDoc.hp === 0) {
        await unitStackRepository.deleteById(stackDoc._id?.toString?.() || (stackDoc as any)._id);
      } else {
        await stackDoc.save();
      }
    }
  }

  /**
   * 도시 방어 병력 계산 (주둔 병력 + 성벽)
   */
  private static async getCityDefenseCrew(sessionId: string, cityId: number): Promise<number> {
    const stacks = await unitStackRepository.findByOwner(sessionId, 'city', cityId);
    return stacks.reduce((sum, stack) => {
      const hp = (stack as any).hp;
      if (typeof hp === 'number') {
        return sum + hp;
      }
      return sum + (stack.unit_size * stack.stack_count);
    }, 0);
  }

  private static getUnitCrewValue(unit: any): number {
    if (!unit) {
      return 0;
    }
    if (typeof unit.crew === 'number') {
      return unit.crew;
    }
    if (typeof unit.data?.crew === 'number') {
      return unit.data.crew;
    }
    return 0;
  }

  private static getStackTroopCount(stack: any): number {
    if (!stack) {
      return 0;
    }
    if (typeof stack.hp === 'number') {
      return stack.hp;
    }
    const unitSize = stack.unit_size ?? 100;
    const stackCount = stack.stack_count ?? 0;
    return unitSize * stackCount;
  }

  private static buildCityGarrisonUnits(city: any, stacks: any[], defenderNationID: number) {
    if (!stacks?.length) {
      return [] as any[];
    }
    return stacks
      .map((stack) => {
        const stackId = this.normalizeStackId(stack._id);
        return {
          no: `city-${stackId || 'unknown'}`,
          name: `${city?.name || '도시'} 수비대`,
          nation: defenderNationID,
          crew: this.getStackTroopCount(stack),
          crewtype: stack.crew_type_id ?? 110,
          train: stack.train ?? 70,
          atmos: stack.morale ?? 70,
          leadership: 45,
          strength: 45,
          intel: 40,
          npc: 9,
          originStackId: stackId,
        };
      })
      .filter((unit) => unit.crew > 0 && unit.originStackId);
  }

  private static async applyBattleLossToCityGarrison(sessionId: string, cityId: number, totalLoss: number) {
    if (!totalLoss || totalLoss <= 0) {
      return;
    }
    const stacks = await unitStackRepository.findByOwner(sessionId, 'city', cityId);
    if (!stacks.length) {
      return;
    }
    const totalCrew = stacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);
    if (totalCrew <= 0) {
      return;
    }
    let remainingLoss = totalLoss;
    for (const stack of stacks) {
      const stackId = this.normalizeStackId(stack._id);
      if (!stackId) {
        continue;
      }
      const stackDoc = await unitStackRepository.findById(stackId);
      if (!stackDoc) {
        continue;
      }
      const hp = this.getStackTroopCount(stackDoc);
      if (hp <= 0) {
        continue;
      }
      const lossShare = Math.min(hp, Math.round((hp / totalCrew) * totalLoss));
      stackDoc.hp = Math.max(0, hp - lossShare);
      stackDoc.stack_count = Math.max(0, Math.ceil(stackDoc.hp / Math.max(1, stackDoc.unit_size)));
      remainingLoss -= lossShare;
      if (stackDoc.hp <= 0 || stackDoc.stack_count <= 0) {
        await unitStackRepository.deleteById(stackId);
      } else {
        await stackDoc.save();
      }
    }
    if (remainingLoss > 0) {
      // distribute remaining loss in case of rounding
      const survivors = await unitStackRepository.findByOwner(sessionId, 'city', cityId);
      if (survivors.length && remainingLoss > 0) {
        for (const stack of survivors) {
          if (remainingLoss <= 0) {
            break;
          }
          const stackId = this.normalizeStackId(stack._id);
          if (!stackId) {
            continue;
          }
          const stackDoc = await unitStackRepository.findById(stackId);
          if (!stackDoc) {
            continue;
          }
          const hp = this.getStackTroopCount(stackDoc);
          if (hp <= 0) {
            await unitStackRepository.deleteById(stackId);
            continue;
          }
          const loss = Math.min(hp, remainingLoss);
          stackDoc.hp = Math.max(0, hp - loss);
          stackDoc.stack_count = Math.max(0, Math.ceil(stackDoc.hp / Math.max(1, stackDoc.unit_size)));
          remainingLoss -= loss;
          if (stackDoc.hp <= 0 || stackDoc.stack_count <= 0) {
            await unitStackRepository.deleteById(stackId);
          } else {
            await stackDoc.save();
          }
        }
      }
    }
  }

  private static async applySiegeDamage(
    sessionId: string,
    city: any,
    attackerLoss: number,
    defenderLoss: number,
    attackerWon: boolean
  ) {
    if (!city?.city) {
      return;
    }
    const state = await cityDefenseRepository.ensure(sessionId, city.city, city.name);
    if (attackerWon) {
      await cityDefenseRepository.update(sessionId, city.city, {
        wall_hp: 0,
        gate_hp: 0,
        last_damage_at: new Date(),
      });
      return;
    }
    const wallDamage = Math.max(0, Math.round((attackerLoss || 0) * 0.05 + (defenderLoss || 0) * 0.02));
    const gateDamage = Math.max(0, Math.round((attackerLoss || 0) * 0.08));
    if (wallDamage === 0 && gateDamage === 0) {
      return;
    }
    const newWall = Math.max(0, (state.wall_hp ?? state.wall_max) - wallDamage);
    const newGate = Math.max(0, (state.gate_hp ?? state.gate_max) - gateDamage);
    await cityDefenseRepository.update(sessionId, city.city, {
      wall_hp: newWall,
      gate_hp: newGate,
      last_damage_at: new Date(),
    });
  }

  private static normalizeStackId(rawId: unknown): string {
    if (!rawId && rawId !== 0) {
      return '';
    }
    if (typeof rawId === 'string') {
      return rawId;
    }
    if (typeof rawId === 'number') {
      return String(rawId);
    }
    if (typeof (rawId as any)?.toString === 'function') {
      return (rawId as any).toString();
    }
    return `${rawId}`;
  }
}
