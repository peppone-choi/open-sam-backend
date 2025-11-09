// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';

export class DonateCommand extends GeneralCommand {
  protected static actionName = '헌납';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('isGold' in this.arg)) {
      return false;
    }
    if (!('amount' in this.arg)) {
      return false;
    }
    const isGold = this.arg.isGold;
    let amount = this.arg.amount;
    
    if (typeof amount !== 'number') {
      return false;
    }
    amount = Util.round(amount, -2);
    amount = Util.valueFit(amount, 100, GameConst.maxResourceActionAmount);
    if (amount <= 0) {
      return false;
    }
    
    if (typeof isGold !== 'boolean') {
      return false;
    }
    
    this.arg = {
      isGold,
      amount
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
    ];
  }

  protected initWithArg(): void {
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
    ];
    
    if (this.arg.isGold) {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqGeneralGold(GameConst.generalMinimumGold)
      );
    } else {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqGeneralRice(GameConst.generalMinimumRice)
      );
    }
  }

  public getBrief(): string {
    const resText = this.arg.isGold ? '금' : '쌀';
    const name = this.constructor.getName();
    return `${resText} ${this.arg.amount}을 ${name}`;
  }

  public getCommandDetailTitle(): string {
    return `${this.constructor.getName()}(통솔경험)`;
  }

  public getCost(): [number, number] {
    return [0, 0];
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

    const isGold = this.arg.isGold;
    let amount = this.arg.amount;
    const resKey = isGold ? 'gold' : 'rice';
    const resName = isGold ? '금' : '쌀';

    amount = Util.valueFit(amount, 0, general.getVar(resKey));
    const amountText = amount.toLocaleString();

    const logger = general.getLogger();

    await db.update('nation', {
      [resKey]: db.sqleval(`${resKey} + ?`, [amount])
    },  'nation=?', [general.getNationID()]);

    general.increaseVarWithLimit(resKey, -amount, 0);

    logger.pushGeneralActionLog(`${resName} <C>${amountText}</>을 헌납했습니다. <1>${date}</>`);

    const exp = 70;
    const ded = 100;

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);

    this.setResultTurn(new LastTurn(DonateCommand.getName(), this.arg));
    general.checkStatChange();

    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      DonateCommand,
      this.env,
      this.arg ?? {}
    );
    
    await await general.save();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    return {
      procRes: {
        minAmount: 100,
        maxAmount: GameConst.maxResourceActionAmount,
        amountGuide: GameConst.resourceActionAmountGuide,
      }
    };
  }
}

