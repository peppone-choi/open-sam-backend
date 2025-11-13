// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 강행 커맨드
 * 
 * 빠르게 이동하되 병력, 훈련, 사기가 감소합니다.
 */
export class ForceMarchCommand extends GeneralCommand {
  protected static actionName = '강행';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('destCityID' in this.arg)) {
      return false;
    }
    this.arg = {
      destCityID: this.arg.destCityID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [];
  }

  protected initWithArg(): void {
    const [reqGold, reqRice] = this.getCost();

    // setDestCity를 먼저 호출
    this.setDestCity(this.arg.destCityID, true);

    // fullConditionConstraints 설정 (PHP와 동일)
    this.fullConditionConstraints = [
      ConstraintHelper.NotSameDestCity(),
      ConstraintHelper.NearCity(3), // 최대 3칸 거리
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    const [reqGold, reqRice] = this.getCost();

    let title = `${name}(통솔경험`;
    if (reqGold > 0) {
      title += `, 자금${reqGold}`;
    }
    if (reqRice > 0) {
      title += `, 군량${reqRice}`;
    }
    title += ', 병력,훈련,사기↓)';
    return title;
  }

  public getCost(): [number, number] {
    const env = this.env;
    return [env.develcost * 5, 0];
  }

  public getBrief(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const destCityName = this.destCity?.name ?? '목적지';
    return `【${destCityName}】로 ${commandName}`;
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = this.destCity?.name ?? '목적지';
    return `${failReason} <G><b>${destCityName}</b></>로 ${commandName} 실패.`;
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;
    const general = this.generalObj;
    const date = general.getTurnTime('HM');

    if (!this.destCity) {
      throw new Error('목적 도시 정보가 없습니다');
    }
    
    const destCityName = this.destCity.name;
    const destCityID = this.destCity.city;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>로 강행했습니다. <1>${date}</>`);

    const exp = 100;
    general.setVar('city', destCityID);

    if (general.getVar('officer_level') === 12 && this.nation && this.nation.level === 0) {
      try {
        const sessionId = general.getSessionID();
        const nationID = general.getNationID();
        
        const generals = await generalRepository.findByFilter({
          session_id: sessionId,
          'data.nation': nationID,
          'data.no': { $ne: general.getID() }
        });
        
        if (generals && generals.length > 0) {
          await generalRepository.updateManyByFilter(
            {
              session_id: sessionId,
              'data.nation': nationID,
              'data.no': { $ne: general.getID() }
            },
            {
              'data.city': destCityID
            }
          );
          
          for (const targetGen of generals) {
            const targetGeneralID = targetGen.data?.no;
            if (targetGeneralID) {
              const targetLogger = general.createLogger(targetGeneralID, nationID, env.year, env.month);
              targetLogger.pushGeneralActionLog(`방랑군 세력이 <G><b>${destCityName}</b></>로 강행했습니다.`, 'PLAIN');
              await targetLogger.flush();
            }
          }
        }
      } catch (error) {
        console.error('방랑군 전체 이동 실패:', error);
      }
    }

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('train', -5, 20);
    general.increaseVarWithLimit('atmos', -5, 20);
    general.addExperience(exp);
    general.increaseVar('leadership_exp', 1);

    this.setResultTurn(new LastTurn(ForceMarchCommand.getName(), this.arg));
    general.checkStatChange();

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    // UniqueItemLottery
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '강행');
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const cities: any[] = [];
    const distanceList: any[] = [];
    
    try {
      const { cityRepository } = await import('../../repositories/city.repository');
      const sessionId = this.env.session_id || 'sangokushi_default';
      const allCities = await cityRepository.findBySession(sessionId);
      
      for (const city of allCities) {
        cities.push({
          city: city.city,
          name: city.name,
          nation: city.nation
        });
      }
      
      // 3칸 이내 거리 정보 (간단한 구현)
      const currentCityID = this.generalObj.getCityID();
      distanceList.push({
        from: currentCityID,
        distance: 3
      });
    } catch (error) {
      console.error('exportJSVars 실패:', error);
    }
    
    return {
      procRes: {
        cities,
        distanceList
      },
    };
  }
}
