// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';

/**
 * 군량매매 커맨드
 * 
 * 도시의 교역율을 이용하여 군량과 금을 교환합니다.
 */
export class TradeRiceCommand extends GeneralCommand {
  protected static actionName = '군량매매';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    const buyRice = this.arg.buyRice ?? null;
    if (typeof buyRice !== 'boolean') {
      return false;
    }
    let amount = this.arg.amount ?? null;
    if (typeof amount !== 'number') {
      return false;
    }
    amount = Util.round(amount, -2);
    amount = Util.valueFit(amount, 100, GameConst.maxResourceActionAmount);
    if (amount <= 0) {
      return false;
    }
    this.arg = {
      buyRice: Boolean(buyRice),
      amount: amount
    };
    return true;
  }

  public getBrief(): string {
    const buyRiceText = this.arg.buyRice ? '구입' : '판매';
    return `군량 ${this.arg.amount}을(를) ${buyRiceText}`;
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
      this.fullConditionConstraints.push(ConstraintHelper.ReqGeneralGold(1));
    } else {
      this.fullConditionConstraints.push(ConstraintHelper.ReqGeneralRice(1));
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
    
    const tradeRate = this.city.trade;
    const date = general.getTurnTime(general.TURNTIME_HM);

    const buyRice = this.arg.buyRice;

    let actualTradeRate: number;
    if (tradeRate === null) {
      if (general.data.npc ?? general.npc ?? 0 >= 2) {
        actualTradeRate = 1.0;
      } else {
        throw new Error('교역율이 설정되지 않았습니다.');
      }
    } else {
      actualTradeRate = tradeRate / 100;
    }
    
    // 0으로 나누기 방지
    actualTradeRate = Math.max(0.01, actualTradeRate);

    let buyKey: string;
    let sellKey: string;
    let buyAmount: number;
    let sellAmount: number;
    let tax: number;

    if (buyRice) {
      buyKey = 'rice';
      sellKey = 'gold';
      sellAmount = Util.valueFit(this.arg.amount * actualTradeRate, null, general.data.gold);
      tax = sellAmount * GameConst.exchangeFee;
      if (sellAmount + tax > general.data.gold) {
        // 0으로 나누기 방지
        const denominator = Math.max(0.01, sellAmount + tax);
        sellAmount *= general.data.gold / denominator;
        tax = general.data.gold - sellAmount;
      }
      buyAmount = sellAmount / actualTradeRate;
      sellAmount += tax;
    } else {
      buyKey = 'gold';
      sellKey = 'rice';
      sellAmount = Util.valueFit(this.arg.amount, null, general.data.rice);
      buyAmount = sellAmount * actualTradeRate;
      tax = buyAmount * GameConst.exchangeFee;
      buyAmount -= tax;
    }

    const logger = general.getLogger();

    const buyAmountText = Util.numberFormat(buyAmount);
    const sellAmountText = Util.numberFormat(sellAmount);

    if (buyRice) {
      logger.pushGeneralActionLog(`군량 <C>${buyAmountText}</>을(를) 사서 자금 <C>${sellAmountText}</>을(를) 썼습니다. <1>${date}</>`);
    } else {
      logger.pushGeneralActionLog(`군량 <C>${sellAmountText}</>을(를) 팔아 자금 <C>${buyAmountText}</>을(를) 얻었습니다. <1>${date}</>`);
    }

    general.increaseVar(buyKey, buyAmount);
    general.increaseVarWithLimit(sellKey, -sellAmount, 0);

    await db.update(
      'nation',
      {
        gold: db.raw(`gold + ${tax}`)
      },
      'nation = ?',
      general.getNationID()
    );

    const exp = 30;
    const ded = 50;

    const stats = {
      leadership_exp: general.getLeadership(false, false, false, false),
      strength_exp: general.getStrength(false, false, false, false),
      intel_exp: general.getIntel(false, false, false, false),
      politics_exp: general.getPolitics(false, false, false, false),
      charm_exp: general.getCharm(false, false, false, false)
    };

    const incStat = rng.choiceUsingWeight(stats);
    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar(incStat, 1);

    this.setResultTurn(new LastTurn(TradeRiceCommand.getName(), this.arg));
    general.checkStatChange();

    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);

    await this.saveGeneral();

    return true;
  }

  public exportJSVars(): Record<string, any> {
    return {
      procRes: {
        minAmount: 100,
        maxAmount: GameConst.maxResourceActionAmount,
        amountGuide: GameConst.resourceActionAmountGuide,
      }
    };
  }
}

