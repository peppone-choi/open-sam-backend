import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 첩보 커맨드
 * 
 * 적 도시의 정보를 수집합니다.
 * 거리에 따라 얻을 수 있는 정보의 양이 달라집니다.
 */
export class SpyCommand extends GeneralCommand {
  protected static actionName = '첩보';
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
    this.setNation(['tech']);

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
      // NotBeNeutral(),
    ];
  }

  protected initWithArg(): void {
    this.setDestCity(this.arg.destCityID);
    this.setDestNation(this.destCity.nation, ['tech']);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotOccupiedDestCity(),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
    ];
  }

  public getBrief(): string {
    const cityName = this.destCity.name;
    return `【${cityName}】에 ${(this.constructor as typeof GeneralCommand).getName()} 실행`;
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
    title += ')';
    return title;
  }

  public getCost(): [number, number] {
    const env = this.env;
    return [env.develcost * 3, env.develcost * 3];
  }

  public getFailString(): string {
    const commandName = (this.constructor as typeof GeneralCommand).getName();
    const failReason = this.testFullConditionMet();
    if (failReason === null) {
      throw new Error('실행 가능한 커맨드에 대해 실패 이유를 수집');
    }
    const destCityName = this.destCity.name;
    return `${failReason} <G><b>${destCityName}</b></>에 ${commandName} 실패.`;
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
    const nationID = general.getNationID();
    const date = general.getTurnTime('HM');
    const destCity = this.destCity;
    const destCityName = destCity.name;
    const destCityID = destCity.city;
    const destNationID = destCity.nation;
    const logger = general.getLogger();

    const dist = 2;

    const destCityGeneralList = await db.query(
      'SELECT crew, crewtype FROM general WHERE city = ? AND nation = ?',
      [destCityID, destNationID]
    );

    const totalCrew = destCityGeneralList.reduce((sum: number, g: any) => sum + g.crew, 0);
    const totalGenCnt = destCityGeneralList.length;

    const popText = destCity.pop.toLocaleString();
    const trustText = destCity.trust.toFixed(1);
    const agriText = destCity.agri.toLocaleString();
    const commText = destCity.comm.toLocaleString();
    const secuText = destCity.secu.toLocaleString();
    const defText = destCity.def.toLocaleString();
    const wallText = destCity.wall.toLocaleString();

    const cityBrief = `【<G>${destCityName}</>】주민:${popText}, 민심:${trustText}, 장수:${totalGenCnt}, 병력:${totalCrew}`;
    const cityDevel = `【<M>첩보</>】농업:${agriText}, 상업:${commText}, 치안:${secuText}, 수비:${defText}, 성벽:${wallText}`;

    logger.pushGlobalActionLog(`누군가가 <G><b>${destCityName}</b></>을(를) 살피는 것 같습니다.`);
    
    if (dist <= 1) {
      logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>의 정보를 많이 얻었습니다. <1>${date}</>`);
      logger.pushGeneralActionLog(cityBrief, 'RAWTEXT');
      logger.pushGeneralActionLog(cityDevel, 'RAWTEXT');

      if (this.destNation.nation && general.getNationID()) {
        const techDiff = Math.floor(this.destNation.tech) - Math.floor(this.nation.tech);
        let techText: string;
        
        if (techDiff >= 1000) {
          techText = '<M>↑</>압도';
        } else if (techDiff >= 250) {
          techText = '<Y>▲</>우위';
        } else if (techDiff >= -250) {
          techText = '<W>↕</>대등';
        } else if (techDiff >= -1000) {
          techText = '<G>▼</>열위';
        } else {
          techText = '<C>↓</>미미';
        }
        logger.pushGeneralActionLog(`【<span class='ev_notice'>${this.destNation.name}</span>】아국대비기술:${techText}`);
      }
    } else if (dist === 2) {
      logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>의 정보를 어느 정도 얻었습니다. <1>${date}</>`);
      logger.pushGeneralActionLog(cityBrief, 'RAWTEXT');
      logger.pushGeneralActionLog(cityDevel, 'RAWTEXT');
    } else {
      logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>의 소문만 들을 수 있었습니다. <1>${date}</>`);
      logger.pushGeneralActionLog(cityBrief, 'RAWTEXT');
    }

    const rawSpy = await db.queryFirstField('SELECT spy FROM nation WHERE nation = ?', [nationID]);
    const spyInfo = rawSpy ? JSON.parse(rawSpy) : {};
    spyInfo[destCityID] = 3;
    
    await db.update('nation', {
      spy: JSON.stringify(spyInfo)
    }, 'nation=?', [nationID]);

    const exp = rng.nextRangeInt(1, 100);
    const ded = rng.nextRangeInt(1, 70);

    const [reqGold, reqRice] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);

    this.setResultTurn(new LastTurn(SpyCommand.getName(), this.arg));
    general.checkStatChange();
    general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        cities: [],
        distanceList: [],
      },
    };
  }
}
