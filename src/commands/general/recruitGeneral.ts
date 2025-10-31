import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';

/**
 * 장수를 따라 임관 커맨드
 * 
 * 재야 장수가 특정 장수가 속한 국가로 임관합니다.
 */
export class RecruitGeneralCommand extends GeneralCommand {
  protected static actionName = '장수를 따라 임관';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destGeneralID = this.arg.destGeneralID;

    if (destGeneralID === null || destGeneralID === undefined) {
      return false;
    }

    if (typeof destGeneralID !== 'number') {
      return false;
    }
    if (destGeneralID < 1) {
      return false;
    }
    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }

    this.arg = {
      destGeneralID,
    };

    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const relYear = this.env.year - this.env.startyear;

    this.permissionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom')
    ];

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
      // BeNeutral(),
      // AllowJoinAction()
    ];
  }

  public getCommandDetailTitle(): string {
    return '장수를 따라 임관';
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  protected async initWithArg(): Promise<void> {
    const destGeneralID = this.arg.destGeneralID;
    // const destGeneral = await General.findById(destGeneralID);
    // this.setDestGeneral(destGeneral);
    // this.setDestNation(this.destGeneralObj.getVar('nation'), ['gennum', 'scout']);

    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
      // BeNeutral(),
      // ExistsDestNation(),
      // AllowJoinDestNation(relYear),
      // AllowJoinAction()
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
    const destGeneralName = this.destGeneralObj.getName();
    return `【${destGeneralName}】을 따라 임관`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const generalName = general.getName();

    const destNation = this.destNation;
    const gennum = destNation.gennum;
    const destNationID = destNation.nation;
    const destNationName = destNation.name;

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`<D>${destNationName}</>에 임관했습니다. <1>${date}</>`);
    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>에 임관`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 <D><b>${destNationName}</b></>에 <S>임관</>했습니다.`);

    let exp: number;
    const initialNationGenLimit = 6; // GameConst::$initialNationGenLimit
    if (gennum < initialNationGenLimit) {
      exp = 700;
    } else {
      exp = 100;
    }

    general.setVar('nation', destNationID);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.setVar('belong', 1);

    if (this.destGeneralObj !== null) {
      general.setVar('city', this.destGeneralObj.getCityID());
    } else {
      const targetCityID = await (db as any)('general')
        .where('nation', destNationID)
        .where('officer_level', 12)
        .first()
        .then((r: any) => r?.city);
      general.setVar('city', targetCityID);
    }

    await (db as any)('nation')
      .where('nation', destNationID)
      .update({
        gennum: (db as any).raw('gennum + 1'),
      });

    // TODO: refreshNationStaticInfo
    // TODO: InheritancePoint
    general.addExperience(exp);
    this.setResultTurn(new LastTurn(RecruitGeneralCommand.getName(), this.arg));
    general.checkStatChange();
    // TODO: StaticEventHandler
    // TODO: tryUniqueItemLottery
    general.applyDB(db);

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const db = DB.db();
    const destRawGenerals = await (db as any)('general')
      .where('no', '!=', this.generalObj.getID())
      .orderBy(['npc', (db as any).raw('BINARY(name)')])
      .select('no', 'name', 'nation', 'officer_level', 'npc', 'leadership', 'strength', 'intel');

    // TODO: 국가 목록 및 스카우트 메시지

    return {
      procRes: {
        nationList: [],
        generals: destRawGenerals,
        generalsKey: ['no', 'name', 'nationID', 'officerLevel', 'npc', 'leadership', 'strength', 'intel'],
      },
    };
  }
}
