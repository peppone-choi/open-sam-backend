import { Router } from 'express';
import { autoExtractToken } from '../../middleware/auth';
import { Gin7FrontendService, Gin7TelemetryPayload } from '../../services/logh/Gin7Frontend.service';
import { Gin7EnergyProfile } from '../../models/logh/Gin7TacticalPreference.model';
import { gin7CommandCatalog } from '../../config/gin7/catalog';
import { TimeEngine } from '../../core/gin7/TimeEngine';

const router = Router();

/**
 * GET /api/gin7/status
 * Returns server status and current game time for all active sessions
 * (No authentication required - public endpoint)
 */
router.get('/status', async (_req, res) => {
  try {
    const engine = TimeEngine.getInstance();
    const status = engine.getStatus();
    
    res.json({
      success: true,
      schemaVersion: '2025-12-02.gin7.status.1',
      data: {
        serverTime: new Date().toISOString(),
        ...status,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.use(autoExtractToken);

router.get('/session', async (req, res) => {
  try {
    const context = await ensureContext(req);
    const overview = await Gin7FrontendService.getSessionOverview(context.sessionId, context.character);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.session.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: overview,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.get('/strategy', async (req, res) => {
  try {
    const context = await ensureContext(req);
    const strategic = await Gin7FrontendService.getStrategicState(context.sessionId, context.character ? (context.character.faction as any) : undefined);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.strategy.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: strategic,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.get('/operations', async (req, res) => {
  try {
    const context = await ensureContext(req, { allowAnonymous: true });
    const plans = await Gin7FrontendService.getCommandPlans(context.sessionId, context.character?.characterId);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.operations.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: plans,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post('/operations', async (req, res) => {
  try {
    const context = await ensureContext(req);
    if (!context.character) {
      return res.status(400).json({ success: false, message: '캐릭터 정보를 찾을 수 없습니다' });
    }
    const plan = await Gin7FrontendService.saveOperationDraft(context.sessionId, context.character.characterId, req.body || {});
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.operations.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: plan,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.get('/tactical', async (req, res) => {
  try {
    const context = await ensureContext(req, { allowAnonymous: true });
    const tactical = await Gin7FrontendService.getTacticalState(context.sessionId, context.character ?? null);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.tactical.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: tactical,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post('/tactical/energy', async (req, res) => {
  try {
    const context = await ensureContext(req);
    if (!context.character) {
      return res.status(400).json({ success: false, message: '캐릭터 정보를 찾을 수 없습니다' });
    }
    const energy = sanitizeEnergy(req.body?.energy);
    if (!energy) {
      return res.status(400).json({ success: false, message: '에너지 설정 값이 필요합니다.' });
    }
    const updated = await Gin7FrontendService.updateEnergyProfile(context.sessionId, context.character.characterId, energy);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.tactical.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: updated,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.get('/chat', async (req, res) => {
  try {
    const context = await ensureContext(req, { allowAnonymous: true });
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const chat = await Gin7FrontendService.getChatLog(context.sessionId, limit);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.chat.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: chat,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.post('/telemetry', async (req, res) => {
  try {
    const context = await ensureContext(req, { allowAnonymous: true });
    const payload = req.body as Gin7TelemetryPayload;
    await Gin7FrontendService.recordTelemetry(context.sessionId, context.character?.characterId, payload);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.telemetry.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

router.get('/telemetry', async (req, res) => {
  try {
    const context = await ensureContext(req, { allowAnonymous: true });
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const samples = await Gin7FrontendService.listTelemetrySamples(context.sessionId, limit);
    res.json({
      success: true,
      schemaVersion: '2025-11-22.state.telemetry.2',
      meta: { commandCatalogVersion: gin7CommandCatalog.version },
      data: samples,
    });
  } catch (error: any) {
    res.status(error.status || 400).json({ success: false, message: error.message });
  }
});

async function ensureContext(req: any, options?: { allowAnonymous?: boolean }) {
  const sessionId = (req.user?.sessionId || req.query?.sessionId || req.body?.sessionId) as string | undefined;
  if (!sessionId) {
    const status = options?.allowAnonymous ? 400 : 401;
    const error = new Error('세션 식별자가 필요합니다.');
    (error as any).status = status;
    throw error;
  }
  const userId = req.user?.userId || req.user?.id;
  if (!userId && !options?.allowAnonymous && !req.query?.characterId) {
    const error = new Error('인증 정보가 필요합니다');
    (error as any).status = 401;
    throw error;
  }

  const characterId = (req.query?.characterId || req.body?.characterId) as string | undefined;
  const character = await Gin7FrontendService.resolveCharacter(sessionId, userId, characterId);

  return { sessionId, userId, character };
}

function sanitizeEnergy(energy: Gin7EnergyProfile | undefined): Gin7EnergyProfile | null {
  if (!energy) return null;
  const keys: Array<keyof Gin7EnergyProfile> = ['beam', 'gun', 'shield', 'engine', 'warp', 'sensor'];
  const payload: Gin7EnergyProfile = { ...energy } as Gin7EnergyProfile;
  for (const key of keys) {
    const value = Number(payload[key]);
    payload[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  }
  return payload;
}

export default router;
