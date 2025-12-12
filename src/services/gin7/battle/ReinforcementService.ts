/**
 * ReinforcementService
 * 
 * 전투 중 증원 합류 시스템
 * - 합류 요청 및 검증
 * - 도착 시간 계산
 * - 합류 예약 및 처리
 * - 유닛 제한 체크 (300 유닛/진영/그리드)
 */

import { EventEmitter } from 'events';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { RealtimeBattle, IRealtimeBattle, IBattleParticipant } from '../../../models/gin7/RealtimeBattle';
import { Gin7Character } from '../../../models/gin7/Character';
import { gridService } from '../GridService';

/**
 * 증원 요청
 */
export interface IReinforcementRequest {
  sessionId: string;
  battleId: string;
  fleetId: string;
  requesterId: string;      // 요청자 캐릭터 ID
  priority?: 'NORMAL' | 'URGENT';
}

/**
 * 증원 상태
 */
export type ReinforcementStatus = 
  | 'PENDING'       // 요청됨, 검증 대기
  | 'APPROVED'      // 승인됨
  | 'EN_ROUTE'      // 이동 중
  | 'ARRIVING'      // 도착 중 (전투 맵 진입)
  | 'JOINED'        // 합류 완료
  | 'REJECTED'      // 거부됨
  | 'CANCELLED';    // 취소됨

/**
 * 예약된 증원 정보
 */
export interface IScheduledReinforcement {
  id: string;
  sessionId: string;
  battleId: string;
  fleetId: string;
  factionId: string;
  
  // 요청 정보
  requestedAt: Date;
  requesterId: string;
  priority: 'NORMAL' | 'URGENT';
  
  // 도착 정보
  status: ReinforcementStatus;
  estimatedArrivalTick: number;
  actualArrivalTick?: number;
  
  // 출발 위치
  fromGridX: number;
  fromGridY: number;
  
  // 전투 위치
  battleGridX: number;
  battleGridY: number;
  
  // 유닛 정보
  unitCount: number;
  commanderId: string;
  isPlayerControlled: boolean;
  
  // 결과
  rejectionReason?: string;
  spawnPosition?: { x: number; y: number; z: number };
}

/**
 * 증원 결과
 */
export interface IReinforcementResult {
  success: boolean;
  reinforcement?: IScheduledReinforcement;
  reason?: string;
  estimatedArrivalTick?: number;
  estimatedArrivalTime?: number;  // 초
}

/**
 * 증원 설정
 */
export const REINFORCEMENT_CONFIG = {
  // 이동 시간 (틱)
  baseArrivalTicks: 100,        // 기본 도착 시간 (10초)
  ticksPerGrid: 50,             // 그리드당 추가 시간 (5초)
  urgentMultiplier: 0.7,        // 긴급 증원 시간 감소
  
  // 유닛 제한
  maxUnitsPerFaction: 300,      // 진영당 최대 유닛
  maxFactions: 2,               // 최대 진영 수
  
  // 증원 대기열
  maxPendingPerBattle: 10,      // 전투당 최대 대기 증원
  maxPendingPerFaction: 5,      // 진영당 최대 대기 증원
};

/**
 * ReinforcementService 클래스
 */
class ReinforcementService extends EventEmitter {
  private static instance: ReinforcementService;
  
  // 예약된 증원 목록
  private scheduledReinforcements: Map<string, IScheduledReinforcement> = new Map();  // id -> reinforcement
  
  // 전투별 증원 목록
  private battleReinforcements: Map<string, Set<string>> = new Map();  // battleId -> reinforcement ids
  
  // 함대별 증원 ID (중복 방지)
  private fleetReinforcements: Map<string, string> = new Map();  // fleetId -> reinforcement id

  private constructor() {
    super();
  }

  static getInstance(): ReinforcementService {
    if (!ReinforcementService.instance) {
      ReinforcementService.instance = new ReinforcementService();
    }
    return ReinforcementService.instance;
  }

