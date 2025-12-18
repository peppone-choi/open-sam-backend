import fs from 'fs';
import path from 'path';
import { GameUnitConst } from '../../const/GameUnitConst';

// 스택 시스템 제거됨
type IUnitStack = any;

export interface ParsedGarrisonEntry {
  cityId: number;
  stacks: Array<Partial<IUnitStack>>;
}

export interface FallbackDefender {
  label: string;
  unit: {
    name: string;
    crew: number;
    crewtype: number;
    leadership: number;
    strength: number;
    intel: number;
    train: number;
    morale: number;
  };
}

interface CityLike {
  city?: number;
  id?: number;
  level?: number;
  levelId?: number;
  name?: string;
}

interface GarrisonStackConfig {
  crewTypeId: number;
  crewTypeName?: string;
  stackCount: number;
  unitSize?: number;
  train?: number;
  morale?: number;
}

interface GarrisonCommanderConfig {
  name?: string;
  title?: string;
  leadership?: number;
  strength?: number;
  intel?: number;
  crewTypeId?: number;
  train?: number;
  morale?: number;
}

interface GarrisonPattern {
  label?: string;
  stacks: GarrisonStackConfig[];
  commander?: GarrisonCommanderConfig;
}

interface GarrisonRule {
  pattern: string;
  cityIds?: number[];
  levelGte?: number;
  levelLte?: number;
  levelEq?: number;
  default?: boolean;
}

interface ParsedGarrisonConfig {
  directEntries: Map<number, Array<Partial<IUnitStack>>>;
  patterns: Record<string, GarrisonPattern>;
  rules: GarrisonRule[];
}

const garrisonCache = new Map<string, ParsedGarrisonConfig | null>();

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeScenarioKey(scenarioId: string): string {
  if (!scenarioId) return 'sangokushi';
  const trimmed = scenarioId.includes('/') ? scenarioId.split('/')[0] : scenarioId;
  if (trimmed.includes('_')) {
    return trimmed.split('_')[0];
  }
  return trimmed;
}

