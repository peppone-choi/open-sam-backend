import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { InheritanceKey } from '../../enums/InheritanceKey';
import { DeleteConflict } from '../../func/DeleteConflict';
import { refreshNationStaticInfo } from '../../func/refreshNationStaticInfo';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { nationRepository } from '../../repositories/nation.repository';
import { generalRepository } from '../../repositories/general.repository';
import { cityRepository } from '../../repositories/city.repository';

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
      ConstraintHelper.BeLord(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.NotOpeningPart(relYear)
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

    const env = this.env;
    const general = this.generalObj;
    const sessionId = general.getSessionID();

    const generalName = general.data.name || general.name;
    const nationID = general.getNationID();
    
    if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const nationName = this.nation.name;

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);

    logger.pushGeneralActionLog(`영토를 버리고 방랑의 길을 떠납니다. <1>${date}</>`);
    logger.pushGlobalActionLog(`<Y>${generalName}</>이 방랑의 길을 떠납니다.`);
    logger.pushGlobalHistoryLog(`<R><b>【방랑】</b></><D><b>${generalName}</b></>은 <R>방랑</>의 길을 떠납니다.`);
    logger.pushGeneralHistoryLog(`<D><b>${nationName}</b></>을 버리고 방랑`);

    // 분쟁 기록 모두 삭제
    await DeleteConflict(nationID);

    // 국가 정보 변경: 방랑군으로 전환
    await nationRepository.updateByNationNum(sessionId, nationID, {
      name: generalName,
      color: '#330000',
      level: 0,
      type: 'None',
      tech: 0,
      capital: 0
    });

    // 군주의 병종 한계 설정
    await generalRepository.updateManyByFilter(
      { session_id: sessionId, 'data.nation': nationID },
      { 'data.makelimit': 12 }
    );
    general.data.makelimit = 12;
    general.data.officer_city = 0;

    // 다른 장수들의 관직 초기화
    await generalRepository.updateManyByFilter(
      { 
        session_id: sessionId,
        'data.nation': nationID,
        'data.officer_level': { $lt: 12 }
      },
      {
        'data.officer_level': 1,
        'data.officer_city': 0
      }
    );

    // 모든 도시 중립화
    await cityRepository.updateManyByFilter(
      { session_id: sessionId, nation: nationID },
      {
        nation: 0,
        front: 0,
        conflict: '{}'
      }
    );

    // 외교 관계 초기화
    try {
      const { diplomacyRepository } = await import('../../repositories/diplomacy.repository');
      await diplomacyRepository.updateMany(
        {
          session_id: sessionId,
          $or: [{ me: nationID }, { you: nationID }]
        },
        {
          state: 2,
          term: 0
        }
      );
    } catch (error) {
      console.error('외교 관계 초기화 실패:', error);
    }

    await refreshNationStaticInfo();

    try {
      if (typeof general.increaseInheritancePoint === 'function') {
        // TODO: general.increaseInheritancePoint('active_action', 1);
      }
    } catch (error) {
      console.error('InheritancePoint 처리 실패:', error);
    }

    this.setResultTurn(new LastTurn(WanderCommand.getName(), this.arg));

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    // UniqueItemLottery
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '방랑');
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
