// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { generalRepository } from '../../repositories/general.repository';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { GameConst } from '../../constants/GameConst';
import { LastTurn } from '../../types/LastTurn';
import { RandUtil } from '../../utils/RandUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { General } from '../../models/General';
import { ActionLogger } from '../../utils/ActionLogger';

export class GrantCommand extends GeneralCommand {
  protected static actionName = '증여';
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
    if (!('destGeneralID' in this.arg)) {
      return false;
    }
    
    const isGold = this.arg.isGold;
    let amount = this.arg.amount;
    const destGeneralID = this.arg.destGeneralID;
    
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
    
    if (typeof destGeneralID !== 'number' || !Number.isInteger(destGeneralID)) {
      return false;
    }
    if (destGeneralID <= 0) {
      return false;
    }
    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }
    
    this.arg = {
      isGold,
      amount,
      destGeneralID
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

  protected async initWithArg(): Promise<void> {
    const destGeneral = await generalRepository.findById(this.arg.destGeneralID);
    this.setDestGeneral(destGeneral);

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.FriendlyDestGeneral()
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

  public getBrief(): string {
    const destGeneralName = this.destGeneralObj?.getName() || '???';
    const resText = this.arg.isGold ? '금' : '쌀';
    const name = this.constructor.getName();
    return `【${destGeneralName}】에게 ${resText} ${this.arg.amount}을 ${name}`;
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
    const destGeneral = this.destGeneralObj;

    if (!destGeneral) {
      throw new Error('대상 장수가 존재하지 않습니다');
    }

    amount = Util.valueFit(
      amount, 
      0, 
      general.getVar(resKey) - (isGold ? GameConst.generalMinimumGold : GameConst.generalMinimumRice)
    );
    const amountText = amount.toLocaleString();

    const logger = general.getLogger();

    destGeneral.increaseVarWithLimit(resKey, amount);
    general.increaseVarWithLimit(resKey, -amount, 0);

    destGeneral.getLogger().pushGeneralActionLog(
      `<Y>${general.getName()}</>에게서 ${resName} <C>${amountText}</>을 증여 받았습니다.`, 
      ActionLogger.PLAIN
    );
    logger.pushGeneralActionLog(
      `<Y>${destGeneral.getName()}</>에게 ${resName} <C>${amountText}</>을 증여했습니다. <1>${date}</>`
    );

    const exp = 70;
    const ded = 100;

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);

    this.setResultTurn(new LastTurn(GrantCommand.getName(), this.arg));
    general.checkStatChange();
    
    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      GrantCommand,
      this.env,
      this.arg ?? {}
    );

    await await this.saveGeneral();
    await await destGeneral.save();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const db = DB.db();
    const nationID = this.getNationID();
    
    const troops = await db.query('SELECT * FROM troop WHERE nation=?', [nationID]);
    const troopsDict = Util.convertArrayToDict(troops, 'troop_leader');
    
    const destRawGenerals = await db.queryAllLists(
      'SELECT no,name,officer_level,npc,gold,rice,leadership,strength,intel,city,crew,train,atmos,troop FROM general WHERE nation = ? ORDER BY npc,binary(name)', 
      [nationID]
    );
    
    return {
      procRes: {
        troops: troopsDict,
        generals: destRawGenerals,
        generalsKey: ['no', 'name', 'officerLevel', 'npc', 'gold', 'rice', 'leadership', 'strength', 'intel', 'cityID', 'crew', 'train', 'atmos', 'troopID'],
        cities: await global.JSOptionsForCities(),
        minAmount: 100,
        maxAmount: GameConst.maxResourceActionAmount,
        amountGuide: GameConst.resourceActionAmountGuide,
      }
    };
  }
}
