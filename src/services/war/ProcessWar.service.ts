/**
 * ProcessWarService - 출병 후 전투 처리
 * PHP process_war.php 포팅
 * 
 * 전투 방식:
 * 1. 자동 전투 (processWar_NG): Phase 기반 자동 계산
 * 2. 전술 전투 (40x40): BattleInstance를 생성하여 턴제 전투
 */

import { RandUtil } from '../../utils/RandUtil';
import { BattleCreationService } from '../battle/BattleCreation.service';

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

export class ProcessWarService {
  /**
   * 출병 후 전투 처리 메인 함수
   * 무조건 40x40 전술 전투로 진행
   */
  static async process(
    rng: RandUtil,
    attackerGeneral: any,
    attackerNation: any,
    defenderCity: any
  ): Promise<void> {
    const sessionId = attackerGeneral.session_id;
    const attackerNationID = attackerGeneral.nation || attackerGeneral.getNationID?.();
    const defenderNationID = defenderCity.nation;
    const defenderCityID = defenderCity.city;

    const logger = attackerGeneral.getLogger?.() || console;

    // === 1. 방어군 확인 ===
    const { generalRepository } = await import('../../repositories/general.repository');
    const defenderGenerals = await generalRepository.findByFilter({
      session_id: sessionId,
      nation: defenderNationID,
      city: defenderCityID,
      crew: { $gt: 0 }
    });

    // === 2. 공백지 체크 - 한나라 잔존 세력과 자동 전투 ===
    if (defenderGenerals.length === 0 && defenderNationID === 0) {
      // 공백지에 한나라 관리/호족/이민족 사병 생성 (지역 방어군)
      const localMilitia = this.createLocalMilitia(defenderCity, rng);
      const cityLevel = (defenderCity as any).level || 5;
      const cityId = (defenderCity as any).city || 0;
      
      // 로그용 방어 세력 표시
      let defenderType: string;
      if (cityLevel >= 10) {
        // 레벨 10 (경): 경기 - 사예교위 휘하
        if (cityId === 3) {
          defenderType = '<R>한 사예교위 휘하 하남윤</>';
        } else if (cityId === 4) {
          defenderType = '<R>한 사예교위 휘하 경조윤</>';
        } else {
          defenderType = '<R>한 사예교위</>';
        }
      } else if (cityLevel >= 9) {
        // 레벨 9 (특): 주치소급 대도시 - 자사/주목
        defenderType = '<Y>한 자사</>';
      } else if (cityLevel >= 8) {
        // 레벨 8 (대): 대군급 - 태수
        defenderType = '<Y>한 태수</>';
      } else if (cityLevel >= 7) {
        // 레벨 7 (중): 중소군급 - 태수
        defenderType = '한 태수';
      } else if (cityLevel === 6) {
        // 레벨 6 (소): 소현급 - 현령 (만호 이상, ex. 평원)
        defenderType = '한 현령';
      } else if (cityLevel === 5) {
        // 레벨 5 (이): 이민족 도시
        defenderType = '이민족';
      } else if (cityLevel === 4) {
        // 레벨 4 (관): 관문 도시 - 관문 수비대
        defenderType = '한 관문 수비대';
      } else if (cityLevel === 3) {
        // 레벨 3 (진): 군사기지 - 둔전/진영
        defenderType = '한 진영 수비대';
      } else if (cityLevel === 2) {
        // 레벨 2 (수): 항구 도시 - 항구 호족
        defenderType = '항구 호족';
      } else if (cityLevel === 1) {
        // 레벨 1 (향): 향촌 - 향촌 호족
        defenderType = '향촌 호족';
      } else {
        // 레벨 0 (무): 황폐화된 도시 - 유민/산적
        defenderType = '유민 무리';
      }
      
      logger.pushGlobalActionLog?.(
        `<D><b>${attackerNation.name}</b></>의 <Y>${attackerGeneral.name}</>이(가) 공백지 <G><b>${defenderCity.name}</b></>에 진격합니다. [${defenderType} ${localMilitia.crew}명 저항]`
      );

      // 자동 전투 실행
      const battleResult = await this.executeAutoBattle(
        sessionId,
        attackerGeneral,
        localMilitia,
        defenderCity,
        rng
      );

      if (battleResult.winner === 'attacker') {
        logger.pushGeneralActionLog?.(
          `${defenderType}을(를) 격파하고 <G><b>${defenderCity.name}</b></>을(를) 점령했습니다! [피해: ${battleResult.attackerLoss}명]`
        );

        // 도시 점령
        await this.conquerCity(sessionId, defenderCityID, attackerNationID);
        
        // 공격자 이동 및 병력 손실 반영
        attackerGeneral.city = defenderCityID;
        attackerGeneral.crew = Math.max(0, attackerGeneral.crew - battleResult.attackerLoss);
        await attackerGeneral.applyDB?.();
      } else {
        logger.pushGeneralActionLog?.(
          `${defenderType}에게 패배했습니다! [손실: ${battleResult.attackerLoss}명]`
        );
        
        // 병력 손실만 반영
        attackerGeneral.crew = Math.max(0, attackerGeneral.crew - battleResult.attackerLoss);
        await attackerGeneral.applyDB?.();
      }
      
      return;
    }

    // === 3. 자동 전투 조건 체크 ===
    const shouldUseAutoBattle = this.checkAutoBattleCondition(
      attackerGeneral,
      defenderGenerals,
      attackerNation,
      defenderNationID
    );

    if (shouldUseAutoBattle) {
      // 자동 전투 실행
      const battleResult = await this.executeMultiUnitAutoBattle(
        sessionId,
        attackerGeneral,
        defenderGenerals,
        defenderCity,
        rng
      );

      if (battleResult.winner === 'attacker') {
        logger.pushGlobalActionLog?.(
          `<D><b>${attackerNation.name}</b></>의 <Y>${attackerGeneral.name}</>이(가) <G><b>${defenderCity.name}</b></>을(를) 점령했습니다! [자동 전투]`
        );

        // 도시 점령
        await this.conquerCity(sessionId, defenderCityID, attackerNationID);
        
        // 공격자 이동 및 병력 손실 반영
        attackerGeneral.city = defenderCityID;
        attackerGeneral.crew = Math.max(0, attackerGeneral.crew - battleResult.attackerLoss);
        await attackerGeneral.applyDB?.();
      } else {
        logger.pushGeneralActionLog?.(
          `<G><b>${defenderCity.name}</b></> 공격 실패 [자동 전투] [손실: ${battleResult.attackerLoss}명]`
        );
        
        // 병력 손실만 반영
        attackerGeneral.crew = Math.max(0, attackerGeneral.crew - battleResult.attackerLoss);
        await attackerGeneral.applyDB?.();
      }
      
      return;
    }

    // === 4. 진입 방향 계산 ===
    const entryDirection = await this.calculateEntryDirection(
      attackerGeneral,
      defenderCity
    );

    // === 5. 40x40 전술 전투 생성 ===
    const battleId = await this.createTacticalBattle(
      sessionId,
      attackerNationID,
      defenderNationID,
      defenderCityID,
      [attackerGeneral.no],
      defenderGenerals.map((g: any) => g.no),
      entryDirection
    );

    logger.pushGlobalActionLog?.(
      `<D><b>${attackerNation.name}</b></>의 <Y>${attackerGeneral.name}</>이(가) <G><b>${defenderCity.name}</b></>에 진격합니다. [전술 전투]`
    );
    logger.pushGeneralActionLog?.(
      `<G><b>${defenderCity.name}</b></>로 진격합니다. [전술 전투 시작] (ID: ${battleId})`
    );
  }

