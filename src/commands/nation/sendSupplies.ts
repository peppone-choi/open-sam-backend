// @ts-nocheck - Legacy db usage needs migration to Mongoose
import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { ActionLogger } from '../../models/ActionLogger';
import { GameConst } from '../../const/GameConst';
import { Util } from '../../utils/Util';

export class che_물자원조 extends NationCommand {
  static getName(): string {
    return '원조';
  }

  static getCategory(): string {
    return 'nation';
  }

  static get reqArg(): boolean {
    return true;
  }

  protected argTest(): boolean {
    if (this.arg === null) return false;

    if (!('destNationID' in this.arg)) return false;
    const destNationID = this.arg['destNationID'];
    if (typeof destNationID !== 'number') return false;
    if (destNationID < 1) return false;

    if (!('amountList' in this.arg)) return false;
    const amountList = this.arg['amountList'];
    if (!Array.isArray(amountList)) return false;
    if (amountList.length !== 2) return false;

    const [goldAmount, riceAmount] = amountList;
    if (typeof goldAmount !== 'number' || typeof riceAmount !== 'number') return false;
    if (goldAmount < 0 || riceAmount < 0) return false;
    if (goldAmount === 0 && riceAmount === 0) return false;

    this.arg = {
      destNationID,
      amountList: [goldAmount, riceAmount]
    };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation(['gold', 'rice', 'surlimit']);

    this.minConditionConstraints = [
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ReqNationValue('surlimit', '외교제한', '==', 0, '외교제한중입니다.')
    ];
  }

