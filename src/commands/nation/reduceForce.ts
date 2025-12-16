// @ts-nocheck - Type issues need review
import { NationCommand } from '../base/NationCommand';
import { LastTurn } from '../base/BaseCommand';
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

    // MongoDB로 도시 업데이트 (CQRS 패턴)
    await this.updateCity(destCityID, {
      level: Math.max(0, (destCity.level || 0) - 1),
      pop: Math.max(minAvailableRecruitPop, (destCity.pop || 0) - expandCityPopIncreaseAmount),
      agri: Math.max(0, (destCity.agri || 0) - expandCityDevelIncreaseAmount),
      comm: Math.max(0, (destCity.comm || 0) - expandCityDevelIncreaseAmount),
      secu: Math.max(0, (destCity.secu || 0) - expandCityDevelIncreaseAmount),
      def: Math.max(0, (destCity.def || 0) - expandCityWallIncreaseAmount),
      wall: Math.max(0, (destCity.wall || 0) - expandCityWallIncreaseAmount),
      pop_max: Math.max(0, (destCity.pop_max || 0) - expandCityPopIncreaseAmount),
      agri_max: Math.max(0, (destCity.agri_max || 0) - expandCityDevelIncreaseAmount),
      comm_max: Math.max(0, (destCity.comm_max || 0) - expandCityDevelIncreaseAmount),
      secu_max: Math.max(0, (destCity.secu_max || 0) - expandCityDevelIncreaseAmount),
      def_max: Math.max(0, (destCity.def_max || 0) - expandCityWallIncreaseAmount),
      wall_max: Math.max(0, (destCity.wall_max || 0) - expandCityWallIncreaseAmount),
    });

    const [reqGold, reqRice] = this.getCost();
    // MongoDB로 국가 업데이트 (CQRS 패턴)
    await this.incrementNation(nationID, {
      capset: 1,
      gold: reqGold,
      rice: reqRice,
    });

    const generalName = general.data.name || general.name;
    const josaUl = JosaUtil.pick(destCityName, '을');
    const josaYi = JosaUtil.pick(generalName, '이');
    const josaYiNation = JosaUtil.pick(nationName, '이');

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>${josaUl} 감축했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<G><b>${destCityName}</b></>${josaUl} <M>감축</> <1>${date}</>`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>감축</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>${josaYi} <G><b>${destCityName}</b></>${josaUl} <M>감축</>하였습니다.`);
    logger.pushGlobalHistoryLog(`<M><b>【감축】</b></><D><b>${nationName}</b></>${josaYiNation} <G><b>${destCityName}</b></>${josaUl} <M>감축</>하였습니다.`);

    try {
      const { InheritancePointService, InheritanceKey } = await import('../../services/inheritance/InheritancePoint.service');
      const sessionId = this.env.session_id || 'sangokushi_default';
      const inheritanceService = new InheritancePointService(sessionId);
      const userId = general.data.owner ?? general.data.user_id ?? general.getID();
      await inheritanceService.recordActivity(userId, InheritanceKey.ACTIVE_ACTION, 1);
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }
    this.setResultTurn(new LastTurn(ReduceForceCommand.getName(), this.arg, 0));
    await this.saveGeneral();

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
