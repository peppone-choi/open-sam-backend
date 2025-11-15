import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { SightseeingMessage } from '../../TextDecoration/SightseeingMessage';

/**
 * 견문 커맨드
 * 
 * 여행하며 다양한 이벤트를 경험합니다.
 * 자금, 군량, 경험치, 능력치 경험치 등을 얻거나 잃을 수 있습니다.
 */
export class TravelCommand extends GeneralCommand {
  protected static actionName = '견문';
  public static reqArg = false;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected init(): void {
    this.fullConditionConstraints = [];
  }

  public getCommandDetailTitle(): string {
    const name = TravelCommand.getName();
    return `${name}(자금?, 군량?, 경험치?)`;
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
   * 견문 실행
   * 
   * - 랜덤 이벤트 발생
   * - 자금/군량/경험치/능력치 변동
   */
  public async run(rng: any): Promise<boolean> {
    if (!this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;

    const sightseeingMessage = new SightseeingMessage();
    const [type, text] = sightseeingMessage.pickAction();

    let exp = 0;

    // 경험치 증가
    if (type & SightseeingMessage.IncExp) {
      exp += 30;
    }
    if (type & SightseeingMessage.IncHeavyExp) {
      exp += 60;
    }

    // 능력치 경험치 증가
    if (type & SightseeingMessage.IncLeadership) {
      general.increaseVar('leadership_exp', 2);
    }
    if (type & SightseeingMessage.IncStrength) {
      general.increaseVar('strength_exp', 2);
    }
    if (type & SightseeingMessage.IncIntel) {
      general.increaseVar('intel_exp', 2);
    }
    if (type & SightseeingMessage.IncPolitics) {
      general.increaseVar('politics_exp', 2);
    }
    if (type & SightseeingMessage.IncCharm) {
      general.increaseVar('charm_exp', 2);
    }

    // 자금/군량 증가
    let finalText = text;
    if (type & SightseeingMessage.IncGold) {
      general.increaseVar('gold', 300);
      finalText = finalText.replace(':goldAmount:', '300');
    }
    if (type & SightseeingMessage.IncRice) {
      general.increaseVar('rice', 300);
      finalText = finalText.replace(':riceAmount:', '300');
    }

    // 자금/군량 감소
    if (type & SightseeingMessage.DecGold) {
      general.increaseVarWithLimit('gold', -200, 0);
      finalText = finalText.replace(':goldAmount:', '200');
    }
    if (type & SightseeingMessage.DecRice) {
      general.increaseVarWithLimit('rice', -200, 0);
      finalText = finalText.replace(':riceAmount:', '200');
    }

    // 부상
    if (type & SightseeingMessage.Wounded) {
      general.increaseVarWithLimit('injury', rng.nextRangeInt(10, 20), null, 80);
    }
    if (type & SightseeingMessage.HeavyWounded) {
      general.increaseVarWithLimit('injury', rng.nextRangeInt(20, 50), null, 80);
    }

    const logger = general.getLogger();
    const date = general.getTurnTime(general.TURNTIME_HM);
    logger.pushGeneralActionLog(`${finalText} <1>${date}</>`);

    general.addExperience(exp);

    this.setResultTurn(new LastTurn(TravelCommand.getName(), this.arg));
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
        // TODO: general.genGenericUniqueRNG(TravelCommand.actionName),
        general,
        sessionId,
        '유랑'
      );
    } catch (error) {
      console.error('tryUniqueItemLottery 실패:', error);
    }

    await this.saveGeneral();

    return true;
  }
}
