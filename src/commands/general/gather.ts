// @ts-nocheck - Legacy db usage needs migration to Mongoose
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { RandUtil } from '../../utils/RandUtil';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';

/**
 * 집합 커맨드
 * 
 * 부대장이 부대원들을 현재 도시로 집합시킵니다.
 */
export class GatherCommand extends GeneralCommand {
  protected static actionName = '집합';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.SuppliedCity(),
      ConstraintHelper.MustBeTroopLeader(),
      ConstraintHelper.ReqTroopMembers(),
    ];
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GatherCommand).getName();
    return `${name}(통솔경험)`;
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

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const db = DB.db();
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const cityID = this.city!.city;
    const cityName = this.city!.name;
    const josaRo = JosaUtil.pick(cityName, '로');
    const troopID = general.getID();
    
    // 부대 이름 조회
    const troopNameResult = await db.queryFirstField(
      'SELECT name FROM troop WHERE troop_leader = ?',
      [troopID]
    );
    const troopName = troopNameResult || '부대';

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`<G><b>${cityName}</b></>에서 집합을 실시했습니다. <1>${date}</>`);

    // 현재 도시가 아닌 같은 부대 소속 장수들 조회
    const generalListResult = await db.queryFirstColumn(
      'SELECT no FROM general WHERE nation=? AND city!=? AND troop=? AND no!=?',
      [general.getNationID(), cityID, troopID, general.getID()]
    );
    const generalList = generalListResult || [];

    if (generalList.length > 0) {
      await db.update('general', {
        city: cityID
      }, 'no IN (?)', [generalList]);
      await this.updateOtherGeneralsCity(generalList, cityID);
    }

    // 각 장수에게 로그 추가
    for (const targetGeneralID of generalList) {
      const { ActionLogger } = await import('../../services/logger/ActionLogger');
      const targetLogger = new ActionLogger(
        targetGeneralID,
        general.getNationID(),
        env.year,
        env.month,
        env.session_id,
        true
      );
      targetLogger.pushGeneralActionLog(`${troopName} 부대원들은 <G><b>${cityName}</b></>${josaRo} 집합되었습니다.`, 'PLAIN');
      await targetLogger.flush();
    }

    const exp = 70;
    const ded = 100;

    general.addExperience(exp);
    general.addDedication(ded);
    general.increaseVar('leadership_exp', 1);
    
    this.setResultTurn(new LastTurn((this.constructor as typeof GatherCommand).getName(), this.arg));
    general.checkStatChange();
    
    await StaticEventHandler.handleEvent(
      this.generalObj,
      this.destGeneralObj,
      GatherCommand,
      this.env,
      this.arg ?? {}
    );
    
    await tryUniqueItemLottery(
      // TODO: general.genGenericUniqueRNG(GatherCommand.actionName),
      general
    );
    
    await this.saveGeneral();

    return true;
  }
}
