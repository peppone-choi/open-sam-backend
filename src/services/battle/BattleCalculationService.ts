import { WarUnit } from '../../battle/WarUnit';
import { WarUnitCity } from '../../battle/WarUnitCity';
import { WarUnitGeneral } from '../../battle/WarUnitGeneral';

export interface BattleOrderStats {
  crew: number;
  rice: number;
  defenceTrain: number;
  train: number;
  atmos: number;
  realLeadership: number;
  realStrength: number;
  realIntel: number;
  fullLeadership: number;
  fullStrength: number;
  fullIntel: number;
}

export interface DamageResolutionInput {
  attackerHP: number;
  defenderHP: number;
  rawAttackerDamage: number;
  rawDefenderDamage: number;
}

export interface DamageResolutionResult {
  attackerDamage: number;
  defenderDamage: number;
}

/**
 * 순수 수치 기반 수비 순서를 계산한다.
 */
export function computeBattleOrderScore(stats: BattleOrderStats): number {
  const {
    crew,
    rice,
    defenceTrain,
    train,
    atmos,
    realLeadership,
    realStrength,
    realIntel,
    fullLeadership,
    fullStrength,
    fullIntel
  } = stats;

  if (crew <= 0) {
    return 0;
  }

  if (rice <= crew / 100) {
    return 0;
  }

  if (train < defenceTrain || atmos < defenceTrain) {
    return 0;
  }

  const realStat = realLeadership + realStrength + realIntel;
  const fullStat = fullLeadership + fullStrength + fullIntel;
  const totalStat = (realStat + fullStat) / 2;

  // 병력 보정치
  const totalCrew = crew / 1_000_000 * Math.pow(train * atmos, 1.5);

  return totalStat + totalCrew / 100;
}

/**
 * WarUnit을 받아 수비 순서를 계산한다.
 * 계산 자체는 순수함수 computeBattleOrderScore에 위임한다.
 */
export function calculateBattleOrder(defender: WarUnit, attacker: WarUnit): number {
  // 도시 수비는 장수 onCalcOpposeStat을 통해 처리
  if (defender instanceof WarUnitCity) {
    if (!(attacker instanceof WarUnitGeneral)) {
      return 0;
    }
    const attackerGeneral = attacker.getGeneral();
    if (typeof attackerGeneral.onCalcOpposeStat === 'function') {
      return attackerGeneral.onCalcOpposeStat(defender.getGeneral(), 'cityBattleOrder', -1);
    }
    return -1;
  }

  const general = defender.getGeneral();
  const crew = general.data?.crew || 0;
  const rice = general.data?.rice || 0;
  const defence_train = general.data?.defence_train || 999;
  const train = general.data?.train || 0;
  const atmos = general.data?.atmos || 0;

  const realLeadership = typeof general.getLeadership === 'function'
    ? general.getLeadership(true)
    : general.data?.leadership || 50;
  const realStrength = typeof general.getStrength === 'function'
    ? general.getStrength(true)
    : general.data?.strength || 50;
  const realIntel = typeof general.getIntel === 'function'
    ? general.getIntel(true)
    : general.data?.intel || 50;

  const fullLeadership = typeof general.getLeadership === 'function'
    ? general.getLeadership(false)
    : realLeadership;
  const fullStrength = typeof general.getStrength === 'function'
    ? general.getStrength(false)
    : realStrength;
  const fullIntel = typeof general.getIntel === 'function'
    ? general.getIntel(false)
    : realIntel;

  return computeBattleOrderScore({
    crew,
    rice,
    defenceTrain: defence_train,
    train,
    atmos,
    realLeadership,
    realStrength,
    realIntel,
    fullLeadership,
    fullStrength,
    fullIntel
  });
}

/**
 * 데미지 오버킬을 보정한 최종 피해량을 계산한다.
 * 입력은 순수 수치만 사용한다.
 */
export function resolveDamageOutcome(input: DamageResolutionInput): DamageResolutionResult {
  const attackerHP = Math.max(0, input.attackerHP);
  const defenderHP = Math.max(0, input.defenderHP);
  const rawAttackerDamage = Math.max(0, input.rawAttackerDamage);
  const rawDefenderDamage = Math.max(0, input.rawDefenderDamage);

  // 오버킬 여부 확인
  if (rawAttackerDamage > attackerHP || rawDefenderDamage > defenderHP) {
    const deadAttackerRatio = rawAttackerDamage / Math.max(1, attackerHP);
    const deadDefenderRatio = rawDefenderDamage / Math.max(1, defenderHP);

    let finalAttackerDamage = rawAttackerDamage;
    let finalDefenderDamage = rawDefenderDamage;

    if (deadDefenderRatio > deadAttackerRatio) {
      finalAttackerDamage /= deadDefenderRatio;
      finalDefenderDamage = defenderHP;
    } else {
      finalDefenderDamage /= deadAttackerRatio;
      finalAttackerDamage = attackerHP;
    }

    return {
      attackerDamage: Math.min(Math.ceil(finalAttackerDamage), attackerHP),
      defenderDamage: Math.min(Math.ceil(finalDefenderDamage), defenderHP)
    };
  }

  return {
    attackerDamage: Math.min(Math.ceil(rawAttackerDamage), attackerHP),
    defenderDamage: Math.min(Math.ceil(rawDefenderDamage), defenderHP)
  };
}








