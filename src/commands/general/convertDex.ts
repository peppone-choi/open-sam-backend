import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameUnitConst } from '../../constants/GameUnitConst';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 숙련전환 커맨드
 * 
 * 한 병종의 숙련도를 다른 병종의 숙련도로 전환합니다.
 * 전환 시 40%가 감소하고, 감소된 양의 90%가 대상 병종에 추가됩니다.
 */
export class ConvertDexCommand extends GeneralCommand {
  protected static actionName = '숙련전환';
  public static reqArg = true;

  // Conversion coefficients matching PHP
  private static readonly DECREASE_COEFF = 0.4;
  private static readonly CONVERT_COEFF = 0.9;

  protected srcArmType!: number;
  protected srcArmTypeName!: string;
  protected destArmType!: number;
  protected destArmTypeName!: string;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('srcArmType' in this.arg)) {
      return false;
    }
    if (!('destArmType' in this.arg)) {
      return false;
    }

    const srcArmType = this.arg.srcArmType;
    const destArmType = this.arg.destArmType;

    if (typeof srcArmType !== 'number') {
      return false;
    }
    if (!(srcArmType in GameUnitConst.allType())) {
      return false;
    }

    if (typeof destArmType !== 'number') {
      return false;
    }
    if (!(destArmType in GameUnitConst.allType())) {
      return false;
    }

    if (srcArmType === destArmType) {
      return false;
    }

    this.arg = {
      srcArmType,
      destArmType
    };
    return true;
  }

  protected async init(): Promise<void> {
    await this.setCity();
    await this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.srcArmType = this.arg.srcArmType;
    this.srcArmTypeName = GameUnitConst.allType()[this.srcArmType];
    this.destArmType = this.arg.destArmType;
    this.destArmTypeName = GameUnitConst.allType()[this.destArmType];

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  public getBrief(): string {
    return `【${this.srcArmTypeName}】숙련을 【${this.destArmTypeName}】숙련으로 전환`;
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
    return [env.develcost, env.develcost];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async runImpl(rng: RandUtil): Promise<boolean> {
    const general = this.generalObj;
    const date = general.getTurnTime('hm');
    const logger = general.getLogger();

    // Get source dex and calculate conversion
    const srcDex = general.getVar(`dex${this.srcArmType}`) as number;
    const cutDex = Math.floor(srcDex * ConvertDexCommand.DECREASE_COEFF);
    const cutDexText = cutDex.toLocaleString();
    const addDex = Math.floor(cutDex * ConvertDexCommand.CONVERT_COEFF);
    const addDexText = addDex.toLocaleString();

    // Apply conversion
    general.increaseVar(`dex${this.srcArmType}`, -cutDex);
    general.increaseVar(`dex${this.destArmType}`, addDex);

    // Determine josa particles (Korean grammar)
    const josaUl = this.pickJosa(cutDex, '을');
    const josaRo = this.pickJosa(addDex, '로');

    const [reqGold, reqRice] = this.getCost();

    logger.pushGeneralActionLog(
      `${this.srcArmTypeName} 숙련 ${cutDexText}${josaUl} ${this.destArmTypeName} 숙련 ${addDexText}${josaRo} 전환했습니다. <1>${date}</>`
    );

    // Apply costs and rewards
    general.addExperience(10);
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.increaseVar('leadership_exp', 2);

    this.setResultTurn(new LastTurn(ConvertDexCommand.getName(), this.arg));
    general.checkStatChange();

    // Try unique item lottery
    tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, ConvertDexCommand.actionName),
      general
    );

    await general.applyDB();

    return true;
  }

  /**
   * Helper to pick Korean josa particle based on number
   */
  private pickJosa(num: number, type: string): string {
    const lastDigit = num % 10;
    if (type === '을') {
      return lastDigit === 0 || lastDigit === 1 || lastDigit === 3 || lastDigit === 6 || lastDigit === 7 || lastDigit === 8 ? '을' : '를';
    } else if (type === '로') {
      return lastDigit === 0 || lastDigit === 1 || lastDigit === 3 || lastDigit === 6 || lastDigit === 7 || lastDigit === 8 ? '으로' : '로';
    }
    return '';
  }
}
