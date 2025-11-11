import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { CityConst } from '../../const/CityConst';
import { searchDistance } from '../../func/searchDistance';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { cityRepository } from '../../repositories/city.repository';

/**
 * 접경귀환 커맨드
 * 
 * 3칸 이내의 가장 가까운 아군 점령 도시로 귀환합니다.
 */
export class BorderReturnCommand extends GeneralCommand {
  protected static actionName = '접경귀환';
  public static reqArg = false;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation()
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
   * 접경귀환 실행
   * 
   * - 3칸 이내의 가장 가까운 아군 점령 도시로 이동
   * - 해당하는 도시가 없으면 실패
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const cityID = general.getCityID();
    const logger = general.getLogger();
    const sessionId = general.getSessionID();
    const nationID = general.getNationID();

    // 3칸 이내 거리별 도시 목록
    const distanceList = searchDistance(cityID, 3, true);
    const flatCityList = distanceList.flat();

    // 아군 점령 도시 목록
    const occupiedCities = await cityRepository.findByFilter({
      session_id: sessionId,
      nation: nationID,
      city: { $in: flatCityList },
      supply: 1
    });

    const occupiedSet = new Set(occupiedCities.map((c: any) => c.city || c.data?.city));

    // 가장 가까운 거리의 도시 찾기
    let nearestCityList: number[] = [];
    for (const cityList of distanceList) {
      for (const cid of cityList) {
        if (occupiedSet.has(cid)) {
          nearestCityList.push(cid);
        }
      }
      if (nearestCityList.length > 0) {
        break;
      }
    }

    // 3칸 이내에 아군 도시가 없으면 실패
    if (nearestCityList.length === 0) {
      logger.pushGeneralActionLog('3칸 이내에 아국 도시가 없습니다.');
      return false;
    }

    // 랜덤하게 하나 선택
    const destCityID = rng.choice(nearestCityList);
    const destCityName = CityConst.byID(destCityID).name;

    logger.pushGeneralActionLog(`<G><b>${destCityName}</b></>로 접경귀환했습니다.`);
    general.setVar('city', destCityID);

    this.setResultTurn(new LastTurn(BorderReturnCommand.getName(), this.arg));

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
