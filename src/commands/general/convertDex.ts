import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameUnitConst } from '../../constants/GameUnitConst';
import { Util } from '../../utils/Util';
import { JosaUtil } from '../../utils/JosaUtil';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 숙련전환 커맨드
 * PHP: sammo/Command/General/che_숙련전환.php
 * 
 * 한 병과의 숙련도를 다른 병과로 전환합니다.
 * 원본 숙련의 40%를 차감하고, 그 중 90%를 목표 숙련에 추가합니다.
 */
export class ConvertDexCommand extends GeneralCommand {
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
    const name = ConvertDexCommand.getName();
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
    const develcost = this.env.develcost || 0;
    return [develcost, develcost];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!await this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();

    const srcDex = general.getVar('dex' + this.srcArmType);
    const cutDex = Util.toInt(srcDex * ConvertDexCommand.decreaseCoeff);
    const cutDexText = cutDex.toLocaleString();
    const addDex = Util.toInt(cutDex * ConvertDexCommand.convertCoeff);
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
    
    this.setResultTurn(new LastTurn(ConvertDexCommand.getName(), this.arg));
    general.checkStatChange();

    // 유니크 아이템 추첨
    await tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, ConvertDexCommand.actionName),
      general,
      this.env.session_id || 'default'
    );

    await general.applyDB();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const general = this.generalObj;
    const ownDexList = [];
    
    const allTypes = GameUnitConst.allType();
    for (const armType in allTypes) {
      const armName = allTypes[armType];
      ownDexList.push({
        armType: parseInt(armType),
        name: armName,
        amount: general.getVar('dex' + armType),
      });
    }

    // getDexLevelList 구현
    const dexLevelList = [
      { amount: 0, color: 'gray', name: '미숙' },
      { amount: 1000, color: 'white', name: '초급' },
      { amount: 5000, color: 'green', name: '중급' },
      { amount: 20000, color: 'blue', name: '상급' },
      { amount: 50000, color: 'purple', name: '달인' },
      { amount: 100000, color: 'orange', name: '명인' },
    ];

    return {
      procRes: {
        ownDexList,
        dexLevelList,
        decreaseCoeff: ConvertDexCommand.decreaseCoeff,
        convertCoeff: ConvertDexCommand.convertCoeff,
      }
    };
  }
}
