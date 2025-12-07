// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { nationRepository } from '../../repositories/nation.repository';

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
      ConstraintHelper.ReqCityTrader(this.generalObj.getNPCType()),
      ConstraintHelper.OccupiedCity(true),
      ConstraintHelper.SuppliedCity(),
    ];
  }

  protected initWithArg(): void {
    this.fullConditionConstraints = [
      ConstraintHelper.ReqCityTrader(this.generalObj.getNPCType()),
      ConstraintHelper.OccupiedCity(true),
      ConstraintHelper.SuppliedCity(),
    ];

    if (this.arg.buyRice) {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqGeneralGold(1)
      );
    } else {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqGeneralRice(1)
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
    
    if (!this.city) {
      throw new Error('도시 정보가 없습니다');
    }
    
    let tradeRate = this.city.trade;
    const buyRice = this.arg.buyRice;
    const exchangeFee = 0.05;

    if (tradeRate === null || tradeRate === undefined) {
      if (general.data.npc ?? general.npc ?? 0 >= 2) {
        tradeRate = 1.0;
      } else {
        throw new Error('Trade rate not available');
      }
    } else {
      tradeRate /= 100;
    }
    
    // 0으로 나누기 방지
    tradeRate = Math.max(0.01, tradeRate);

    let buyKey: string;
    let sellKey: string;
    let buyAmount: number;
    let sellAmount: number;
    let tax: number;

    if (buyRice) {
      buyKey = 'rice';
      sellKey = 'gold';
      sellAmount = Math.min(this.arg.amount * tradeRate, general.data.gold);
      tax = sellAmount * exchangeFee;
      if (sellAmount + tax > general.data.gold) {
        // 0으로 나누기 방지
        const denominator = Math.max(0.01, sellAmount + tax);
        sellAmount *= general.data.gold / denominator;
        tax = general.data.gold - sellAmount;
      }
      buyAmount = sellAmount / tradeRate;
      sellAmount += tax;
    } else {
      buyKey = 'gold';
      sellKey = 'rice';
      sellAmount = Math.min(this.arg.amount, general.data.rice);
      buyAmount = sellAmount * tradeRate;
      tax = buyAmount * exchangeFee;
      buyAmount -= tax;
    }

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);

    const buyAmountText = buyAmount.toLocaleString();
    const sellAmountText = sellAmount.toLocaleString();

    if (buyRice) {
      logger.pushGeneralActionLog(`군량 <C>${buyAmountText}</>을 사서 자금 <C>${sellAmountText}</>을 썼습니다. <1>${date}</>`);
    } else {
      logger.pushGeneralActionLog(`군량 <C>${sellAmountText}</>을 팔아 자금 <C>${buyAmountText}</>을 얻었습니다. <1>${date}</>`);
    }

    general.increaseVar(buyKey, buyAmount);
    general.increaseVarWithLimit(sellKey, -sellAmount, 0);

    const sessionId = general.getSessionID();
    const nationID = general.getNationID();
    const currentNation = await nationRepository.findByNationNum(sessionId, nationID);
    await nationRepository.updateByNationNum(sessionId, nationID, {
      gold: (currentNation?.gold || 0) + tax
    });

    const exp = 30;
    const ded = 50;

    const incStat = rng.choiceUsingWeight({
      'leadership_exp': general.getLeadership(false, false, false, false),
      'strength_exp': general.getStrength(false, false, false, false),
      'intel_exp': general.getIntel(false, false, false, false),
      'politics_exp': general.getPolitics(false, false, false, false),
      'charm_exp': general.getCharm(false, false, false, false)
    });

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(incStat, 1);

    this.setResultTurn(new LastTurn((this.constructor as typeof TradeMilitaryCommand).getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);

    await this.saveGeneral();

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
