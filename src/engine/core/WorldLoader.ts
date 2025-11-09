/**
 * 범용 게임 엔진 - WorldLoader
 * JSON 파일에서 World 객체 생성
 */

import * as fs from 'fs';
import * as path from 'path';
import { World, WorldConfig, StatDefinition, ResourceDefinition, ActionDefinition } from './World';

/**
 * WorldLoader 클래스
 * JSON 파일을 로드하여 World 객체 생성
 */
export class WorldLoader {
  private static configRoot = path.join(__dirname, '../../../config/worlds');

  /**
   * 세계관 로드
   * @param worldId 세계관 ID (예: 'threekingdoms', 'gineiden')
   */
  static async load(worldId: string): Promise<World> {
    const worldPath = path.join(this.configRoot, worldId);

    // world.json 로드
    const worldConfig = await this.loadWorldConfig(worldPath);

    // stats 로드
    const stats = await this.loadStats(worldPath);

    // resources 로드
    const resources = await this.loadResources(worldPath);

    // actions 로드 (actions-all.json 우선, 없으면 actions.json)
    const actions = await this.loadActions(worldPath);

    // WorldConfig 구성
    const config: WorldConfig = {
      id: worldConfig.id || worldId,
      name: worldConfig.name || worldId,
      description: worldConfig.description || '',
      stats,
      resources,
      actions
    };

    return new World(config);
  }

  /**
   * world.json 로드
   */
  private static async loadWorldConfig(worldPath: string): Promise<any> {
    const filePath = path.join(worldPath, 'world.json');
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * stats.json 로드
   */
  private static async loadStats(worldPath: string): Promise<StatDefinition[]> {
    const filePath = path.join(worldPath, 'stats.json');

    if (!fs.existsSync(filePath)) {
      console.warn(`Stats file not found: ${filePath}`);
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * resources.json 로드
   */
  private static async loadResources(worldPath: string): Promise<ResourceDefinition[]> {
    const filePath = path.join(worldPath, 'resources.json');

    if (!fs.existsSync(filePath)) {
      console.warn(`Resources file not found: ${filePath}`);
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * actions 로드 (actions-all.json 우선)
   */
  private static async loadActions(worldPath: string): Promise<ActionDefinition[]> {
    // actions-all.json 시도
    let filePath = path.join(worldPath, 'actions-all.json');

    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // actions-all.json은 { actions: [...] } 구조
      if (data.actions && Array.isArray(data.actions)) {
        return data.actions;
      }

      return [];
    }

    // actions.json 시도
    filePath = path.join(worldPath, 'actions.json');

    if (!fs.existsSync(filePath)) {
      console.warn(`Actions file not found: ${filePath}`);
      return [];
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 사용 가능한 모든 세계관 ID 조회
   */
  static async getAvailableWorlds(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.configRoot, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => !name.startsWith('.') && !name.startsWith('{'));
    } catch (error) {
      console.error('Error reading worlds directory:', error);
      return [];
    }
  }

  /**
   * 세계관 존재 여부 확인
   */
  static exists(worldId: string): boolean {
    const worldPath = path.join(this.configRoot, worldId);
    const worldJsonPath = path.join(worldPath, 'world.json');
    return fs.existsSync(worldJsonPath);
  }
}
