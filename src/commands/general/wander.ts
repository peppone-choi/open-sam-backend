import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { InheritanceKey } from '../../Enums/InheritanceKey';
import { DeleteConflict } from '../../func/DeleteConflict';
import { refreshNationStaticInfo } from '../../func/refreshNationStaticInfo';

/**
 * 방랑 커맨드
 * 
 * 군주만 사용 가능하며, 영토를 버리고 방랑군이 됩니다.
 * 모든 도시를 포기하고 국가가 방랑 상태로 전환됩니다.
 */
export class WanderCommand extends GeneralCommand {
  protected static actionName = '방랑';
  public static reqArg = false;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    const general = this.generalObj;
    const env = this.env;

    this.setCity();
    this.setNation();

    const relYear = env.year - env.startyear;

    this.fullConditionConstraints = [
      // TODO: ConstraintHelper
      // BeLord(),
      // NotWanderingNation(),
      // NotOpeningPart(relYear),
      // AllowDiplomacyStatus(this.generalObj.getNationID(), [2, 7], '방랑할 수 없는 외교상태입니다.'),
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

  /**
   * 방랑 실행
   * 
   * - 영토를 모두 포기
   * - 국가를 방랑군으로 전환
   * - 국가명을 군주명으로 변경
   * - 모든 도시 중립화
   * - 외교 상태 초기화
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const env = this.env;
    const general = this.generalObj;

    const generalName = general.getName();
    const nationID = general.getNationID();
    const nationName = this.nation.name;

    const logger = general.getLogger();

    logger.pushGeneralActionLog('영토를 버리고 방랑의 길을 떠납니다.');
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 방랑의 길을 떠납니다.`);
    logger.pushGlobalHistoryLog(`<R><b>【방랑】</b></><D><b>${generalName}</b></>은 <R>방랑</>의 길을 떠납니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>을 버리고 방랑`);

    // 분쟁 기록 모두 삭제
    await DeleteConflict(nationID);

    // 국가 정보 변경: 방랑군으로 전환
    await db.update(
      'nation',
      {
        name: generalName,
        color: '#330000', // TODO: 기본 방랑군 색 별도 지정
        level: 0,
        type: 'None',
        tech: 0,
        capital: 0
      },
      'nation = ?',
      nationID
    );

    // 군주의 병종 한계 설정
    await db.update('general', { makelimit: 12 }, 'nation = ?', nationID);
    general.setVar('makelimit', 12);
    general.setVar('officer_city', 0);

    // 다른 장수들의 관직 초기화
    await db.update(
      'general',
      {
        officer_level: 1,
        officer_city: 0
      },
      'nation = ? AND officer_level < 12',
      nationID
    );

    // 모든 도시 중립화
    await db.update(
      'city',
      {
        nation: 0,
        front: 0,
        conflict: '{}'
      },
      'nation = ?',
      nationID
    );

    // 외교 관계 초기화
    await db.update(
      'diplomacy',
      {
        state: 2,
        term: 0
      },
      'me = ? OR you = ?',
      [nationID,
      nationID]
    );

    await refreshNationStaticInfo();

    general.increaseInheritancePoint(InheritanceKey.active_action, 1);

    this.setResultTurn(new LastTurn(WanderCommand.getName(), this.arg));

    // TODO: StaticEventHandler

    general.applyDB(db);

    return true;
  }
}
