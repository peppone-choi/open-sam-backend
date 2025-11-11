import fs from 'fs/promises';
import path from 'path';
import { ScenarioRegistry, ScenarioConfig } from './scenario-registry';
import { Role, ScenarioId, RelationKey } from '../@types/role.types';

/**
 * 시나리오 동적 로더
 * config/scenarios 디렉토리에서 시나리오를 자동으로 로드
 */
export class ScenarioLoader {
  private static readonly SCENARIOS_DIR = path.join(__dirname, '../../../config/scenarios');

  /**
   * 특정 시나리오 로드
   * @param scenarioId 시나리오 ID
   */
  static async load(scenarioId: string): Promise<void> {
    const scenarioPath = path.join(this.SCENARIOS_DIR, scenarioId, 'scenario.json');
    
    try {
      const data = await fs.readFile(scenarioPath, 'utf-8');
      const scenarioData = JSON.parse(data);
      
      // JSON 데이터를 ScenarioConfig로 변환
      const config: ScenarioConfig = {
        id: scenarioData.id as ScenarioId,
        name: scenarioData.name,
        description: scenarioData.description,
        roles: this.parseRoles(scenarioData.roles),
        relations: this.parseRelations(scenarioData.relations),
        commandAliases: scenarioData.commandAliases,
        config: scenarioData.config
      };

      // 레지스트리에 등록
      ScenarioRegistry.register(config);
    } catch (error) {
      console.error(`❌ Failed to load scenario: ${scenarioId}`, error);
      throw new Error(`Scenario not found or invalid: ${scenarioId}`);
    }
  }

  /**
   * config/scenarios 디렉토리의 모든 시나리오 자동 로드
   */
  static async loadAll(): Promise<void> {
    try {
      const entries = await fs.readdir(this.SCENARIOS_DIR, { withFileTypes: true });
      
      // 디렉토리만 필터링 (각 시나리오는 폴더)
      const scenarioDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      // 각 시나리오 로드
      for (const scenarioId of scenarioDirs) {
        // scenario.json 존재 여부 확인
        const scenarioJsonPath = path.join(this.SCENARIOS_DIR, scenarioId, 'scenario.json');
        try {
          await fs.access(scenarioJsonPath);
          await this.load(scenarioId);
        } catch (err) {
          // scenario.json not found, skip
        }
      }
    } catch (error) {
      console.error('❌ Failed to load scenarios:', error);
      throw error;
    }
  }

  /**
   * 시나리오 목록 조회 (메타데이터만)
   */
  static async listScenarios(): Promise<Array<{ id: string; name: string; description?: string; version?: string }>> {
    const entries = await fs.readdir(this.SCENARIOS_DIR, { withFileTypes: true });
    const scenarioDirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name);

    const scenarios = [];
    for (const scenarioId of scenarioDirs) {
      try {
        const scenarioPath = path.join(this.SCENARIOS_DIR, scenarioId, 'scenario.json');
        const data = await fs.readFile(scenarioPath, 'utf-8');
        const scenarioData = JSON.parse(data);
        
        scenarios.push({
          id: scenarioData.id,
          name: scenarioData.name,
          description: scenarioData.description,
          version: scenarioData.version
        });
      } catch (err) {
        // scenario.json 없으면 스킵
        continue;
      }
    }

    return scenarios;
  }

  /**
   * JSON roles를 ScenarioConfig roles로 변환
   */
  private static parseRoles(rolesData: any): ScenarioConfig['roles'] {
    const roles: ScenarioConfig['roles'] = {};
    
    for (const [roleKey, roleData] of Object.entries(rolesData)) {
      roles[roleKey as Role] = roleData as any;
    }

    return roles;
  }

  /**
   * JSON relations를 ScenarioConfig relations로 변환
   */
  private static parseRelations(relationsData: any): ScenarioConfig['relations'] {
    const relations: ScenarioConfig['relations'] = {};
    
    for (const [relationKey, relationData] of Object.entries(relationsData)) {
      const data = relationData as any;
      relations[relationKey as RelationKey] = {
        from: data.from as Role,
        to: data.to as Role,
        viaField: data.viaField,
        inverse: data.inverse
      };
    }

    return relations;
  }

  /**
   * 시나리오 존재 여부 확인
   */
  static async exists(scenarioId: string): Promise<boolean> {
    try {
      const scenarioPath = path.join(this.SCENARIOS_DIR, scenarioId, 'scenario.json');
      await fs.access(scenarioPath);
      return true;
    } catch {
      return false;
    }
  }
}