  protected async initWithArg(): Promise<void> {
    const destNationID = this.arg['destNationID'];
    this.setDestNation(destNationID, ['gold', 'rice', 'surlimit']);

    const [goldAmount, riceAmount] = this.arg['amountList'];
    const limit = this.nation['level'] * GameConst.coefAidAmount;

    if (goldAmount > limit || riceAmount > limit) {
      this.fullConditionConstraints = [
        ConstraintHelper.AlwaysFail('작위 제한량 이상은 보낼 수 없습니다.')
      ];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.BeChief(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.DifferentDestNation(),
      ConstraintHelper.ReqNationGold(GameConst.basegold + (goldAmount > 0 ? 1 : 0)),
      ConstraintHelper.ReqNationRice(GameConst.baserice + (riceAmount > 0 ? 1 : 0)),
      ConstraintHelper.ReqNationValue('surlimit', '외교제한', '==', 0, '외교제한중입니다.'),
      ConstraintHelper.ReqDestNationValue('surlimit', '외교제한', '==', 0, '상대국이 외교제한중입니다.')
    ];
  }

  public getCost(): [number, number] {
    return [0, 0];
  }

  public getPreReqTurn(): number {
    return 0;
  }

  public getPostReqTurn(): number {
    return 12;
  }

  public getBrief(): string {
    const [goldAmount, riceAmount] = this.arg['amountList'];
    const goldAmountText = goldAmount.toLocaleString();
    const riceAmountText = riceAmount.toLocaleString();
    const getNationStaticInfo = global.getNationStaticInfo;
    const destNationName = getNationStaticInfo(this.arg['destNationID'])?.['name'] || '알 수 없음';
    const commandName = this.constructor.getName();
    return `【${destNationName}】에게 국고 ${goldAmountText} 병량 ${riceAmountText} ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();

    const general = this.generalObj;
    if (!general) {
      throw new Error('장수 정보가 없습니다');
    }
    const generalID = general!.getID();
    const date = general!.getTurnTime('HM');

        if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

    const destNationID = this.destNation['nation'];
    const destNationName = this.destNation['name'];

    let [goldAmount, riceAmount] = this.arg['amountList'];

    goldAmount = Util.valueFit(goldAmount, 0, nation['gold'] - GameConst.basegold);
    riceAmount = Util.valueFit(riceAmount, 0, nation['rice'] - GameConst.baserice);

    const goldAmountText = goldAmount.toLocaleString();
    const riceAmountText = riceAmount.toLocaleString();

    const logger = general!.getLogger();

    const year = this.env['year'];
    const month = this.env['month'];

    const josaRo = JosaUtil.pick(destNationName, '로');

    const broadcastMessage = `<D><b>${destNationName}</b></>${josaRo} 금<C>${goldAmountText}</> 쌀<C>${riceAmountText}</>을 지원했습니다.`;

    const chiefList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE officer_level >= 5 AND no != %i AND nation = %i',
      [generalID, nationID]
    );
    for (const chiefID of chiefList) {
      const chiefLogger = new ActionLogger(chiefID as number, nationID, year, month);
      chiefLogger.pushGeneralActionLog(broadcastMessage, ActionLogger.PLAIN);
      await chiefLogger.flush();
    }

    const josaUlRiceAmount = JosaUtil.pick(riceAmountText, '을');

    logger.pushGeneralHistoryLog(
      `<D><b>${destNationName}</b></>${josaRo} 금<C>${goldAmountText}</> 쌀<C>${riceAmountText}</>${josaUlRiceAmount} 지원`
    );
    logger.pushNationalHistoryLog(
      `<D><b>${destNationName}</b></>${josaRo} 금<C>${goldAmountText}</> 쌀<C>${riceAmountText}</>${josaUlRiceAmount} 지원`
    );
    logger.pushGlobalHistoryLog(
      `<Y><b>【원조】</b></><D><b>${nationName}</b></>에서 <D><b>${destNationName}</b></>${josaRo} 물자를 지원합니다`
    );

    logger.pushGeneralActionLog(broadcastMessage);
    logger.pushGeneralActionLog(
      `<D><b>${destNationName}</b></>${josaRo} 물자를 지원합니다. <1>${date}</>`
    );

    const destBroadcastMessage = `<D><b>${nationName}</b></>에서 금<C>${goldAmountText}</> 쌀<C>${riceAmountText}</>${josaUlRiceAmount} 원조했습니다.`;
    const destChiefList = await db.queryFirstColumn(
      'SELECT no FROM general WHERE officer_level >= 5 AND nation = %i',
      [destNationID]
    );
    for (const destChiefID of destChiefList) {
      const destChiefLogger = new ActionLogger(destChiefID as number, nationID, year, month);
      destChiefLogger.pushGeneralActionLog(destBroadcastMessage, ActionLogger.PLAIN);
      await destChiefLogger.flush();
    }

    const josaRoSrc = JosaUtil.pick(nationName, '로');
    const destNationLogger = new ActionLogger(0, destNationID, year, month);
    destNationLogger.pushNationalHistoryLog(
      `<D><b>${nationName}</b></>${josaRoSrc}부터 금<C>${goldAmountText}</> 쌀<C>${riceAmountText}</>${josaUlRiceAmount} 지원 받음`
    );
    await destNationLogger.flush();

    const KVStorage = global.KVStorage;
    const destNationStor = KVStorage.getStorage(db, destNationID, 'nation_env');
    const destRecvAssist = (destNationStor.getValue('recv_assist') as any) ?? {};
    destRecvAssist[`n${nationID}`] = [
      nationID,
      (destRecvAssist[`n${nationID}`]?.[1] ?? 0) + goldAmount + riceAmount
    ];
    destNationStor.setValue('recv_assist', destRecvAssist);

    await db.update(
      'nation',
      {
        gold: db.sqleval('gold - %i', [goldAmount]),
        rice: db.sqleval('rice - %i', [riceAmount]),
        surlimit: db.sqleval('surlimit + %i', [this.getPostReqTurn()])
      },
      'nation = %i',
      [nationID]
    );

    await db.update(
      'nation',
      {
        gold: db.sqleval('gold + %i', [goldAmount]),
        rice: db.sqleval('rice + %i', [riceAmount])
      },
      'nation = %i',
      [destNationID]
    );

    general.addExperience(5);
    general.addDedication(5);

    this.setResultTurn(new LastTurn(che_물자원조.getName(), this.arg));
    await general.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationList = [];
    const getAllNationStaticInfo = global.getAllNationStaticInfo;
    const getNationStaticInfo = global.getNationStaticInfo;

    for (const destNation of getAllNationStaticInfo()) {
      const nationTarget: any = {
        id: destNation['nation'],
        name: destNation['name'],
        color: destNation['color'],
        power: destNation['power']
      };

      if (nationTarget['id'] === generalObj!.getNationID()) {
        nationTarget['notAvailable'] = true;
      }

      nationList.push(nationTarget);
    }

    const currentNationLevel = getNationStaticInfo(this.generalObj.getNationID())['level'];

    const getNationLevelList = global.getNationLevelList;
    const levelInfo: any = {};
    const nationLevelList = getNationLevelList() as any;
    for (const level in nationLevelList) {
      const [levelText] = nationLevelList[level];
      const levelNum = Number(level);
      if (isNaN(levelNum)) {
        console.warn(`Invalid level: ${level}`);
        continue;
      }
      levelInfo[level] = {
        text: levelText,
        amount: levelNum * GameConst.coefAidAmount
      };
    }

    const amountGuide = [];
    for (let nationLevel = 1; nationLevel <= currentNationLevel + 1; nationLevel++) {
      amountGuide.push(nationLevel * GameConst.coefAidAmount);
    }

    return {
      procRes: {
        nationList,
        currentNationLevel,
        levelInfo,
        minAmount: 1000,
        maxAmount: amountGuide[amountGuide.length - 1],
        amountGuide
      }
    };
  }
}