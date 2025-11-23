import { GeneralCommand } from '../base/GeneralCommand';
import { DB } from '../../config/db';
import { RandUtil } from '../../utils/RandUtil';
import { LastTurn } from '../../types/LastTurn';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { unitStackRepository } from '../../repositories/unit-stack.repository';
import { cityRepository } from '../../repositories/city.repository';

/**
 * 소집해제 커맨드
 * 
 * 병사들을 전원 해산하고 도시 인구로 되돌립니다.
 */
export class DismissCommand extends GeneralCommand {
  protected static actionName = '소집해제';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    const general = this.generalObj;

    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.ReqGeneralCrew(),
    ];
  }

  private getUnitStacks(): any[] {
    return this.getCachedUnitStacks();
  }

  private getStackTroopCount(stack: any): number {
    const hp = stack?.hp;
    if (typeof hp === 'number') {
      return hp;
    }
    const unitSize = stack?.unit_size ?? 100;
    const stackCount = stack?.stack_count ?? 0;
    return unitSize * stackCount;
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof DismissCommand).getName();
    return `${name}(병사↓, 인구↑)`;
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
    const logger = general.getLogger();

    logger.pushGeneralActionLog(`병사들을 <R>소집해제</>하였습니다. <1>${date}</>`);
 
    const exp = 70;
    const ded = 100;
 
    // UnitStack에서 총 병력 수 계산
    await this.ensureUnitStacksCache();
    const unitStacks = this.getUnitStacks();
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);
    
    // 레거시 crew 값과 비교하여 최대값 사용 (안전장치)
    const actualCrew = Math.max(totalCrew, general.data.crew || 0);


    const crewUp = general.onCalcDomestic('징집인구', 'score', actualCrew);

    // 도시 인구 증가
    const sessionId = this.env.session_id || general.getSessionID() || 'sangokushi_default';
    const cityId = general.getCityID();
    
    try {
      const cityDoc = await cityRepository.findByCityNum(sessionId, cityId);
      if (cityDoc) {
        const nextPop = Math.max(0, (cityDoc.pop ?? 0) + crewUp);
        await cityRepository.updateByCityNum(sessionId, cityId, { pop: nextPop });
      } else {
        throw new Error('city not found in cache');
      }
    } catch (error) {
      console.warn('도시 인구 업데이트 실패 (레거시 방식 시도):', error);
      await db.update('city', {
        pop: db.sqleval('pop + %i', crewUp)
      }, 'city=%i', [cityId]);
    }

    // UnitStack 전체 삭제
    for (const stack of unitStacks) {
      try {
        await unitStackRepository.deleteById(stack._id?.toString?.() || stack._id);
      } catch (error) {
        console.error('UnitStack 삭제 실패:', error);
      }
    }
    this.markUnitStacksDirty();
    await this.syncGeneralTroopData(sessionId, general.getID?.() ?? general.no ?? general.data?.no);
 
    // 레거시 crew 값도 0으로 설정
    general.data.crew = 0;
 
    general.data.train = 0;
    general.data.atmos = 0;


    general.addExperience(exp);
    general.addDedication(ded);
    this.setResultTurn(new LastTurn((this.constructor as typeof DismissCommand).getName(), this.arg));
    general.checkStatChange();
    await StaticEventHandler.handleEvent(this.generalObj, this.destGeneralObj, DismissCommand, this.env, this.arg ?? {});
    await this.saveGeneral();

    return true;
  }
}
