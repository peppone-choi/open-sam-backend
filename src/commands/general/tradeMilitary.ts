import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 군량 매매 커맨드
 * 
 * 군량과 자금을 교환합니다.
 */
export class TradeMilitaryCommand extends GeneralCommand {
  protected static actionName = '군량매매';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    const buyRice = this.arg.buyRice;
    if (typeof buyRice !== 'boolean') {
      return false;
    }
    let amount = this.arg.amount;
    if (typeof amount !== 'number') {
      return false;
    }
    
    amount = Math.round(amount / 100) * 100;
    const maxResourceActionAmount = 100000;
    amount = Math.max(100, Math.min(maxResourceActionAmount, amount));
    
    if (amount <= 0) {
      return false;
    }
    
    this.arg = {
      buyRice,
      amount
    };
    return true;
  }

  public getBrief(): string {
    const buyRiceText = this.arg.buyRice ? '구입' : '판매';
    return `군량 ${this.arg.amount}을 ${buyRiceText}`;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqCityTrader(general.getNPCType()),
      // OccupiedCity(true),
      // SuppliedCity(),
    ];
  }

  protected async initWithArg(): Promise<void> {
    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqCityTrader(general.getNPCType()),
      // OccupiedCity(true),
      // SuppliedCity(),
    ];

    if (this.arg.buyRice) {
      this.fullConditionConstraints.push(
        // TODO: ReqGeneralGold(1)
      );
    } else {
      this.fullConditionConstraints.push(
        // TODO: ReqGeneralRice(1)
      );
    }
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

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    let tradeRate = this.city.trade;
    const buyRice = this.arg.buyRice;
    const exchangeFee = 0.05;

    if (tradeRate === null || tradeRate === undefined) {
      if (general.getNPCType() >= 2) {
        tradeRate = 1.0;
      } else {
        throw new Error('Trade rate not available');
      }
    } else {
      tradeRate /= 100;
    }

    let buyKey: string;
    let sellKey: string;
    let buyAmount: number;
    let sellAmount: number;
    let tax: number;

    if (buyRice) {
      buyKey = 'rice';
      sellKey = 'gold';
      sellAmount = Math.min(this.arg.amount * tradeRate, general.getVar('gold'));
      tax = sellAmount * exchangeFee;
      if (sellAmount + tax > general.getVar('gold')) {
        sellAmount *= general.getVar('gold') / (sellAmount + tax);
        tax = general.getVar('gold') - sellAmount;
      }
      buyAmount = sellAmount / tradeRate;
      sellAmount += tax;
    } else {
      buyKey = 'gold';
      sellKey = 'rice';
      sellAmount = Math.min(this.arg.amount, general.getVar('rice'));
      buyAmount = sellAmount * tradeRate;
      tax = buyAmount * exchangeFee;
      buyAmount -= tax;
    }

    const logger = general.getLogger();

    const buyAmountText = buyAmount.toLocaleString();
    const sellAmountText = sellAmount.toLocaleString();

    if (buyRice) {
      logger.pushGeneralActionLog(`군량 <C>${buyAmountText}</>을 사서 자금 <C>${sellAmountText}</>을 썼습니다.`);
    } else {
      logger.pushGeneralActionLog(`군량 <C>${sellAmountText}</>을 팔아 자금 <C>${buyAmountText}</>을 얻었습니다.`);
    }

    general.increaseVar(buyKey, buyAmount);
    general.increaseVarWithLimit(sellKey, -sellAmount, 0);

    const nationUpdated = {
      gold: await db.sqleval('gold + %i', tax)
    };
    await db.update('nation', nationUpdated, 'nation=%i', general.getNationID());

    const exp = 30;
    const ded = 50;

    const incStat = rng.choiceUsingWeight({
      'leadership_exp': general.getLeadership(false, false, false, false),
      'strength_exp': general.getStrength(false, false, false, false),
      'intel_exp': general.getIntel(false, false, false, false)
    });

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(incStat, 1);

    this.setResultTurn(new LastTurn((this.constructor as typeof TradeMilitaryCommand).getName(), this.arg));
    general.checkStatChange();

    // TODO: StaticEventHandler, tryUniqueItemLottery

    general.applyDB(db);

    return true;
  }

  public exportJSVars(): any {
    const maxResourceActionAmount = 100000;
    const resourceActionAmountGuide = 5000;
    
    return {
      procRes: {
        minAmount: 100,
        maxAmount: maxResourceActionAmount,
        amountGuide: resourceActionAmountGuide,
      }
    };
  }
}
