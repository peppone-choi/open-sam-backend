import { Router, Request, Response } from 'express';
import { EntityRepository } from '../../../common/repository/entity-repository';
import { Role, RoleRef, ScenarioId } from '../../../common/@types/role.types';
import { asyncHandler } from '../../../common/utils/async-handler';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/entities/:role
 * 특정 Role의 엔티티 목록 조회 (시나리오별, 쿼리 지원)
 */
router.get(
  '/:role',
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const q = req.query.q as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const query: any = { scenario, role };

    if (q) {
      query.name = { $regex: q, $options: 'i' };
    }

    const result = await EntityRepository.findPaginated(query, page, limit);

    res.json({
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        pages: result.pages,
        limit,
      },
    });
  })
);

/**
 * POST /api/entities/:role
 * 새 엔티티 생성
 */
router.post(
  '/:role',
  asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.params;
    const scenario = (req.body.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const entityData = {
      ...req.body,
      scenario,
      role: role as Role,
      id: new mongoose.Types.ObjectId().toString(),
      attributes: req.body.attributes || {},
      resources: req.body.resources || {},
      slots: req.body.slots || {},
      refs: req.body.refs || {},
      systems: req.body.systems || {},
    };

    const entity = await EntityRepository.create(entityData);

    res.status(201).json({ data: entity });
  })
);

/**
 * GET /api/entities/:role/:id
 * 특정 엔티티 조회
 */
router.get(
  '/:role/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    const entity = await EntityRepository.findById(ref);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity });
  })
);

/**
 * PATCH /api/entities/:role/:id
 * 엔티티 부분 업데이트
 */
router.patch(
  '/:role/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const expectedVersion = req.body.version as number | undefined;

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    
    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.attributes) updates.attributes = req.body.attributes;
    if (req.body.resources) updates.resources = req.body.resources;
    if (req.body.slots) updates.slots = req.body.slots;
    if (req.body.refs) updates.refs = req.body.refs;
    if (req.body.systems) updates.systems = req.body.systems;
    if (req.body.ext) updates.ext = req.body.ext;

    const entity = await EntityRepository.patch(ref, { $set: updates }, expectedVersion);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity });
  })
);

/**
 * DELETE /api/entities/:role/:id
 * 엔티티 삭제
 */
router.delete(
  '/:role/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    
    // 엔티티 삭제
    const deleted = await EntityRepository.delete(ref);

    if (!deleted) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    // 관련된 모든 Edge도 삭제
    await EntityRepository.deleteAllEdges(ref);

    res.json({ success: true });
  })
);

/**
 * GET /api/entities/:role/:id/attributes
 * 엔티티의 속성 조회
 */
router.get(
  '/:role/:id/attributes',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    const entity = await EntityRepository.findById(ref);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.attributes || {} });
  })
);

/**
 * PATCH /api/entities/:role/:id/attributes
 * 엔티티의 속성 부분 업데이트
 */
router.patch(
  '/:role/:id/attributes',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const expectedVersion = req.body.version as number | undefined;

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    
    const attributeUpdates: any = {};
    Object.entries(req.body.attributes || req.body).forEach(([key, value]) => {
      if (key !== 'version') {
        attributeUpdates[`attributes.${key}`] = value;
      }
    });

    const entity = await EntityRepository.patch(ref, { $set: attributeUpdates }, expectedVersion);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.attributes });
  })
);

/**
 * GET /api/entities/:role/:id/resources
 * 엔티티의 자원 조회
 */
router.get(
  '/:role/:id/resources',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    const entity = await EntityRepository.findById(ref);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.resources || {} });
  })
);

/**
 * PATCH /api/entities/:role/:id/resources
 * 엔티티의 자원 부분 업데이트
 */
router.patch(
  '/:role/:id/resources',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const expectedVersion = req.body.version as number | undefined;

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    
    const resourceUpdates: any = {};
    Object.entries(req.body.resources || req.body).forEach(([key, value]) => {
      if (key !== 'version') {
        resourceUpdates[`resources.${key}`] = value;
      }
    });

    const entity = await EntityRepository.patch(ref, { $set: resourceUpdates }, expectedVersion);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.resources });
  })
);

/**
 * GET /api/entities/:role/:id/slots
 * 엔티티의 슬롯 조회
 */
router.get(
  '/:role/:id/slots',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    const entity = await EntityRepository.findById(ref);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.slots || {} });
  })
);

/**
 * PATCH /api/entities/:role/:id/slots
 * 엔티티의 슬롯 부분 업데이트
 */
router.patch(
  '/:role/:id/slots',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const expectedVersion = req.body.version as number | undefined;

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    
    const slotUpdates: any = {};
    Object.entries(req.body.slots || req.body).forEach(([key, value]) => {
      if (key !== 'version') {
        slotUpdates[`slots.${key}`] = value;
      }
    });

    const entity = await EntityRepository.patch(ref, { $set: slotUpdates }, expectedVersion);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.slots });
  })
);

