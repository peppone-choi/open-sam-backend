import { getTechCost } from '../../utils/global-funcs';
import { GeneralCommand } from '../base/GeneralCommand';

import { RandUtil } from '../../utils/RandUtil';
import { Util } from '../../utils/Util';
import { LastTurn } from '../../types/LastTurn';
import { ConstraintHelper } from '../../constraints/ConstraintHelper';
import { GameConst } from '../../constants/GameConst';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { StaticEventHandler } from '../../events/StaticEventHandler';
import { unitStackRepository } from '../../repositories/unit-stack.repository';

/**
 * 전투태세 커맨드
 * 
 * 3턴에 걸쳐 병사들을 훈련하여 훈련도와 사기를 최대치 근처로 끌어올립니다.
 */
export class BattleStanceCommand extends GeneralCommand {
  protected static actionName = '전투태세';

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    const general = this.generalObj;

    this.setCity();
    this.setNation();

    const [reqGold, reqRice] = this.getCost();

    this.fullConditionConstraints = [
      ConstraintHelper.NotBeNeutral(),
      ConstraintHelper.NotWanderingNation(),
      ConstraintHelper.OccupiedCity(),
      ConstraintHelper.ReqGeneralCrew(),
      ConstraintHelper.ReqGeneralGold(reqGold),
      ConstraintHelper.ReqGeneralRice(reqRice),
      ConstraintHelper.ReqGeneralTrainMargin(GameConst.maxTrainByCommand - 10),
      ConstraintHelper.ReqGeneralAtmosMargin(GameConst.maxAtmosByCommand - 10),
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

  public getCost(): [number, number] {
    const unitStacks = this.getUnitStacks();
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);
    const crew = Math.max(1, totalCrew || this.generalObj?.data?.crew || 1);
    
    if (!this.nation) {
      throw new Error('국가 정보가 없습니다');
    }
    const techCost = getTechCost(this.nation.tech);
    return [Util.round(crew / 100 * 3 * techCost), 0];
  }

  public getPreReqTurn(): number {
    return 3;
  }

  public getPostReqTurn(): number {
    return 0;
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const unitStacks = this.getUnitStacks();
    const totalCrew = unitStacks.reduce((sum, stack) => sum + this.getStackTroopCount(stack), 0);

    const lastTurn = general.getLastTurn();
    const turnResult = new LastTurn((this.constructor as typeof BattleStanceCommand).getName(), this.arg);

    const reqTurn = this.getPreReqTurn();

    if (lastTurn.getCommand() !== (this.constructor as typeof BattleStanceCommand).getName()) {
      turnResult.setTerm(1);
    } else if (lastTurn.getTerm() === reqTurn) {
      turnResult.setTerm(1);
    } else if (lastTurn.getTerm() < reqTurn) {
      turnResult.setTerm(lastTurn.getTerm() + 1);
    } else {
      throw new Error('전투 태세에 올바른 턴이 아님');
    }

    const term = turnResult.getTerm();

    const logger = general.getLogger();

    if (term < 3) {
      logger.pushGeneralActionLog(`병사들을 열심히 훈련중... (${term}/3) <1>${date}</>`);
      this.setResultTurn(turnResult);
      await this.saveGeneral();

      return true;
    }

    logger.pushGeneralActionLog(`전투태세 완료! (${term}/3) <1>${date}</>`);

    const trainCap = GameConst.maxTrainByCommand - 5;
    const atmosCap = GameConst.maxAtmosByCommand - 5;
    const currentTrain = general.data?.train ?? 0;
    const currentAtmos = general.data?.atmos ?? 0;

    if (trainCap > currentTrain) {
      general.increaseVarWithLimit('train', trainCap - currentTrain, trainCap);
    }
    if (atmosCap > currentAtmos) {
      general.increaseVarWithLimit('atmos', atmosCap - currentAtmos, atmosCap);
    }

    await this.applyBattleStanceToStacks(unitStacks, trainCap, atmosCap);

    const exp = 100 * 3;
    const ded = 70 * 3;

    general.addExperience(exp);
    general.addDedication(ded);

    const crew = Math.max(1, totalCrew || general.data.crew || 1); // 0으로 나누기 방지

    const crewTypeObj = typeof general.getCrewTypeObj === 'function'
      ? general.getCrewTypeObj()
      : { id: general.data?.crewtype ?? 0, name: general.data?.crewtype_name ?? '병종', armType: general.data?.crewtype ?? 0 };

    if (typeof general.addDex === 'function') {
      general.addDex(crewTypeObj, (crew / 100) * 3, false);
    }

    // PHP에서는 getCost()로 조건 검증만 하고 실제 gold 차감은 하지 않음
    // const [reqGold, reqRice] = this.getCost();
    // general.increaseVarWithLimit('gold', -reqGold, 0);

    general.increaseVar('leadership_exp', 3);
    this.setResultTurn(turnResult);
    general.checkStatChange();
    // 공통 후처리 (StaticEventHandler + 아이템 추첨 + 유산 포인트)
    await this.postRunHooks(rng);
    
    await this.saveGeneral();

    return true;
  }

  private async applyBattleStanceToStacks(stacks: any[], trainCap: number, atmosCap: number): Promise<void> {
    if (!stacks.length) return;
 
    let updated = false;
    for (const stack of stacks) {
      const stackDoc = await unitStackRepository.findById(stack._id?.toString?.() || stack._id);
      if (!stackDoc) continue;
 
      stackDoc.train = Math.max(stackDoc.train ?? 0, trainCap);
      stackDoc.morale = Math.max(stackDoc.morale ?? 0, atmosCap);
      await stackDoc.save();
      updated = true;
    }
    if (updated) {
      this.markUnitStacksDirty();
    }
  }

}
