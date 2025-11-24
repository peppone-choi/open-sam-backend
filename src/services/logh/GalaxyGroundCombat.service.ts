import { randomUUID } from 'crypto';
import { GalaxyGroundCombat, ISupplyBatch, IWarehouseStock, IOccupationStatus } from '../../models/logh/GalaxyGroundCombat.model';

/**
 * Ground Combat Service
 * 지상전 상태 관리 및 보급/점령 시스템
 */

export interface CreateGroundCombatParams {
  sessionId: string;
  battleId: string;
  gridCoordinates: { x: number; y: number };
  factions: Array<{
    code: 'empire' | 'alliance' | 'rebel';
    commanderIds: string[];
    groundUnits: number;
  }>;
  planets?: string[];
}

/**
 * 지상전 상태 생성
 */
export async function createGroundCombat(params: CreateGroundCombatParams) {
  const { sessionId, battleId, gridCoordinates, factions, planets = [] } = params;

  // 초기 점령 상태 설정
  const occupationStatus: IOccupationStatus[] = planets.map((planetId, idx) => ({
    planetId,
    planetName: `Planet-${planetId}`,
    controllingFaction: 'neutral' as const,
    occupationProgress: 0,
    defenseStrength: 100,
    garrisonUnits: 0,
    supplyLines: [],
    status: 'contested' as const,
  }));

  // 초기 보급 배치 생성
  const supplyBatches: ISupplyBatch[] = factions.flatMap((faction, idx) => [
    {
      batchId: randomUUID(),
      type: 'fuel' as const,
      quantity: 1000,
      location: `landing-zone-${faction.code}`,
      assignedUnits: [],
      status: 'available' as const,
    },
    {
      batchId: randomUUID(),
      type: 'ammunition' as const,
      quantity: 500,
      location: `landing-zone-${faction.code}`,
      assignedUnits: [],
      status: 'available' as const,
    },
  ]);

  // 창고 재고 초기화
  const warehouseStocks = planets.map((planetId, idx) => ({
    warehouseId: randomUUID(),
    planetId,
    faction: factions[0]?.code || 'empire' as 'empire' | 'alliance' | 'rebel',
    inventory: {
      fuel: 500,
      ammunition: 300,
      rations: 400,
      medical: 200,
      equipment: 150,
    },
    capacity: 2000,
    lastUpdated: new Date(),
  }));

  const groundCombat = await GalaxyGroundCombat.create({
    session_id: sessionId,
    battleId,
    gridCoordinates,
    factions,
    occupationStatus,
    supplyBatches,
    warehouseStocks,
    combatPhase: 'landing',
    startedAt: new Date(),
    lastUpdateAt: new Date(),
  });

  return groundCombat;
}

/**
 * 지상전 상태 조회
 */
export async function getGroundCombatState(sessionId: string, battleId: string) {
  const combat = await GalaxyGroundCombat.findOne({
    session_id: sessionId,
    battleId,
  });

  if (!combat) {
    throw new Error(`Ground combat not found: ${battleId}`);
  }

  return combat;
}

/**
 * 점령 상태 업데이트
 */
export async function updateOccupationStatus(
  sessionId: string,
  battleId: string,
  planetId: string,
  updates: Partial<IOccupationStatus>
) {
  const combat = await GalaxyGroundCombat.findOne({
    session_id: sessionId,
    battleId,
  });

  if (!combat) {
    throw new Error(`Ground combat not found: ${battleId}`);
  }

  const occupationIndex = combat.occupationStatus.findIndex((o) => o.planetId === planetId);

  if (occupationIndex === -1) {
    throw new Error(`Planet not found in occupation status: ${planetId}`);
  }

  // 점령 상태 업데이트
  combat.occupationStatus[occupationIndex] = {
    ...combat.occupationStatus[occupationIndex],
    ...updates,
  };

  combat.lastUpdateAt = new Date();
  await combat.save();

  return combat.occupationStatus[occupationIndex];
}

/**
 * 보급 배치 추가
 */
