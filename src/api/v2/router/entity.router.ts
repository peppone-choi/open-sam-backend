import { Router, Request, Response } from 'express';
import { Role, ScenarioId } from '../../../common/@types/role.types';
import { RoleRepository, RelationHelper } from '../../../common/repository/role-repository';
import { ScenarioRegistry } from '../../../common/registry/scenario-registry';
import { ResourceRegistry } from '../../../common/registry/resource-registry';

const router = Router();

/**
 * v2 API - Lore 중립 엔드포인트
 */

/**
 * 시나리오 메타데이터 조회
 */
router.get('/meta/scenarios', async (req: Request, res: Response) => {
  const scenarios = ScenarioRegistry.getAll();
  
  const result = scenarios.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    roles: Object.entries(s.roles).map(([role, config]) => ({
      role,
      label: config?.label,
      collection: config?.collection
    })),
    resources: ResourceRegistry.getAll(s.id).map(r => ({
      id: r.id,
      kind: r.kind,
      label: r.label,
      max: r.max
    }))
  }));
  
  res.json({ data: result });
});

/**
 * 특정 시나리오 메타데이터
 */
router.get('/meta/scenarios/:id', async (req: Request, res: Response) => {
  const scenario = ScenarioRegistry.get(req.params.id);
  
  if (!scenario) {
    return res.status(404).json({ error: 'Scenario not found' });
  }
  
  res.json({
    data: {
      ...scenario,
      resources: ResourceRegistry.getAll(scenario.id)
    }
  });
});

/**
 * Settlements 조회 (도시/행성/마을)
 */
router.get('/settlements', async (req: Request, res: Response) => {
  const scenario = req.query.scenario as ScenarioId || 'sangokushi';
  const settlements = await RoleRepository.findAll(scenario, Role.SETTLEMENT, 100);
  
  res.json({ data: settlements, scenario });
});

/**
 * Commanders 조회 (장수/영웅/커맨더)
 */
router.get('/commanders', async (req: Request, res: Response) => {
  const scenario = req.query.scenario as ScenarioId || 'sangokushi';
  const commanders = await RoleRepository.findAll(scenario, Role.COMMANDER, 100);
  
  res.json({ data: commanders, scenario });
});

/**
 * Factions 조회 (국가/왕국/세력)
 */
router.get('/factions', async (req: Request, res: Response) => {
  const scenario = req.query.scenario as ScenarioId || 'sangokushi';
  const factions = await RoleRepository.findAll(scenario, Role.FACTION, 50);
  
  res.json({ data: factions, scenario });
});

/**
 * 엔티티 조회 (범용)
 */
router.get('/entities/:role/:id', async (req: Request, res: Response) => {
  const { role, id } = req.params;
  const scenario = req.query.scenario as ScenarioId || 'sangokushi';
  
  if (!Object.values(Role).includes(role as Role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  const ref = { role: role as Role, id, scenario };
  const entity = await RoleRepository.get(ref);
  
  if (!entity) {
    return res.status(404).json({ error: 'Entity not found' });
  }
  
  res.json({ data: entity });
});

/**
 * 관계 조회
 */
router.get('/entities/:role/:id/relations/:relationKey', async (req: Request, res: Response) => {
  const { role, id, relationKey } = req.params;
  const scenario = req.query.scenario as ScenarioId || 'sangokushi';
  
  const ref = { role: role as Role, id, scenario };
  const related = await RelationHelper.getRelatedref, relationKey;
  
  if (!related) {
    return res.status(404).json({ error: 'Related entity not found' });
  }
  
  const relatedEntity = await RoleRepository.get(related);
  
  res.json({ data: relatedEntity, ref: related });
});

export default router;
