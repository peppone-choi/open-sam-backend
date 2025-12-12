/**
 * RetreatService
 * 
 * 퇴각 시스템
 * - 퇴각 요청 및 검증
 * - 워프 에너지/맵 외곽 조건 체크
 * - 퇴각 중 손실 계산
 * - 퇴각 완료 후 도착지 결정
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet, IVector3 } from '../../../models/gin7/Fleet';
import { RealtimeBattle, IRealtimeBattle, IBattleParticipant } from '../../../models/gin7/RealtimeBattle';
import { GalaxyGrid } from '../../../models/gin7/GalaxyGrid';
import { gridService } from '../GridService';
import { BattleFleetState } from './RealtimeBattleEngine';

/**
 * 퇴각 요청
 */
export interface IRetreatRequest {
  sessionId: string;
  battleId: string;
  fleetId: string;
  requesterId: string;
  destination?: { x: number; y: number };  // 선택적 목적지
}

/**
 * 퇴각 상태
 */
export type RetreatStatus = 
  | 'REQUESTED'       // 요청됨
  | 'CHARGING'        // 워프 충전 중
  | 'MOVING_TO_EDGE'  // 맵 외곽으로 이동 중
  | 'WARPING'         // 워프 중
  | 'COMPLETED'       // 퇴각 완료
  | 'FAILED'          // 퇴각 실패 (파괴됨)
  | 'CANCELLED';      // 취소됨

/**
 * 퇴각 중인 함대 정보
 */
export interface IRetreatingFleet {
  id: string;
  sessionId: string;
  battleId: string;
  fleetId: string;
  factionId: string;
  
  // 상태
  status: RetreatStatus;
  requestedAt: Date;
  requesterId: string;
  
  // 퇴각 진행
  startTick: number;
  estimatedCompletionTick: number;
  currentPhase: 'CHARGE' | 'MOVE' | 'WARP';
  
  // 워프 충전
  warpChargePercent: number;
  warpChargeStartTick?: number;
  
  // 위치
  startPosition: IVector3;
  currentPosition: IVector3;
  edgeTarget: IVector3;
  
  // 손실 추적
  initialUnits: number;
  currentUnits: number;
  unitsLostDuringRetreat: number;
  damageTakenDuringRetreat: number;
  
  // 결과
  destination?: { gridX: number; gridY: number };
  completedAt?: Date;
  failureReason?: string;
}

/**
 * 퇴각 결과
 */
export interface IRetreatResult {
  success: boolean;
  retreatingFleet?: IRetreatingFleet;
  reason?: string;
  estimatedCompletionTick?: number;
  estimatedCompletionTime?: number;  // 초
}

/**
 * 퇴각 설정
 */
export const RETREAT_CONFIG = {
  // 워프 충전 시간
  warpChargeTicksBase: 100,     // 기본 10초
  warpChargeTicksMin: 50,       // 최소 5초
  
  // 맵 외곽 이동
  edgeReachRequiredDistance: 50,  // 외곽까지 이 거리 이내로 도달해야 함
  battleAreaHalfSize: 500,        // 전투 맵 절반 크기
  
  // 퇴각 중 손실
  retreatDamagePenalty: 1.5,      // 퇴각 중 받는 데미지 1.5배
  pursuitDamagePerTick: 0.5,      // 추격 데미지/틱
  
  // 퇴각 완료
  totalRetreatTicks: 150,         // 전체 퇴각 소요 시간 (15초)
  warpPhasePercent: 0.3,          // 워프 충전이 전체의 30%
  movePhasePercent: 0.5,          // 이동이 전체의 50%
  warpPhaseTickPercent: 0.2,      // 워프(실제 이동)가 전체의 20%
};

/**
 * RetreatService 클래스
 */
class RetreatService extends EventEmitter {
  private static instance: RetreatService;
  
  // 퇴각 중인 함대 목록
  private retreatingFleets: Map<string, IRetreatingFleet> = new Map();  // fleetId -> retreat info
  
