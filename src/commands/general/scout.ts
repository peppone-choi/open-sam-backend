import { GeneralCommand } from '../base/GeneralCommand';
import { LastTurn } from '../base/BaseCommand';
import { tryUniqueItemLottery } from '../../utils/unique-item-lottery';
import { genGenericUniqueRNGFromGeneral } from '../../utils/rng-utils';
import type { RandUtil } from '../../utils/rand-util';

/**
 * 견문 커맨드
 * 
 * 장수가 견문을 넓혀 경험치, 자금, 군량, 또는 능력치 경험을 획득합니다.
 * 랜덤 이벤트가 발생하여 부상을 입을 수도 있습니다.
 */
export class ScoutCommand extends GeneralCommand {
  protected static actionName = '견문';

  // Event type flags (bitwise)
  protected static readonly IncExp = 0x1;
  protected static readonly IncHeavyExp = 0x2;
  protected static readonly IncLeadership = 0x10;
  protected static readonly IncStrength = 0x20;
  protected static readonly IncIntel = 0x40;
  protected static readonly IncGold = 0x100;
  protected static readonly IncRice = 0x200;
  protected static readonly DecGold = 0x400;
  protected static readonly DecRice = 0x800;
  protected static readonly Wounded = 0x1000;
  protected static readonly HeavyWounded = 0x2000;

  protected argTest(): boolean {
    this.arg = null;
    return true;
  }

  protected async init(): Promise<void> {
    this.fullConditionConstraints = [];
  }

  public getCommandDetailTitle(): string {
    const name = ScoutCommand.getName();
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

  public async runImpl(rng: RandUtil): Promise<boolean> {
    const general = this.generalObj;
    const date = general.getTurnTime('hm');

    const [type, text] = this.pickAction(rng);

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
    }
    if (type & ScoutCommand.IncRice) {
      general.increaseVar('rice', 300);
    }
    if (type & ScoutCommand.DecGold) {
      general.increaseVarWithLimit('gold', -200, 0);
    }
    if (type & ScoutCommand.DecRice) {
      general.increaseVarWithLimit('rice', -200, 0);
    }
    if (type & ScoutCommand.Wounded) {
      general.increaseVarWithLimit('injury', rng.nextRangeInt(10, 20), 0, 80);
    }
    if (type & ScoutCommand.HeavyWounded) {
      general.increaseVarWithLimit('injury', rng.nextRangeInt(20, 50), 0, 80);
    }

    const logger = general.getLogger();
    logger.pushGeneralActionLog(`${text} <1>${date}</>`);

    general.addExperience(exp);
    this.setResultTurn(new LastTurn(ScoutCommand.getName(), this.arg));
    general.checkStatChange();

    // Try unique item lottery
    tryUniqueItemLottery(
      genGenericUniqueRNGFromGeneral(general, ScoutCommand.actionName),
      general
    );

    await general.applyDB();

    return true;
  }

  /**
   * Pick a random sightseeing event
   */
  private pickAction(rng: RandUtil): [number, string] {
    const messages = this.getMessageList();
    const [[type, texts], _] = rng.choiceUsingWeightPair(messages);
    const text = rng.choice(texts);
    
    // Replace placeholders
    let finalText = text;
    finalText = finalText.replace(':goldAmount:', '300');
    finalText = finalText.replace(':riceAmount:', '300');

    return [type, finalText];
  }

  /**
   * Get list of possible sightseeing events
   */
  private getMessageList(): Array<[[number, string[]], number]> {
    const Inc = ScoutCommand;
    return [
      [[Inc.IncExp, [
        '아무일도 일어나지 않았습니다.',
        '명사와 설전을 벌였으나 망신만 당했습니다.',
        '동네 장사와 힘겨루기를 했지만 망신만 당했습니다.',
      ]], 1],
      [[Inc.IncHeavyExp, [
        '주점에서 사람들과 어울려 술을 마셨습니다.',
        '위기에 빠진 사람을 구해주었습니다.',
      ]], 1],
      [[Inc.IncHeavyExp | Inc.IncLeadership, [
        '백성들에게 현인의 가르침을 설파했습니다.',
        '어느 집의 도망친 가축을 되찾아 주었습니다.',
      ]], 2],
      [[Inc.IncHeavyExp | Inc.IncStrength, [
        '동네 장사와 힘겨루기를 하여 멋지게 이겼습니다.',
        '어느 집의 무너진 울타리를 고쳐주었습니다.',
      ]], 2],
      [[Inc.IncHeavyExp | Inc.IncIntel, [
        '어느 명사와 설전을 벌여 멋지게 이겼습니다.',
        '거리에서 글 모르는 아이들을 모아 글을 가르쳤습니다.',
      ]], 2],
      [[Inc.IncExp | Inc.IncGold, [
        '지나가는 행인에게서 금을 <C>:goldAmount:</> 받았습니다.',
      ]], 1],
      [[Inc.IncExp | Inc.IncRice, [
        '지나가는 행인에게서 쌀을 <C>:riceAmount:</> 받았습니다.',
      ]], 1],
      [[Inc.IncExp | Inc.DecGold, [
        '산적을 만나 금 <C>:goldAmount:</>을 빼앗겼습니다.',
        '돈을 <C>:goldAmount:</> 빌려주었다가 떼어먹혔습니다.',
      ]], 1],
      [[Inc.IncExp | Inc.DecRice, [
        '쌀을 <C>:riceAmount:</> 빌려주었다가 떼어먹혔습니다.',
      ]], 1],
      [[Inc.IncExp | Inc.Wounded, [
        '호랑이에게 물려 다쳤습니다.',
        '곰에게 할퀴어 다쳤습니다.',
      ]], 1],
      [[Inc.IncHeavyExp | Inc.Wounded, [
        '위기에 빠진 사람을 구해주다가 다쳤습니다.',
      ]], 1],
      [[Inc.IncExp | Inc.HeavyWounded, [
        '호랑이에게 물려 크게 다쳤습니다.',
        '곰에게 할퀴어 크게 다쳤습니다.',
      ]], 1],
      [[Inc.IncHeavyExp | Inc.Wounded | Inc.HeavyWounded, [
        '위기에 빠진 사람을 구하다가 죽을뻔 했습니다.',
      ]], 1],
      [[Inc.IncHeavyExp | Inc.IncStrength | Inc.IncGold, [
        '산적과 싸워 금 <C>:goldAmount:</>을 빼앗았습니다.',
      ]], 1],
      [[Inc.IncHeavyExp | Inc.IncStrength | Inc.IncRice, [
        '호랑이를 잡아 고기 <C>:riceAmount:</>을 얻었습니다.',
        '곰을 잡아 고기 <C>:riceAmount:</>을 얻었습니다.',
      ]], 1],
      [[Inc.IncHeavyExp | Inc.IncIntel | Inc.IncGold, [
        '돈을 빌려주었다가 이자 <C>:goldAmount:</>을 받았습니다.',
      ]], 1],
      [[Inc.IncHeavyExp | Inc.IncIntel | Inc.IncRice, [
        '쌀을 빌려주었다가 이자 <C>:riceAmount:</>을 받았습니다.',
      ]], 1],
    ];
  }
}
