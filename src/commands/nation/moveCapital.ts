import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { CityConst } from '../../CityConst';
import { GameConst } from '../../const/GameConst';

export class che_천도 extends NationCommand {
  static getName(): string {
    return '천도';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  private cachedDist: number | null = null;

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destCityID' in this.arg)) return false;

    if (CityConst.byID(this.arg['destCityID']) === null) return false;

    const destCityID = this.arg['destCityID'];

    this.arg = { destCityID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['capset', 'gold', 'rice', 'capital']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity()
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.setDestCity(this.arg['destCityID']);

    const [reqGold, reqRice] = this.getCost();

    if (this.getDistance() === null) {
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('천도 대상으로 도달할 방법이 없습니다.')
      ];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.OccupiedDestCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.SuppliedDestCity(),
      ConstraintHelper.ReqNationValue(
        'capital',
        '수도',
        '!=',
        this.destCity['city'],
        '이미 수도입니다.'
      ),
      ConstraintHelper.ReqNationGold(GameConst.basegold + reqGold),
      ConstraintHelper.ReqNationRice(GameConst.baserice + reqRice)
    ];
  }

  public getCommandDetailTitle(): string {
    const name = che_천도.getName();
    const amount = (Number(this.env['develcost']) * 5).toLocaleString();
    return `${name}/1+거리×2턴(금쌀 ${amount}×2^거리)`;
  }

  public getCost(): [number, number] {
    let amount = Number(this.env['develcost']) * 5;
    amount *= 2 ** (this.getDistance() ?? 50);
    return [amount, amount];
  }

  private getDistance(): number | null {
    if (this.cachedDist !== null) {
      return this.cachedDist;
    }

    const srcCityID = this.nation['capital'];
    const destCityID = this.arg['destCityID'];
    const nationID = this.nation['nation'];

    const calcCityDistance = (global as any).calcCityDistance;
    const distance = calcCityDistance(srcCityID, destCityID, [nationID]) ?? 50;
    this.cachedDist = distance;

    return distance;
  }

  public getPreReqTurn(): number {
    return (this.getDistance() ?? 0) * 2;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public addTermStack(): boolean {
    const lastTurn = this.getLastTurn();
    const commandName = che_천도.getName();

    const general = this.getGeneral();
    const nationID = general!.getNationID();

    const KVStorage = (global as any).KVStorage;
    const nationStor = KVStorage.getStorage(DB.db(), nationID, 'nation_env');

    nationStor.last천도Trial = [general!.getVar('officer_level'), general!.getTurnTime()];

    if (lastTurn.getCommand() !== commandName || lastTurn.getArg() !== this.arg) {
      this.setResultTurn(new LastTurn(commandName, this.arg, 1, this.nation['capset']));
      return false;
    }

    if (lastTurn.getSeq() < this.nation['capset']) {
      this.setResultTurn(new LastTurn(commandName, this.arg, 1, this.nation['capset']));
      return false;
    }

    if (lastTurn.getTerm() < this.getPreReqTurn()) {
      this.setResultTurn(
        new LastTurn(commandName, this.arg, lastTurn.getTerm() + 1, this.nation['capset'])
      );
      return false;
    }

    return true;
  }

  public getBrief(): string {
    const commandName = che_천도.getName();
    const destCityName = CityConst.byID(this.arg['destCityID'])?.name;
    const josaRo = JosaUtil.pick(destCityName || '', '로');
    return `【${destCityName}】${josaRo} ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();

    const general = this.generalObj;
    const generalName = general!.getName();
    const date = general!.getTurnTime('HM');

    const destCity = this.destCity;
    const destCityID = destCity['city'];
    const destCityName = destCity['name'];

    const nationID = general!.getNationID();
    const nationName = this.nation['name'];

    const josaRo = JosaUtil.pick(destCityName, '로');

    const logger = general!.getLogger();

    general!.addExperience(5 * (this.getPreReqTurn() + 1));
    general!.addDedication(5 * (this.getPreReqTurn() + 1));

    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    await db.update(
      'nation',
      {
        capital: destCityID,
        capset: db.sqleval('capset + 1')
      },
      'nation=%i',
      [nationID]
    );

    const refreshNationStaticInfo = (global as any).refreshNationStaticInfo;
    await refreshNationStaticInfo();

    general!.increaseInheritancePoint('active_action', 1);
    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>${josaRo} 천도했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>${josaRo} <M>천도</>명령`);
    logger.pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaRo} <M>천도</> 명령`
    );
    logger.pushGlobalActionLog(
      `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaRo} <M>천도</>를 명령하였습니다.`
    );
    logger.pushGlobalHistoryLog(
      `<S><b>【천도】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>${josaRo} <M>천도</>하였습니다.`
    );

    this.setResultTurn(new LastTurn(che_천도.getName(), this.arg));
    await general!.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    return {
      procRes: {
        cities: await (global as any).JSOptionsForCities(),
        distanceList: {}
      }
    };
  }
}
