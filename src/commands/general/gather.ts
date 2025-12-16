// @ts-nocheck - Type issues need review
import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { RandUtil } from '../../utils/RandUtil';
import { JosaUtil } from '../../utils/JosaUtil';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { troopRepository } from '../../repositories/troop.repository';
import { generalRepository } from '../../repositories/general.repository';

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

    const env = this.env;
    const sessionId = env.session_id || 'sangokushi_default';
    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const cityID = this.city!.city;
    const cityName = this.city!.name;
    const josaRo = JosaUtil.pick(cityName, '로');
    const troopID = general.getID();
    
    // 부대 이름 조회 (MongoDB)
    const troopDoc = await troopRepository.findByLeader(sessionId, troopID);
    const troopName = troopDoc?.name || '부대';

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`<G><b>${cityName}</b></>에서 집합을 실시했습니다. <1>${date}</>`);

    // 현재 도시가 아닌 같은 부대 소속 장수들 조회 (MongoDB)
    const membersResult = await generalRepository.findTroopMembers(
      sessionId, general.getNationID(), troopID, cityID
    );
    const generalList = membersResult
      .filter((g: any) => {
        const no = g.no ?? g.data?.no;
        return no && no !== general.getID();
      })
      .map((g: any) => g.no ?? g.data?.no);

    if (generalList.length > 0) {
      // MongoDB로 장수들 도시 업데이트
      for (const generalNo of generalList) {
        await this.updateGeneral(generalNo, { city: cityID });
      }
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
    
    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);
    
    await this.saveGeneral();

    return true;
  }
}
