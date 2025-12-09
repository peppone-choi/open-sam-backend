/**
 * Offline AI Service
 * 
 * 플레이어 부재 시 자동으로 함대를 관리합니다:
 * - 자동 방어 모드
 * - 자동 후퇴 조건
 * - 자동 보급 요청
 * - 자동 수리 명령
 * - 위험 회피 로직
 */

import { EventEmitter } from 'events';
import {
  OfflineMode,
  OfflineAIConfig,
  OfflineAutoAction,
  TacticalContext,
  TacticalDecision,
  AI_CONFIG,
} from '../../../types/gin7/npc-ai.types';
import { Fleet, IFleet } from '../../../models/gin7/Fleet';
import { logger } from '../../../common/logger';

// ============================================================
// Types
// ============================================================

export interface OfflinePlayerConfig {
  playerId: string;
  sessionId: string;
  factionId: string;
  config: OfflineAIConfig;
}

export interface OfflineEvaluationResult {
  playerId: string;
  actionsTriggered: OfflineAutoAction[];
  fleetsAffected: string[];
}

// ============================================================
// Default Configurations
// ============================================================

export const DEFAULT_OFFLINE_MODE: OfflineMode = {
  enabled: true,
  defenseThreshold: 50,      // 50% HP에서 방어 모드
  retreatThreshold: 25,      // 25% HP에서 퇴각
  autoResupply: true,
  autoRepair: true,
  dangerAvoidance: true,
};

export const OFFLINE_CONFIG = {
  AFK_THRESHOLD_MINUTES: 5,          // 5분 후 오프라인 AI 활성화
  CHECK_INTERVAL_TICKS: 10,          // 10틱마다 상태 체크
  DANGER_PROXIMITY_THRESHOLD: 5000,  // 위험 근접 거리
  RESUPPLY_THRESHOLD: 30,            // 30% 이하 보급
  REPAIR_THRESHOLD: 70,              // 70% 이하 HP시 수리
};

// ============================================================
// Offline AI Service
// ============================================================

export class OfflineAIService extends EventEmitter {
  private offlinePlayers: Map<string, OfflinePlayerConfig> = new Map();
  
  constructor() {
    super();
  }
  
  // ============================================================
  // Player Management
  // ============================================================
  
  /**
   * 플레이어를 오프라인 AI 관리에 등록
   */
  registerPlayer(
    playerId: string, 
    sessionId: string, 
    factionId: string,
    customConfig?: Partial<OfflineMode>
  ): void {
    const config: OfflineAIConfig = {
      mode: { ...DEFAULT_OFFLINE_MODE, ...customConfig },
      lastActivity: new Date(),
      afkDuration: 0,
      autoActions: [],
    };
    
    this.offlinePlayers.set(playerId, {
      playerId,
      sessionId,
      factionId,
      config,
    });
    
    logger.info('[OfflineAI] Player registered', { playerId, sessionId });
  }
  
  /**
   * 플레이어 등록 해제
   */
  unregisterPlayer(playerId: string): void {
    this.offlinePlayers.delete(playerId);
    logger.info('[OfflineAI] Player unregistered', { playerId });
  }
  
  /**
   * 플레이어 활동 업데이트 (접속 중임을 알림)
   */
  updateActivity(playerId: string): void {
    const playerConfig = this.offlinePlayers.get(playerId);
    if (playerConfig) {
      playerConfig.config.lastActivity = new Date();
      playerConfig.config.afkDuration = 0;
    }
  }
  
  /**
   * 오프라인 모드 설정 업데이트
   */
  updateOfflineMode(playerId: string, mode: Partial<OfflineMode>): void {
    const playerConfig = this.offlinePlayers.get(playerId);
    if (playerConfig) {
      playerConfig.config.mode = { ...playerConfig.config.mode, ...mode };
      logger.debug('[OfflineAI] Mode updated', { playerId, mode });
    }
  }
  
  /**
   * 플레이어가 오프라인인지 확인
   */
  isPlayerOffline(playerId: string): boolean {
    const playerConfig = this.offlinePlayers.get(playerId);
    if (!playerConfig) return false;
    
    const minutesSinceActivity = 
      (Date.now() - playerConfig.config.lastActivity.getTime()) / (1000 * 60);
    
    return minutesSinceActivity >= OFFLINE_CONFIG.AFK_THRESHOLD_MINUTES;
  }
  
