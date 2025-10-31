export class JSON {
  static encode(data: any): string {
    return globalThis.JSON.stringify(data);
  }
  
  static decode(data: string): any {
    return globalThis.JSON.parse(data);
  }
}
