import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_SCENARIO_ID = process.env.DEFAULT_SCENARIO_ID || 'sangokushi';

// 프로젝트 루트 찾기: package.json이 있는 디렉토리 탐색
function findProjectRoot(): string {
  // 환경변수가 설정되어 있으면 사용
  if (process.env.PROJECT_ROOT) {
    return process.env.PROJECT_ROOT;
  }
  
  // __dirname 기반으로 탐색 (dist/utils -> 프로젝트 루트)
  let currentDir = __dirname;
  
  // 최대 5단계까지 상위 디렉토리 탐색
  for (let i = 0; i < 5; i++) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const configDir = path.join(currentDir, 'config', 'scenarios');
    
    // config/scenarios 폴더가 있는 디렉토리를 프로젝트 루트로 간주
    if (fs.existsSync(configDir)) {
      return currentDir;
    }
    
    // package.json이 있고 이름이 open-sam-backend인지 확인
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (pkg.name === 'open-sam-backend') {
          return currentDir;
        }
      } catch {}
    }
    
    currentDir = path.dirname(currentDir);
  }
  
  // 폴백: __dirname 기반
  return path.resolve(__dirname, '../..');
}

const PROJECT_ROOT = findProjectRoot();

console.log('[scenario-data] PROJECT_ROOT:', PROJECT_ROOT);
console.log('[scenario-data] __dirname:', __dirname);

const scenarioDataDir = path.join(PROJECT_ROOT, 'config', 'scenarios', DEFAULT_SCENARIO_ID, 'data');
const constantsPath = path.join(scenarioDataDir, 'constants.json');
const itemsPath = path.join(scenarioDataDir, 'items.json');

console.log('[scenario-data] constantsPath:', constantsPath);
console.log('[scenario-data] exists:', fs.existsSync(constantsPath));

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
