import { Util } from '../utils/Util';

export class SightseeingMessage {
  static readonly IncExp = 0x1;
  static readonly IncHeavyExp = 0x2;
  static readonly IncLeadership = 0x10;
  static readonly IncStrength = 0x20;
  static readonly IncIntel = 0x40;
  static readonly IncGold = 0x100;
  static readonly IncRice = 0x200;
  static readonly DecGold = 0x400;
  static readonly DecRice = 0x800;
  static readonly Wounded = 0x1000;
  static readonly HeavyWounded = 0x2000;

  private static messages: Array<[[number, string[]], number]> | null = null;

  private static getMessageList(): Array<[[number, string[]], number]> {
    return [
      [[this.IncExp, [
        '아무일도 일어나지 않았습니다.',
        '명사와 설전을 벌였으나 망신만 당했습니다.',
        '동네 장사와 힘겨루기를 했지만 망신만 당했습니다.',
      ]], 1],
      [[this.IncHeavyExp, [
        '주점에서 사람들과 어울려 술을 마셨습니다.',
        '위기에 빠진 사람을 구해주었습니다.',
      ]], 1],
      [[this.IncHeavyExp | this.IncLeadership, [
        '백성들에게 현인의 가르침을 설파했습니다.',
        '어느 집의 도망친 가축을 되찾아 주었습니다.',
      ]], 2],
      [[this.IncHeavyExp | this.IncStrength, [
        '동네 장사와 힘겨루기를 하여 멋지게 이겼습니다.',
        '어느 집의 무너진 울타리를 고쳐주었습니다.',
      ]], 2],
      [[this.IncHeavyExp | this.IncIntel, [
        '어느 명사와 설전을 벌여 멋지게 이겼습니다.',
        '거리에서 글 모르는 아이들을 모아 글을 가르쳤습니다.',
      ]], 2],
      [[this.IncExp | this.IncGold, [
        '지나가는 행인에게서 금을 <C>:goldAmount:</> 받았습니다.',
      ]], 1],
      [[this.IncExp | this.IncRice, [
        '지나가는 행인에게서 쌀을 <C>:riceAmount:</> 받았습니다.',
      ]], 1],
      [[this.IncExp | this.DecGold, [
        '산적을 만나 금 <C>:goldAmount:</>을 빼앗겼습니다.',
        '돈을 <C>:goldAmount:</> 빌려주었다가 떼어먹혔습니다.',
      ]], 1],
      [[this.IncExp | this.DecRice, [
        '쌀을 <C>:riceAmount:</> 빌려주었다가 떼어먹혔습니다.',
      ]], 1],
      [[this.IncExp | this.Wounded, [
        '호랑이에게 물려 다쳤습니다.',
        '곰에게 할퀴어 다쳤습니다.',
      ]], 1],
      [[this.IncHeavyExp | this.Wounded, [
        '위기에 빠진 사람을 구해주다가 다쳤습니다.',
      ]], 1],
      [[this.IncExp | this.HeavyWounded, [
        '호랑이에게 물려 크게 다쳤습니다.',
        '곰에게 할퀴어 크게 다쳤습니다.',
      ]], 1],
      [[this.IncHeavyExp | this.Wounded | this.HeavyWounded, [
        '위기에 빠진 사람을 구하다가 죽을뻔 했습니다.',
      ]], 1],
      [[this.IncHeavyExp | this.IncStrength | this.IncGold, [
        '산적과 싸워 금 <C>:goldAmount:</>을 빼앗았습니다.',
      ]], 1],
      [[this.IncHeavyExp | this.IncStrength | this.IncRice, [
        '호랑이를 잡아 고기 <C>:riceAmount:</>을 얻었습니다.',
        '곰을 잡아 고기 <C>:riceAmount:</>을 얻었습니다.',
      ]], 1],
      [[this.IncHeavyExp | this.IncIntel | this.IncGold, [
        '돈을 빌려주었다가 이자 <C>:goldAmount:</>을 받았습니다.',
      ]], 1],
      [[this.IncHeavyExp | this.IncIntel | this.IncRice, [
        '쌀을 빌려주었다가 이자 <C>:riceAmount:</>을 받았습니다.',
      ]], 1],
    ];
  }

  private static initMessageList(): void {
    if (this.messages === null) {
      this.messages = this.getMessageList();
    }
  }

  public constructor() {
    SightseeingMessage.initMessageList();
  }

  public pickAction(): [number, string] {
    SightseeingMessage.initMessageList();
    if (!SightseeingMessage.messages) {
      return [0, '아무일도 일어나지 않았습니다.'];
    }

    const [[type, texts], remaining] = Util.choiceRandomUsingWeightPair(SightseeingMessage.messages);
    const text = Util.choiceRandom(texts);

    return [type, text];
  }
}
