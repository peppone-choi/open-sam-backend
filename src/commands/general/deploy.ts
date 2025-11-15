// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { RandUtil } from '../../utils/RandUtil';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { MoveCommand } from './move';

/**
 * 출병 커맨드
 * 
 * 적국 도시로 출병하여 전투를 벌입니다.
 * 경로상 가장 가까운 적 도시를 먼저 공격합니다.
 */
export class DeployCommand extends GeneralCommand {
  protected static actionName = '출병';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destCityID' in this.arg)) {
      return false;
    }
    
    const destCityID = this.arg.destCityID;
    if (typeof destCityID !== 'number' || destCityID <= 0) {
      return false;
    }
    
    this.arg = {
      destCityID: destCityID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['war', 'gennum', 'tech', 'gold', 'rice', 'color', 'type', 'level', 'capital']);

    const [reqGold, reqRice] = this.getCost();
    const relYear = this.env.year - this.env.startyear;

    this.minConditionConstraints = [
      ConstraintHelper.NotOpeningPart(relYear + 2),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  protected initWithArg(): void {
    const [reqGold, reqRice] = this.getCost();
    const relYear = this.env.year - this.env.startyear;

    // fullConditionConstraints를 먼저 설정 (setDestCity는 비동기이므로 나중에 처리)
    this.fullConditionConstraints = [
      ConstraintHelper.NotOpeningPart(relYear),
      ConstraintHelper.NotSameDestCity(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.AllowWar(),
      ConstraintHelper.HasRouteWithEnemy(),
    ];
    
    // setDestCity는 비동기이지만 생성자에서 동기적으로 호출됨
    this.setDestCity(this.arg.destCityID);
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof DeployCommand).getName();
    return `${name}(통솔경험, 병종숙련, 군량↓)`;
  }

  public getCost(): [number, number] {
    const crew = Math.max(1, this.generalObj.data.crew);
    return [0, Util.round(crew / 100)];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public getBrief(): string {
    const commandName = (this.constructor as typeof DeployCommand).getName();
    const destCityName = this.destCity?.name || '도시';
    const josaRo = JosaUtil.pick(destCityName, '로');
    return `【${destCityName}】${josaRo} ${commandName}`;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof DeployCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = this.destCity?.name || '도시';
    const josaRo = JosaUtil.pick(destCityName, '로');
    return `${failReason} <G><b>${destCityName}</b></>${josaRo} ${commandName} 실패.`;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // dest 보장 로딩
    if (this.arg?.destCityID && !this.destCity) {
      await this.setDestCityAsync(this.arg.destCityID, true);
    }
    if (this.destCity && !this.destNation) {
      await this.setDestNation(this.destCity.nation);
    }

    const db = DB.db();
    const general = this.generalObj;
    const attackerNationID = general.getNationID();
    const date = general.getTurnTime('HM');
    const attackerCityID = general.getCityID();
    const finalTargetCityID = this.destCity!.city;
    const finalTargetCityName = this.destCity!.name;
    const logger = general.getLogger();

    // 경로 탐색: 목표 도시까지의 경로에서 가장 가까운 적 도시 찾기
    const allowedNationList = [attackerNationID, 0]; // 아군과 중립 도시만 통과 가능
    
    // 실제 공격 대상 도시 결정 (경로상 가장 가까운 적 도시)
    let defenderCityID = finalTargetCityID;
    
    try {
      // 현재 도시에서 목표 도시까지의 경로상 적 도시 찾기
      const City = await import('../../models/city.model').then(m => m.City);
      const cities = await City.find({ session_id: this.env.session_id || 'sangokushi_default' });
      
      // BFS로 최단 경로상의 적 도시 찾기
      const queue: number[] = [attackerCityID];
      const visited = new Set<number>([attackerCityID]);
      const parent = new Map<number, number>();
      
      while (queue.length > 0) {
        const currentCityID = queue.shift()!;
        const currentCity = cities.find(c => c.city === currentCityID);
        
        if (!currentCity || !currentCity.connect) continue;
        
        for (const neighborID of currentCity.connect) {
          if (visited.has(neighborID)) continue;
          
          const neighborCity = cities.find(c => c.city === neighborID);
          if (!neighborCity) continue;
          
          visited.add(neighborID);
          parent.set(neighborID, currentCityID);
          
          // 적 도시 발견
          if (neighborCity.nation !== attackerNationID && neighborCity.nation !== 0) {
            defenderCityID = neighborID;
            queue.length = 0; // BFS 중단
            break;
          }
          
          // 목표 도시 도달
          if (neighborID === finalTargetCityID) {
            defenderCityID = finalTargetCityID;
            queue.length = 0;
            break;
          }
          
          // 아군 또는 중립 도시만 경로에 추가
          if (allowedNationList.includes(neighborCity.nation)) {
            queue.push(neighborID);
          }
        }
      }
    } catch (error) {
      console.error('경로 탐색 실패:', error);
      // 실패시 목표 도시를 직접 공격
      defenderCityID = finalTargetCityID;
    }
    await this.setDestCity(defenderCityID);
    const defenderCityName = this.destCity!.name;
    const josaRo = JosaUtil.pick(defenderCityName, '로');
    const defenderNationID = this.destCity!.nation;

    // 같은 국가면 이동으로 대체
    if (attackerNationID === defenderNationID) {
      if (this.arg.destCityID === defenderCityID) {
        logger.pushGeneralActionLog(`본국입니다. <G><b>${defenderCityName}</b></>${josaRo} 이동합니다. <1>${date}</>`);
      } else {
        logger.pushGeneralActionLog(`가까운 경로에 적군 도시가 없습니다. <G><b>${defenderCityName}</b></>${josaRo} 이동합니다. <1>${date}</>`);
      }
      this.alternative = new MoveCommand(general, this.env, { destCityID: defenderCityID });
      return false;
    }

    // 도시 상태 변경 (공성전 시작)
    try {
      const { cityRepository } = await import('../../repositories/city.repository');
      const sessionId = this.env.session_id || 'sangokushi_default';
      
      await cityRepository.updateByCityNum(sessionId, defenderCityID, {
        state: 43,
        term: 3
      });
      
      this.destCity!.state = 43;
      this.destCity!.term = 3;
      
    } catch (error) {
      console.error('도시 상태 업데이트 실패:', error);
      throw new Error('공성전 시작 처리 실패');
    }

    // 병종 숙련도 증가
    const crew = Math.max(1, general.data.crew);
    // TODO: const crewTypeObj = general.getCrewTypeObj() || { id: 0, name: '병종', armType: 0 };
    // TODO: general.addDex(crewTypeObj, crew / 100);

    // 활발한 액션 포인트 (500명 이상, 고훈련/고사기)
    if (general.data.crew > 500 && 
        general.data.train * general.data.atmos > 70 * 70) {
      try {
        if (typeof general.increaseInheritancePoint === 'function') {
          // TODO: general.increaseInheritancePoint('active_action', 1);
        }
      } catch (error) {
        console.error('InheritancePoint 처리 실패:', error);
      }
    }

    this.setResultTurn(new LastTurn((this.constructor as typeof DeployCommand).getName(), this.arg));
    await this.saveGeneral();

    // 전투 처리
    try {
      // 전투 RNG 시드 생성
      const warRngSeed = `${this.env.year}_${this.env.month}_${general.getID()}_${defenderCityID}_${Date.now()}`;
      const warRng = new RandUtil(warRngSeed);
      
      // 전투 결과 처리
      const processWar = await import('../../services/war/ProcessWar.service')
        .then(m => m.ProcessWarService || m.processWar)
        .catch(() => null);
      
      if (processWar && typeof processWar === 'function') {
        await processWar(warRng, general, this.nation, this.destCity);
      } else if (processWar && typeof processWar.process === 'function') {
        await processWar.process(warRng, general, this.nation, this.destCity);
      } else {
        // 전투 서비스가 없으면 기본 로직
        logger.pushGeneralActionLog(`<G><b>${defenderCityName}</b></>에 대한 전투가 시작되었습니다.`);
      }
    } catch (error) {
      console.error('전투 처리 실패:', error);
      logger.pushGeneralActionLog(`<G><b>${defenderCityName}</b></>에 대한 전투가 시작되었습니다.`);
    }

    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      DeployCommand,
      this.env,
      this.arg ?? {}
    );
    
    await tryUniqueItemLottery(
      // TODO: general.genGenericUniqueRNG(DeployCommand.actionName),
      general
    );
    
    await this.saveGeneral();

    return true;
  }

  public exportJSVars(): any {
    // 경로 정보 및 도시 정보 내보내기
    const cities: any[] = [];
    const distanceList: any[] = [];
    
    try {
      // 현재 세션의 모든 도시 정보
      const City = require('../../models/city.model').City;
      City.find({ session_id: this.env.session_id || 'sangokushi_default' })
        .then((cityList: any[]) => {
          cityList.forEach(city => {
            cities.push({
              city: city.city,
              name: city.name,
              nation: city.nation,
              state: city.state,
            });
          });
        })
        .catch((err: any) => console.error('exportJSVars 도시 조회 실패:', err));
      
      // 거리 정보 (간단한 구현)
      distanceList.push({
        fromCity: this.generalObj.getCityID(),
        toCity: this.destCity?.city,
        distance: 1,
      });
    } catch (error) {
      console.error('exportJSVars 처리 실패:', error);
    }
    
    return {
      procRes: {
        cities,
        distanceList,
      }
    };
  }
}
