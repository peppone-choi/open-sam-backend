import * as fs from 'fs';
import * as path from 'path';
import { configManager } from '../config/ConfigManager';

const { system } = configManager.get();
const DEFAULT_SCENARIO_ID = system.sessionId.split('_')[0] || 'sangokushi';

// 프로젝트 루트 찾기
function findProjectRoot(): string {
  // __dirname 기반으로 탐색 (dist/utils -> 프로젝트 루트)
  let currentDir = __dirname;
  
  // 최대 5단계까지 상위 디렉토리 탐색
  for (let i = 0; i < 5; i++) {
    const configDir = path.join(currentDir, 'config', 'scenarios');
    if (fs.existsSync(configDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return path.resolve(__dirname, '../..');
}

const PROJECT_ROOT = findProjectRoot();

const scenarioDataDir = path.join(PROJECT_ROOT, 'config', 'scenarios', DEFAULT_SCENARIO_ID, 'data');
const constantsPath = path.join(scenarioDataDir, 'constants.json');
const itemsPath = path.join(scenarioDataDir, 'items.json');

let cachedConstants: any | null = null;
let cachedItems: any[] | null = null;
const scenarioConfigCache: Map<string, any> = new Map();

function safeReadJson(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

export function getScenarioConfig(scenarioId: string = DEFAULT_SCENARIO_ID): any {
  if (scenarioConfigCache.has(scenarioId)) return scenarioConfigCache.get(scenarioId);
  const configPath = path.join(PROJECT_ROOT, 'config', 'scenarios', scenarioId, 'scenario.json');
  const config = safeReadJson(configPath);
  if (config) scenarioConfigCache.set(scenarioId, config);
  return config || {};
}

export function getDataAssetPath(scenarioId: string, assetName: string): string | null {
  const config = getScenarioConfig(scenarioId);
  const assetConfig = config?.data?.assets?.[assetName];
  if (!assetConfig?.file) {
    if (scenarioId !== 'sangokushi') return getDataAssetPath('sangokushi', assetName);
    return null;
  }
  return path.join(PROJECT_ROOT, 'config', 'scenarios', scenarioId, assetConfig.file);
}

export function loadDataAsset(scenarioId: string, assetName: string): any {
  const assetPath = getDataAssetPath(scenarioId, assetName);
  if (!assetPath) return null;
  const data = safeReadJson(assetPath);
  if (!data && scenarioId !== 'sangokushi') return loadDataAsset('sangokushi', assetName);
  return data;
}

export function getScenarioId(): string {
  return DEFAULT_SCENARIO_ID;
}

export function getScenarioDataPath(...segments: string[]): string {
  if (!segments.length) return scenarioDataDir;
  return path.join(scenarioDataDir, ...segments);
}

export function getScenarioConstants(): any {
  if (cachedConstants !== null) return cachedConstants;
  cachedConstants = safeReadJson(constantsPath) || {};
  return cachedConstants;
}

export function getScenarioItems(): any[] {
  if (cachedItems !== null) return cachedItems;
  const data = safeReadJson(itemsPath);
  if (Array.isArray(data)) cachedItems = data;
  else if (data && Array.isArray(data.items)) cachedItems = data.items;
  else cachedItems = [];
  return cachedItems;
}

export function resetScenarioDataCache(): void {
  cachedConstants = null;
  cachedItems = null;
  scenarioConfigCache.clear();
}
