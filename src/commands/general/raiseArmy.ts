import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * 거병 커맨드
 * 
 * 재야 장수가 새로운 세력을 만듭니다.
 */
export class RaiseArmyCommand extends GeneralCommand {
  protected static actionName = '거병';
  public static reqArg = false;

  protected argTest(): boolean {
    this.arg = [];
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const env = this.env;
    const relYear = env.year - env.startyear;

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // BeNeutral(),
      // BeOpeningPart(relYear+1),
      // AllowJoinAction(),
      // NoPenalty(PenaltyKey::NoFoundNation),
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

  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;
    const general = this.generalObj;
    const date = general.getTurnTime('HM');

    const generalName = general.getName();
    const cityName = this.city.name;
    const logger = general.getLogger();

    let nationName = generalName;

    const nationNameExistsCnt = await db.queryFirstField(
      'SELECT count(*) FROM nation WHERE name = ?',
      [nationName]
    );
    
    if (nationNameExistsCnt) {
      nationName = '㉥' + nationName.substring(0, 16);
    }

    const nationNameExistsCnt2 = await db.queryFirstField(
      'SELECT count(*) FROM nation WHERE name = ?',
      [nationName]
    );

    if (nationNameExistsCnt2) {
      nationName = '㉥' + nationName;
    }

    const secretlimit = env.scenario >= 1000 ? 1 : 3;
    const baserice = 50000;

    await db.insert('nation', {
      name: nationName,
      color: '#330000',
      gold: 0,
      rice: baserice,
      rate: 20,
      bill: 100,
      strategic_cmd_limit: 12,
      surlimit: 72,
      secretlimit: secretlimit,
      type: 0,
      gennum: 1
    });

    const nationID = (db as any).insertId();

    const allNations = await db.query('SELECT nation FROM nation WHERE nation != ?', [nationID]);
    const diplomacyInit: any[] = [];

    for (const destNation of allNations) {
      const destNationID = destNation.nation;

      diplomacyInit.push({
        me: destNationID,
        you: nationID,
        state: 2,
        term: 0,
      });

      diplomacyInit.push({
        me: nationID,
        you: destNationID,
        state: 2,
        term: 0,
      });
    }

    if (diplomacyInit.length > 0) {
      await db.insert('diplomacy', diplomacyInit);
    }

    const turnRows: any[] = [];
    for (const chiefLevel of [12, 11]) {
      for (let turnIdx = 0; turnIdx < 12; turnIdx++) {
        turnRows.push({
          nation_id: nationID,
          officer_level: chiefLevel,
          turn_idx: turnIdx,
          action: '휴식',
          arg: null,
          brief: '휴식',
        });
      }
    }
    await db.insert('nation_turn', turnRows);

    logger.pushGeneralActionLog(`거병에 성공하였습니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이(가) <G><b>${cityName}</b></>에 거병하였습니다.`);
    logger.pushGlobalHistoryLog(`<Y><b>【거병】</b></><D><b>${generalName}</b></>이(가) 세력을 결성하였습니다.`);
    logger.pushGeneralHistoryLog(`<G><b>${cityName}</b></>에서 거병`);
    logger.pushNationalHistoryLog(`<Y>${generalName}</>이(가) <G><b>${cityName}</b></>에서 거병`);

    const exp = 100;
    const ded = 100;

    general.addExperience(exp);
    general.addDedication(ded);
    general.setVar('belong', 1);
    general.setVar('officer_level', 12);
    general.setVar('officer_city', 0);
    general.setVar('nation', nationID);

    this.setResultTurn(new LastTurn(RaiseArmyCommand.getName(), this.arg));
    general.checkStatChange();

    general.applyDB(db);

    return true;
  }
}
