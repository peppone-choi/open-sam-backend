export class SightseeingMessage {
  static generate(...args: any[]): string {
    return '';
  }
  static pickAction(...args: any[]): any {
    return {};
  }
  static IncExp = 1;
  static IncHeavyExp = 2;
  static IncLeadership = 4;
  static IncStrength = 8;
  static IncIntel = 16;
  static IncGold = 32;
  static IncRice = 64;
  static DecGold = 128;
  static DecRice = 256;
  static Wounded = 512;
  static HeavyWounded = 1024;
}
