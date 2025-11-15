import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';

/**
 * 사기 진작 커맨드
 * 
 * 병사들의 사기를 올립니다.
 */
export class BoostMoraleCommand extends GeneralCommand {
  protected static actionName = '사기진작';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
    ];

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.ReqGeneralAtmosMargin(GameConst.maxAtmosByCommand || 100),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    return `${name}(통솔경험, 자금↓)`;
  }

  public getCost(): [number, number] {
    const general = this.generalObj;
    const crew = Math.max(1, general.data.crew); // 0으로 나누기 방지
    return [Math.round(crew / 100), 0];
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

    const general = this.generalObj;

    const atmosDelta = 0.005;
    const maxAtmosByCommand = 100;
    const trainSideEffectByAtmosTurn = 0.9;

    // 0으로 나누기 방지: crew가 0일 수 있음
    const crew = Math.max(1, general.data.crew);
    
    // 사기진작은 통솔 70% + 매력 30%
    const leadership = general.getLeadership();
    const charm = general.getCharm();
    const moralePower = leadership * 0.7 + charm * 0.3;
    
    const score = Math.max(0, Math.min(
      Math.round(moralePower * 100 / crew * atmosDelta),
      Math.max(0, maxAtmosByCommand - general.data.atmos)
    ));

    const scoreText = score.toLocaleString();

    const sideEffect = Math.max(0, Math.floor(general.data.train * trainSideEffectByAtmosTurn));

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);

    logger.pushGeneralActionLog(`사기치가 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);

    const exp = 100;
    const ded = 70;

    general.increaseVar('atmos', score);
    general.data.train = sideEffect;

    // TODO: const crewTypeObj = general.getCrewTypeObj() || { id: 0, name: '병종', armType: 0 };
    // TODO: general.addDex(crewTypeObj, score, false);

    const [reqGold] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);

    general.addExperience(exp);
    general.addDedication(ded);
    // 사기진작은 통솔 70% + 매력 30%
    general.increaseVar('leadership_exp', 1);
    general.increaseVar('charm_exp', 0.5);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof BoostMoraleCommand).getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(
        // TODO: general.genGenericUniqueRNG(BoostMoraleCommand.actionName),
        general,
        sessionId,
        '사기진작'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
