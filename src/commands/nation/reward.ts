import '../../utils/function-extensions';
import { generalRepository } from '../../repositories/general.repository';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { General } from '../../models/General';
import { Util } from '../../utils/Util';
import { GameConst } from '../../const/GameConst';

export class che_포상 extends NationCommand {
  static getName(): string {
    return '포상';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('isGold' in this.arg)) return false;
    if (!('amount' in this.arg)) return false;
    if (!('destGeneralID' in this.arg)) return false;

    const isGold = this.arg['isGold'];
    let amount = this.arg['amount'];
    const destGeneralID = this.arg['destGeneralID'];

    if (typeof amount !== 'number') return false;
    amount = Math.round(amount / 100) * 100;
    amount = Math.max(100, Math.min(amount, GameConst.maxResourceActionAmount));
    if (amount <= 0) return false;
    if (typeof isGold !== 'boolean') return false;
    if (typeof destGeneralID !== 'number') return false;
    if (destGeneralID <= 0) return false;

    this.arg = { isGold, amount, destGeneralID };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gold', 'rice']);

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity()
    ];
  }

  protected async initWithArg(): Promise<void> {
    // TODO: Legacy method - const destGeneral = await General.createObjFromDB(this.arg['destGeneralID']);
    // Use generalRepository.findById() instead
    this.setDestGeneral(destGeneral);

    if (this.arg['destGeneralID'] === this.getGeneral()?.getID()) {
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('본인입니다')
      ];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.FriendlyDestGeneral()
    ];

    if (this.arg['isGold']) {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqNationGold(1 + GameConst.basegold)
      );
    } else {
      this.fullConditionConstraints.push(
        ConstraintHelper.ReqNationRice(1 + GameConst.baserice)
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

  public getBrief(): string {
    const isGold = this.arg['isGold'];
    const amount = this.arg['amount'];
    const amountText = amount.toLocaleString();
    const resName = isGold ? '금' : '쌀';
    const destGeneral = this.destGeneralObj;
    const commandName = this.constructor.getName();
    return `【${destGeneral?.getName()}】 ${resName} ${amountText} ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();

    const general = this.generalObj;
    const date = general!.getTurnTime('HM');

    const nation = this.nation;
    const nationID = nation['nation'];

    const isGold = this.arg['isGold'];
    let amount = this.arg['amount'];
    const resKey = isGold ? 'gold' : 'rice';
    const resName = isGold ? '금' : '쌀';
    const destGeneral = this.destGeneralObj;

    amount = Math.max(
      0,
      Math.min(amount, nation[resKey] - (isGold ? GameConst.basegold : GameConst.baserice))
    );
    const amountText = amount.toLocaleString();

    const logger = general!.getLogger();

    destGeneral!.increaseVar(resKey, amount);
    await db.update(
      'nation',
      { [resKey]: db.sqleval('%b - %i', resKey, amount) },
      'nation=%i',
      [nationID]
    );

    const josaUl = JosaUtil.pick(amountText, '을');

    destGeneral!.getLogger().pushGeneralActionLog(
      `${resName} <C>${amountText}</>${josaUl} 포상으로 받았습니다.`,
      0
    );
    logger.pushGeneralActionLog(
      `<Y>${destGeneral!.getName()}</>에게 ${resName} <C>${amountText}</>${josaUl} 수여했습니다. <1>${date}</>`
    );

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await general!.applyDB(db);
    await destGeneral!.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    // TODO: Legacy DB access - const db = DB.db();
    const nationID = this.getNationID();
    const troops = await db.query('SELECT * FROM troop WHERE nation=%i', [nationID]);
    const troopsDict = Util.convertArrayToDict(troops, 'troop_leader');
    const destRawGenerals = await db.queryAllLists(
      'SELECT no,name,officer_level,npc,gold,rice,leadership,strength,intel,city,crew,train,atmos,troop FROM general WHERE nation = %i ORDER BY npc,binary(name)',
      [nationID]
    );

    return {
      procRes: {
        troops: troopsDict,
        generals: destRawGenerals,
        generalsKey: [
          'no',
          'name',
          'officerLevel',
          'npc',
          'gold',
          'rice',
          'leadership',
          'strength',
          'intel',
          'cityID',
          'crew',
          'train',
          'atmos',
          'troopID'
        ],
        cities: await global.JSOptionsForCities(),
        minAmount: 100,
        maxAmount: GameConst.maxResourceActionAmount,
        amountGuide: GameConst.resourceActionAmountGuide
      }
    };
  }
}
