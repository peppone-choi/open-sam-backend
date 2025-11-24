import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 견문 커맨드  
 * PHP: sammo/Command/General/che_견문.php
 * 
 * 탐험을 통해 랜덤한 보상/패널티를 받습니다.
 * 17가지 이벤트 중 하나가 발생합니다.
 */
export class ScoutCommand extends GeneralCommand {
  protected static actionName = '견문';

  // SightseeingMessage 플래그 (PHP 비트 플래그)
  static readonly IncExp = 1 << 0;
  static readonly IncHeavyExp = 1 << 1;
  static readonly IncLeadership = 1 << 2;
  static readonly IncStrength = 1 << 3;
  static readonly IncIntel = 1 << 4;
  static readonly IncGold = 1 << 5;
  static readonly IncRice = 1 << 6;
  static readonly DecGold = 1 << 7;
  static readonly DecRice = 1 << 8;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected async init(): Promise<void> {
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

  /**
   * 17가지 랜덤 이벤트 선택
   */
  private pickSightseeingEvent(rng: RandUtil): [number, string] {
    const events = [
      [ScoutCommand.IncExp, '여행 중 귀한 경험을 했습니다.'],
      [ScoutCommand.IncHeavyExp, '세상의 이치를 깨달았습니다!'],
      [ScoutCommand.IncLeadership, '리더십 훈련을 받았습니다.'],
      [ScoutCommand.IncStrength, '무술 수련을 했습니다.'],
      [ScoutCommand.IncIntel, '서적을 읽고 지혜를 얻었습니다.'],
      [ScoutCommand.IncGold, '자금 :goldAmount:을 얻었습니다.'],
      [ScoutCommand.IncRice, '군량 :riceAmount:을 얻었습니다.'],
      [ScoutCommand.DecGold, '도박으로 자금 :goldAmount:을 잃었습니다.'],
      [ScoutCommand.DecRice, '여행 중 군량 :riceAmount:을 소비했습니다.'],
      [ScoutCommand.IncExp | ScoutCommand.IncGold, '좋은 일이 있었습니다! 경험과 자금 :goldAmount:을 얻었습니다.'],
      [ScoutCommand.IncExp | ScoutCommand.IncRice, '풍족한 여행이었습니다. 경험과 군량 :riceAmount:을 얻었습니다.'],
      [ScoutCommand.IncLeadership | ScoutCommand.IncGold, '훌륭한 지도자를 만났습니다. 리더십과 자금 :goldAmount:을 얻었습니다.'],
      [ScoutCommand.IncStrength | ScoutCommand.IncRice, '무예 대회에서 승리했습니다! 무력과 군량 :riceAmount:을 얻었습니다.'],
      [ScoutCommand.IncIntel | ScoutCommand.IncGold, '학자와 논쟁에서 이겼습니다. 지력과 자금 :goldAmount:을 얻었습니다.'],
      [ScoutCommand.IncHeavyExp | ScoutCommand.IncLeadership, '깊은 깨달음을 얻었습니다! 경험과 리더십이 크게 상승했습니다.'],
      [ScoutCommand.IncHeavyExp | ScoutCommand.IncStrength, '무도의 비전을 터득했습니다! 경험과 무력이 크게 상승했습니다.'],
      [ScoutCommand.IncHeavyExp | ScoutCommand.IncIntel, '현자를 만나 가르침을 받았습니다! 경험과 지력이 크게 상승했습니다.'],
    ];

    const idx = rng.next(0, events.length - 1);
    return events[idx] as [number, string];
  }

  public async run(rng: RandUtil): Promise<boolean> {
    if (!await this.hasFullConditionMet()) {
      throw new Error('불가능한 커맨드를 강제로 실행 시도');
    }

    const general = this.generalObj;
    const date = general.getTurnTime('HM');
    const logger = general.getLogger();

    const [type, rawText] = this.pickSightseeingEvent(rng);
    let text = rawText;
    let exp = 0;

    if (type & ScoutCommand.IncExp) {
      exp += 30;
    }
    if (type & ScoutCommand.IncHeavyExp) {
      exp += 60;
    }
    if (type & ScoutCommand.IncLeadership) {
      general.increaseVar('leadership_exp', 2);
    }
    if (type & ScoutCommand.IncStrength) {
      general.increaseVar('strength_exp', 2);
    }
    if (type & ScoutCommand.IncIntel) {
      general.increaseVar('intel_exp', 2);
    }
    if (type & ScoutCommand.IncGold) {
      general.increaseVar('gold', 300);
      text = text.replace(':goldAmount:', '300');
    }
    if (type & ScoutCommand.IncRice) {
      general.increaseVar('rice', 300);
      text = text.replace(':riceAmount:', '300');
    }
    if (type & ScoutCommand.DecGold) {
      general.increaseVarWithLimit('gold', -200, 0);
      text = text.replace(':goldAmount:', '200');
    }
    if (type & ScoutCommand.DecRice) {
      general.increaseVarWithLimit('rice', -200, 0);
      text = text.replace(':riceAmount:', '200');
    }

    logger.pushGeneralActionLog(`${text} <1>${date}</>`);
    
    general.addExperience(exp);
    this.setResultTurn(new LastTurn(ScoutCommand.getName(), this.arg));
    general.checkStatChange();

    // 유니크 아이템 추첨
    await tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, ScoutCommand.actionName),
      general,
      this.env.session_id || 'default'
    );
 
    await this.saveGeneral();
 
    return true;
  }
}
