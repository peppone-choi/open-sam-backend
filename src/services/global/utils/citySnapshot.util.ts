import { CityConst, CityConstEntry } from '../../../const/CityConst';
import { ResourceService } from '../../../common/services/resource.service';

export interface CitySnapshotOptions {
  scenarioId?: string;
}

export interface CitySnapshot {
  city: number;
  name: string;
  nation: number;
  level: number;
  state: number;
  region: number;
  x?: number;
  y?: number;
  position?: { x: number; y: number };
  neighbors?: number[];
  initialState?: Record<string, number>;
  supply: number;
  pendingSupply: number;
  supplyDeficit: number;
  [key: string]: any;
}

const toFiniteOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveNeighbors = (meta: CityConstEntry | null, city: any): number[] | undefined => {
  const candidates = [
    meta?.neighbors,
    Array.isArray(city?.neighbors) ? city.neighbors : undefined,
    Array.isArray(city?.data?.neighbors) ? city.data.neighbors : undefined
  ];

  for (const source of candidates) {
    if (!Array.isArray(source)) {
      continue;
    }
    const normalized = source
      .map(value => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      })
      .filter((value): value is number => value !== undefined);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
};

const resolvePosition = (meta: CityConstEntry | null, city: any) => {
  const explicitPosition = city?.data?.position || (typeof city?.x === 'number' && typeof city?.y === 'number' ? { x: city.x, y: city.y } : null);
  return meta?.position || explicitPosition || undefined;
};

const pickPrimaryName = (city: any, meta: CityConstEntry | null): string => {
  return city?.data?.name || city?.name || meta?.name || `City_${city?.city ?? 'unknown'}`;
};

const pickScenarioId = (options?: CitySnapshotOptions): string | undefined => options?.scenarioId;

export const buildCitySnapshot = (city: any, options?: CitySnapshotOptions): CitySnapshot => {
  const cityData = city?.data || {};
  const meta = CityConst.byID(city?.city, pickScenarioId(options));

  const normalizedSupply = ResourceService.normalizeSupplySnapshot({
    supply: city?.supply ?? cityData?.supply,
    pendingSupply: city?.pendingSupply ?? city?.pending_supply ?? cityData?.pendingSupply ?? cityData?.pending_supply
  });

  const baseSnapshot: CitySnapshot = {
    city: city?.city,
    name: pickPrimaryName(city, meta),
    nation: city?.nation ?? cityData?.nation ?? 0,
    level: city?.level ?? cityData?.level ?? meta?.levelId ?? 0,
    state: city?.state ?? cityData?.state ?? 0,
    region: city?.region ?? cityData?.region ?? meta?.regionId ?? 0,
    x: toFiniteOrUndefined(city?.x) ?? toFiniteOrUndefined(cityData?.x) ?? meta?.position?.x,
    y: toFiniteOrUndefined(city?.y) ?? toFiniteOrUndefined(cityData?.y) ?? meta?.position?.y,
    position: resolvePosition(meta, city),
    neighbors: resolveNeighbors(meta, city),
    initialState: meta?.initialState ?? cityData?.initialState,
    supply: normalizedSupply.supply,
    pendingSupply: normalizedSupply.pendingSupply,
    supplyDeficit: normalizedSupply.supplyDeficit
  };

  const snapshot: CitySnapshot = {
    ...baseSnapshot,
    ...cityData,
    city: baseSnapshot.city,
    name: cityData?.name ?? baseSnapshot.name,
    neighbors: baseSnapshot.neighbors,
    initialState: baseSnapshot.initialState,
    position: baseSnapshot.position,
    supply: baseSnapshot.supply,
    pendingSupply: baseSnapshot.pendingSupply,
    supplyDeficit: baseSnapshot.supplyDeficit
  };

  return snapshot;
};
