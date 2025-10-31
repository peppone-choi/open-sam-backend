export class GameUnitConst {
  static readonly crewTypeList: any[] = [];
  static readonly crewTypes: Record<string, any> = {};
  
  static allType(key?: string): any {
    return key ? {} : {};
  }
}