  /**
   * 호족 사병 생성
   * 공백지 방어를 위한 지역 민병대
   */
  private static createLocalMilitia(city: any, rng: RandUtil): any {
    const cityLevel = (city as any).level || 5;
    const cityName = (city as any).name || '';
    const cityId = (city as any).city || 0;
    
    // 레벨별 병력 및 지휘관 설정
    let baseTroops: number;
    let troops: number;
    let leaderTitle: string;
    let leadership: number;
    let strength: number;
    let intel: number;
    let train: number;
    let morale: number;
    let crewtype: number;

    // === 레벨 10: 경급 도시 (낙양, 장안) - 사예교위 휘하 ===
    if (cityLevel >= 10) {
      baseTroops = 800 + cityLevel * 100; // 1800
      troops = baseTroops + rng.nextInt(200, 500); // 2000~2300명
      
      // 낙양(id:3) = 하남윤, 장안(id:4) = 경조윤
      // 사예교위가 총괄하지만, 실제 행정은 각 윤이 담당
      if (cityId === 3) {
        leaderTitle = '사예교위 하남윤';
      } else if (cityId === 4) {
        leaderTitle = '사예교위 경조윤';
      } else {
        leaderTitle = '사예교위'; // 혹시 다른 경급 도시가 있다면
      }
      
      leadership = 65 + rng.nextInt(10, 20); // 75~85
      strength = 65 + rng.nextInt(10, 20);   // 75~85
      intel = 60 + rng.nextInt(10, 20);      // 70~80
      train = 70 + rng.nextInt(10, 20);      // 80~90
      morale = 70 + rng.nextInt(10, 20);     // 80~90
      crewtype = rng.nextBoolean() ? 2 : 1; // 기병 or 창병
    }
    // === 레벨 9: 특급 도시 - 자사 ===
    else if (cityLevel >= 9) {
      leaderTitle = '자사';
      baseTroops = 600 + cityLevel * 80; // 1320
      troops = baseTroops + rng.nextInt(180, 480); // 1500~1800명
      leadership = 60 + rng.nextInt(5, 20); // 65~80
      strength = 60 + rng.nextInt(5, 20);   // 65~80
      intel = 55 + rng.nextInt(5, 15);      // 60~70
      train = 65 + rng.nextInt(10, 20);     // 75~85
      morale = 65 + rng.nextInt(10, 20);    // 75~85
      crewtype = 1; // 창병
    }
    // === 레벨 8: 대군 - 태수 ===
    else if (cityLevel >= 8) {
      leaderTitle = '태수';
      baseTroops = 500 + cityLevel * 70; // 1060
      troops = baseTroops + rng.nextInt(140, 440); // 1200~1500명
      leadership = 55 + rng.nextInt(5, 20); // 60~75
      strength = 55 + rng.nextInt(5, 20);   // 60~75
      intel = 50 + rng.nextInt(5, 15);      // 55~65
      train = 60 + rng.nextInt(10, 20);     // 70~80
      morale = 60 + rng.nextInt(10, 20);    // 70~80
      crewtype = 1; // 창병
    }
    // === 레벨 7: 중군 - 태수 ===
    else if (cityLevel >= 7) {
      leaderTitle = '태수';
      baseTroops = 400 + cityLevel * 60; // 820
      troops = baseTroops + rng.nextInt(80, 280); // 900~1100명
      leadership = 50 + rng.nextInt(5, 20); // 55~70
      strength = 50 + rng.nextInt(5, 20);   // 55~70
      intel = 45 + rng.nextInt(5, 15);      // 50~60
      train = 55 + rng.nextInt(10, 20);     // 65~75
      morale = 55 + rng.nextInt(10, 20);    // 65~75
      crewtype = 1; // 창병
    }
    // === 레벨 5: 이민족 도시 - 족장 ===
    else if (cityLevel === 5) {
      baseTroops = 150 + cityLevel * 50; // 400
      troops = baseTroops + rng.nextInt(0, 200); // 400~600명 (방랑군이 이길 수 있는 수준)
      leaderTitle = '족장';
      leadership = 45 + rng.nextInt(0, 15); // 45~60
      strength = 45 + rng.nextInt(0, 15);   // 45~60
      intel = 35 + rng.nextInt(0, 10);      // 35~45
      train = 45 + rng.nextInt(0, 15);      // 45~60
      morale = 50 + rng.nextInt(0, 15);     // 50~65
      crewtype = 1; // 창병
    }
    // === 레벨 1-4, 6: 도시 특성별 지방 세력 ===
    else {
      // 도시 크기/특성별 세력 세분화
      if (cityLevel === 6) {
        // 레벨 6 (소): 소현급 - 현령 (만호 이상, ex. 평원상)
        leaderTitle = '현령';
        baseTroops = 200 + cityLevel * 70; // 620
        troops = baseTroops + rng.nextInt(50, 250); // 670~870명 (방랑군이 승리 가능)
        leadership = 50 + rng.nextInt(5, 15); // 55~65
        strength = 50 + rng.nextInt(5, 15);   // 55~65
        intel = 45 + rng.nextInt(5, 10);      // 50~55
        train = 50 + rng.nextInt(5, 15);      // 55~65
        morale = 55 + rng.nextInt(5, 15);     // 60~70
        crewtype = 1; // 창병
      } else if (cityLevel === 4) {
        // 레벨 4 (관): 관문 도시 - 관문 수비대장
        leaderTitle = '관문장';
        baseTroops = 300 + cityLevel * 120; // 780
        troops = baseTroops + rng.nextInt(50, 300); // 830~1080명
        leadership = 50 + rng.nextInt(5, 15); // 55~65
        strength = 55 + rng.nextInt(5, 20);   // 60~75 (방어 중시)
        intel = 40 + rng.nextInt(5, 10);      // 45~50
        train = 55 + rng.nextInt(10, 20);     // 65~75 (높은 훈련도)
        morale = 60 + rng.nextInt(10, 20);    // 70~80 (높은 사기)
        crewtype = 1; // 창병
      } else if (cityLevel === 3) {
        // 레벨 3 (진): 군사기지 - 둔전관/진장
        leaderTitle = rng.nextBoolean() ? '둔전관' : '진장';
        baseTroops = 300 + cityLevel * 120; // 660
        troops = baseTroops + rng.nextInt(50, 250); // 710~910명
        leadership = 50 + rng.nextInt(5, 15); // 55~65
        strength = 50 + rng.nextInt(5, 15);   // 55~65 (군사 기지)
        intel = 40 + rng.nextInt(5, 10);      // 45~50
        train = 55 + rng.nextInt(10, 20);     // 65~75 (군사 훈련)
        morale = 55 + rng.nextInt(10, 20);    // 65~75
        crewtype = 1; // 창병
      } else if (cityLevel === 2) {
        // 레벨 2 (수): 항구 도시 - 항구 호족/선주
        leaderTitle = rng.nextBoolean() ? '항구 호족' : '선주';
        baseTroops = 300 + cityLevel * 120; // 540
        troops = baseTroops + rng.nextInt(0, 200); // 540~740명
        leadership = 45 + rng.nextInt(5, 15); // 50~60
        strength = 40 + rng.nextInt(5, 15);   // 45~55
        intel = 45 + rng.nextInt(5, 15);      // 50~60 (상업 지능)
        train = 40 + rng.nextInt(5, 15);      // 45~55
        morale = 50 + rng.nextInt(5, 15);     // 55~65
        crewtype = 0; // 궁병 (수전 가능)
      } else if (cityLevel === 1) {
        // 레벨 1 (향): 향촌급 - 향촌 호족/향리
        leaderTitle = rng.nextBoolean() ? '향촌 호족' : '향리';
        baseTroops = 300 + cityLevel * 120; // 420
        troops = baseTroops + rng.nextInt(0, 150); // 420~570명
        leadership = 40 + rng.nextInt(5, 15); // 45~55
        strength = 40 + rng.nextInt(5, 15);   // 45~55
        intel = 35 + rng.nextInt(5, 10);      // 40~45
        train = 40 + rng.nextInt(5, 15);      // 45~55
        morale = 45 + rng.nextInt(5, 15);     // 50~60
        crewtype = 1; // 창병
      } else {
        // 레벨 0 (무): 황폐화된 도시 - 유민/산적
        leaderTitle = rng.nextBoolean() ? '유민 무리' : '산적 무리';
        baseTroops = 100 + rng.nextInt(0, 100); // 100~200
        troops = baseTroops + rng.nextInt(0, 100); // 100~300명
        leadership = 25 + rng.nextInt(0, 15); // 25~40
        strength = 30 + rng.nextInt(0, 15);   // 30~45
        intel = 20 + rng.nextInt(0, 15);      // 20~35
        train = 20 + rng.nextInt(0, 20);      // 20~40 (낮은 훈련도)
        morale = 30 + rng.nextInt(0, 20);     // 30~50 (낮은 사기)
        crewtype = 1; // 창병
      }
    }

    return {
      no: -999, // 호족/족장/현령/태수/자사/경조윤/하남윤 특수 ID
      name: `한 ${leaderTitle}`,
      crew: troops,
      leadership,
      strength,
      intel,
      crewtype,
      train,
      morale
    };
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
    // 유저 참여 전투는 무조건 전술 전투
    const attackerIsUser = attackerGeneral.npc === 0 || !attackerGeneral.npc;
    if (attackerIsUser) {
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
    rng: RandUtil
  ): Promise<{ winner: 'attacker' | 'defender'; attackerLoss: number; defenderLoss: number }> {
    const { BattleCalculator, UnitType, TerrainType } = await import('../../core/battle-calculator');
    
    const calculator = new BattleCalculator();
    const terrain = (city as any).wall > 0 ? TerrainType.FORTRESS : TerrainType.PLAINS;

    const result = calculator.calculateBattle({
      attacker: {
        name: attacker.name,
        troops: attacker.crew,
        leadership: attacker.leadership,
        strength: attacker.strength,
        intelligence: attacker.intel,
        unitType: UnitType.FOOTMAN,
        morale: attacker.morale || 80,
        training: attacker.train || 80,
        techLevel: 50
      },
      defender: {
        name: defender.name,
        troops: defender.crew,
        leadership: defender.leadership,
        strength: defender.strength,
        intelligence: defender.intel,
        unitType: UnitType.FOOTMAN,
        morale: defender.morale || 60,
        training: defender.train || 50,
        techLevel: 30
      },
      terrain,
      isDefenderCity: (city as any).wall > 0
    });

    return {
      winner: result.winner as 'attacker' | 'defender',
      attackerLoss: result.attackerCasualties,
      defenderLoss: result.defenderCasualties
    };
  }

  /**
   * 자동 전투 실행 (다중 유닛)
   */
  private static async executeMultiUnitAutoBattle(
    sessionId: string,
    attacker: any,
    defenders: any[],
    city: any,
    rng: RandUtil
  ): Promise<{ winner: 'attacker' | 'defender'; attackerLoss: number; defenderLoss: number }> {
    // 간단 구현: 방어군을 하나로 합산
    const totalDefenderTroops = defenders.reduce((sum, g) => sum + (g.crew || 0), 0);
    const avgDefenderLeadership = Math.round(
      defenders.reduce((sum, g) => sum + (g.leadership || 50), 0) / defenders.length
    );
    const avgDefenderStrength = Math.round(
      defenders.reduce((sum, g) => sum + (g.strength || 50), 0) / defenders.length
    );
    const avgDefenderIntel = Math.round(
      defenders.reduce((sum, g) => sum + (g.intel || 50), 0) / defenders.length
    );

    const combinedDefender = {
      no: -998,
      name: `${(city as any).name} 수비군`,
      crew: totalDefenderTroops,
      leadership: avgDefenderLeadership,
      strength: avgDefenderStrength,
      intel: avgDefenderIntel,
      crewtype: 1,
      train: 70,
      morale: 75
    };

    return this.executeAutoBattle(sessionId, attacker, combinedDefender, city, rng);
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
   * 40x40 전술 전투 생성
   */
  private static async createTacticalBattle(
    sessionId: string,
    attackerNationId: number,
    defenderNationId: number,
    cityId: number,
    attackerGenerals: number[],
    defenderGenerals: number[],
    entryDirection: any
  ): Promise<string> {
    const result = await BattleCreationService.createBattle({
      sessionId,
      attackerNationId,
      defenderNationId,
      cityId,
      attackerGenerals,
      defenderGenerals,
      entryDirection,
    });

    return result.battleId;
  }



  /**
   * 도시 점령 처리 (전술 전투 승리 시 호출)
   */
  static async conquerCity(
    sessionId: string,
    cityId: number,
    attackerNationId: number
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

      // 수도 함락 체크
      const { nationRepository } = await import('../../repositories/nation.repository');
      const defenderNation = await nationRepository.findByNationNum(sessionId, oldNationId);
      
      if (defenderNation && defenderNation.capital === cityId) {
        console.log(`[ProcessWar] 수도 함락! 국가 ${oldNationId} 멸망 처리 필요`);
        // 국가 멸망 처리 (별도 구현 필요)
      }
    } catch (error) {
      console.error('[ProcessWar] 도시 점령 처리 실패:', error);
      throw error;
    }
  }
}
