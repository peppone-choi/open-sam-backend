import '../../utils/function-extensions';
import { NationCommand } from '../base/NationCommand';
import { DB } from '../../config/db';
import { LastTurn } from '../base/BaseCommand';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/constraint-helper';
import { General } from '../../models/General';
import { ActionLogger } from '../../models/ActionLogger';

export class che_불가침수락 extends NationCommand {
  static getName(): string {
    return '불가침 수락';
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

    if (!('destGeneralID' in this.arg)) return false;
    const destGeneralID = this.arg['destGeneralID'];
    if (typeof destGeneralID !== 'number') return false;
    if (destGeneralID <= 0) return false;
    if (destGeneralID === this.generalObj?.getID()) return false;

    if (!('year' in this.arg) || !('month' in this.arg)) return false;
    const year = this.arg['year'];
    const month = this.arg['month'];
    if (typeof year !== 'number' || typeof month !== 'number') return false;

    if (month < 1 || month > 12) return false;

    if (year < this.env['startyear']) return false;

    this.arg = { destNationID, destGeneralID, year, month };
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.permissionConstraints = [ConstraintHelper.AlwaysFail('예약 불가능 커맨드')];
  }

  protected async initWithArg(): Promise<void> {
    const env = this.env;

    const destGeneral = await (General as any).createObjFromDB(this.arg['destGeneralID']);
    this.setDestGeneral(destGeneral);
    this.setDestNation(this.arg['destNationID']);

    const year = this.arg['year'];
    const month = this.arg['month'];

    const currentMonth = env['year'] * 12 + env['month'] - 1;
    const reqMonth = year * 12 + month;

    if (reqMonth <= currentMonth) {
      this.fullConditionConstraints = [ConstraintHelper.AlwaysFail('이미 기한이 지났습니다.')];
      return;
    }

    this.fullConditionConstraints = [
      ConstraintHelper.BeChief(),
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.ExistsDestNation(),
      ConstraintHelper.ExistsDestGeneral(),
      ConstraintHelper.ReqDestNationValue(
        'nation',
        '소속',
        '==',
        this.destGeneralObj!.getNationID(),
        '제의 장수가 국가 소속이 아닙니다'
      ),
      ConstraintHelper.DisallowDiplomacyBetweenStatus({
        0: '아국과 이미 교전중입니다.',
        1: '아국과 이미 선포중입니다.'
      })
    ];
  }

  public canDisplay(): boolean {
    return false;
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
    const getNationStaticInfo = (global as any).getNationStaticInfo;
    const destNationName = getNationStaticInfo(this.arg['destNationID'])?.['name'] || '알 수 없음';
    const year = this.arg['year'];
    const month = this.arg['month'];
    return `${year}년 ${month}월까지 불가침 합의`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;

    const nation = this.nation;
    const nationID = nation['nation'];
    const nationName = nation['name'];

    const destNation = this.destNation;
    const destNationID = destNation['nation'];
    const destNationName = destNation['name'];

    const KVStorage = (global as any).KVStorage;
    const destNationStor = KVStorage.getStorage(db, destNationID, 'nation_env');
    const destRecvAssist = (destNationStor.getValue('recv_assist') as any) ?? {};
    const destRespAssist = (destNationStor.getValue('resp_assist') as any) ?? {};

    destRespAssist[`n${nationID}`] = [nationID, destRecvAssist[`n${nationID}`]?.[1] ?? 0];
    destNationStor.setValue('resp_assist', destRespAssist);

    const year = this.arg['year'];
    const month = this.arg['month'];

    const logger = general!.getLogger();
    const destLogger = this.destGeneralObj!.getLogger();

    const currentMonth = env['year'] * 12 + env['month'] - 1;
    const reqMonth = year * 12 + month;

    await db.update(
      'diplomacy',
      { state: 7, term: reqMonth - currentMonth },
      '(me=%i AND you=%i) OR (you=%i AND me=%i)',
      [nationID, destNationID, nationID, destNationID]
    );

    const josaWa = JosaUtil.pick(destNationName, '와');
    logger.pushGeneralActionLog(
      `<D><b>${destNationName}</b></>${josaWa} <C>${year}</>년 <C>${month}</>월까지 불가침에 성공했습니다.`,
      ActionLogger.PLAIN
    );
    logger.pushGeneralHistoryLog(
      `<D><b>${destNationName}</b></>${josaWa} ${year}년 ${month}월까지 불가침 성공`
    );

    const josaWaSrc = JosaUtil.pick(nationName, '와');
    destLogger.pushGeneralActionLog(
      `<D><b>${nationName}</b></>${josaWaSrc} <C>${year}</>년 <C>${month}</>월까지 불가침에 성공했습니다.`,
      ActionLogger.PLAIN
    );
    destLogger.pushGeneralHistoryLog(
      `<D><b>${nationName}</b></>${josaWaSrc} ${year}년 ${month}월까지 불가침 성공`
    );

    await general!.applyDB(db);
    await destLogger.flush();

    return true;
  }
}
