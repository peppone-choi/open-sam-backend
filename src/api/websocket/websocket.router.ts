import { Router, Request, Response } from 'express';
import { EntityRepository } from '../../common/repository/entity-repository';
import { RoleRepository } from '../../common/repository/role-repository';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { ScenarioId } from '../../common/@types/role.types';

/**
 * WebSocket API Router
 * 
 * 기능:
 * - 게임 상태 조회 (Entity 기반)
 * - 엔티티 업데이트 이벤트 발행
 * - Redis Pub/Sub를 통한 실시간 동기화
 * 
 * 이벤트:
 * - game:state: 전체 게임 상태 전송
 * - battle:event: 전투 이벤트 전송
 * - entity:updated: 엔티티 업데이트 전송
 */
const router = Router();
const redis = new RedisService();

// Redis 채널 정의
const CHANNELS = {
  gameState: 'channel:game-state',
  battle: 'channel:battle',
  entity: 'channel:entity',
};

/**
 * GET /api/websocket/game-state/:scenario
 * 
 * 시나리오의 전체 게임 상태 조회 (Entity 기반)
 */
router.get('/game-state/:scenario', async (req: Request, res: Response) => {
  try {
    const scenario = req.params.scenario as ScenarioId;

    // 시나리오의 모든 엔티티 조회
    const entities = await EntityRepository.findByQuery({ scenario });

    // Role별로 그룹화
    const entitiesByRole: Record<string, any[]> = {};
    entities.forEach((entity) => {
      const role = entity.role;
      if (!entitiesByRole[role]) {
        entitiesByRole[role] = [];
      }
      entitiesByRole[role].push({
        id: entity.id,
        role: entity.role,
        version: entity.version,
      });
    });

    res.json({
      scenario,
      entities: entitiesByRole,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('게임 상태 조회 실패:', error);
    res.status(500).json({ error: '게임 상태 조회 실패' });
  }
});

/**
 * GET /api/websocket/entities/:scenario/:role
 * 
 * 특정 Role의 엔티티 목록 조회
 */
router.get('/entities/:scenario/:role', async (req: Request, res: Response) => {
  try {
    const { scenario, role } = req.params;

    // RoleRepository를 통한 엔티티 조회
    const entities = await RoleRepository.findAll(
      scenario as ScenarioId,
      role as any,
      100
    );

    res.json({
      scenario,
      role,
      entities,
      count: entities.length,
    });
  } catch (error) {
    console.error('엔티티 조회 실패:', error);
    res.status(500).json({ error: '엔티티 조회 실패' });
  }
});

/**
 * GET /api/websocket/entity/:scenario/:role/:id
 * 
 * 특정 엔티티 상세 조회
 */
router.get('/entity/:scenario/:role/:id', async (req: Request, res: Response) => {
  try {
    const { scenario, role, id } = req.params;

    const entity = await RoleRepository.get({
      scenario: scenario as ScenarioId,
      role: role as any,
      id,
    });

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다' });
    }

    res.json(entity);
  } catch (error) {
    console.error('엔티티 조회 실패:', error);
    res.status(500).json({ error: '엔티티 조회 실패' });
  }
});

/**
 * POST /api/websocket/publish/game-state
 * 
 * 게임 상태 변경 이벤트 발행 (game:state)
 */
router.post('/publish/game-state', async (req: Request, res: Response) => {
  try {
    const { sessionId, data } = req.body;

    if (!sessionId || !data) {
      return res.status(400).json({ error: 'sessionId와 data가 필요합니다' });
    }

    // Redis Pub/Sub로 이벤트 발행
    await redis.publish(CHANNELS.gameState, {
      sessionId,
      data,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: '게임 상태 이벤트 발행 완료' });
  } catch (error) {
    console.error('게임 상태 이벤트 발행 실패:', error);
    res.status(500).json({ error: '게임 상태 이벤트 발행 실패' });
  }
});

/**
 * POST /api/websocket/publish/battle-event
 * 
 * 전투 이벤트 발행 (battle:event)
 */
router.post('/publish/battle-event', async (req: Request, res: Response) => {
  try {
    const { battleId, event } = req.body;

    if (!battleId || !event) {
      return res.status(400).json({ error: 'battleId와 event가 필요합니다' });
    }

    // Redis Pub/Sub로 전투 이벤트 발행
    await redis.publish(CHANNELS.battle, {
      battleId,
      event,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: '전투 이벤트 발행 완료' });
  } catch (error) {
    console.error('전투 이벤트 발행 실패:', error);
    res.status(500).json({ error: '전투 이벤트 발행 실패' });
  }
});

/**
 * POST /api/websocket/publish/entity-update
 * 
 * 엔티티 업데이트 이벤트 발행 (entity:updated)
 */
router.post('/publish/entity-update', async (req: Request, res: Response) => {
  try {
    const { scenario, role, id, patch } = req.body;

    if (!scenario || !role || !id || !patch) {
      return res.status(400).json({
        error: 'scenario, role, id, patch가 필요합니다',
      });
    }

    // RoleRepository로 엔티티 업데이트
    const updated = await RoleRepository.update(
      { scenario, role, id },
      patch
    );

    if (!updated) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다' });
    }

    // Redis Pub/Sub로 업데이트 이벤트 발행
    await redis.publish(CHANNELS.entity, {
      scenario,
      role,
      id,
      patch,
      version: (updated as any).version,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: '엔티티 업데이트 완료',
      entity: updated,
    });
  } catch (error) {
    console.error('엔티티 업데이트 실패:', error);
    res.status(500).json({ error: '엔티티 업데이트 실패' });
  }
});

/**
 * POST /api/websocket/broadcast
 * 
 * 임의의 이벤트 브로드캐스트 (개발/디버그용)
 */
router.post('/broadcast', async (req: Request, res: Response) => {
  try {
    const { channel, event, data } = req.body;

    if (!channel || !event || !data) {
      return res.status(400).json({
        error: 'channel, event, data가 필요합니다',
      });
    }

    await redis.publish(channel, {
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: '브로드캐스트 완료' });
  } catch (error) {
    console.error('브로드캐스트 실패:', error);
    res.status(500).json({ error: '브로드캐스트 실패' });
  }
});

export default router;