  // ============================================================
  // Evaluation & Actions
  // ============================================================
  
  /**
   * 모든 오프라인 플레이어의 함대 평가 및 자동 조치
   */
  async evaluateAllOfflinePlayers(currentTick: number): Promise<OfflineEvaluationResult[]> {
    const results: OfflineEvaluationResult[] = [];
    
    for (const [playerId, playerConfig] of this.offlinePlayers) {
      // 활동 시간 업데이트
      const minutesSinceActivity = 
        (Date.now() - playerConfig.config.lastActivity.getTime()) / (1000 * 60);
      playerConfig.config.afkDuration = minutesSinceActivity;
      
      // 오프라인 모드 활성화 체크
      if (!this.isPlayerOffline(playerId)) continue;
      if (!playerConfig.config.mode.enabled) continue;
      
      // 체크 주기 확인
      if (currentTick % OFFLINE_CONFIG.CHECK_INTERVAL_TICKS !== 0) continue;
      
      try {
        const result = await this.evaluatePlayer(playerConfig);
        results.push(result);
      } catch (error) {
        logger.error('[OfflineAI] Evaluation error', { playerId, error });
      }
    }
    
    return results;
  }
  
  /**
   * 개별 플레이어 평가
   */
  private async evaluatePlayer(playerConfig: OfflinePlayerConfig): Promise<OfflineEvaluationResult> {
    const { playerId, sessionId, factionId, config } = playerConfig;
    const result: OfflineEvaluationResult = {
      playerId,
      actionsTriggered: [],
      fleetsAffected: [],
    };
    
    // 플레이어의 함대 로드
    const fleets = await Fleet.find({
      sessionId,
      factionId,
      // 플레이어 소속 함대만 (실제로는 playerId 필드가 있어야 함)
    }).lean();
    
    for (const fleet of fleets) {
      const actions = await this.evaluateFleet(fleet as unknown as IFleet, config.mode);
      
      if (actions.length > 0) {
        result.actionsTriggered.push(...actions);
        result.fleetsAffected.push(fleet.fleetId);
        
        // 액션 실행
        for (const action of actions) {
          await this.executeOfflineAction(fleet as unknown as IFleet, action);
        }
      }
    }
    
    // 이벤트 발생
    if (result.actionsTriggered.length > 0) {
      this.emit('OFFLINE_ACTIONS_TRIGGERED', result);
    }
    
    return result;
  }
  
  /**
   * 개별 함대 평가
   */
  private async evaluateFleet(fleet: IFleet, mode: OfflineMode): Promise<OfflineAutoAction[]> {
    const actions: OfflineAutoAction[] = [];
    
    // 함대 상태 계산
    const avgHp = this.calculateAverageHp(fleet);
    const avgSupply = this.calculateAverageSupply(fleet);
    const isInDanger = await this.checkDangerProximity(fleet);
    
    // 1. 위험 회피 체크 (최우선)
    if (mode.dangerAvoidance && isInDanger && avgHp < mode.defenseThreshold) {
      actions.push({
        type: 'EVADE',
        triggered: true,
        triggeredAt: new Date(),
        parameters: { reason: 'danger_proximity' },
      });
    }
    
    // 2. 퇴각 체크
    if (avgHp <= mode.retreatThreshold && fleet.status === 'COMBAT') {
      actions.push({
        type: 'RETREAT',
        triggered: true,
        triggeredAt: new Date(),
        parameters: { hp: avgHp, threshold: mode.retreatThreshold },
      });
    }
    
    // 3. 방어 모드 체크
    else if (avgHp <= mode.defenseThreshold && fleet.status !== 'REORG') {
      actions.push({
        type: 'DEFEND',
        triggered: true,
        triggeredAt: new Date(),
        parameters: { hp: avgHp, threshold: mode.defenseThreshold },
      });
    }
    
    // 4. 수리 체크
    if (mode.autoRepair && avgHp < OFFLINE_CONFIG.REPAIR_THRESHOLD && fleet.status === 'IDLE') {
      actions.push({
        type: 'REPAIR',
        triggered: true,
        triggeredAt: new Date(),
        parameters: { hp: avgHp },
      });
    }
    
    // 5. 보급 체크
    if (mode.autoResupply && avgSupply < OFFLINE_CONFIG.RESUPPLY_THRESHOLD && fleet.status === 'IDLE') {
      actions.push({
        type: 'RESUPPLY',
        triggered: true,
        triggeredAt: new Date(),
        parameters: { supply: avgSupply },
      });
    }
    
    return actions;
  }
  
