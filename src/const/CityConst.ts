import fs from 'fs';
import path from 'path';

export interface CityConstEntry {
  city: number;
  name: string;
  levelId?: number;
  regionId?: number;
  position?: { x: number; y: number };
  neighbors?: number[];
  initialState?: Record<string, number>;
}

interface CityCacheEntry {
  list: CityConstEntry[];
  map: Map<number, CityConstEntry>;
}

const cityCache = new Map<string, CityCacheEntry>();
const DEFAULT_SCENARIO = process.env.SCENARIO_ID || 'sangokushi';

function resolveCitiesPath(scenarioId: string): string | null {
  const normalized = scenarioId || DEFAULT_SCENARIO;
  const projectRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(projectRoot, 'config', 'scenarios', normalized, 'data', 'cities.json'),
    path.join(process.cwd(), 'config', 'scenarios', normalized, 'data', 'cities.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function loadCitiesFile(scenarioId: string): any {
  const filePath = resolveCitiesPath(scenarioId);
  if (!filePath) {
    return { cities: [] };
  }

  try {
    const fileData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileData);
  } catch (error) {
    console.error(`[CityConst] Failed to parse cities.json for scenario ${scenarioId}:`, error);
    return { cities: [] };
  }
}

function buildCache(scenarioId: string): CityCacheEntry {
  const normalized = scenarioId || DEFAULT_SCENARIO;
  const data = loadCitiesFile(normalized);
  const list: CityConstEntry[] = [];
  const map = new Map<number, CityConstEntry>();

  if (Array.isArray(data?.cities)) {
    for (const rawCity of data.cities) {
      const cityId = rawCity?.id ?? rawCity?.city;
      if (typeof cityId !== 'number') {
        continue;
      }

      const entry: CityConstEntry = {
        city: cityId,
        name: rawCity?.name || `City_${cityId}`,
        levelId: rawCity?.levelId ?? rawCity?.level,
        regionId: rawCity?.regionId ?? rawCity?.region,
        position: rawCity?.position,
        neighbors: Array.isArray(rawCity?.neighbors) ? rawCity.neighbors : undefined,
        initialState: rawCity?.initialState,
      };

      list.push(entry);
      map.set(cityId, entry);
    }
  }

  const cacheEntry: CityCacheEntry = { list, map };
  cityCache.set(normalized, cacheEntry);
  return cacheEntry;
}

function getCache(scenarioId?: string): CityCacheEntry {
  const normalized = scenarioId || DEFAULT_SCENARIO;
  if (cityCache.has(normalized)) {
    return cityCache.get(normalized)!;
  }
  return buildCache(normalized);
}

export const CityConst = {
  getCityList: (scenarioId?: string): CityConstEntry[] => {
    const cacheEntry = getCache(scenarioId);
    return cacheEntry.list.slice();
  },
  byID: (cityId: number, scenarioId?: string): CityConstEntry | null => {
    if (typeof cityId !== 'number' || Number.isNaN(cityId)) {
      return null;
    }
    const cacheEntry = getCache(scenarioId);
    const entry = cacheEntry.map.get(cityId);
    return entry ? { ...entry } : null;
  },
  clearCache: (): void => {
    cityCache.clear();
  }
};
