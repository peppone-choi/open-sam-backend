import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { General } from '../../models/general.model';

/**
 * 등용 수락 커맨드
 * 
 * 다른 장수가 보낸 등용 제안을 수락하여 그 장수의 국가로 망명합니다.
 * 재야가 아닌 경우 배신 횟수만큼 명성/공헌이 감소합니다.
 */
export class AcceptRecruitCommand extends GeneralCommand {
  protected static actionName = '등용 수락';
  public static reqArg = true;

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }

    if (!('destGeneralID' in this.arg)) {
      return false;
    }
    const destGeneralID = this.arg.destGeneralID;
    if (typeof destGeneralID !== 'number') {
      return false;
    }
    if (destGeneralID <= 0) {
      return false;
    }
    if (destGeneralID === this.generalObj.getID()) {
      return false;
    }

    if (!('destNationID' in this.arg)) {
      return false;
    }
    const destNationID = this.arg.destNationID;
    if (typeof destNationID !== 'number') {
      return false;
    }
    if (destNationID <= 0) {
      return false;
    }
    if (destNationID === this.generalObj.getNationID()) {
      return false;
    }

    this.arg = {
      destGeneralID,
      destNationID,
    };
    return true;
  }

  protected init(): void {
    this.setNation(['gennum', 'scout']);

    this.permissionConstraints = [
      // TODO: ConstraintHelper
      // AlwaysFail('예약 불가능 커맨드')
    ];
  }

  protected async initWithArg(): Promise<void> {
    // const destGeneral = await General.findById(this.arg.destGeneralID);
    // this.setDestGeneral(destGeneral);
    // this.setDestNation(this.arg.destNationID, ['gennum', 'scout']);

    const relYear = this.env.year - this.env.startyear;

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // ReqEnvValue('join_mode', '!=', 'onlyRandom'),
      // ExistsDestNation(),
      // BeNeutral(),
      // AllowJoinDestNation(relYear),
      // ReqDestNationValue('level', '>', 0, '방랑군에는 임관할 수 없습니다.'),
      // DifferentDestNation(),
      // ReqGeneralValue('officer_level', '!=', 12, '군주는 등용장을 수락할 수 없습니다')
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

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;

    const general = this.generalObj;
    const generalID = general.getID();
    const generalName = general.getName();
    const cityID = general.getVar('city');
    const nationID = general.getNationID();

    const destGeneral = this.destGeneralObj;
    const destNationID = this.destNation.nation;
    const destNationName = this.destNation.name;

    const isTroopLeader = generalID === general.getVar('troop');

    destGeneral.addExperience(100);
    destGeneral.addDedication(100);

    const setOriginalNationValues: any = {
      gennum: (db as any).raw('gennum - 1'),
    };

    const setScoutNationValues: any = {
      gennum: (db as any).raw('gennum + 1'),
    };

    if (nationID !== 0) {
      const defaultGold = 1000; // GameConst::$defaultGold
      const defaultRice = 1000; // GameConst::$defaultRice

      if (general.getVar('gold') > defaultGold) {
        setOriginalNationValues.gold = (db as any).raw(`gold + ${general.getVar('gold') - defaultGold}`);
        general.setVar('gold', defaultGold);
      }

      if (general.getVar('rice') > defaultRice) {
        setOriginalNationValues.rice = (db as any).raw(`rice + ${general.getVar('rice') - defaultRice}`);
        general.setVar('rice', defaultRice);
      }

      // 배신 횟수만큼 명성/공헌 감소 (N*10%)
      const betrayCount = general.getVar('betray');
      general.setVar('experience', general.getVar('experience') * (1 - 0.1 * betrayCount));
      general.addExperience(0, false);
      general.setVar('dedication', general.getVar('dedication') * (1 - 0.1 * betrayCount));
      general.addDedication(0, false);
      general.increaseVarWithLimit('betray', 1, null, 5); // GameConst::$maxBetrayCnt
    } else {
      general.addExperience(100);
      general.addDedication(100);
    }

    if (general.getNPCType() < 2) {
      general.setVar('killturn', env.killturn);
    }

    const logger = general.getLogger();
    const destLogger = destGeneral.getLogger();

    // TODO: JosaUtil
    logger.pushGeneralActionLog(`<D>${destNationName}</>로 망명하여 수도로 이동합니다.`);
    destLogger.pushGeneralActionLog(`<Y>${generalName}</> 등용에 성공했습니다.`);

    logger.pushGeneralHistoryLog(`<D><b>${destNationName}</b></>로 망명`);
    destLogger.pushGeneralHistoryLog(`<Y>${generalName}</> 등용에 성공`);

    logger.pushGlobalActionLog(`<Y>${generalName}</>이 <D><b>${destNationName}</b></>로 <S>망명</>하였습니다.`);

    if (nationID !== 0) {
      await (db as any)('nation').where('nation', nationID).update(setOriginalNationValues);
    }
    await (db as any)('nation').where('nation', destNationID).update(setScoutNationValues);

    // TODO: InheritancePoint
    // general.increaseInheritancePoint(InheritanceKey::active_action, 1);

    if (general.getNPCType() < 2) {
      // TODO: max_belong 처리
    }

    general.setVar('permission', 'normal');
    general.setVar('belong', 1);
    general.setVar('officer_level', 1);
    general.setVar('officer_city', 0);
    general.setVar('nation', destNationID);
    general.setVar('city', this.destNation.capital);
    general.setVar('troop', 0);

    if (isTroopLeader) {
      await (db as any)('general').where('troop_leader', generalID).update({ troop: 0 });
      await (db as any)('troop').where('troop_leader', generalID).del();
    }

    // TODO: StaticEventHandler
    general.applyDB(db);
    destGeneral.applyDB(db);

    return true;
  }
}
