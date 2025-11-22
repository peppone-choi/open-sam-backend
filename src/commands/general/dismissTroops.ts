import { GeneralCommand } from '../base/GeneralCommand';
import { cityRepository } from '../../repositories/city.repository';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { Util } from '../../utils/Util';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

/**
 * 소집해제 커맨드
 * PHP che_소집해제와 동일한 구조
 */
export class DismissTroopsCommand extends GeneralCommand {
  protected static actionName = '소집해제';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    this.fullConditionConstraints = [
      ConstraintHelper.ReqGeneralCrew()
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
    return '소집해제(병사↓, 인구↑)';
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

    const general = this.generalObj;
    const date = general.getTurnTime();

    const logger = general.getLogger();

    logger.pushGeneralActionLog(`병사들을 <R>소집해제</>하였습니다. <1>${date}</>`);

    const exp = 70;
    const ded = 100;

    const unitStacks = this.getUnitStacks();
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);
    const legacyCrew = general.data.crew || 0;
    const actualCrew = Math.max(totalCrew, legacyCrew);

    const crewUp = general.onCalcDomestic('징집인구', 'score', actualCrew);

    const sessionId = general.getSessionID();
    const cityId = general.getCityID();

    await cityRepository.updateOneByFilter(
      { 
        session_id: sessionId,
        city: cityId
      },
      {
        $inc: { 'data.pop': crewUp }
      }
    ).catch(async (error) => {
      console.warn('도시 인구 증가 실패, 레거시 방식 시도:', error);
      const db = DB.db();
      await db.update('city', { pop: db.sqleval('pop + %i', crewUp) }, 'city=%i', [cityId]);
    });

    for (const stack of unitStacks) {
      try {
        await unitStackRepository.deleteById(stack._id?.toString?.() || stack._id);
      } catch (error) {
        console.error('UnitStack 삭제 실패:', error);
      }
    }

    general.data.crew = 0;
    general.data.train = 0;
    general.data.atmos = 0;
    general.addExperience(exp);
    general.addDedication(ded);
    this.setResultTurn(new LastTurn(DismissTroopsCommand.getName(), this.arg));
    general.checkStatChange();


    // StaticEventHandler 처리
    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(
        general,
        null,
        this,
        this.env,
        this.arg
      );
    } catch (error: any) {
      // StaticEventHandler 실패해도 계속 진행
      console.error('StaticEventHandler failed:', error);
    }

    // UniqueItemLottery
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '소집해제');
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}

