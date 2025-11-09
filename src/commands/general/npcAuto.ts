import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';

/**
 * NPC 능동 커맨드
 * 
 * NPC 전용 커맨드로, 일반 플레이어는 사용할 수 없습니다.
 * 현재는 순간이동 기능만 구현되어 있습니다.
 */
export class NpcAutoCommand extends GeneralCommand {
  protected static actionName = 'NPC능동';

  protected argTest(): boolean {
    if (this.arg === null) {
      return false;
    }
    if (!('optionText' in this.arg)) {
      return false;
    }

    if (this.arg.optionText === '순간이동') {
      if (!('destCityID' in this.arg)) {
        return false;
      }
      // TODO: CityConst.byID 검증
      const destCityID = this.arg.destCityID;
      if (typeof destCityID !== 'number' || destCityID <= 0) {
        return false;
      }
      this.arg = {
        optionText: this.arg.optionText,
        destCityID,
      };
      return true;
    }

    return false;
  }

  protected init(): void {
    this.setNation();

    this.permissionConstraints = [
      // TODO: ConstraintHelper
      // MustBeNPC()
    ];

    this.fullConditionConstraints = [];
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

    // TODO: Legacy DB access - const db = DB.db();
    const general = this.generalObj;
    const logger = general.getLogger();
    const date = general.getTurnTime('HM');

    if (this.arg.optionText === '순간이동') {
      const destCityID = this.arg.destCityID;
      // TODO: CityConst.byID로 도시 이름 가져오기
      const cityName = `도시${destCityID}`;
      logger.pushGeneralActionLog(`NPC 전용 명령을 이용해 ${cityName}로 이동했습니다.`);
      general.setVar('city', destCityID);

      this.setResultTurn(new LastTurn(NpcAutoCommand.getName(), this.arg));
    }

    // TODO: StaticEventHandler
    await this.saveGeneral();

    return true;
  }
}
