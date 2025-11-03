import { GlobalRepository } from '../../repositories/global.repository';
import { Session } from '../../models/session.model';
import { CacheManager } from '../../cache/CacheManager';
import { cacheService } from '../../common/cache/cache.service';
import * as fs from 'fs';
import * as path from 'path';

const cacheManager = CacheManager.getInstance();

// 캐시 키 프리픽스
const CACHE_PREFIX = 'const:';
// 상수는 자주 변경되지 않으므로 긴 TTL 설정 (1시간)
const CONSTANTS_TTL = 3600;

/**
 * GetConst Service
 * Returns all game constants to frontend
 * Loads: gameConst, gameUnitConst, cityConst, iActionInfo, version
 * 
 * 캐시 전략:
 * - Redis (L2) + 메모리 (L1) 캐시 사용
 * - 상수는 변경이 적으므로 1시간 TTL
 * - 시나리오별로 캐시 키 분리
 */
export class GetConstService {
  /**
   * 상수 데이터를 파일에서 로드
   */
  private static async loadConstantsFromFile(scenarioId: string): Promise<any> {
    const configDir = path.join(__dirname, '../../../config');
    
    // Load game constants from scenarios
    const constantsPath = path.join(
      configDir,
      'scenarios',
      scenarioId,
      'data',
      'constants.json'
    );
    
    let gameConst = {};
    if (fs.existsSync(constantsPath)) {
      const constantsData = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
      // 모든 상수 섹션 포함
      gameConst = {
        gameSettings: constantsData.gameSettings || {},
        calculationConstants: constantsData.calculationConstants || {},
        banner: constantsData.banner,
        allItems: constantsData.allItems || {},
        availableGeneralCommand: constantsData.availableGeneralCommand || {},
        availableChiefCommand: constantsData.availableChiefCommand || {},
        defaultInstantAction: constantsData.defaultInstantAction || {},
        availableInstantAction: constantsData.availableInstantAction || {},
        randGenFirstName: constantsData.randGenFirstName || [],
        randGenMiddleName: constantsData.randGenMiddleName || [],
        randGenLastName: constantsData.randGenLastName || [],
        regionMap: constantsData.regionMap || {},
        levelMap: constantsData.levelMap || {},
        defaultInitialEvents: constantsData.defaultInitialEvents || [],
        defaultEvents: constantsData.defaultEvents || [],
        defaultPolicy: constantsData.defaultPolicy || {},
        unitTypes: constantsData.unitTypes || {},
      };
    }

    // Load units from scenario data
    const unitsPath = path.join(
      configDir, 
      'scenarios', 
      scenarioId, 
      'data', 
      'units.json'
    );
    
    let gameUnitConst = {};
    if (fs.existsSync(unitsPath)) {
      const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));
      gameUnitConst = unitsData.units || unitsData.unit_types || {};
    }

    // Load cities from scenario
    const citiesPath = path.join(
      configDir,
      'scenarios',
      scenarioId,
      'data',
      'cities.json'
    );
    
    let cityConst = {};
    if (fs.existsSync(citiesPath)) {
      const citiesData = JSON.parse(fs.readFileSync(citiesPath, 'utf-8'));
      cityConst = citiesData.cities || citiesData.city_list || {};
    } else {
      // Fallback: 레거시 경로
      const legacyCitiesPath = path.join(configDir, 'cities.json');
      if (fs.existsSync(legacyCitiesPath)) {
        const citiesData = JSON.parse(fs.readFileSync(legacyCitiesPath, 'utf-8'));
        cityConst = citiesData.cities || {};
      }
    }

    // Load action info
    const actionsPath = path.join(configDir, 'actions.json');
    let iActionInfo = {};
    if (fs.existsSync(actionsPath)) {
      const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
      iActionInfo = actionsData.items || actionsData.iActionInfo || {};
    }

    // Get version from package.json
    const packagePath = path.join(__dirname, '../../../package.json');
    let version = '1.0.0';
    if (fs.existsSync(packagePath)) {
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      version = packageData.version || '1.0.0';
    }

    return {
      gameConst,
      gameUnitConst,
      cityConst,
      iActionInfo,
      version
    };
  }

  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    
    try {
      // Load session (L1 → L2 → DB)
      const { getSession } = require('../../common/cache/model-cache.helper');
      const session = await getSession(sessionId);
      
      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      const scenarioId = session.scenario_id || 'sangokushi';
      
      // 캐시 키 생성 (시나리오별로 분리)
      const cacheKey = `${CACHE_PREFIX}${scenarioId}`;
      
      // 캐시에서 조회
      const cached = await cacheManager.get<any>(cacheKey);
      if (cached) {
        return {
          success: true,
          result: cached
        };
      }

      // 캐시 미스 - 파일에서 로드
      const constants = await this.loadConstantsFromFile(scenarioId);
      
      // 캐시에 저장 (1시간 TTL)
      await cacheManager.set(cacheKey, constants, CONSTANTS_TTL);
      
      return {
        success: true,
        result: constants
      };
    } catch (error: any) {
      console.error('GetConst error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 특정 시나리오의 상수 캐시 무효화
   * (관리자 API에서 사용)
   */
  static async invalidateCache(scenarioId: string): Promise<void> {
    const cacheKey = `${CACHE_PREFIX}${scenarioId}`;
    await cacheManager.delete(cacheKey);
  }
}
