import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { RandUtil } from '../../utils/RandUtil';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { tryUniqueItemLottery } from '../../utils/functions';
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
    // TODO: CityConst.all() validation
    this.arg = {
      destCityID: this.arg.destCityID
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['war', 'gennum', 'tech', 'gold', 'rice', 'color', 'type', 'level', 'capital']);

    const [reqGold, reqRice] = this.getCost();
    const relYear = this.env.year - this.env.startyear;

    this.minConditionConstraints = [
      (ConstraintHelper as any).NotOpeningPart(relYear + 2),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  protected initWithArg(): void {
    this.setDestCity(this.arg.destCityID);

    const [reqGold, reqRice] = this.getCost();
    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      (ConstraintHelper as any).NotOpeningPart(relYear),
      (ConstraintHelper as any).NotSameDestCity(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralRice(reqRice),
      (ConstraintHelper as any).AllowWar(),
      (ConstraintHelper as any).HasRouteWithEnemy(),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof DeployCommand).getName();
    return `${name}(통솔경험, 병종숙련, 군량↓)`;
  }

  public getCost(): [number, number] {
    return [0, Util.round(this.generalObj.getVar('crew') / 100)];
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

    const db = DB.db();
    const general = this.generalObj;
    const attackerNationID = general.getNationID();
    const date = general.getTurnTime('HM');
    const attackerCityID = general.getCityID();
    const finalTargetCityID = this.destCity!.city;
    const finalTargetCityName = this.destCity!.name;
    const logger = general.getLogger();

    // TODO: 경로 탐색 로직
    // searchDistanceListToDest, diplomacy 쿼리 등
    const allowedNationList = [attackerNationID, 0];
    
    // 임시: 목표 도시를 그대로 공격 대상으로 설정
    const defenderCityID = finalTargetCityID;
    this.setDestCity(defenderCityID);
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
    await db.update('city', {
      state: 43,
      term: 3
    }, 'city=?', [defenderCityID]);

    this.destCity!.state = 43;
    this.destCity!.term = 3;

    // 병종 숙련도 증가
    general.addDex(general.getCrewTypeObj(), general.getVar('crew') / 100);

    // 활발한 액션 포인트 (500명 이상, 고훈련/고사기)
    if (general.getVar('crew') > 500 && 
        general.getVar('train') * general.getVar('atmos') > 70 * 70) {
      // TODO: general.increaseInheritancePoint('active_action', 1);
    }

    this.setResultTurn(new LastTurn((this.constructor as typeof DeployCommand).getName(), this.arg));
    await general.applyDB(db);

    // 전투 처리
    // TODO: processWar 로직 구현
    // const warRngSeed = generateWarRngSeed(...)
    // await processWar(warRngSeed, general, this.nation, this.destCity);

    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      DeployCommand,
      this.env,
      this.arg ?? {}
    );
    
    await tryUniqueItemLottery(
      general.genGenericUniqueRNG(DeployCommand.actionName),
      general
    );
    
    await general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    return {
      procRes: {
        // TODO: cities, distanceList
      }
    };
  }
}