  /**
   * 증원 요청
   */
  async requestReinforcement(
    request: IReinforcementRequest
  ): Promise<IReinforcementResult> {
    const { sessionId, battleId, fleetId, requesterId, priority = 'NORMAL' } = request;

    // 1. 전투 확인
    const battle = await RealtimeBattle.findOne({ sessionId, battleId });
    if (!battle) {
      return { success: false, reason: '전투를 찾을 수 없습니다.' };
    }

    if (battle.status !== 'ACTIVE' && battle.status !== 'PREPARING') {
      return { success: false, reason: '전투가 증원을 받을 수 없는 상태입니다.' };
    }

    // 2. 함대 확인
    const fleet = await Fleet.findOne({ sessionId, fleetId });
    if (!fleet) {
      return { success: false, reason: '함대를 찾을 수 없습니다.' };
    }

    // 3. 합류 가능 여부 확인
    const canReinforce = await this.canReinforce(sessionId, battle, fleet);
    if (!canReinforce.canReinforce) {
      return { success: false, reason: canReinforce.reason };
    }

    // 4. 이미 예약된 증원인지 확인
    if (this.fleetReinforcements.has(fleetId)) {
      return { success: false, reason: '이미 증원이 예약되어 있습니다.' };
    }

    // 5. 대기열 제한 확인
    const queueCheck = this.checkQueueLimits(battleId, fleet.factionId);
    if (!queueCheck.allowed) {
      return { success: false, reason: queueCheck.reason };
    }

    // 6. 도착 시간 계산
    const [, fx, fy] = (fleet.gridId || '').split('_').map(Number);
    const arrivalTicks = this.calculateArrivalTime(
      fx, fy,
      battle.gridLocation!.x, battle.gridLocation!.y,
      priority
    );

    // 7. 지휘관 온라인 상태 확인
    const commander = await Gin7Character.findOne({ sessionId, characterId: fleet.commanderId });
    const isPlayerControlled = commander?.isOnline || false;

    // 8. 스폰 위치 계산
    const spawnPosition = this.calculateSpawnPosition(battle, fleet.factionId);

    // 9. 증원 예약 생성
    const reinforcementId = `reinf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const scheduled: IScheduledReinforcement = {
      id: reinforcementId,
      sessionId,
      battleId,
      fleetId,
      factionId: fleet.factionId,
      requestedAt: new Date(),
      requesterId,
      priority,
      status: 'APPROVED',
      estimatedArrivalTick: (battle.tickCount || 0) + arrivalTicks,
      fromGridX: fx,
      fromGridY: fy,
      battleGridX: battle.gridLocation!.x,
      battleGridY: battle.gridLocation!.y,
      unitCount: fleet.units.reduce((sum, u) => sum + u.count, 0),
      commanderId: fleet.commanderId,
      isPlayerControlled,
      spawnPosition
    };

    // 10. 저장
    this.scheduledReinforcements.set(reinforcementId, scheduled);
    this.fleetReinforcements.set(fleetId, reinforcementId);
    
    if (!this.battleReinforcements.has(battleId)) {
      this.battleReinforcements.set(battleId, new Set());
    }
    this.battleReinforcements.get(battleId)!.add(reinforcementId);

    // 11. 함대 상태 업데이트
    await Fleet.findOneAndUpdate(
      { sessionId, fleetId },
      { status: 'REINFORCING' }
    );

    // 12. 이벤트 발송
    this.emit('reinforcement:scheduled', scheduled);

    return {
      success: true,
      reinforcement: scheduled,
      estimatedArrivalTick: scheduled.estimatedArrivalTick,
      estimatedArrivalTime: arrivalTicks / 10  // 초
    };
  }

  /**
   * 합류 가능 여부 확인
   */
  async canReinforce(
    sessionId: string,
    battle: IRealtimeBattle,
    fleet: IFleet
  ): Promise<{ canReinforce: boolean; reason?: string }> {
    // 1. 함대 상태 확인
    if (fleet.status === 'IN_BATTLE' || fleet.status === 'COMBAT') {
      return { canReinforce: false, reason: '함대가 이미 전투 중입니다.' };
    }

    if (fleet.status === 'REINFORCING') {
      return { canReinforce: false, reason: '함대가 이미 증원 이동 중입니다.' };
    }

    // 2. 진영 확인
    if (!battle.factions.includes(fleet.factionId)) {
      return { canReinforce: false, reason: '함대의 진영이 이 전투에 참여하고 있지 않습니다.' };
    }

    // 3. 위치 확인 (인접 그리드)
    const gridLocation = battle.gridLocation;
    if (!gridLocation) {
      return { canReinforce: false, reason: '전투 위치를 알 수 없습니다.' };
    }

    const [, fx, fy] = (fleet.gridId || '').split('_').map(Number);
    if (!gridService.isAdjacent(fx, fy, gridLocation.x, gridLocation.y) && 
        !(fx === gridLocation.x && fy === gridLocation.y)) {
      return { canReinforce: false, reason: '인접한 그리드에서만 증원할 수 있습니다.' };
    }

    // 4. 유닛 제한 확인
    const currentUnits = battle.participants
      .filter(p => p.faction === fleet.factionId && !p.isDefeated)
      .reduce((sum, p) => sum + (p.shipCount - p.shipsLost), 0);
    
    const fleetUnits = fleet.units.reduce((sum, u) => sum + u.count, 0);
    
    // 예약된 증원의 유닛도 계산
    const pendingUnits = this.getPendingUnitsForFaction(battle.battleId, fleet.factionId);
    
    if (currentUnits + pendingUnits + fleetUnits > REINFORCEMENT_CONFIG.maxUnitsPerFaction) {
      return { 
        canReinforce: false, 
        reason: `진영 유닛 제한(${REINFORCEMENT_CONFIG.maxUnitsPerFaction})을 초과합니다. 현재: ${currentUnits}, 대기: ${pendingUnits}, 요청: ${fleetUnits}` 
      };
    }

    return { canReinforce: true };
  }

  /**
   * 도착 시간 계산
   */
  calculateArrivalTime(
    fromX: number, fromY: number,
    toX: number, toY: number,
    priority: 'NORMAL' | 'URGENT' = 'NORMAL'
  ): number {
    // 거리 계산 (그리드 단위)
    const distance = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
    
    // 기본 시간 + 거리 * 그리드당 시간
    let arrivalTicks = REINFORCEMENT_CONFIG.baseArrivalTicks + 
                       distance * REINFORCEMENT_CONFIG.ticksPerGrid;
    
    // 긴급 증원은 더 빠름
    if (priority === 'URGENT') {
      arrivalTicks = Math.floor(arrivalTicks * REINFORCEMENT_CONFIG.urgentMultiplier);
    }
    
    return arrivalTicks;
  }

  /**
   * 스폰 위치 계산
   */
  private calculateSpawnPosition(
    battle: IRealtimeBattle,
    factionId: string
  ): { x: number; y: number; z: number } {
    const factionIndex = battle.factions.indexOf(factionId);
    const totalFactions = battle.factions.length;
    
    // 진영별 기본 각도
    const baseAngle = (factionIndex / totalFactions) * Math.PI * 2 - Math.PI / 2;
    
    // 같은 진영의 기존 함대 수
    const existingFleets = battle.participants.filter(p => p.faction === factionId).length;
    
    // 같은 진영의 대기 중인 증원 수
    const pendingReinforcements = this.getPendingReinforcementsForFaction(battle.battleId, factionId);
    const offset = existingFleets + pendingReinforcements;
    
    // 스폰 위치 (외곽에서 약간 오프셋)
    const radius = 400 + offset * 30;  // 기본 400, 추가 함대당 30씩 증가
    const angleOffset = offset * 0.1;   // 약간의 각도 오프셋
    
    return {
      x: Math.cos(baseAngle + angleOffset) * radius,
      y: Math.sin(baseAngle + angleOffset) * radius,
      z: 0
    };
  }

  /**
   * 매 틱 증원 처리 (전투 엔진에서 호출)
   */
  async processTick(
    battleId: string,
    currentTick: number
  ): Promise<IScheduledReinforcement[]> {
    const arrivedReinforcements: IScheduledReinforcement[] = [];
    const reinforcementIds = this.battleReinforcements.get(battleId);
    
    if (!reinforcementIds || reinforcementIds.size === 0) {
      return arrivedReinforcements;
    }

    for (const reinfId of reinforcementIds) {
      const reinforcement = this.scheduledReinforcements.get(reinfId);
      if (!reinforcement) continue;

      // 도착 시간 체크
      if (reinforcement.status === 'APPROVED' || reinforcement.status === 'EN_ROUTE') {
        if (currentTick >= reinforcement.estimatedArrivalTick) {
          // 도착!
          reinforcement.status = 'ARRIVING';
          reinforcement.actualArrivalTick = currentTick;
          arrivedReinforcements.push(reinforcement);
          
          this.emit('reinforcement:arriving', reinforcement);
        } else if (reinforcement.status === 'APPROVED') {
          // 이동 중으로 변경
          reinforcement.status = 'EN_ROUTE';
          this.emit('reinforcement:en_route', reinforcement);
        }
      }
    }

    return arrivedReinforcements;
  }

  /**
   * 증원 합류 처리 (실제 전투에 추가)
   */
  async processReinforcement(
    reinforcement: IScheduledReinforcement
  ): Promise<IBattleParticipant | null> {
    const { sessionId, battleId, fleetId, spawnPosition, commanderId, isPlayerControlled, unitCount, factionId } = reinforcement;

    // 전투 조회
    const battle = await RealtimeBattle.findOne({ sessionId, battleId });
    if (!battle || battle.status === 'ENDED') {
      this.cancelReinforcement(reinforcement.id, '전투가 종료되었습니다.');
      return null;
    }

    // 참가자 생성
    const participant: IBattleParticipant = {
      fleetId,
      faction: factionId,
      commanderId,
      isPlayerControlled,
      initialPosition: spawnPosition || { x: 0, y: 0, z: 0 },
      shipCount: unitCount,
      isDefeated: false,
      joinedAt: new Date(),
      damageDealt: 0,
      damageTaken: 0,
      shipsLost: 0
    };

    // 전투에 추가
    battle.participants.push(participant);
    await battle.save();

    // 함대 상태 업데이트
    await Fleet.findOneAndUpdate(
      { sessionId, fleetId },
      { 
        status: 'IN_BATTLE',
        battleState: {
          battleId,
          gridId: battle.gridLocation?.gridId,
          joinedAt: new Date(),
          role: 'REINFORCEMENT',
          initialUnits: unitCount,
          currentUnits: unitCount
        }
      }
    );

    // 증원 상태 업데이트
    reinforcement.status = 'JOINED';
    
    // 정리
    this.cleanupReinforcement(reinforcement.id);

    this.emit('reinforcement:joined', { reinforcement, participant });

    return participant;
  }

  /**
   * 증원 취소
   */
  cancelReinforcement(
    reinforcementId: string,
    reason?: string
  ): boolean {
    const reinforcement = this.scheduledReinforcements.get(reinforcementId);
    if (!reinforcement) return false;

    if (reinforcement.status === 'JOINED') {
      return false;  // 이미 합류됨
    }

    reinforcement.status = 'CANCELLED';
    reinforcement.rejectionReason = reason;

    // 함대 상태 복원
    Fleet.findOneAndUpdate(
      { sessionId: reinforcement.sessionId, fleetId: reinforcement.fleetId },
      { status: 'IDLE' }
    ).exec();

    this.cleanupReinforcement(reinforcementId);
    this.emit('reinforcement:cancelled', reinforcement);

    return true;
  }

  /**
   * 증원 정리
   */
  private cleanupReinforcement(reinforcementId: string): void {
    const reinforcement = this.scheduledReinforcements.get(reinforcementId);
    if (!reinforcement) return;

    this.scheduledReinforcements.delete(reinforcementId);
    this.fleetReinforcements.delete(reinforcement.fleetId);
    this.battleReinforcements.get(reinforcement.battleId)?.delete(reinforcementId);
  }

  /**
   * 대기열 제한 확인
   */
  private checkQueueLimits(
    battleId: string,
    factionId: string
  ): { allowed: boolean; reason?: string } {
    const battleReinfs = this.battleReinforcements.get(battleId);
    if (!battleReinfs) {
      return { allowed: true };
    }

    // 전투당 대기 제한
    if (battleReinfs.size >= REINFORCEMENT_CONFIG.maxPendingPerBattle) {
      return { 
        allowed: false, 
        reason: `전투당 최대 대기 증원 수(${REINFORCEMENT_CONFIG.maxPendingPerBattle})를 초과했습니다.` 
      };
    }

    // 진영당 대기 제한
    let factionCount = 0;
    for (const reinfId of battleReinfs) {
      const reinf = this.scheduledReinforcements.get(reinfId);
      if (reinf && reinf.factionId === factionId && 
          (reinf.status === 'APPROVED' || reinf.status === 'EN_ROUTE')) {
        factionCount++;
      }
    }

    if (factionCount >= REINFORCEMENT_CONFIG.maxPendingPerFaction) {
      return { 
        allowed: false, 
        reason: `진영당 최대 대기 증원 수(${REINFORCEMENT_CONFIG.maxPendingPerFaction})를 초과했습니다.` 
      };
    }

    return { allowed: true };
  }

  /**
   * 진영의 대기 중인 유닛 수 조회
   */
  private getPendingUnitsForFaction(battleId: string, factionId: string): number {
    const battleReinfs = this.battleReinforcements.get(battleId);
    if (!battleReinfs) return 0;

    let totalUnits = 0;
    for (const reinfId of battleReinfs) {
      const reinf = this.scheduledReinforcements.get(reinfId);
      if (reinf && reinf.factionId === factionId && 
          reinf.status !== 'CANCELLED' && reinf.status !== 'REJECTED' && reinf.status !== 'JOINED') {
        totalUnits += reinf.unitCount;
      }
    }

    return totalUnits;
  }

  /**
   * 진영의 대기 중인 증원 수 조회
   */
  private getPendingReinforcementsForFaction(battleId: string, factionId: string): number {
    const battleReinfs = this.battleReinforcements.get(battleId);
    if (!battleReinfs) return 0;

    let count = 0;
    for (const reinfId of battleReinfs) {
      const reinf = this.scheduledReinforcements.get(reinfId);
      if (reinf && reinf.factionId === factionId && 
          reinf.status !== 'CANCELLED' && reinf.status !== 'REJECTED' && reinf.status !== 'JOINED') {
        count++;
      }
    }

    return count;
  }

  /**
   * 전투의 모든 대기 중인 증원 조회
   */
  getPendingReinforcements(battleId: string): IScheduledReinforcement[] {
    const battleReinfs = this.battleReinforcements.get(battleId);
    if (!battleReinfs) return [];

    const result: IScheduledReinforcement[] = [];
    for (const reinfId of battleReinfs) {
      const reinf = this.scheduledReinforcements.get(reinfId);
      if (reinf && reinf.status !== 'CANCELLED' && reinf.status !== 'REJECTED' && reinf.status !== 'JOINED') {
        result.push(reinf);
      }
    }

    return result;
  }

  /**
   * 증원 정보 조회
   */
  getReinforcement(reinforcementId: string): IScheduledReinforcement | undefined {
    return this.scheduledReinforcements.get(reinforcementId);
  }

  /**
   * 함대의 증원 상태 조회
   */
  getFleetReinforcementStatus(fleetId: string): IScheduledReinforcement | undefined {
    const reinfId = this.fleetReinforcements.get(fleetId);
    if (!reinfId) return undefined;
    return this.scheduledReinforcements.get(reinfId);
  }

  /**
   * 전투 종료 시 모든 증원 취소
   */
  cancelAllForBattle(battleId: string): void {
    const battleReinfs = this.battleReinforcements.get(battleId);
    if (!battleReinfs) return;

    for (const reinfId of [...battleReinfs]) {
      this.cancelReinforcement(reinfId, '전투가 종료되었습니다.');
    }

    this.battleReinforcements.delete(battleId);
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    this.scheduledReinforcements.clear();
    this.battleReinforcements.clear();
    this.fleetReinforcements.clear();
    this.removeAllListeners();
  }
}

export const reinforcementService = ReinforcementService.getInstance();
export default ReinforcementService;
