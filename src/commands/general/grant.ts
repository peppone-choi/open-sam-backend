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
import { General } from '../../models/general.model';
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

  protected initWithArg(): void {
    const { isGold } = this.arg;

    // PHP che_증여와 동일한 제약 구성
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.FriendlyDestGeneral(),
    ];

    // 최소 자원 보유량 체크 (GameConst.generalMinimumGold/Rice 사용)
    if (isGold) {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqGeneralGold(GameConst.generalMinimumGold)
      );
    } else {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqGeneralRice(GameConst.generalMinimumRice)
      );
    }
  }
  
  // 비동기로 destGeneral 설정하는 헬퍼 메서드
  private async setDestGeneralAsync(destGeneralID: number): Promise<void> {
    try {
      const destGeneral = await generalRepository.findById(destGeneralID);
      this.setDestGeneral(destGeneral);
    } catch (error) {
      console.error('setDestGeneralAsync 실패:', error);
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
    // PHP에서는 initWithArg()에서 destGeneral를 동기 로드하지만,
    // TS에서는 비동기이므로 run 시작 시 한 번 더 보장해준다.
    if (!this.destGeneralObj) {
      await this.setDestGeneralAsync(this.arg.destGeneralID);
    }

    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }


    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime(general.TURNTIME_HM);


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
      (general.data[resKey] ?? 0) - (isGold ? GameConst.generalMinimumGold : GameConst.generalMinimumRice)
    );
    const amountText = amount.toLocaleString();

    const logger = general.getLogger();

    destGeneral.increaseVarWithLimit(resKey, amount);
    general.increaseVarWithLimit(resKey, -amount, 0);

    destGeneral.getLogger().pushGeneralActionLog(
      `<Y>${general.data.name || general.name}</>에게서 ${resName} <C>${amountText}</>을 증여 받았습니다.`, 
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

    // TODO: PHP che_증여에서는 tryUniqueItemLottery 호출
    // TS에서는 공통 유니크 아이템 추첨 유틸을 사용하도록 후속 마이그레이션 예정
    
    await this.saveGeneral();
    await destGeneral.save?.();


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
        // TODO: JSOptionsForCities 대체 구현 필요
        cities: await global.JSOptionsForCities?.(),

        minAmount: 100,
        maxAmount: GameConst.maxResourceActionAmount,
        amountGuide: GameConst.resourceActionAmountGuide,
      }
    };
  }
}
