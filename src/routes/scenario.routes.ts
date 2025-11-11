import { Router, Request, Response } from 'express';
import { ScenarioLoader } from '../common/registry/scenario-loader';
import { ScenarioRegistry } from '../common/registry/scenario-registry';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

/**
 * GET /scenarios/templates
 * CQRS 시나리오 목록 조회 (관리자 초기화용)
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const scenariosDir = path.resolve(process.cwd(), 'config', 'scenarios');
    console.log('[Scenario API] Reading scenarios from:', scenariosDir);
    const entries = await fs.readdir(scenariosDir, { withFileTypes: true });
    
    // 디렉토리만 필터링 (각 시나리오는 디렉토리)
    const scenarioDirs = entries.filter(e => e.isDirectory());
    
    const scenarios = [];
    for (const dir of scenarioDirs) {
      try {
        const scenarioJsonPath = path.join(scenariosDir, dir.name, 'scenario.json');
        
        // scenario.json 파일이 있는지 확인
        try {
          await fs.access(scenarioJsonPath);
        } catch {
          // scenario.json이 없으면 스킵
          continue;
        }
        
        const content = await fs.readFile(scenarioJsonPath, 'utf-8');
        const data = JSON.parse(content);
        
        // 은하영웅전설은 제외 (아직 미완성)
        if (dir.name.includes('legend-of-galactic-heroes') || dir.name.includes('logh')) {
          continue;
        }

        // 카테고리 자동 감지 (scenario.json에 category가 없으면 ID로 추론)
        let category = data.category || 'other';
        if (!data.category) {
          if (dir.name.startsWith('sangokushi')) {
            category = 'sangokushi';
          }
        }

        scenarios.push({
          id: dir.name,
          title: data.name || '제목 없음',
          description: data.description || '',
          category: category,
          startYear: data.metadata?.startYear || data.startYear || data.data?.scenario?.startYear || 184,
          version: data.version || '1.0.0',
          order: data.order || 999  // scenario.json에 order 필드가 있으면 사용
        });
      } catch (err) {
        console.warn(`Failed to parse scenario ${dir.name}:`, err);
      }
    }
    
    // 정렬: 1) order, 2) 시작년도, 3) 제목
    scenarios.sort((a, b) => {
      // 1. order로 정렬
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      
      // 2. order가 같으면 시작년도로 정렬
      if (a.startYear !== b.startYear) {
        return a.startYear - b.startYear;
      }
      
      // 3. 같은 년도면 제목으로 정렬 (한글 가나다순)
      return a.title.localeCompare(b.title, 'ko');
    });
    
    res.json({
      success: true,
      data: {
        scenarios,
        total: scenarios.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /scenarios
 * 사용 가능한 시나리오 목록 조회
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const scenarios = await ScenarioLoader.listScenarios();
    
    res.json({
      success: true,
      data: {
        scenarios,
        total: scenarios.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /scenarios/:scenarioId
 * 특정 시나리오 상세 정보 조회
 */
router.get('/:scenarioId', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    
    // 레지스트리에서 조회
    const scenario = ScenarioRegistry.get(scenarioId);
    
    if (!scenario) {
      // 로드되지 않았으면 로드 시도
      const exists = await ScenarioLoader.exists(scenarioId);
      if (!exists) {
        return res.status(404).json({
          success: false,
          error: `Scenario not found: ${scenarioId}`
        });
      }
      
      await ScenarioLoader.load(scenarioId);
      const loadedScenario = ScenarioRegistry.get(scenarioId);
      
      return res.json({
        success: true,
        data: loadedScenario
      });
    }
    
    res.json({
      success: true,
      data: scenario
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /scenarios/:scenarioId/reload
 * 특정 시나리오 리로드 (개발용)
 */
router.post('/:scenarioId/reload', async (req: Request, res: Response) => {
  try {
    const { scenarioId } = req.params;
    
    await ScenarioLoader.load(scenarioId);
    
    res.json({
      success: true,
      message: `Scenario reloaded: ${scenarioId}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
