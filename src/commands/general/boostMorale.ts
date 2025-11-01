import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

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
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // NotWanderingNation(),
      // OccupiedCity(),
    ];

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // NotBeNeutral(),
      // NotWanderingNation(),
      // OccupiedCity(),
      // ReqGeneralCrew(),
      // ReqGeneralGold(reqGold),
      // ReqGeneralRice(reqRice),
      // ReqGeneralAtmosMargin(100), // GameConst::$maxAtmosByCommand
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    return `${name}(통솔경험, 자금↓)`;
  }

  public getCost(): [number, number] {
    const general = this.generalObj;
    return [Math.round(general.getVar('crew') / 100), 0];
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
    const general = this.generalObj;

    const atmosDelta = 0.005;
    const maxAtmosByCommand = 100;
    const trainSideEffectByAtmosTurn = 0.9;

    const score = Math.max(0, Math.min(
      Math.round(general.getLeadership() * 100 / general.getVar('crew') * atmosDelta),
      Math.max(0, maxAtmosByCommand - general.getVar('atmos'))
    ));

    const scoreText = score.toLocaleString();

    const sideEffect = Math.max(0, Math.floor(general.getVar('train') * trainSideEffectByAtmosTurn));

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`사기치가 <C>${scoreText}</> 상승했습니다.`);

    const exp = 100;
    const ded = 70;

    general.increaseVar('atmos', score);
    general.setVar('train', sideEffect);

    general.addDex(general.getCrewTypeObj(), score, false);

    const [reqGold] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof BoostMoraleCommand).getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler, tryUniqueItemLottery

    general.applyDB(db);

    return true;
  }
}