  // ============================================================
  // Action Execution
  // ============================================================
  
  /**
   * 오프라인 액션 실행
   */
  private async executeOfflineAction(fleet: IFleet, action: OfflineAutoAction): Promise<void> {
    logger.info('[OfflineAI] Executing action', {
      fleetId: fleet.fleetId,
      action: action.type,
      parameters: action.parameters,
    });
    
    switch (action.type) {
      case 'EVADE':
        await this.executeEvade(fleet);
        break;
        
      case 'RETREAT':
        await this.executeRetreat(fleet);
        break;
        
      case 'DEFEND':
        await this.executeDefend(fleet);
        break;
        
      case 'REPAIR':
        await this.executeRepair(fleet);
        break;
        
      case 'RESUPPLY':
        await this.executeResupply(fleet);
        break;
    }
  }
  
  /**
   * 위험 회피 실행
   */
  private async executeEvade(fleet: IFleet): Promise<void> {
    // 가장 가까운 안전한 위치로 이동
    const safePosition = await this.findSafePosition(fleet);
    
    await Fleet.updateOne(
      { fleetId: fleet.fleetId },
      {
        status: 'MOVING',
        'statusData.destination': safePosition,
        'statusData.mission': 'EVADE',
        'statusData.autoAction': true,
      }
    );
  }
  
  /**
   * 퇴각 실행
   */
  private async executeRetreat(fleet: IFleet): Promise<void> {
    // 가장 가까운 아군 기지로 퇴각
    const retreatDestination = await this.findRetreatDestination(fleet);
    
    await Fleet.updateOne(
      { fleetId: fleet.fleetId },
      {
        status: 'RETREATING',
        'statusData.destination': retreatDestination,
        'statusData.mission': 'RETREAT',
        'statusData.autoAction': true,
      }
    );
    
    logger.info('[OfflineAI] Fleet retreating', {
      fleetId: fleet.fleetId,
      destination: retreatDestination,
    });
  }
  
  /**
   * 방어 모드 실행
   */
  private async executeDefend(fleet: IFleet): Promise<void> {
    // 방어적 진형으로 전환하고 현 위치 고수
    await Fleet.updateOne(
      { fleetId: fleet.fleetId },
      {
        status: 'DEFENDING',
        'statusData.formation': 'DEFENSIVE',
        'statusData.mission': 'DEFEND',
        'statusData.autoAction': true,
      }
    );
  }
  
  /**
   * 수리 실행
   */
  private async executeRepair(fleet: IFleet): Promise<void> {
    // 가장 가까운 수리 시설로 이동
    const repairFacility = await this.findNearestRepairFacility(fleet);
    
    if (repairFacility) {
      await Fleet.updateOne(
        { fleetId: fleet.fleetId },
        {
          status: 'MOVING',
          'statusData.destination': repairFacility,
          'statusData.mission': 'REPAIR',
          'statusData.autoAction': true,
        }
      );
    }
  }
  
  /**
   * 보급 실행
   */
  private async executeResupply(fleet: IFleet): Promise<void> {
    // 가장 가까운 보급 기지로 이동
    const supplyBase = await this.findNearestSupplyBase(fleet);
    
    if (supplyBase) {
      await Fleet.updateOne(
        { fleetId: fleet.fleetId },
        {
          status: 'MOVING',
          'statusData.destination': supplyBase,
          'statusData.mission': 'RESUPPLY',
          'statusData.autoAction': true,
        }
      );
    }
  }
  
  // ============================================================
  // Helper Functions
  // ============================================================
  
  /**
   * 평균 HP 계산
   */
  private calculateAverageHp(fleet: IFleet): number {
    if (!fleet.units || fleet.units.length === 0) return 100;
    
    const totalHp = fleet.units.reduce((sum, unit) => sum + unit.hp, 0);
    return totalHp / fleet.units.length;
  }
  