export async function addSupplyBatch(
  sessionId: string,
  battleId: string,
  batch: Omit<ISupplyBatch, 'batchId'>
) {
  const combat = await GalaxyGroundCombat.findOne({
    session_id: sessionId,
    battleId,
  });

  if (!combat) {
    throw new Error(`Ground combat not found: ${battleId}`);
  }

  const newBatch: ISupplyBatch = {
    ...batch,
    batchId: randomUUID(),
  };

  combat.supplyBatches.push(newBatch);
  combat.lastUpdateAt = new Date();
  await combat.save();

  return newBatch;
}

/**
 * 보급 배치 상태 업데이트
 */
export async function updateSupplyBatch(
  sessionId: string,
  battleId: string,
  batchId: string,
  updates: Partial<ISupplyBatch>
) {
  const combat = await GalaxyGroundCombat.findOne({
    session_id: sessionId,
    battleId,
  });

  if (!combat) {
    throw new Error(`Ground combat not found: ${battleId}`);
  }

  const batchIndex = combat.supplyBatches.findIndex((b) => b.batchId === batchId);

  if (batchIndex === -1) {
    throw new Error(`Supply batch not found: ${batchId}`);
  }

  combat.supplyBatches[batchIndex] = {
    ...combat.supplyBatches[batchIndex],
    ...updates,
  };

  combat.lastUpdateAt = new Date();
  await combat.save();

  return combat.supplyBatches[batchIndex];
}

/**
 * 창고 재고 업데이트
 */
export async function updateWarehouseStock(
  sessionId: string,
  battleId: string,
  warehouseId: string,
  inventoryChanges: Partial<IWarehouseStock['inventory']>
) {
  const combat = await GalaxyGroundCombat.findOne({
    session_id: sessionId,
    battleId,
  });

  if (!combat) {
    throw new Error(`Ground combat not found: ${battleId}`);
  }

  const warehouseIndex = combat.warehouseStocks.findIndex((w) => w.warehouseId === warehouseId);

  if (warehouseIndex === -1) {
    throw new Error(`Warehouse not found: ${warehouseId}`);
  }

  const warehouse = combat.warehouseStocks[warehouseIndex];

  // 재고 변경 적용
  warehouse.inventory = {
    ...warehouse.inventory,
    ...inventoryChanges,
  };

  warehouse.lastUpdated = new Date();
  combat.lastUpdateAt = new Date();
  await combat.save();

  return warehouse;
}

/**
 * 전투 단계 진행
 */
export async function advanceCombatPhase(
  sessionId: string,
  battleId: string,
  newPhase: 'landing' | 'engagement' | 'occupation' | 'withdrawal' | 'completed'
) {
  const combat = await GalaxyGroundCombat.findOne({
    session_id: sessionId,
    battleId,
  });

  if (!combat) {
    throw new Error(`Ground combat not found: ${battleId}`);
  }

  combat.combatPhase = newPhase;
  combat.lastUpdateAt = new Date();
  await combat.save();

  return combat;
}

/**
 * 점령 진행률 계산
 */
export function calculateOccupationProgress(
  attackingUnits: number,
  defendingUnits: number,
  currentProgress: number
): number {
  const ratio = attackingUnits / Math.max(defendingUnits, 1);
  const progressChange = ratio > 1 ? 5 : ratio < 1 ? -3 : 0;
  
  return Math.max(0, Math.min(100, currentProgress + progressChange));
}

/**
 * 보급 소비 처리
 */
export async function consumeSupply(
  sessionId: string,
  battleId: string,
  batchId: string,
  amount: number
) {
  const combat = await GalaxyGroundCombat.findOne({
    session_id: sessionId,
    battleId,
  });

  if (!combat) {
    throw new Error(`Ground combat not found: ${battleId}`);
  }

  const batchIndex = combat.supplyBatches.findIndex((b) => b.batchId === batchId);

  if (batchIndex === -1) {
    throw new Error(`Supply batch not found: ${batchId}`);
  }

  const batch = combat.supplyBatches[batchIndex];

  if (batch.quantity < amount) {
    throw new Error(`Insufficient supply: requested ${amount}, available ${batch.quantity}`);
  }

  batch.quantity -= amount;

  if (batch.quantity === 0) {
    batch.status = 'exhausted';
  }

  combat.lastUpdateAt = new Date();
  await combat.save();

  return batch;
}