  // 전투별 퇴각 목록
  private battleRetreats: Map<string, Set<string>> = new Map();  // battleId -> fleetIds

  private constructor() {
    super();
  }

  static getInstance(): RetreatService {
    if (!RetreatService.instance) {
      RetreatService.instance = new RetreatService();
    }
    return RetreatService.instance;
  }

  /**
   * 퇴각 요청
   */
  async requestRetreat(
    request: IRetreatRequest,
    fleetState?: BattleFleetState
  ): Promise<IRetreatResult> {
    const { sessionId, battleId, fleetId, requesterId, destination } = request;

    // 1. 이미 퇴각 중인지 확인
    if (this.retreatingFleets.has(fleetId)) {
      return { success: false, reason: '이미 퇴각 중입니다.' };
    }

    // 2. 전투 확인
    const battle = await RealtimeBattle.findOne({ sessionId, battleId });
    if (!battle) {
      return { success: false, reason: '전투를 찾을 수 없습니다.' };
    }

    if (battle.status !== 'ACTIVE') {
      return { success: false, reason: '전투가 진행 중이 아닙니다.' };
    }

    // 3. 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, reason: '함대를 찾을 수 없습니다.' };
    }

    // 4. 퇴각 가능 여부 확인
    const canRetreat = await this.canRetreat(sessionId, battle, fleet, fleetState);
    if (!canRetreat.canRetreat) {
      return { success: false, reason: canRetreat.reason };
    }

    // 5. 현재 위치 가져오기
    const currentPosition = fleetState?.physics.combat.position || { x: 0, y: 0, z: 0 };
    
    // 6. 맵 외곽 타겟 계산
    const edgeTarget = this.calculateEdgeTarget(currentPosition);

    // 7. 완료 시간 계산
    const currentTick = battle.tickCount || 0;
    const estimatedCompletionTick = currentTick + RETREAT_CONFIG.totalRetreatTicks;

