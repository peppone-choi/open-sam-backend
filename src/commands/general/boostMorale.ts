import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

/**
 * 사기 진작 커맨드
 * 
 * 병사들의 사기를 올립니다.
 */
export class BoostMoraleCommand extends GeneralCommand {
  protected static actionName = '사기진작';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.minConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
    ];

    // PHP 원본과 동일: SuppliedCity() 제약 없음 (사기진작은 보급 연결 불필요)
    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.ReqGeneralAtmosMargin(GameConst.maxAtmosByCommand || 100),
    ];
  }

  private getUnitStacks(): any[] {
    return this.getCachedUnitStacks();
  }

  public getCommandDetailTitle(): string {
    const name = (this.constructor as typeof GeneralCommand).getName();
    return `${name}(통솔경험, 자금↓)`;
  }

  public getCost(): [number, number] {
    const unitStacks = this.getUnitStacks();
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);
    const crew = Math.max(1, totalCrew || this.generalObj?.data?.crew || 1);
    return [Math.round(crew / 100), 0];
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
    const unitStacks = this.getUnitStacks();
    const primaryStack = unitStacks[0];
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);

    const atmosDelta = 0.005;
    const maxAtmosByCommand = 100;
    const trainSideEffectByAtmosTurn = 0.9;

    // 0으로 나누기 방지: crew가 0일 수 있음
    const crew = Math.max(1, totalCrew || general.data.crew);

    // 사기진작은 통솔 100% (PHP Parity)
    const leadership = general.getLeadership();
    const moralePower = leadership;

    // 현재 평균 사기 (UnitStack 기준)
    const currentMorale = primaryStack?.morale ?? general.data.atmos ?? 50;

    const score = Math.max(0, Math.min(
      Math.round(moralePower * 100 / crew * atmosDelta),
      Math.max(0, maxAtmosByCommand - currentMorale)
    ));

    const scoreText = score.toLocaleString();

    // 훈련도 부작용 (UnitStack 기준)
    const currentTrain = primaryStack?.train ?? general.data.train ?? 50;
    const sideEffect = Math.max(0, Math.floor(currentTrain * trainSideEffectByAtmosTurn));

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);

    logger.pushGeneralActionLog(`사기치가 <C>${scoreText}</> 상승했습니다. <1>${date}</>`);

    const exp = 100;
    const ded = 70;

    // 레거시 general.data 업데이트 (하위 호환성)
    general.increaseVar('atmos', score);
    general.data.train = sideEffect;

    // UnitStack 업데이트
    await this.applyMoraleToStacks(unitStacks, score, sideEffect);

    const crewTypeObj = typeof general.getCrewTypeObj === 'function'
      ? general.getCrewTypeObj()
      : { id: general.data?.crewtype ?? 0, name: general.data?.crewtype_name ?? '병종', armType: general.data?.crewtype ?? 0 };

    if (typeof general.addDex === 'function') {
      general.addDex(crewTypeObj, score, false);
    }

    const [reqGold] = this.getCost();
    general.increaseVarWithLimit('gold', -reqGold, 0);

    general.addExperience(exp);
    general.addDedication(ded);
    // PHP 원본: leadership_exp +1만 증가
    // TS 확장: 사기진작은 군사 커맨드이지만 병사 통솔 특성상 charm 영향 추가
    general.increaseVar('leadership_exp', 1);
    general.increaseVar('charm_exp', 0.5);  // ⚡ TS 확장: PHP에는 없음

    this.setResultTurn(new LastTurn((this.constructor as typeof BoostMoraleCommand).getName(), this.arg));
    general.checkStatChange();

    try {
      const { StaticEventHandler } = await import('../../events/StaticEventHandler');
      await StaticEventHandler.handleEvent(general, null, this, this.env, this.arg);
    } catch (error) {
      console.error('StaticEventHandler 실패:', error);
    }

    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env.session_id || 'sangokushi_default';
      await tryUniqueItemLottery(
        // TODO: general.genGenericUniqueRNG(BoostMoraleCommand.actionName),
        general,
        sessionId,
        '사기진작'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }

  private async applyMoraleToStacks(stacks: any[], moraleBoost: number, newTrain: number): Promise<void> {
    if (!stacks.length) return;

    let updated = false;
    for (const stack of stacks) {
      const stackDoc = await unitStackRepository.findById(stack._id?.toString?.() || stack._id);
      if (!stackDoc) continue;

      // 사기 증가 (최대 100)
      stackDoc.morale = Math.min(100, stackDoc.morale + moraleBoost);

      // 훈련도 감소 (부작용)
      stackDoc.train = newTrain;

      await stackDoc.save();
      updated = true;
    }
    if (updated) {
      this.markUnitStacksDirty();
    }
  }
}
