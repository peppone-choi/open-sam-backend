/**
 * 게임 내 권한 체크 유틸리티
 * 장수의 국가 소속, 직책 등을 확인하는 함수들
 */

import { IGeneral } from '../../api/general/@types/general.types';
import { INation } from '../../api/nation/@types/nation.types';

/**
 * 장수가 군주(수뇌)인지 확인
 */
export function isChief(general: IGeneral): boolean {
  return general.officerLevel === 1;
}

/**
 * 장수가 특정 국가에 소속되어 있는지 확인
 */
export function belongsToNation(general: IGeneral, nationId: string): boolean {
  return general.nation === nationId;
}

/**
 * 장수가 특정 국가의 군주인지 확인
 */
export function isChiefOfNation(general: IGeneral, nationId: string): boolean {
  return isChief(general) && belongsToNation(general, nationId);
}

/**
 * 장수가 국가에 소속되어 있는지 확인 (야인이 아닌지)
 */
export function hasNation(general: IGeneral): boolean {
  return general.nation !== undefined && general.nation !== null && general.nation !== '';
}

/**
 * 장수가 야인(무소속)인지 확인
 */
export function isRonin(general: IGeneral): boolean {
  return !hasNation(general);
}

/**
 * 장수가 NPC인지 확인
 */
export function isNPC(general: IGeneral): boolean {
  return general.npc === true;
}

/**
 * 장수가 플레이어(유저)인지 확인
 */
export function isPlayer(general: IGeneral): boolean {
  return !isNPC(general) && general.owner !== undefined && general.owner !== null;
}

/**
 * 장수가 특정 유저의 소유인지 확인
 */
export function isOwnedBy(general: IGeneral, userId: string): boolean {
  return general.owner === userId;
}

/**
 * 장수가 특정 도시에 있는지 확인
 */
export function isInCity(general: IGeneral, cityId: string): boolean {
  return general.city === cityId;
}

/**
 * 장수가 도시를 소유하고 있는지 확인
 */
export function hasCity(general: IGeneral): boolean {
  return general.city !== undefined && general.city !== null && general.city !== '';
}

/**
 * 장수가 부대에 소속되어 있는지 확인
 */
export function isInTroop(general: IGeneral): boolean {
  return general.troop !== undefined && general.troop !== null && general.troop !== '';
}

/**
 * 장수가 승상(재상)인지 확인
 */
export function isPrimeMinister(general: IGeneral): boolean {
  return general.officerLevel === 2;
}

/**
 * 장수가 특정 직책 레벨 이상인지 확인
 */
export function hasOfficerLevel(general: IGeneral, minLevel: number): boolean {
  return general.officerLevel >= minLevel;
}

/**
 * 장수가 특정 권한을 가지고 있는지 확인
 */
export function hasPermission(
  general: IGeneral,
  permission: 'normal' | 'auditor' | 'ambassador'
): boolean {
  return general.permission === permission;
}

/**
 * 장수가 감찰관 권한을 가지고 있는지 확인
 */
export function isAuditor(general: IGeneral): boolean {
  return hasPermission(general, 'auditor');
}

/**
 * 장수가 외교관 권한을 가지고 있는지 확인
 */
export function isAmbassador(general: IGeneral): boolean {
  return hasPermission(general, 'ambassador');
}

/**
 * 장수가 정상적으로 소속되어 있는지 확인 (배신자가 아닌지)
 */
export function hasNormalBelong(general: IGeneral): boolean {
  return general.belong === 1;
}

/**
 * 장수가 배신자인지 확인
 */
export function isBetrayedRecently(general: IGeneral): boolean {
  return general.betray > 0;
}

/**
 * 장수가 블록 상태인지 확인
 */
export function isBlocked(general: IGeneral): boolean {
  return general.block === true;
}

/**
 * 장수가 살아있는지 확인 (죽은 해가 0 또는 설정되지 않음)
 */
export function isAlive(general: IGeneral): boolean {
  return general.deadYear === 0 || general.deadYear === undefined;
}

/**
 * 두 장수가 같은 국가에 소속되어 있는지 확인
 */
export function isSameNation(generalA: IGeneral, generalB: IGeneral): boolean {
  return (
    hasNation(generalA) &&
    hasNation(generalB) &&
    generalA.nation === generalB.nation
  );
}

/**
 * 두 장수가 같은 도시에 있는지 확인
 */
export function isSameCity(generalA: IGeneral, generalB: IGeneral): boolean {
  return (
    hasCity(generalA) &&
    hasCity(generalB) &&
    generalA.city === generalB.city
  );
}

/**
 * 국가가 중립 국가인지 확인
 */
export function isNeutralNation(nation: INation): boolean {
  return nation.type.includes('중립') || nation.type === 'neutral';
}

/**
 * 국가가 멸망했는지 확인 (장수가 0명)
 */
export function isDestroyedNation(nation: INation): boolean {
  return nation.genNum === 0;
}

/**
 * 국가가 전쟁 상태인지 확인
 */
export function isAtWar(nation: INation): boolean {
  return nation.war === true;
}

/**
 * 장수가 특정 세션에 속하는지 확인
 */
export function belongsToSession(general: IGeneral, sessionId: string): boolean {
  return general.sessionId === sessionId;
}

/**
 * 국가가 특정 세션에 속하는지 확인
 */
export function nationBelongsToSession(nation: INation, sessionId: string): boolean {
  return nation.sessionId === sessionId;
}