    // 8. 퇴각 정보 생성
    const retreatId = `retreat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const unitCount = fleet.units.reduce((sum, u) => sum + u.count, 0);
    
    const retreatingFleet: IRetreatingFleet = {
      id: retreatId,
      sessionId,
      battleId,
      fleetId,
      factionId: fleet.factionId,
      status: 'REQUESTED',
      requestedAt: new Date(),
      requesterId,
      startTick: currentTick,
      estimatedCompletionTick,
      currentPhase: 'CHARGE',
      warpChargePercent: 0,
      startPosition: { ...currentPosition },
      currentPosition: { ...currentPosition },
      edgeTarget,
      initialUnits: unitCount,
      currentUnits: fleetState?.currentShips || unitCount,
      unitsLostDuringRetreat: 0,
      damageTakenDuringRetreat: 0,
      destination: destination ? { gridX: destination.x, gridY: destination.y } : undefined
    };

    // 9. 저장
    this.retreatingFleets.set(fleetId, retreatingFleet);
    
    if (!this.battleRetreats.has(battleId)) {
      this.battleRetreats.set(battleId, new Set());
    }
    this.battleRetreats.get(battleId)!.add(fleetId);

    // 10. 이벤트 발송
    this.emit('retreat:started', retreatingFleet);

    return {
      success: true,
      retreatingFleet,
      estimatedCompletionTick,
      estimatedCompletionTime: RETREAT_CONFIG.totalRetreatTicks / 10
    };
  }

  /**
   * 퇴각 가능 여부 확인
   */
  async canRetreat(
    sessionId: string,
    battle: IRealtimeBattle,
    fleet: IFleet,
    fleetState?: BattleFleetState
  ): Promise<{ canRetreat: boolean; reason?: string }> {
    // 1. 함대가 전투 참가자인지 확인
    const participant = battle.participants.find(p => p.fleetId === fleet.fleetId);
    if (!participant) {
      return { canRetreat: false, reason: '이 함대는 전투에 참여하고 있지 않습니다.' };
    }

    // 2. 이미 패배했는지 확인
    if (participant.isDefeated) {
      return { canRetreat: false, reason: '함대가 이미 패배했습니다.' };
    }

    // 3. 함대 상태 확인 (전투 엔진에서의 상태)
    if (fleetState) {
      if (fleetState.isDefeated) {
        return { canRetreat: false, reason: '함대가 패배했습니다.' };
      }
      
      if (fleetState.isRetreating) {
        return { canRetreat: false, reason: '이미 퇴각 중입니다.' };
      }

      // 유닛이 남아있는지 확인
      if (fleetState.currentShips <= 0) {
        return { canRetreat: false, reason: '남은 함선이 없습니다.' };
      }
    }

    // 4. 워프 에너지 확인 (생략 가능 - 충전 과정에서 처리)
    // 실제 게임에서는 워프 에너지 시스템과 연동

    return { canRetreat: true };
  }

  /**
   * 맵 외곽 타겟 계산
   */
  private calculateEdgeTarget(currentPosition: IVector3): IVector3 {
    // 현재 위치에서 가장 가까운 외곽 방향으로
    const halfSize = RETREAT_CONFIG.battleAreaHalfSize;
    
    // 중심에서 현재 위치 방향으로의 벡터
    const dirX = currentPosition.x === 0 ? 1 : currentPosition.x;
    const dirY = currentPosition.y === 0 ? 1 : currentPosition.y;
    
    // 정규화
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    const normX = dirX / length;
    const normY = dirY / length;
    
    // 외곽 위치
    return {
      x: normX * halfSize,
      y: normY * halfSize,
      z: 0
    };
  }

  /**
   * 매 틱 퇴각 처리 (전투 엔진에서 호출)
   */
  processTick(
    battleId: string,
    currentTick: number,
    allFleetStates: Map<string, BattleFleetState>
  ): { completed: IRetreatingFleet[]; failed: IRetreatingFleet[] } {
    const completed: IRetreatingFleet[] = [];
    const failed: IRetreatingFleet[] = [];
    
    const retreatFleetIds = this.battleRetreats.get(battleId);
    if (!retreatFleetIds || retreatFleetIds.size === 0) {
      return { completed, failed };
    }

    for (const fleetId of retreatFleetIds) {
      const retreat = this.retreatingFleets.get(fleetId);
      if (!retreat || retreat.status === 'COMPLETED' || retreat.status === 'FAILED') {
        continue;
      }

      const fleetState = allFleetStates.get(fleetId);
      
      // 함대가 파괴됐는지 확인
      if (!fleetState || fleetState.isDefeated || fleetState.currentShips <= 0) {
        retreat.status = 'FAILED';
        retreat.failureReason = '퇴각 중 파괴됨';
        failed.push(retreat);
        continue;
      }

      // 퇴각 진행
      const ticksElapsed = currentTick - retreat.startTick;
      const progress = ticksElapsed / RETREAT_CONFIG.totalRetreatTicks;
      
      // 손실 추적
      const unitsLost = retreat.initialUnits - fleetState.currentShips;
      if (unitsLost > retreat.unitsLostDuringRetreat) {
        retreat.unitsLostDuringRetreat = unitsLost;
      }
      retreat.currentUnits = fleetState.currentShips;

      // 페이즈 업데이트
      if (progress < RETREAT_CONFIG.warpPhasePercent) {
        // 워프 충전 페이즈
        retreat.currentPhase = 'CHARGE';
        retreat.warpChargePercent = (progress / RETREAT_CONFIG.warpPhasePercent) * 100;
        
        if (retreat.status === 'REQUESTED') {
          retreat.status = 'CHARGING';
          retreat.warpChargeStartTick = currentTick;
          this.emit('retreat:charging', retreat);
        }
      } else if (progress < RETREAT_CONFIG.warpPhasePercent + RETREAT_CONFIG.movePhasePercent) {
        // 맵 외곽 이동 페이즈
        retreat.currentPhase = 'MOVE';
        retreat.warpChargePercent = 100;
        
        if (retreat.status === 'CHARGING') {
          retreat.status = 'MOVING_TO_EDGE';
          this.emit('retreat:moving', retreat);
        }
        
        // 위치 업데이트 (전투 엔진이 실제 이동 처리)
        retreat.currentPosition = { ...fleetState.physics.combat.position };
      } else {
        // 워프 페이즈
        retreat.currentPhase = 'WARP';
        
        if (retreat.status === 'MOVING_TO_EDGE') {
          retreat.status = 'WARPING';
          this.emit('retreat:warping', retreat);
        }
      }

      // 완료 체크
      if (ticksElapsed >= RETREAT_CONFIG.totalRetreatTicks) {
        retreat.status = 'COMPLETED';
        retreat.completedAt = new Date();
        completed.push(retreat);
        this.emit('retreat:completed', retreat);
      }
    }

    return { completed, failed };
  }

  /**
   * 퇴각 완료 처리
   */
  async completeRetreat(retreat: IRetreatingFleet): Promise<{ gridX: number; gridY: number } | null> {
    const { sessionId, battleId, fleetId, factionId, destination } = retreat;

    // 1. 목적지 결정
    let finalDestination = destination;
    
    if (!finalDestination) {
      // 자동 목적지: 전투 그리드에서 가장 가까운 아군 그리드
      const battle = await RealtimeBattle.findOne({ sessionId, battleId });
      if (battle?.gridLocation) {
        finalDestination = await this.findRetreatDestination(
          sessionId,
          factionId,
          battle.gridLocation.x,
          battle.gridLocation.y
        );
      }
    }

    if (!finalDestination) {
      // 기본값: 전투 그리드 뒤쪽
      finalDestination = { gridX: 0, gridY: 0 };
    }

    // 2. 함대 상태 업데이트
    const gridId = `grid_${finalDestination.gridX}_${finalDestination.gridY}`;
    
    await Fleet.findOneAndUpdate(
      { sessionId, fleetId },
      {
        status: 'IDLE',
        gridId,
        previousGridId: retreat.battleId,
        battleState: undefined,
        // 유닛 손실은 전투 엔진에서 이미 처리됨
      }
    );

    // 3. 그리드에 함대 추가
    await gridService.moveFleetToGrid(sessionId, fleetId, finalDestination.gridX, finalDestination.gridY);

    // 4. 정리
    this.cleanupRetreat(fleetId);

    retreat.destination = finalDestination;

    this.emit('retreat:destination_reached', { retreat, destination: finalDestination });

    return finalDestination;
  }

  /**
   * 퇴각 목적지 찾기
   */
  private async findRetreatDestination(
    sessionId: string,
    factionId: string,
    battleGridX: number,
    battleGridY: number
  ): Promise<{ gridX: number; gridY: number } | null> {
    // 인접 그리드 중 아군 영토 찾기
    const adjacentGrids = [
      { x: battleGridX - 1, y: battleGridY },
      { x: battleGridX + 1, y: battleGridY },
      { x: battleGridX, y: battleGridY - 1 },
      { x: battleGridX, y: battleGridY + 1 },
      { x: battleGridX - 1, y: battleGridY - 1 },
      { x: battleGridX + 1, y: battleGridY + 1 },
      { x: battleGridX - 1, y: battleGridY + 1 },
      { x: battleGridX + 1, y: battleGridY - 1 },
    ];

    for (const pos of adjacentGrids) {
      const grid = await GalaxyGrid.findOne({ 
        sessionId, 
        x: pos.x, 
        y: pos.y 
      });
      
      if (grid && grid.ownerFactions?.includes(factionId)) {
        return { gridX: pos.x, gridY: pos.y };
      }
    }

    // 아군 영토가 없으면 아무 인접 그리드
    return adjacentGrids[0] ? { gridX: adjacentGrids[0].x, gridY: adjacentGrids[0].y } : null;
  }

  /**
   * 퇴각 중 추가 데미지 계산
   */
  calculatePursuitDamage(
    retreat: IRetreatingFleet,
    pursuerCount: number
  ): number {
    // 기본 추격 데미지
    let damage = RETREAT_CONFIG.pursuitDamagePerTick * pursuerCount;
    
    // 맵 외곽에서 멀수록 더 많은 데미지
    const edgeDist = Math.sqrt(
      Math.pow(retreat.edgeTarget.x - retreat.currentPosition.x, 2) +
      Math.pow(retreat.edgeTarget.y - retreat.currentPosition.y, 2)
    );
    
    if (edgeDist > 200) {
      damage *= 1.5;
    }
    
    // 퇴각 중 데미지 보정
    damage *= RETREAT_CONFIG.retreatDamagePenalty;
    
    return damage;
  }

  /**
   * 퇴각 취소
   */
  cancelRetreat(fleetId: string, reason?: string): boolean {
    const retreat = this.retreatingFleets.get(fleetId);
    if (!retreat) return false;

    if (retreat.status === 'COMPLETED' || retreat.status === 'FAILED') {
      return false;
    }

    // 워프 충전 중에만 취소 가능
    if (retreat.currentPhase !== 'CHARGE') {
      return false;  // 이동 시작 후에는 취소 불가
    }

    retreat.status = 'CANCELLED';
    retreat.failureReason = reason || '취소됨';

    this.cleanupRetreat(fleetId);
    this.emit('retreat:cancelled', retreat);

    return true;
  }

  /**
   * 퇴각 정리
   */
  private cleanupRetreat(fleetId: string): void {
    const retreat = this.retreatingFleets.get(fleetId);
    if (!retreat) return;

    this.retreatingFleets.delete(fleetId);
    this.battleRetreats.get(retreat.battleId)?.delete(fleetId);
  }

  /**
   * 함대의 퇴각 상태 조회
   */
  getRetreatStatus(fleetId: string): IRetreatingFleet | undefined {
    return this.retreatingFleets.get(fleetId);
  }

  /**
   * 함대가 퇴각 중인지 확인
   */
  isRetreating(fleetId: string): boolean {
    const retreat = this.retreatingFleets.get(fleetId);
    return retreat !== undefined && 
           retreat.status !== 'COMPLETED' && 
           retreat.status !== 'FAILED' && 
           retreat.status !== 'CANCELLED';
  }

  /**
   * 전투의 퇴각 중인 함대 목록
   */
  getRetreatingFleets(battleId: string): IRetreatingFleet[] {
    const fleetIds = this.battleRetreats.get(battleId);
    if (!fleetIds) return [];

    const result: IRetreatingFleet[] = [];
    for (const fleetId of fleetIds) {
      const retreat = this.retreatingFleets.get(fleetId);
      if (retreat && retreat.status !== 'COMPLETED' && retreat.status !== 'FAILED') {
        result.push(retreat);
      }
    }

    return result;
  }

  /**
   * 전투 종료 시 모든 퇴각 완료 처리
   */
  async completeAllForBattle(battleId: string): Promise<void> {
    const fleetIds = this.battleRetreats.get(battleId);
    if (!fleetIds) return;

    for (const fleetId of [...fleetIds]) {
      const retreat = this.retreatingFleets.get(fleetId);
      if (retreat && retreat.status !== 'COMPLETED' && retreat.status !== 'FAILED') {
        retreat.status = 'COMPLETED';
        retreat.completedAt = new Date();
        await this.completeRetreat(retreat);
      }
    }

    this.battleRetreats.delete(battleId);
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    this.retreatingFleets.clear();
    this.battleRetreats.clear();
    this.removeAllListeners();
  }
}

export const retreatService = RetreatService.getInstance();
export default RetreatService;
