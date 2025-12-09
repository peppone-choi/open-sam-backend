import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_SCENARIO_ID = process.env.DEFAULT_SCENARIO_ID || 'sangokushi';
// __dirname 기반으로 프로젝트 루트 계산 (dist/utils -> 프로젝트 루트)
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '../..');

const scenarioDataDir = path.join(PROJECT_ROOT, 'config', 'scenarios', DEFAULT_SCENARIO_ID, 'data');
const constantsPath = path.join(scenarioDataDir, 'constants.json');
const itemsPath = path.join(scenarioDataDir, 'items.json');

let cachedConstants: any | null = null;
let cachedItems: any[] | null = null;
const scenarioConfigCache: Map<string, any> = new Map();

function safeReadJson(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error: any) {
    console.warn(`[scenario-data] Failed to read ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * 시나리오 설정(scenario.json) 로드
 * @param scenarioId 시나리오 ID (예: 'sangokushi', 'legend-of-galactic-heroes')
 */
export function getScenarioConfig(scenarioId: string = DEFAULT_SCENARIO_ID): any {
  if (scenarioConfigCache.has(scenarioId)) {
    return scenarioConfigCache.get(scenarioId);
  }

  const scenarioDir = path.join(PROJECT_ROOT, 'config', 'scenarios', scenarioId);
  const configPath = path.join(scenarioDir, 'scenario.json');
  const config = safeReadJson(configPath);

  if (config) {
    scenarioConfigCache.set(scenarioId, config);
  }

  return config || {};
}

/**
 * 시나리오 데이터 에셋 경로 가져오기
 * scenario.json의 data.assets에서 경로를 읽어옴
 * @param scenarioId 시나리오 ID
 * @param assetName 에셋 이름 ('units', 'map', 'cities' 등)
 * @returns 절대 경로 또는 null
 */
export function getDataAssetPath(scenarioId: string, assetName: string): string | null {
  const config = getScenarioConfig(scenarioId);
  const assetConfig = config?.data?.assets?.[assetName];

  if (!assetConfig?.file) {
    // 기본 경로 사용 (sangokushi fallback)
    if (scenarioId !== 'sangokushi') {
      return getDataAssetPath('sangokushi', assetName);
    }
    return null;
  }

  const scenarioDir = path.join(PROJECT_ROOT, 'config', 'scenarios', scenarioId);
  return path.join(scenarioDir, assetConfig.file);
}

/**
 * 시나리오 데이터 에셋 로드
 * @param scenarioId 시나리오 ID
 * @param assetName 에셋 이름 ('units', 'map', 'cities' 등)
 */
export function loadDataAsset(scenarioId: string, assetName: string): any {
  const assetPath = getDataAssetPath(scenarioId, assetName);
  if (!assetPath) {
    console.warn(`[scenario-data] Asset path not found: ${assetName} for scenario ${scenarioId}`);
    return null;
  }

  const data = safeReadJson(assetPath);
  if (!data) {
    // fallback to sangokushi
    if (scenarioId !== 'sangokushi') {
      console.warn(`[scenario-data] Asset not found, falling back to sangokushi: ${assetName}`);
      return loadDataAsset('sangokushi', assetName);
    }
  }

  return data;
}

export function getScenarioId(): string {
  return DEFAULT_SCENARIO_ID;
}

export function getScenarioDataPath(...segments: string[]): string {
  if (!segments.length) {
    return scenarioDataDir;
  }
  return path.join(scenarioDataDir, ...segments);
}

export function getScenarioConstants(): any {
  if (cachedConstants !== null) {
    return cachedConstants;
  }
  cachedConstants = safeReadJson(constantsPath) || {};
  return cachedConstants;
}

export function getScenarioItems(): any[] {
  if (cachedItems !== null) {
    return cachedItems;
  }
  const data = safeReadJson(itemsPath);
  if (Array.isArray(data)) {
    cachedItems = data;
  } else if (data && Array.isArray(data.items)) {
    cachedItems = data.items;
  } else {
    cachedItems = [];
  }
  return cachedItems;
}

export function resetScenarioDataCache(): void {
  cachedConstants = null;
  cachedItems = null;
  scenarioConfigCache.clear();
}
