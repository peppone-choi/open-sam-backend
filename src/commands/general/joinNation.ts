// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';

/**
 * 임관 커맨드
 * 
 * 재야 장수가 특정 국가를 선택하여 임관합니다.
 */
export class JoinNationCommand extends GeneralCommand {
  protected static actionName = '임관';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    const destNationID = this.arg.destNationID;

    if (destNationID === null || destNationID === undefined) {
      return false;
    }

    if (typeof destNationID !== 'number') {
      return false;
    }
    if (destNationID < 1) {
      return false;
    }

    this.arg = {
      destNationID,
    };

    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const relYear = this.env.year - this.env.startyear;

    this.permissionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom', '랜덤 임관만 가능합니다')
    ];

    this.minConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
      // BeNeutral(),
      // AllowJoinAction(),
      // NoPenalty(PenaltyKey::NoChosenAssignment),
    ];
  }

  public getCommandDetailTitle(): string {
    return '지정한 국가로 임관';
  }

  public canDisplay(): boolean {
    return this.env.join_mode !== 'onlyRandom';
  }

  protected async initWithArg(): Promise<void> {
    const destNationID = this.arg.destNationID;
    // this.setDestNation(destNationID, ['gennum', 'scout']);

    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
      // BeNeutral(),
      // ExistsDestNation(),
      // AllowJoinDestNation(relYear),
      // AllowJoinAction(),
      // NoPenalty(PenaltyKey::NoChosenAssignment),
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
    const commandName = JoinNationCommand.getName();
    // TODO: getNationStaticInfo
    const destNationName = '국가명'; // this.destNation.name
    return `【${destNationName}】로 ${commandName}`;
  }

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    // TODO: Legacy DB access - const db = DB.db();
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
    general.setVar('troop', 0);

    if (this.destGeneralObj !== null) {
      general.setVar('city', this.destGeneralObj.getCityID());
    } else {
      const targetCityID = await db('general')
        .where('nation', destNationID)
        .where('officer_level', 12)
        .first()
        .then((r: any) => r?.city);
      general.setVar('city', targetCityID);
    }

    await db('nation')
      .where('nation', destNationID)
      .update({
        gennum: db.raw('gennum + 1'),
      });

    // TODO: refreshNationStaticInfo
    // TODO: InheritancePoint
    general.addExperience(exp);
    this.setResultTurn(new LastTurn(JoinNationCommand.getName(), this.arg));
    general.checkStatChange();
    // TODO: StaticEventHandler
    // TODO: tryUniqueItemLottery
    await general.save();

    return true;
  }

  public async exportJSVars(): Promise<any> {
    const generalObj = this.generalObj;
    const nationID = generalObj.getNationID();
    // TODO: Legacy DB access - const db = DB.db();

    // TODO: 국가 목록 쿼리 및 반환
    return {
      procRes: {
        nationList: [],
        startYear: this.env.startyear,
      },
    };
  }
}
