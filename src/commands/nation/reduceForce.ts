import { NationCommand } from '../base/NationCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

export class ReduceForceCommand extends NationCommand {
  protected static actionName = '감축';

  protected argTest(): boolean {
    this.arg = {};
    return true;
  }

  protected async init(): Promise<void> {
    const general = this.generalObj;

    if (general.getNationID() === 0) {
      // TODO: ConstraintHelper - NotBeNeutral
      this.minConditionConstraints = [];
      this.fullConditionConstraints = [];
      return;
    }

    await this.setCity();
    await this.setNation(['gold', 'rice', 'capset', 'capital']);

    if (!this.nation.capital) {
      // TODO: ConstraintHelper - AlwaysFail:방랑상태에서는 불가능합니다.
      this.fullConditionConstraints = [];
      return;
    }

    await this.setDestCity(this.nation.capital);

    // TODO: ConstraintHelper - OccupiedCity, BeChief, SuppliedCity, ReqDestCityValue
    this.fullConditionConstraints = [];
  }

  public getCommandDetailTitle(): string {
    const name = ReduceForceCommand.getName();
    const [reqGold, reqRice] = this.getCost().map(v => v.toLocaleString());
    const reqTurn = this.getPreReqTurn() + 1;
    return `${name}/${reqTurn}턴(금 ${reqGold}, 쌀 ${reqRice} 회수)`;
  }

  public getCost(): [number, number] {
    const amount = this.env.develcost * 20 + 5000;
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
    const commandName = ReduceForceCommand.getName();
    
    if (lastTurn.getCommand() !== commandName || lastTurn.getArg() !== this.arg) {
      this.setResultTurn(new LastTurn(commandName, this.arg, 1, this.nation.capset));
      return false;
    }

    if (lastTurn.getSeq() < this.nation.capset) {
      this.setResultTurn(new LastTurn(commandName, this.arg, 1, this.nation.capset));
      return false;
    }

    if (lastTurn.getTerm() < this.getPreReqTurn()) {
      this.setResultTurn(new LastTurn(commandName, this.arg, lastTurn.getTerm() + 1, this.nation.capset));
      return false;
    }

    return true;
  }

  public getBrief(): string {
    return `수도를 ${ReduceForceCommand.getName()}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!await this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime();

    const destCity = this.destCity;
    const destCityID = destCity.city;
    const destCityName = destCity.name;

    const nationID = general.getNationID();
    const nationName = this.nation.name;

    const logger = general.getLogger();

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    await db.update('city', {
      level: db.sqleval('level-1'),
      pop: db.sqleval('greatest(pop - %i, %i)', [5000, 1000]),
      agri: db.sqleval('greatest(agri - %i, 0)', [1000]),
      comm: db.sqleval('greatest(comm - %i, 0)', [1000]),
      secu: db.sqleval('greatest(secu - %i, 0)', [1000]),
      def: db.sqleval('greatest(def - %i, 0)', [1000]),
      wall: db.sqleval('greatest(wall - %i, 0)', [1000]),
      pop_max: db.sqleval('pop_max - %i', [5000]),
      agri_max: db.sqleval('agri_max - %i', [1000]),
      comm_max: db.sqleval('comm_max - %i', [1000]),
      secu_max: db.sqleval('secu_max - %i', [1000]),
      def_max: db.sqleval('def_max - %i', [1000]),
      wall_max: db.sqleval('wall_max - %i', [1000]),
    }, 'city=%i', [destCityID]);

    const [reqGold, reqRice] = this.getCost();
    await db.update('nation', {
      capset: db.sqleval('capset + 1'),
      gold: db.sqleval('gold + %i', [reqGold]),
      rice: db.sqleval('rice + %i', [reqRice]),
    }, 'nation=%i', [nationID]);

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>을 감축했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>을 <M>감축</>`);
    logger.pushNationalHistoryLog(`<Y>${general.getName()}</>이 <G><b>${destCityName}</b></>을 <M>감축</>`);
    logger.pushGlobalActionLog(`<Y>${general.getName()}</>이 <G><b>${destCityName}</b></>을 <M>감축</>하였습니다.`);
    logger.pushGlobalHistoryLog(`<M><b>【감축】</b></><D><b>${nationName}</b></>이 <G><b>${destCityName}</b></>을 <M>감축</>하였습니다.`);

    general.increaseInheritancePoint('active_action', 1);
    this.setResultTurn(new LastTurn(ReduceForceCommand.getName(), this.arg, 0));
    await await general.save();

    return true;
  }
}
