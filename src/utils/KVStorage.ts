export class KVStorage {
  static async getValuesAsDict(keys: string[]): Promise<Record<string, any>> {
    return {};
  }
  
  static async getValue(key: string): Promise<any> {
    return null;
  }
  
  static async setValue(key: string, value: any): Promise<void> {
  }
  
  static async getValuesFromInterNamespace(...args: any[]): Promise<Record<string, any>> {
    return {};
  }
}
