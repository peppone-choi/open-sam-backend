// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { NationCommand } from '../base/NationCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/constraint-helper';

import { JosaUtil } from '../../utils/JosaUtil';

export class ReduceForceCommand extends NationCommand {
  protected static actionName = '감축';

  protected argTest(): boolean {
    this.arg = {};
    return true;
  }

  protected async init(): Promise<void> {
    const general = this.generalObj;

    if (general.getNationID() === 0) {
      this.minConditionConstraints = [
        ConstraintHelper.NotBeNeutral()
      ];
      this.fullConditionConstraints = [
        ConstraintHelper.NotBeNeutral()
      ];
      return;
    }

    await this.setCity();
    await this.setNation(['gold', 'rice', 'capset', 'capital']);

    if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }

    if (!this.nation.capital) {
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('방랑상태에서는 불가능합니다.')
      ];
      return;
    }

    await this.setDestCity(this.nation.capital);

    const [reqGold, reqRice] = this.getCost();
    
    // PHP: CityConst.byID(capital).level 가져오기
    const CityConst = global.CityConst;
    const origCityLevel = CityConst?.byID?.(this.nation.capital)?.level || 4;
    
    // PHP: fullConditionConstraints
    this.fullConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqDestCityValue('level', '규모', '>', 4, '더이상 감축할 수 없습니다.'),
      ConstraintHelper.ReqDestCityValue('level', '규모', '>', origCityLevel, '더이상 감축할 수 없습니다.'),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = ReduceForceCommand.getName();
    const [reqGold, reqRice] = this.getCost().map(v => v.toLocaleString());
    const reqTurn = this.getPreReqTurn() + 1;
    return `${name}/${reqTurn}턴(금 ${reqGold}, 쌀 ${reqRice} 회수)`;
  }

  public getCost(): [number, number] {
    const GameConst = global.GameConst || {};
    const expandCityCostCoef = GameConst.expandCityCostCoef || 20;
    const expandCityDefaultCost = GameConst.expandCityDefaultCost || 10000;
    const amount = this.env.develcost * expandCityCostCoef + expandCityDefaultCost / 2;
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
    
    if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    
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

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime();

        if (!this.destCity) {
      throw new Error('대상 도시 정보가 없습니다');
    }
    const destCity = this.destCity;
    const destCityID = destCity.city;
    const destCityName = destCity.name;

    const nationID = general.getNationID();
    const nationName = this.nation.name;

    const logger = general.getLogger();

    general.addExperience(5 * (this.getPreReqTurn() + 1));
    general.addDedication(5 * (this.getPreReqTurn() + 1));

    const GameConst = global.GameConst || {};
    const expandCityPopIncreaseAmount = GameConst.expandCityPopIncreaseAmount || 5000;
    const expandCityDevelIncreaseAmount = GameConst.expandCityDevelIncreaseAmount || 1000;
    const expandCityWallIncreaseAmount = GameConst.expandCityWallIncreaseAmount || 1000;
    const minAvailableRecruitPop = GameConst.minAvailableRecruitPop || 1000;

    await db.update('city', {
      level: db.sqleval('level-1'),
      pop: db.sqleval('greatest(pop - %i, %i)', [expandCityPopIncreaseAmount, minAvailableRecruitPop]),
      agri: db.sqleval('greatest(agri - %i, 0)', [expandCityDevelIncreaseAmount]),
      comm: db.sqleval('greatest(comm - %i, 0)', [expandCityDevelIncreaseAmount]),
      secu: db.sqleval('greatest(secu - %i, 0)', [expandCityDevelIncreaseAmount]),
      def: db.sqleval('greatest(def - %i, 0)', [expandCityWallIncreaseAmount]),
      wall: db.sqleval('greatest(wall - %i, 0)', [expandCityWallIncreaseAmount]),
      pop_max: db.sqleval('pop_max - %i', [expandCityPopIncreaseAmount]),
      agri_max: db.sqleval('agri_max - %i', [expandCityDevelIncreaseAmount]),
      comm_max: db.sqleval('comm_max - %i', [expandCityDevelIncreaseAmount]),
      secu_max: db.sqleval('secu_max - %i', [expandCityDevelIncreaseAmount]),
      def_max: db.sqleval('def_max - %i', [expandCityWallIncreaseAmount]),
      wall_max: db.sqleval('wall_max - %i', [expandCityWallIncreaseAmount]),
    }, 'city=%i', [destCityID]);

    const [reqGold, reqRice] = this.getCost();
    await db.update('nation', {
      capset: db.sqleval('capset + 1'),
      gold: db.sqleval('gold + %i', [reqGold]),
      rice: db.sqleval('rice + %i', [reqRice]),
    }, 'nation=%i', [nationID]);

    const generalName = general.data.name || general.name;
    const josaUl = JosaUtil.pick(destCityName, '을');
    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>${josaUl} 감축했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>${josaUl} <M>감축</> <1>${date}</>`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>감축</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>감축</>하였습니다.`);
    logger.pushGlobalHistoryLog(`<M><b>【감축】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>${josaUl} <M>감축</>하였습니다.`);

    // TODO: general.increaseInheritancePoint('active_action', 1);
    this.setResultTurn(new LastTurn(ReduceForceCommand.getName(), this.arg, 0));
    await await this.saveGeneral();

    // StaticEventHandler
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    return true;
  }
}
