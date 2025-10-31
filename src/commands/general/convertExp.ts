import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { GameUnitConst } from '../../constants/GameUnitConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { JosaUtil } from '../../utils/JosaUtil';

export class ConvertExpCommand extends GeneralCommand {
  protected static actionName = '숙련전환';
  public static reqArg = true;

  protected srcArmType!: number;
  protected srcArmTypeName!: string;
  protected destArmType!: number;
  protected destArmTypeName!: string;

  static decreaseCoeff = 0.4;
  static convertCoeff = 0.9;

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

    if (!Number.isInteger(srcArmType)) {
      return false;
    }
    if (!(srcArmType in (GameUnitConst as any).allType())) {
      return false;
    }

    if (!Number.isInteger(destArmType)) {
      return false;
    }
    if (!(destArmType in (GameUnitConst as any).allType())) {
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

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
    ];
  }

  protected initWithArg(): void {
    this.srcArmType = this.arg.srcArmType;
    this.srcArmTypeName = (GameUnitConst as any).allType()[this.srcArmType];
    this.destArmType = this.arg.destArmType;
    this.destArmTypeName = (GameUnitConst as any).allType()[this.destArmType];

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
    const name = (this.constructor as any).getName();
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

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('TURNTIME_HM');

    const logger = general.getLogger();

    const srcDex = general.getVar('dex' + this.srcArmType);
    const cutDex = Util.toInt(srcDex * ConvertExpCommand.decreaseCoeff);
    const cutDexText = cutDex.toLocaleString();
    const addDex = Util.toInt(cutDex * ConvertExpCommand.convertCoeff);
    const addDexText = addDex.toLocaleString();

    general.increaseVar('dex' + this.srcArmType, -cutDex);
    general.increaseVar('dex' + this.destArmType, addDex);

    const josaUl = JosaUtil.pick(cutDex, '을');
    const josaRo = JosaUtil.pick(addDex, '로');

    const [reqGold, reqRice] = this.getCost();

    logger.pushGeneralActionLog(
      `${this.srcArmTypeName} 숙련 ${cutDexText}${josaUl} ${this.destArmTypeName} 숙련 ${addDexText}${josaRo} 전환했습니다. <1>${date}</>`
    );

    general.addExperience(10);
    general.increaseVarWithLimit('gold', -reqGold, 0);
    general.increaseVarWithLimit('rice', -reqRice, 0);
    general.increaseVar('leadership_exp', 2);
    this.setResultTurn(new LastTurn(ConvertExpCommand.getName(), this.arg));
    general.checkStatChange();

    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      ConvertExpCommand,
      this.env,
      this.arg ?? {}
    );

    await general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    const general = this.generalObj;
    const ownDexList: any[] = [];
    
    for (const [armType, armName] of Object.entries((GameUnitConst as any).allType())) {
      ownDexList.push({
        armType: Number(armType),
        name: armName,
        amount: general.getVar('dex' + armType),
      });
    }

    const dexLevelList: any[] = [];
    const dexLevels: any[] = [];
    for (const [dexKey, color, name] of dexLevels) {
      dexLevelList.push({
        amount: dexKey,
        color,
        name
      });
    }

    return {
      procRes: {
        ownDexList,
        dexLevelList,
        decreaseCoeff: ConvertExpCommand.decreaseCoeff,
        convertCoeff: ConvertExpCommand.convertCoeff,
      }
    };
  }
}