  /**
   * 평균 보급량 계산
   */
  private calculateAverageSupply(fleet: IFleet): number {
    // 실제 구현에서는 fleet.supply 또는 유사한 필드 사용
    return 100; // 임시 값
  }
  
  /**
   * 위험 근접 체크
   */
  private async checkDangerProximity(fleet: IFleet): Promise<boolean> {
    // 적 함대가 근처에 있는지 체크
    const nearbyEnemyFleets = await Fleet.find({
      sessionId: fleet.sessionId,
      factionId: { $ne: fleet.factionId },
      'location.systemId': fleet.location?.systemId,
    }).lean();
    
    // 적 함대가 있으면 위험
    return nearbyEnemyFleets.length > 0;
  }
  
  /**
   * 안전한 위치 찾기
   */
  private async findSafePosition(fleet: IFleet): Promise<string> {
    // 가장 가까운 아군 성계
    // 실제 구현에서는 경로 탐색 필요
    return fleet.location?.systemId || '';
  }
  
  /**
   * 퇴각 목적지 찾기
   */
  private async findRetreatDestination(fleet: IFleet): Promise<string> {
    // 가장 가까운 아군 행성/기지
    // 실제 구현에서는 경로 탐색 필요
    return 'HOMEBASE';
  }
  
  /**
   * 가장 가까운 수리 시설 찾기
   */
  private async findNearestRepairFacility(fleet: IFleet): Promise<string | null> {
    // 실제 구현에서는 시설 검색 필요
    return 'REPAIR_FACILITY';
  }
  
  /**
   * 가장 가까운 보급 기지 찾기
   */
  private async findNearestSupplyBase(fleet: IFleet): Promise<string | null> {
    // 실제 구현에서는 기지 검색 필요
    return 'SUPPLY_BASE';
  }
  
  // ============================================================
  // Tactical Integration
  // ============================================================
  
  /**
   * 전투 중 오프라인 AI 결정 생성
   */
  generateTacticalDecisions(
    playerId: string,
    tacticalContext: TacticalContext
  ): TacticalDecision[] {
    const playerConfig = this.offlinePlayers.get(playerId);
    if (!playerConfig || !this.isPlayerOffline(playerId)) {
      return [];
    }
    
    const decisions: TacticalDecision[] = [];
    const mode = playerConfig.config.mode;
    
    // 위기 상황 체크
    if (tacticalContext.ownAverageHp <= mode.retreatThreshold) {
      // 퇴각 결정
      const unitIds = tacticalContext.ownUnits
        .filter(u => !u.isRetreating && !u.isChaos)
        .map(u => u.unitId);
      
      if (unitIds.length > 0) {
        decisions.push({
          type: 'RETREAT',
          unitIds,
          energyDistribution: {
            beam: 5,
            gun: 5,
            shield: 30,
            engine: 25,
            warp: 30,
            sensor: 5,
          },
          reasoning: '[OfflineAI] Auto-retreat: HP below threshold',
        });
      }
    } else if (tacticalContext.ownAverageHp <= mode.defenseThreshold) {
      // 방어 모드
      const unitIds = tacticalContext.ownUnits
        .filter(u => !u.isChaos)
        .map(u => u.unitId);
      
      if (unitIds.length > 0) {
        decisions.push({
          type: 'CHANGE_FORMATION',
          unitIds,
          formation: 'DEFENSIVE',
          reasoning: '[OfflineAI] Auto-defense: HP below threshold',
        });
        
        decisions.push({
          type: 'CHANGE_ENERGY',
          unitIds,
          energyDistribution: {
            beam: 15,
            gun: 15,
            shield: 40,
            engine: 15,
            warp: 10,
            sensor: 5,
          },
          reasoning: '[OfflineAI] Defensive energy distribution',
        });
      }
    }
    
    return decisions;
  }
  
  /**
   * 정리
   */
  destroy(): void {
    this.offlinePlayers.clear();
    this.removeAllListeners();
    logger.info('[OfflineAI] Service destroyed');
  }
}

// Singleton export
export const offlineAIService = new OfflineAIService();

