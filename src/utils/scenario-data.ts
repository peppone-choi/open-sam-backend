import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_SCENARIO_ID = process.env.DEFAULT_SCENARIO_ID || 'sangokushi';
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

const scenarioDataDir = path.join(PROJECT_ROOT, 'config', 'scenarios', DEFAULT_SCENARIO_ID, 'data');
const constantsPath = path.join(scenarioDataDir, 'constants.json');
const itemsPath = path.join(scenarioDataDir, 'items.json');

let cachedConstants: any | null = null;
let cachedItems: any[] | null = null;

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
}
