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

export class che_몰수 extends NationCommand {
  static getName(): string {
    return '몰수';
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

    const relYear = this.env['year'] - this.env['startyear'];

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotOpeningPart(relYear),
      ConstraintHelper.SuppliedCity()
    ];
  }

  protected async initWithArg(): Promise<void> {
    // TODO: Legacy method - const destGeneral = await General.createObjFromDB(this.arg['destGeneralID']);
    // Use generalRepository.findById() instead
    this.setDestGeneral(destGeneral);

    const relYear = this.env['year'] - this.env['startyear'];

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
      ConstraintHelper.NotOpeningPart(relYear),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.FriendlyDestGeneral()
    ];
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

    amount = Math.max(0, Math.min(amount, destGeneral!.getVar(resKey)));
    const amountText = amount.toLocaleString();

    if (destGeneral!.getNPCType() >= 2 && rng.nextBool(GameConst.npcSeizureMessageProb)) {
      const npcTexts = [
        '몰수를 하다니... 이것이 윗사람이 할 짓이란 말입니까...',
        '사유재산까지 몰수해가면서 이 나라가 잘 될거라 믿습니까? 정말 이해할 수가 없군요...',
        '내 돈 내놔라! 내 돈! 몰수가 웬 말이냐!',
        '몰수해간 내 자금... 언젠가 몰래 다시 빼내올 것이다...',
        '몰수로 인한 사기 저하는 몰수로 얻은 물자보다 더 손해란걸 모른단 말인가!'
      ];
      const text = rng.choice(npcTexts);

      const { Message } = await import('../../core/message/Message');
      const { MessageTarget } = await import('../../core/message/MessageTarget');
      const { GetImageURL } = await import('../../func');
      const src = new MessageTarget(
        destGeneral!.getID(),
        destGeneral!.getName(),
        nationID,
        nation['name'],
        nation['color'],
        GetImageURL(destGeneral!.getVar('imgsvr'), destGeneral!.getVar('picture'))
      );

      await Message.send(src, src, text, new Date(), new Date('9999-12-31'), []);
    }

    const logger = general!.getLogger();

    destGeneral!.increaseVarWithLimit(resKey, -amount, 0);
    await db.update(
      'nation',
      { [resKey]: db.sqleval('%b + %i', [resKey, amount]) },
      'nation=%i',
      [nationID]
    );

    const josaUl = JosaUtil.pick(amountText, '을');

    destGeneral!.getLogger().pushGeneralActionLog(
      `${resName} ${amountText}${josaUl} 몰수 당했습니다.` as any
    );
    logger.pushGeneralActionLog(
      `<Y>${destGeneral!.getName()}</>에게서 ${resName} <C>${amountText}</>${josaUl} 몰수했습니다. <1>${date}</>` as any
    );

    this.setResultTurn(new LastTurn(this.constructor.getName(), this.arg));
    await general!.applyDB(db);
    await destGeneral!.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    // TODO: Legacy DB access - const db = DB.db();
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
