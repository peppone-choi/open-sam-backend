import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { GameConst } from '../../const/GameConst';

export class che_증축 extends NationCommand {
  static getName(): string {
    return '증축';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return false;
  }

  protected argTest(): boolean {
    this.arg = {};
    return true;
  }

  protected init(): void {
    const general = this.generalObj;

    if (general!.getNationID() === 0) {
      this.minConditionConstraints = [ConstraintHelper.NotBeNeutral()];
      this.fullConditionConstraints = [ConstraintHelper.NotBeNeutral()];
      return;
    }

    this.setCity();
    this.setNation(['gold', 'rice', 'capset', 'capital']);

    if (!this.nation['capital']) {
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('방랑상태에서는 불가능합니다.')
      ];
      return;
    }

    this.setDestCity(this.nation['capital']);

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqDestCityValue('level', '규모', '>', 3, '수진, 진, 관문에서는 불가능합니다.'),
      ConstraintHelper.ReqDestCityValue('level', '규모', '<', 8, '더이상 증축할 수 없습니다.'),
      ConstraintHelper.ReqNationGold(GameConst.basegold + reqGold),
      ConstraintHelper.ReqNationRice(GameConst.baserice + reqRice)
    ];
  }

  public getCommandDetailTitle(): string {
    const name = this.constructor.getName();

    const [reqGold, reqRice] = this.getCost().map((v) => v.toLocaleString());
    const amount = (this.env['develcost'] * 5).toLocaleString();
    const reqTurn = this.getPreReqTurn() + 1;

    return `${name}/${reqTurn}턴(금 ${reqGold}, 쌀 ${reqRice})`;
  }

  public getCost(): [number, number] {
    const amount =
      this.env['develcost'] * GameConst.expandCityCostCoef + GameConst.expandCityDefaultCost;

    return [amount, amount];
  }

  public getPreReqTurn(): number {
    return 5;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public addTermStack(): boolean {
    const lastTurn = this.getLastTurn();
    const commandName = this.constructor.getName();

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
    const commandName = this.constructor.getName();
    return `수도를 ${commandName}`;
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

    const logger = general!.getLogger();

    general!.addExperience(5 * (this.getPreReqTurn() + 1));
    general!.addDedication(5 * (this.getPreReqTurn() + 1));
    general!.increaseInheritancePoint('active_action', 1);

    const josaUl = JosaUtil.pick(destCityName, '을');
    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    await db.update(
      'city',
      {
        level: db.sqleval('level+1'),
        pop_max: db.sqleval('pop_max + %i', GameConst.expandCityPopIncreaseAmount),
        agri_max: db.sqleval('agri_max + %i', GameConst.expandCityDevelIncreaseAmount),
        comm_max: db.sqleval('comm_max + %i', GameConst.expandCityDevelIncreaseAmount),
        secu_max: db.sqleval('secu_max + %i', GameConst.expandCityDevelIncreaseAmount),
        def_max: db.sqleval('def_max + %i', GameConst.expandCityWallIncreaseAmount),
        wall_max: db.sqleval('wall_max + %i', GameConst.expandCityWallIncreaseAmount)
      },
      'city=%i',
      [destCityID]
    );

    const [reqGold, reqRice] = this.getCost();
    await db.update(
      'nation',
      {
        capset: db.sqleval('capset + 1'),
        gold: db.sqleval('gold - %i', reqGold),
        rice: db.sqleval('rice - %i', reqRice)
      },
      'nation=%i',
      [nationID]
    );

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>${josaUl} 증축했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>${josaUl} <M>증축</>`);
    logger.pushNationalHistoryLog(
      `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>증축</>`
    );
    logger.pushGlobalActionLog(
      `<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>증축</>하였습니다.`
    );
    logger.pushGlobalHistoryLog(
      `<C><b>【증축】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>${josaUl} <M>증축</>하였습니다.`
    );

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg, 0));
    await general!.applyDB(db);

    return true;
  }
}
