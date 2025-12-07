/**
 * NPC AI Routes
 * 
 * NPC 진영 AI 관련 API 라우트
 */

import { Router, Request, Response, NextFunction } from 'express';
import { NPCFaction, INPCFaction } from '../../models/gin7/NPCFaction';
import { npcControllerManager } from '../../services/gin7/ai/NPCFactionController';
import { PERSONALITY_PRESETS } from '../../types/gin7/npc-ai.types';
import { logger } from '../../common/logger';

const router = Router();

// ============================================================
// GET /npc/presets - 사용 가능한 AI 성격 프리셋 목록
// ============================================================

router.get('/presets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const presets = Object.values(PERSONALITY_PRESETS).map(p => ({
      id: p.id,
      name: p.name,
      nameKo: p.nameKo,
      description: p.description,
      personality: p.personality,
    }));
    
    res.json({
      success: true,
      presets,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /npc/session/:sessionId - 세션의 NPC 진영 목록
// ============================================================

router.get('/session/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    
    const factions = await NPCFaction.find({ sessionId }).lean();
    
    res.json({
      success: true,
      factions: factions.map(f => ({
        factionId: f.factionId,
        aiEnabled: f.aiEnabled,
        aiDifficulty: f.aiDifficulty,
        personalityPresetId: f.personalityPresetId,
        personality: f.personality,
        stats: f.stats,
        lastTickProcessed: f.lastTickProcessed,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /npc/faction - NPC 진영 생성
// ============================================================

interface CreateFactionBody {
  sessionId: string;
  factionId: string;
  presetId?: string;
  difficulty?: INPCFaction['aiDifficulty'];
}

router.post('/faction', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, factionId, presetId, difficulty } = req.body as CreateFactionBody;
    
    if (!sessionId || !factionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and factionId are required',
      });
    }
    
    // 기존 확인
    const existing = await NPCFaction.findOne({ sessionId, factionId });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'NPC faction already exists',
      });
    }
    
    const faction = await NPCFaction.createWithPreset(
      sessionId,
      factionId,
      presetId || 'BALANCED_AI',
      difficulty || 'NORMAL'
    );
    
    logger.info('[NPC Routes] Faction created', { sessionId, factionId, presetId });
    
    res.status(201).json({
      success: true,
      faction: {
        factionId: faction.factionId,
        aiEnabled: faction.aiEnabled,
        aiDifficulty: faction.aiDifficulty,
        personalityPresetId: faction.personalityPresetId,
        personality: faction.personality,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PUT /npc/faction/:sessionId/:factionId - NPC 진영 설정 수정
// ============================================================

interface UpdateFactionBody {
  aiEnabled?: boolean;
  aiDifficulty?: INPCFaction['aiDifficulty'];
  presetId?: string;
}

router.put('/faction/:sessionId/:factionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, factionId } = req.params;
    const { aiEnabled, aiDifficulty, presetId } = req.body as UpdateFactionBody;
    
    const faction = await NPCFaction.findOne({ sessionId, factionId });
    if (!faction) {
      return res.status(404).json({
        success: false,
        error: 'NPC faction not found',
      });
    }
    
    if (aiEnabled !== undefined) {
      faction.aiEnabled = aiEnabled;
    }
    
    if (aiDifficulty) {
      faction.aiDifficulty = aiDifficulty;
    }
    
    if (presetId) {
      const preset = PERSONALITY_PRESETS[presetId];
      if (preset) {
        faction.personalityPresetId = presetId;
        faction.personality = { ...preset.personality };
      }
    }
    
    await faction.save();
    
    logger.info('[NPC Routes] Faction updated', { sessionId, factionId });
    
    res.json({
      success: true,
      faction: {
        factionId: faction.factionId,
        aiEnabled: faction.aiEnabled,
        aiDifficulty: faction.aiDifficulty,
        personalityPresetId: faction.personalityPresetId,
        personality: faction.personality,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /npc/faction/:sessionId/:factionId - NPC 진영 삭제
// ============================================================

router.delete('/faction/:sessionId/:factionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, factionId } = req.params;
    
    const result = await NPCFaction.deleteOne({ sessionId, factionId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'NPC faction not found',
      });
    }
    
    logger.info('[NPC Routes] Faction deleted', { sessionId, factionId });
    
    res.json({
      success: true,
      message: 'NPC faction deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /npc/faction/:sessionId/:factionId/stats - NPC 진영 통계
// ============================================================

router.get('/faction/:sessionId/:factionId/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, factionId } = req.params;
    
    const faction = await NPCFaction.findOne({ sessionId, factionId }).lean();
    if (!faction) {
      return res.status(404).json({
        success: false,
        error: 'NPC faction not found',
      });
    }
    
    res.json({
      success: true,
      stats: faction.stats,
      lastTickProcessed: faction.lastTickProcessed,
      lastEvaluationTime: faction.lastEvaluationTime,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /npc/controller/:sessionId/initialize - NPC 컨트롤러 초기화
// ============================================================

router.post('/controller/:sessionId/initialize', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    
    const controller = await npcControllerManager.getOrCreate(sessionId);
    
    logger.info('[NPC Routes] Controller initialized', { sessionId });
    
    res.json({
      success: true,
      message: 'NPC controller initialized',
      sessionId,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// POST /npc/controller/:sessionId/tick - 수동 틱 처리 (테스트용)
// ============================================================

interface TickBody {
  currentTick: number;
}

router.post('/controller/:sessionId/tick', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const { currentTick } = req.body as TickBody;
    
    if (currentTick === undefined) {
      return res.status(400).json({
        success: false,
        error: 'currentTick is required',
      });
    }
    
    const controller = npcControllerManager.get(sessionId);
    if (!controller) {
      return res.status(404).json({
        success: false,
        error: 'NPC controller not found. Initialize it first.',
      });
    }
    
    const results = await controller.processTick(currentTick);
    
    res.json({
      success: true,
      tick: currentTick,
      results: results.map(r => ({
        factionId: r.factionId,
        strategicDecisions: r.strategicDecisions.length,
        tacticalDecisions: r.tacticalDecisions.length,
        executedCommands: r.executedCommands,
        errors: r.errors,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DELETE /npc/controller/:sessionId - NPC 컨트롤러 제거
// ============================================================

router.delete('/controller/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    
    npcControllerManager.remove(sessionId);
    
    logger.info('[NPC Routes] Controller removed', { sessionId });
    
    res.json({
      success: true,
      message: 'NPC controller removed',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /npc/controller/status - 모든 컨트롤러 상태
// ============================================================

router.get('/controller/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const controllers = npcControllerManager.getAll();
    
    res.json({
      success: true,
      activeControllers: controllers.length,
      // 추가 정보는 필요에 따라
    });
  } catch (error) {
    next(error);
  }
});

export default router;

