export class Util {
  static joinYearMonth(year: number, month: number): number {
    return year * 12 + month;
  }

  static splitYearMonth(yearMonth: number): [number, number] {
    const year = Math.floor(yearMonth / 12);
    const month = yearMonth % 12;
    return [year, month];
  }

  static clamp(value: number, min: number, max?: number): number {
    if (max === undefined) return Math.max(value, min);
    return Math.max(min, Math.min(max, value));
  }

  static round(value: number, decimals: number = 0): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

  static valueFit(value: number, min: number, max?: number): number {
    if (max === undefined) return Math.max(value, min);
    return Math.max(min, Math.min(max, value));
  }

  static toInt(value: any): number {
    return parseInt(value, 10) || 0;
  }

  static convertArrayToDict<T>(array: T[], keyField: keyof T): Record<string, T> {
    const result: Record<string, T> = {};
    for (const item of array) {
      const key = String(item[keyField]);
      result[key] = item;
    }
    return result;
  }

  static range(start: number, end: number, step: number = 1): number[] {
    const result: number[] = [];
    for (let i = start; i < end; i += step) {
      result.push(i);
    }
    return result;
  }

  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static formatNumber(num: number): string {
    return num.toLocaleString();
  }

  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  static pick<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  static groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    const result = {} as Record<K, T[]>;
    for (const item of array) {
      const key = keyFn(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
    }
    return result;
  }

  static sum(array: number[]): number {
    return array.reduce((acc, val) => acc + val, 0);
  }

  static average(array: number[]): number {
    if (array.length === 0) return 0;
    return this.sum(array) / array.length;
  }

  static unique<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  }

  static chunk<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  static flatten<T>(array: T[][]): T[] {
    return array.reduce((acc, val) => acc.concat(val), []);
  }

  static isEmpty(obj: any): boolean {
    if (obj === null || obj === undefined) return true;
    if (Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    if (typeof obj === 'string') return obj.length === 0;
    return false;
  }

  static deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  static arraySum(arr: any[]): number { return arr.reduce((a: any, b: any) => a + b, 0); }
  static arrayGroupBy(arr: any[], key: string): any { 
    return arr.reduce((acc: any, item: any) => {
      const group = item[key];
      acc[group] = acc[group] || [];
      acc[group].push(item);
      return acc;
    }, {});
  }

}
