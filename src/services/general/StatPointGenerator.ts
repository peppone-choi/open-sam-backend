import crypto from 'crypto';
import { GENERAL_BACKGROUNDS, GeneralBackgroundId } from '../../constants/GeneralBackgrounds';
import { GENERAL_TRAITS, GeneralTraitId } from '../../constants/GeneralTraits';

export interface StatBlock {
  leadership: number;
  strength: number;
  intel: number;
  politics: number;
  charm: number;
}

export interface StatAdjust {
  leadership?: number;
  strength?: number;
  intel?: number;
  politics?: number;
  charm?: number;
}

export interface PointSystemInput {
  backgroundId?: GeneralBackgroundId | null;
  traitIds?: (GeneralTraitId | string)[];
  adjust?: StatAdjust;
  /**
   * 게임 환경. 기본 스탯 합/범위 등을 조정하고 싶다면 여기서 읽어 쓸 수 있다.
   */
  gameEnv?: any;
  /**
   * RNG 시드를 위한 값 (userId 등). 미지정시 랜덤.
   */
  seed?: string | number;
}

export interface PointSystemResult {
  success: boolean;
  message?: string;
  baseStats?: StatBlock;
  afterBackground?: StatBlock;
  finalStats?: StatBlock;
  availablePoint?: number;
  usedPoint?: number;
}

function randomInt(min: number, max: number): number {
  // [min, max] 범위의 정수
  const range = max - min + 1;
  const buf = crypto.randomBytes(4).readUInt32BE(0);
  return min + (buf % range);
}

function rollBaseStats(base: number = 50): StatBlock {
  const roll = () => base + randomInt(1, 10) + randomInt(1, 10); // 50 + 2~20 = 52~70
  return {
    leadership: roll(),
    strength: roll(),
    intel: roll(),
    politics: roll(),
    charm: roll(),
  };
}

function applyBackground(stats: StatBlock, backgroundId?: GeneralBackgroundId | null): StatBlock {
  if (!backgroundId) return { ...stats };
  const bg = GENERAL_BACKGROUNDS.find((b) => b.id === backgroundId);
  if (!bg || !bg.statDelta) return { ...stats };

  const delta = bg.statDelta;
  return {
    leadership: stats.leadership + (delta.leadership ?? 0),
    strength: stats.strength + (delta.strength ?? 0),
    intel: stats.intel + (delta.intel ?? 0),
    politics: stats.politics + (delta.politics ?? 0),
    charm: stats.charm + (delta.charm ?? 0),
  };
}

function computeTraitPoint(traitIds: (GeneralTraitId | string)[] | undefined): number {
  if (!traitIds || traitIds.length === 0) return 0;
  let total = 0;
  for (const id of traitIds) {
    const trait = GENERAL_TRAITS.find((t) => t.id === id);
    if (!trait) continue; // 알 수 없는 트레잇은 무시
    total += trait.pointCost;
  }
  return total;
}

function clampStats(stats: StatBlock, min: number, max: number): StatBlock {
  const c = (v: number) => Math.max(min, Math.min(max, v));
  return {
    leadership: c(stats.leadership),
    strength: c(stats.strength),
    intel: c(stats.intel),
    politics: c(stats.politics),
    charm: c(stats.charm),
  };
}

/**
 * 주사위 + 배경 + 포인트 조정으로 최종 능력치를 생성한다.
 * 아직 실제 JoinService에는 연결하지 않고, 향후 통합을 위해 분리된 헬퍼로 둔다.
 */
export function generateStatsWithPointSystem(input: PointSystemInput): PointSystemResult {
  const {
    backgroundId,
    traitIds,
    adjust,
    gameEnv,
  } = input;

  const minStat = (gameEnv?.defaultStatMin ?? 15) as number;
  const maxStat = (gameEnv?.defaultStatMax ?? 90) as number;
  const basePoint = (gameEnv?.defaultStatPoint ?? 20) as number;

  // 1) 기본 주사위
  const baseStats = rollBaseStats(gameEnv?.defaultBaseStat ?? 50);

  // 2) 배경 적용
  const afterBackground = applyBackground(baseStats, backgroundId);

  // 3) 트레잇 포인트 계산
  const traitPointCost = computeTraitPoint(traitIds);
  const availablePoint = basePoint - traitPointCost;
  if (availablePoint < 0) {
    return {
      success: false,
      message: `트레잇이 너무 강력합니다. 포인트가 ${-availablePoint}만큼 부족합니다.`,
      baseStats,
      afterBackground,
      availablePoint,
    };
  }

  const adj: StatAdjust = adjust || {};
  const lAdj = adj.leadership ?? 0;
  const sAdj = adj.strength ?? 0;
  const iAdj = adj.intel ?? 0;
  const pAdj = adj.politics ?? 0;
  const cAdj = adj.charm ?? 0;

  const positives = [lAdj, sAdj, iAdj, pAdj, cAdj].reduce((sum, v) => sum + Math.max(0, v), 0);
  const negatives = [lAdj, sAdj, iAdj, pAdj, cAdj].reduce((sum, v) => sum + Math.max(0, -v), 0);
  const usedPoint = positives - negatives;

  if (usedPoint !== availablePoint) {
    return {
      success: false,
      message: `포인트 사용이 맞지 않습니다. 사용 포인트: ${usedPoint}, 사용 가능 포인트: ${availablePoint}`,
      baseStats,
      afterBackground,
      availablePoint,
      usedPoint,
    };
  }

  // 4) 조정 적용
  const finalStatsRaw: StatBlock = {
    leadership: afterBackground.leadership + lAdj,
    strength: afterBackground.strength + sAdj,
    intel: afterBackground.intel + iAdj,
    politics: afterBackground.politics + pAdj,
    charm: afterBackground.charm + cAdj,
  };

  const finalStats = clampStats(finalStatsRaw, minStat, maxStat);

  return {
    success: true,
    baseStats,
    afterBackground,
    finalStats,
    availablePoint,
    usedPoint,
  };
}