function readGarrisonFile(scenarioKey: string): any | null {
  const filePath = path.join(process.cwd(), 'config', 'scenarios', scenarioKey, 'data', 'garrisons.json');
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[GarrisonHelper] Failed to parse ${filePath}:`, error);
    return null;
  }
}

function ensureArray(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [];
}

function parseDirectEntries(raw: any, scenarioKey: string): Map<number, Array<Partial<IUnitStack>>> {
  const entries = new Map<number, Array<Partial<IUnitStack>>>();
  const list = ensureArray(raw?.garrisons ?? raw);

  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const cityIdRaw = (entry as any).cityId ?? (entry as any).city ?? (entry as any).id;
    const cityId = Number(cityIdRaw);
    if (!Number.isInteger(cityId) || cityId <= 0) continue;

    const stacksRaw = ensureArray((entry as any).stacks);
    const stacks: Array<Partial<IUnitStack>> = [];
    for (const stackRaw of stacksRaw) {
      if (!stackRaw || typeof stackRaw !== 'object') continue;
      const crewTypeIdRaw = (stackRaw as any).crewTypeId ?? (stackRaw as any).unitId ?? (stackRaw as any).id;
      const crewTypeId = Number(crewTypeIdRaw);
      if (!Number.isInteger(crewTypeId)) continue;

      const unitSize = Number((stackRaw as any).unitSize ?? (stackRaw as any).unit_size ?? 100) || 100;
      const stackCount = Number((stackRaw as any).stackCount ?? (stackRaw as any).stack_count ?? (stackRaw as any).count ?? 0);
      if (!Number.isFinite(stackCount) || stackCount <= 0) continue;

      const train = clamp(Number((stackRaw as any).train ?? 70), 0, 100);
      const morale = clamp(Number((stackRaw as any).morale ?? 70), 0, 100);
      const hp = Number((stackRaw as any).hp ?? unitSize * stackCount);

      let crewTypeName =
        (stackRaw as any).crewTypeName ??
        (stackRaw as any).name ??
        undefined;

      if (!crewTypeName) {
        try {
          crewTypeName = GameUnitConst.byID(crewTypeId, scenarioKey).name;
        } catch {
          crewTypeName = `병종 ${crewTypeId}`;
        }
      }

      stacks.push({
        crew_type_id: crewTypeId,
        crew_type_name: crewTypeName,
        unit_size: unitSize,
        stack_count: stackCount,
        train,
        morale,
        hp,
        commander_no: (stackRaw as any).commanderNo ?? (stackRaw as any).commander_no,
        commander_name: (stackRaw as any).commanderName ?? (stackRaw as any).commander_name,
        equipment: (stackRaw as any).equipment ?? {},
        status: (stackRaw as any).status ?? 'active',
        note: (stackRaw as any).note,
      });
    }

    if (stacks.length > 0) {
      entries.set(cityId, stacks);
    }
  }

  return entries;
}

function parsePatterns(raw: any): Record<string, GarrisonPattern> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const patterns: Record<string, GarrisonPattern> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const stacksRaw = ensureArray((value as any).stacks);
    if (!stacksRaw.length) continue;
    const stacks = stacksRaw.reduce<GarrisonStackConfig[]>((acc, stack: any) => {
      if (!stack || typeof stack !== 'object') return acc;
      const crewTypeId = Number(stack.crewTypeId ?? stack.unitId ?? stack.id);
      const stackCount = Number(stack.stackCount ?? stack.stack_count ?? stack.count ?? 0);
      if (!Number.isInteger(crewTypeId) || stackCount <= 0) {
        return acc;
      }
      acc.push({
        crewTypeId,
        crewTypeName: stack.crewTypeName ?? stack.name,
        stackCount,
        unitSize: Number(stack.unitSize ?? stack.unit_size ?? 100) || 100,
        train: typeof stack.train === 'number' ? clamp(stack.train, 0, 100) : undefined,
        morale: typeof stack.morale === 'number' ? clamp(stack.morale, 0, 100) : undefined,
      });
      return acc;
    }, []);
    if (!stacks.length) continue;

    const commanderRaw = (value as any).commander;
    let commander: GarrisonCommanderConfig | undefined;
    if (commanderRaw && typeof commanderRaw === 'object') {
      commander = {
        name: commanderRaw.name,
        title: commanderRaw.title,
        leadership: typeof commanderRaw.leadership === 'number' ? clamp(commanderRaw.leadership, 0, 150) : undefined,
        strength: typeof commanderRaw.strength === 'number' ? clamp(commanderRaw.strength, 0, 150) : undefined,
        intel: typeof commanderRaw.intel === 'number' ? clamp(commanderRaw.intel, 0, 150) : undefined,
        crewTypeId: typeof commanderRaw.crewTypeId === 'number' ? commanderRaw.crewTypeId : undefined,
        train: typeof commanderRaw.train === 'number' ? clamp(commanderRaw.train, 0, 100) : undefined,
        morale: typeof commanderRaw.morale === 'number' ? clamp(commanderRaw.morale, 0, 100) : undefined,
      };
    }

    patterns[key] = {
      label: (value as any).label,
      stacks,
      commander,
    };
  }
  return patterns;
}

function parseRules(raw: any): GarrisonRule[] {
  const list = ensureArray(raw);
  const rules: GarrisonRule[] = [];
  for (const rule of list) {
    if (!rule || typeof rule !== 'object') continue;
    const pattern = (rule as any).pattern;
    if (!pattern || typeof pattern !== 'string') continue;
    const cityIds = ensureArray((rule as any).cityIds)
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const parsedRule: GarrisonRule = {
      pattern,
      cityIds: cityIds.length ? cityIds : undefined,
      levelGte: typeof (rule as any).levelGte === 'number' ? (rule as any).levelGte : undefined,
      levelLte: typeof (rule as any).levelLte === 'number' ? (rule as any).levelLte : undefined,
      levelEq: typeof (rule as any).levelEq === 'number' ? (rule as any).levelEq : undefined,
      default: Boolean((rule as any).default),
    };
    rules.push(parsedRule);
  }
  return rules;
}

function loadConfig(scenarioId: string): ParsedGarrisonConfig | null {
  const scenarioKey = normalizeScenarioKey(scenarioId);
  if (garrisonCache.has(scenarioKey)) {
    return garrisonCache.get(scenarioKey) ?? null;
  }

  const raw = readGarrisonFile(scenarioKey);
  if (!raw) {
    garrisonCache.set(scenarioKey, null);
    return null;
  }

  const directEntries = parseDirectEntries(raw, scenarioKey);
  const patterns = parsePatterns(raw.patterns);
  const rules = parseRules(raw.rules);

  const config: ParsedGarrisonConfig = {
    directEntries,
    patterns,
    rules,
  };
  garrisonCache.set(scenarioKey, config);
  return config;
}

function determineCityId(city: CityLike): number {
  if (typeof city.city === 'number') return city.city;
  if (typeof city.id === 'number') return city.id;
  return 0;
}

function determineCityLevel(city: CityLike): number {
  if (typeof city.level === 'number') return city.level;
  if (typeof city.levelId === 'number') return city.levelId;
  return 0;
}

function cloneStackList(stacks: Array<Partial<IUnitStack>>, cityId: number): Array<Partial<IUnitStack>> {
  return stacks.map((stack) => ({
    ...stack,
    city_id: cityId,
  }));
}

function resolvePatternForCity(city: CityLike, config: ParsedGarrisonConfig): GarrisonPattern | null {
  const cityId = determineCityId(city);
  const level = determineCityLevel(city);
  let defaultPattern: GarrisonPattern | null = null;

  for (const rule of config.rules) {
    if (rule.cityIds && cityId && rule.cityIds.includes(cityId)) {
      return config.patterns[rule.pattern] || null;
    }
    if (typeof rule.levelEq === 'number' && level === rule.levelEq) {
      return config.patterns[rule.pattern] || null;
    }
    if (typeof rule.levelGte === 'number' && level < rule.levelGte) {
      continue;
    }
    if (typeof rule.levelLte === 'number' && level > rule.levelLte) {
      continue;
    }
    if (
      rule.levelGte !== undefined ||
      rule.levelLte !== undefined
    ) {
      if (
        (rule.levelGte === undefined || level >= rule.levelGte) &&
        (rule.levelLte === undefined || level <= rule.levelLte)
      ) {
        return config.patterns[rule.pattern] || null;
      }
    }
    if (rule.default && !defaultPattern) {
      defaultPattern = config.patterns[rule.pattern] || null;
    }
  }

  return defaultPattern;
}

function buildStacksFromPattern(
  pattern: GarrisonPattern,
  cityId: number,
  scenarioKey: string
): Array<Partial<IUnitStack>> {
  return pattern.stacks.map((stackConf) => {
    let crewTypeName = stackConf.crewTypeName;
    if (!crewTypeName) {
      try {
        crewTypeName = GameUnitConst.byID(stackConf.crewTypeId, scenarioKey).name;
      } catch {
        crewTypeName = `병종 ${stackConf.crewTypeId}`;
      }
    }
    const unitSize = stackConf.unitSize ?? 100;
    const stackCount = stackConf.stackCount;
    return {
      crew_type_id: stackConf.crewTypeId,
      crew_type_name: crewTypeName,
      unit_size: unitSize,
      stack_count: stackCount,
      train: stackConf.train ?? 70,
      morale: stackConf.morale ?? 70,
      hp: unitSize * stackCount,
      city_id: cityId,
    };
  });
}

export function generateInitialGarrisonsForCities(
  scenarioId: string,
  cities: CityLike[]
): ParsedGarrisonEntry[] {
  const config = loadConfig(scenarioId);
  if (!config) return [];
  const scenarioKey = normalizeScenarioKey(scenarioId);

  const entries: ParsedGarrisonEntry[] = [];
  const usedCityIds = new Set<number>();

  // Direct entries take precedence
  for (const [cityId, stacks] of config.directEntries.entries()) {
    entries.push({
      cityId,
      stacks: cloneStackList(stacks, cityId),
    });
    usedCityIds.add(cityId);
  }

  for (const city of cities) {
    const cityId = determineCityId(city);
    if (!cityId || usedCityIds.has(cityId)) continue;
    const pattern = resolvePatternForCity(city, config);
    if (!pattern) continue;
    const stacks = buildStacksFromPattern(pattern, cityId, scenarioKey);
    if (stacks.length === 0) continue;
    entries.push({ cityId, stacks });
    usedCityIds.add(cityId);
  }

  return entries;
}

export function resolveFallbackDefender(
  sessionId: string,
  city: CityLike
): FallbackDefender | null {
  const config = loadConfig(sessionId);
  if (!config) return null;
  const pattern = resolvePatternForCity(city, config);
  if (!pattern) return null;

  const cityName = city.name ?? '도시';
  const commander = pattern.commander ?? {};
  const label = pattern.label ?? commander.title ?? commander.name ?? `${cityName} 수비대`;
  const crew = pattern.stacks.reduce(
    (sum, stack) => sum + (stack.unitSize ?? 100) * (stack.stackCount ?? 0),
    0
  );
  if (crew <= 0) {
    return null;
  }

  const unit: FallbackDefender['unit'] = {
    name: commander.name ?? `${cityName} 수비대`,
    crew,
    crewtype: commander.crewTypeId ?? pattern.stacks[0]?.crewTypeId ?? 1100,
    leadership: commander.leadership ?? 55,
    strength: commander.strength ?? 55,
    intel: commander.intel ?? 45,
    train: commander.train ?? pattern.stacks[0]?.train ?? 65,
    morale: commander.morale ?? pattern.stacks[0]?.morale ?? 65,
  };

  return { label, unit };
}

