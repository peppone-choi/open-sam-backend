import { Router, Request, Response } from 'express';
import { ScenarioLoader } from '../common/registry/scenario-loader';
import { ScenarioRegistry } from '../common/registry/scenario-registry';

const router = Router();

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
