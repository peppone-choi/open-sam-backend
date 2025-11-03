export function getDexLevelList(level: number): any[] {
  return [];
}

export function tryUniqueItemLottery(...args: any[]): any {
  return null;
}

export function CheckHall(...args: any[]): any {
  return null;
}

export function checkOfficerLevel(...args: any[]): any {
  return 0;
}

export function getNationType(...args: any[]): any {
  return 0;
}

export async function searchDistance(cityId: number, range: number, onlyOccupied: boolean): Promise<Record<number, number>> {
  return {};
}

export function getVirtualPower(...args: any[]): number {
  return 0;
}

import { Nation } from '../models';

/**
 * 국가의 정적 정보 조회 (PHP func.php의 getNationStaticInfo)
 * nationID가 0이면 재야 정보 반환
 * -1이면 전체 국가 목록 반환
 */
export async function getNationStaticInfo(nationID: number | null): Promise<any> {
  if (nationID === null) {
    return null;
  }
  
  // 재야 (nation 0)
  if (nationID === 0) {
    return {
      nation: 0,
      name: '재야',
      color: '#000000',
      type: 'None',
      level: 0,
      capital: 0,  // 재야는 수도 없음
      gold: 0,
      rice: 2000,
      tech: 0,
      gennum: 1,
      power: 1
    };
  }
  
  // 전체 목록 요청
  if (nationID === -1) {
    const nations = await (Nation as any).find({}).select('nation name color type level capital gennum power');
    const nationDict: Record<number, any> = {};
    nations.forEach((nation: any) => {
      nationDict[nation.nation] = {
        nation: nation.nation,
        name: nation.name,
        color: nation.color,
        type: nation.type,
        level: nation.level,
        capital: nation.capital,
        gennum: nation.gennum,
        power: nation.power
      };
    });
    return nationDict;
  }
  
  // 개별 국가 조회
  const nation = await (Nation as any).findOne({ nation: nationID }).select('nation name color type level capital gennum power');
  if (!nation) {
    return null;
  }
  
  return {
    nation: nation.nation,
    name: nation.name,
    color: nation.color,
    type: nation.type,
    level: nation.level,
    capital: nation.capital,
    gennum: nation.gennum,
    power: nation.power
  };
}

export function refreshNationStaticInfo(...args: any[]): void {
}

export function buildItemClass(...args: any[]): any {
  return null;
}
