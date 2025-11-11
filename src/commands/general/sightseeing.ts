import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { DB } from '../../config/db';
import { SightseeingMessage } from '../../TextDecoration/SightseeingMessage';

/**
 * 견문 커맨드
 * 
 * 무작위 이벤트를 발생시켜 경험치, 능력치, 자원 등을 얻거나 잃을 수 있습니다.
 */
export class SightseeingCommand extends GeneralCommand {
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
    return '견문(자금?, 군량?, 경험치?)';
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
    const date = general.getTurnTime(general.TURNTIME_HM);

    const sightseeing = new SightseeingMessage();
    const [type, text] = sightseeing.pickAction();

    let exp = 0;

    if (type & SightseeingMessage.IncExp) {
      exp += 30;
    }
    if (type & SightseeingMessage.IncHeavyExp) {
      exp += 60;
    }
    if (type & SightseeingMessage.IncLeadership) {
      general.increaseVar('leadership_exp', 2);
    }
    if (type & SightseeingMessage.IncStrength) {
      general.increaseVar('strength_exp', 2);
    }
    if (type & SightseeingMessage.IncIntel) {
      general.increaseVar('intel_exp', 2);
    }
    if (type & SightseeingMessage.IncGold) {
      general.increaseVar('gold', 300);
      text.replace(':goldAmount:', '300');
    }
    if (type & SightseeingMessage.IncRice) {
      general.increaseVar('rice', 300);
      text.replace(':riceAmount:', '300');
    }
    if (type & SightseeingMessage.DecGold) {
      general.increaseVarWithLimit('gold', -200, 0);
      text.replace(':goldAmount:', '200');
    }
    if (type & SightseeingMessage.DecRice) {
      general.increaseVarWithLimit('rice', -200, 0);
      text.replace(':riceAmount:', '200');
    }
    if (type & SightseeingMessage.Wounded) {
      general.increaseVarWithLimit('injury', rng.nextRangeInt(10, 20), null, 80);
    }
    if (type & SightseeingMessage.HeavyWounded) {
      general.increaseVarWithLimit('injury', rng.nextRangeInt(20, 50), null, 80);
    }

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`${text} <1>${date}</>`);

    general.addExperience(exp);
    this.setResultTurn(new LastTurn(SightseeingCommand.getName(), this.arg));
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
      console.error('StaticEventHandler failed:', error);
    }

    // tryUniqueItemLottery 처리
    try {
      const { tryUniqueItemLottery } = await import('../../utils/unique-item-lottery');
      const sessionId = this.env['session_id'] || 'sangokushi_default';
      await tryUniqueItemLottery(rng, general, sessionId, '관광');
    } catch (error: any) {
      console.error('tryUniqueItemLottery failed:', error);
    }

    await this.saveGeneral();

    return true;
  }
}