/**
 * GET /api/entities/:role/:id/refs
 * 엔티티의 참조 조회
 */
router.get(
  '/:role/:id/refs',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    const entity = await EntityRepository.findById(ref);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.refs || {} });
  })
);

/**
 * PATCH /api/entities/:role/:id/refs
 * 엔티티의 참조 부분 업데이트
 */
router.patch(
  '/:role/:id/refs',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const expectedVersion = req.body.version as number | undefined;

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    
    const refUpdates: any = {};
    Object.entries(req.body.refs || req.body).forEach(([key, value]) => {
      if (key !== 'version') {
        refUpdates[`refs.${key}`] = value;
      }
    });

    const entity = await EntityRepository.patch(ref, { $set: refUpdates }, expectedVersion);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({ data: entity.refs });
  })
);

/**
 * GET /api/entities/:role/:id/systems/:systemId
 * 엔티티의 특정 시스템 상태 조회
 */
router.get(
  '/:role/:id/systems/:systemId',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id, systemId } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    const entity = await EntityRepository.findById(ref);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    const systemState = entity.systems?.[systemId];
    
    if (!systemState) {
      return res.status(404).json({ error: '시스템 상태를 찾을 수 없습니다.' });
    }

    res.json({ data: systemState });
  })
);

/**
 * POST /api/entities/:role/:id/systems/:systemId/commands/:command
 * 엔티티의 특정 시스템에 명령 실행
 */
router.post(
  '/:role/:id/systems/:systemId/commands/:command',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, id, systemId, command } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: '유효하지 않은 role입니다.' });
    }

    const ref: RoleRef = { role: role as Role, id, scenario };
    const entity = await EntityRepository.findById(ref);

    if (!entity) {
      return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });
    }

    res.json({
      message: `명령 '${command}'가 시스템 '${systemId}'에 전송되었습니다.`,
      systemId,
      command,
      payload: req.body,
    });
  })
);

/**
 * GET /api/edges
 * Edge(관계) 조회
 */
router.get(
  '/edges',
  asyncHandler(async (req: Request, res: Response) => {
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const key = req.query.key as string | undefined;
    const fromRole = req.query.fromRole as Role | undefined;
    const fromId = req.query.fromId as string | undefined;
    const toRole = req.query.toRole as Role | undefined;
    const toId = req.query.toId as string | undefined;

    const query: any = { scenario };

    if (key) {
      query.key = key;
    }

    if (fromRole && fromId) {
      query['from.role'] = fromRole;
      query['from.id'] = fromId;
      const ref: RoleRef = { role: fromRole, id: fromId, scenario };
      const edges = await EntityRepository.findEdgesFrom(ref, key as any);
      return res.json({ data: edges });
    }

    if (toRole && toId) {
      query['to.role'] = toRole;
      query['to.id'] = toId;
      const ref: RoleRef = { role: toRole, id: toId, scenario };
      const edges = await EntityRepository.findEdgesTo(ref, key as any);
      return res.json({ data: edges });
    }

    res.json({ data: [], message: 'from 또는 to 파라미터가 필요합니다.' });
  })
);

/**
 * POST /api/edges
 * 새 Edge(관계) 생성
 */
router.post(
  '/edges',
  asyncHandler(async (req: Request, res: Response) => {
    const { scenario, key, from, to, metadata } = req.body;

    if (!scenario || !key || !from || !to) {
      return res.status(400).json({ error: 'scenario, key, from, to는 필수입니다.' });
    }

    if (!from.role || !from.id || !to.role || !to.id) {
      return res.status(400).json({ error: 'from과 to는 role과 id를 포함해야 합니다.' });
    }

    const fromRef: RoleRef = { role: from.role, id: from.id, scenario: from.scenario || scenario };
    const toRef: RoleRef = { role: to.role, id: to.id, scenario: to.scenario || scenario };

    const edge = await EntityRepository.createEdge(scenario, key, fromRef, toRef, metadata);

    res.status(201).json({ data: edge });
  })
);

/**
 * DELETE /api/edges/:id
 * Edge(관계) 삭제
 */
router.delete(
  '/edges/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const scenario = (req.query.scenario as ScenarioId) || 'sangokushi';
    const { key, from, to } = req.body;

    if (!key || !from || !to) {
      return res.status(400).json({ error: 'key, from, to는 필수입니다.' });
    }

    const fromRef: RoleRef = { role: from.role, id: from.id, scenario: from.scenario || scenario };
    const toRef: RoleRef = { role: to.role, id: to.id, scenario: to.scenario || scenario };

    const deleted = await EntityRepository.deleteEdge(scenario, key, fromRef, toRef);

    if (!deleted) {
      return res.status(404).json({ error: 'Edge를 찾을 수 없습니다.' });
    }

    res.json({ success: true });
  })
);

export default router;
