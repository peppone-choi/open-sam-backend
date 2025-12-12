/**
 * CivilWarTacticalSession - 내전 전투 세션 확장
 *
 * TacticalSession을 확장하여 같은 세력 내 교전을 지원합니다.
 * 내전 상황에서 사용됩니다:
 * - 쿠데타 (반군 vs 정부군)
 * - 이탈/분리 (독립군 vs 본국군)
 * - 귀족반란 (반란 연합 vs 황제군)
 *
 * 기존 TacticalSession과의 차이점:
 * 1. 세력(faction) 대신 내전세력(civilWarFaction) 기반으로 교전 판단
 * 2. 아군 오인 사격(friendly fire) 확률
 * 3. 내전 종결 조건 (수도 점령, 지도자 처리 등)
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  UnitState,
  Vector3,
  BattleStatus,
  BattleParticipant,
  BattleResult,
  TacticalCommand,
  BattleUpdateEvent,
  TACTICAL_CONSTANTS,
  CasualtyReport,
} from '../../types/gin7/tactical.types';
import { TacticalSession, tacticalSessionManager } from './TacticalSession';
import { logger } from '../../common/logger';
import {
  CivilWarFactionIdentifier,
} from '../../constants/gin7/civil_war_definitions';

/**
 * 내전 참가자 인터페이스 (확장)
 */
export interface CivilWarParticipant extends BattleParticipant {
  /** 내전 내 세력 식별자 (INCUMBENT, INSURGENT, THIRD_PARTY 등) */
  civilWarFactionId: CivilWarFactionIdentifier;
  /** 원래 세력 ID (제국, 동맹 등) */
  originalFactionId: string;
  /** 정당성 점수 */
  legitimacyScore: number;
}

/**
 * 내전 전투 결과 (확장)
 */
export interface CivilWarBattleResult extends BattleResult {
  /** 내전 ID 연동 */
  civilWarId: string;
  /** 전투 유형 */
  battleType: 'FIELD_BATTLE' | 'SIEGE' | 'CAPITAL_ASSAULT';
  /** 수도 점령 여부 */
  capitalCaptured?: boolean;
  /** 지도자 포로/전사 여부 */
  leaderCaptured?: string;
  leaderKilled?: string;
}

/**
 * 아군 오인 사격 상수
 */
const FRIENDLY_FIRE_CONFIG = {
  /** 기본 오인 사격 확률 (%) */
  BASE_PROBABILITY: 2,
  /** 저조도 상황 (행성 야간, 운석대 등) 추가 확률 */
  LOW_VISIBILITY_BONUS: 5,
  /** 혼란 상태 추가 확률 */
  CHAOS_BONUS: 10,
  /** 명령 지연 시 추가 확률 */
  COMMAND_DELAY_BONUS: 3,
};

/**
 * CivilWarTacticalSession 클래스
 */
export class CivilWarTacticalSession extends EventEmitter {
  readonly battleId: string;
  readonly sessionId: string;
  readonly gridId: string;
  readonly civilWarId: string;

  private status: BattleStatus = 'WAITING';
  private tick: number = 0;

  // 내전 세력별 참가자
  private civilWarParticipants: Map<CivilWarFactionIdentifier, CivilWarParticipant> = new Map();

  // 유닛별 내전 세력 매핑
  private unitCivilWarFaction: Map<string, CivilWarFactionIdentifier> = new Map();

  // 기반 TacticalSession
  private baseSession: TacticalSession;

  // 결과
  private result: CivilWarBattleResult | null = null;

  constructor(
    sessionId: string,
    gridId: string,
    civilWarId: string,
    battleType: 'FIELD_BATTLE' | 'SIEGE' | 'CAPITAL_ASSAULT' = 'FIELD_BATTLE'
  ) {
    super();
    this.battleId = `CWBTL-${uuidv4().slice(0, 8)}`;
    this.sessionId = sessionId;
    this.gridId = gridId;
    this.civilWarId = civilWarId;

    // 기반 TacticalSession 생성
    this.baseSession = tacticalSessionManager.createSession(sessionId, gridId);

    // 기반 세션 이벤트 포워딩
    this.setupEventForwarding();

    logger.info('[CivilWarTacticalSession] Created', {
      battleId: this.battleId,
      civilWarId,
      battleType,
    });
  }

  /**
   * 기반 세션 이벤트를 포워딩
   */
  private setupEventForwarding(): void {
    // 전투 시작
    this.baseSession.on('BATTLE_START', (data) => {
      this.emit('CIVIL_WAR_BATTLE_START', {
        ...data,
        civilWarId: this.civilWarId,
      });
    });

    // 전투 업데이트
    this.baseSession.on('BATTLE_UPDATE', (data: BattleUpdateEvent) => {
      // 아군 오인 사격 처리
      this.processFriendlyFire(data);
      this.emit('CIVIL_WAR_BATTLE_UPDATE', data);
    });

    // 유닛 파괴
    this.baseSession.on('UNIT_DESTROYED', (data) => {
      const civilWarFaction = this.unitCivilWarFaction.get(data.unitId);
      this.emit('CIVIL_WAR_UNIT_DESTROYED', {
        ...data,
        civilWarId: this.civilWarId,
        civilWarFaction,
      });

      // 지도자 유닛 확인
      this.checkLeaderCasualty(data.unitId, 'killed');
    });

    // 전투 종료
    this.baseSession.on('BATTLE_END', (data) => {
      this.handleBattleEnd(data);
    });

    // 데미지 이벤트
    this.baseSession.on('DAMAGE', (data) => {
      const sourceFaction = this.unitCivilWarFaction.get(data.sourceId);
      const targetFaction = this.unitCivilWarFaction.get(data.targetId);
      this.emit('CIVIL_WAR_DAMAGE', {
        ...data,
        civilWarId: this.civilWarId,
        sourceCivilWarFaction: sourceFaction,
        targetCivilWarFaction: targetFaction,
        isFriendlyFire: sourceFaction === targetFaction,
      });
    });
  }

  /**
   * 내전 세력 참가자 추가
   */
  addCivilWarParticipant(
    civilWarFactionId: CivilWarFactionIdentifier,
    originalFactionId: string,
    fleetIds: string[],
    commanderIds: string[],
    legitimacyScore: number
  ): void {
    if (this.status !== 'WAITING') {
      throw new Error('Cannot add participants after battle started');
    }

    this.civilWarParticipants.set(civilWarFactionId, {
      factionId: civilWarFactionId,
      civilWarFactionId,
      originalFactionId,
      fleetIds,
      commanderIds,
      ready: false,
      retreated: false,
      surrendered: false,
      legitimacyScore,
    });

    // 기반 세션에도 추가 (같은 factionId로 등록하여 아군 공격 방지 우회)
    // 내전에서는 civilWarFactionId를 factionId로 사용
    this.baseSession.addParticipant(civilWarFactionId, fleetIds, commanderIds);

    logger.debug('[CivilWarTacticalSession] CivilWar participant added', {
      battleId: this.battleId,
      civilWarFactionId,
      originalFactionId,
      fleetIds,
    });
  }

  /**
   * 유닛에 내전 세력 할당
   */
  assignUnitCivilWarFaction(unitId: string, civilWarFactionId: CivilWarFactionIdentifier): void {
    this.unitCivilWarFaction.set(unitId, civilWarFactionId);
  }

  /**
   * 유닛의 내전 세력 조회
   */
  getUnitCivilWarFaction(unitId: string): CivilWarFactionIdentifier | undefined {
    return this.unitCivilWarFaction.get(unitId);
  }

  /**
   * 커맨드 큐잉 (내전 세력 기반)
   */
  queueCommand(
    civilWarFactionId: CivilWarFactionIdentifier,
    commanderId: string,
    command: TacticalCommand
  ): boolean {
    // civilWarFactionId를 factionId로 사용
    return this.baseSession.queueCommand(civilWarFactionId, commanderId, command);
  }

  /**
   * 참가자 준비 상태 설정
   */
  setParticipantReady(civilWarFactionId: CivilWarFactionIdentifier, ready: boolean): void {
    const participant = this.civilWarParticipants.get(civilWarFactionId);
    if (participant) {
      participant.ready = ready;
      this.baseSession.setParticipantReady(civilWarFactionId, ready);
    }
  }

  /**
   * 아군 오인 사격 처리
   */
  private processFriendlyFire(data: BattleUpdateEvent): void {
    // 확률적 아군 오인 사격 발생 체크
    for (const unit of data.units) {
      if (unit.isDestroyed || !unit.targetId) continue;

      const attackerFaction = this.unitCivilWarFaction.get(unit.id);
      const targetFaction = this.unitCivilWarFaction.get(unit.targetId);

      // 같은 내전 세력인데 타겟팅 중인 경우 (버그 방지)
      if (attackerFaction === targetFaction) {
        // 오인 사격 발생
        this.emit('FRIENDLY_FIRE', {
          battleId: this.battleId,
          civilWarId: this.civilWarId,
          attackerId: unit.id,
          targetId: unit.targetId,
          civilWarFaction: attackerFaction,
          tick: this.tick,
        });

        logger.warn('[CivilWarTacticalSession] Friendly fire detected', {
          battleId: this.battleId,
          attackerId: unit.id,
          targetId: unit.targetId,
          faction: attackerFaction,
        });
      }
    }
  }

  /**
   * 전투 종료 처리
   */
  private handleBattleEnd(data: { result: BattleResult }): void {
    const baseResult = data.result;

    // 내전 전투 결과 생성
    this.result = {
      ...baseResult,
      civilWarId: this.civilWarId,
      battleType: 'FIELD_BATTLE', // TODO: 생성자에서 받은 값 사용
    };

    // 승자 내전 세력 확인
    if (baseResult.winnerId) {
      const winnerFaction = this.civilWarParticipants.get(
        baseResult.winnerId as CivilWarFactionIdentifier
      );

      if (winnerFaction) {
        // 정당성 변화 계산
        const legitimacyGain = 10;
        winnerFaction.legitimacyScore += legitimacyGain;

        this.emit('CIVIL_WAR_BATTLE_WON', {
          battleId: this.battleId,
          civilWarId: this.civilWarId,
          winnerId: baseResult.winnerId,
          legitimacyGain,
          newLegitimacyScore: winnerFaction.legitimacyScore,
        });
      }
    }

    // 패배자 정당성 감소
    for (const [factionId, participant] of this.civilWarParticipants) {
      if (factionId !== baseResult.winnerId) {
        const legitimacyLoss = 5;
        participant.legitimacyScore = Math.max(0, participant.legitimacyScore - legitimacyLoss);
      }
    }

    this.emit('CIVIL_WAR_BATTLE_END', {
      battleId: this.battleId,
      civilWarId: this.civilWarId,
      result: this.result,
    });

    logger.info('[CivilWarTacticalSession] Civil war battle ended', {
      battleId: this.battleId,
      civilWarId: this.civilWarId,
      winnerId: baseResult.winnerId,
      reason: baseResult.reason,
    });
  }

  /**
   * 지도자 사상자 확인
   */
  private checkLeaderCasualty(unitId: string, type: 'killed' | 'captured'): void {
    for (const [factionId, participant] of this.civilWarParticipants) {
      // 지휘관 ID로 시작하는 기함인지 확인 (단순화된 로직)
      for (const commanderId of participant.commanderIds) {
        if (unitId.includes(commanderId)) {
          this.emit('CIVIL_WAR_LEADER_CASUALTY', {
            battleId: this.battleId,
            civilWarId: this.civilWarId,
            civilWarFactionId: factionId,
            commanderId,
            type,
          });

          if (type === 'captured') {
            this.result!.leaderCaptured = commanderId;
          } else {
            this.result!.leaderKilled = commanderId;
          }

          logger.info('[CivilWarTacticalSession] Leader casualty', {
            battleId: this.battleId,
            commanderId,
            type,
            faction: factionId,
          });
        }
      }
    }
  }

  /**
   * 항복 처리
   */
  surrender(civilWarFactionId: CivilWarFactionIdentifier): void {
    const participant = this.civilWarParticipants.get(civilWarFactionId);
    if (participant) {
      participant.surrendered = true;

      this.emit('CIVIL_WAR_SURRENDER', {
        battleId: this.battleId,
        civilWarId: this.civilWarId,
        civilWarFactionId,
      });

      logger.info('[CivilWarTacticalSession] Faction surrendered', {
        battleId: this.battleId,
        civilWarFactionId,
      });
    }
  }

  /**
   * 포로 처리 (항복 후)
   */
  async processCaptures(winnerFactionId: CivilWarFactionIdentifier): Promise<string[]> {
    const capturedCommanderIds: string[] = [];

    for (const [factionId, participant] of this.civilWarParticipants) {
      if (factionId === winnerFactionId) continue;
      if (!participant.surrendered && !participant.retreated) continue;

      // 항복/퇴각한 세력의 지휘관 포로 처리
      for (const commanderId of participant.commanderIds) {
        capturedCommanderIds.push(commanderId);
      }
    }

    this.emit('CIVIL_WAR_CAPTURES', {
      battleId: this.battleId,
      civilWarId: this.civilWarId,
      winnerFactionId,
      capturedCommanderIds,
    });

    return capturedCommanderIds;
  }

  // ==================== Getters ====================

  getBattleId(): string {
    return this.battleId;
  }

  getStatus(): BattleStatus {
    return this.baseSession.getStatus();
  }

  getTick(): number {
    return this.baseSession.getTick();
  }

  getResult(): CivilWarBattleResult | null {
    return this.result;
  }

  getUnits(): UnitState[] {
    return this.baseSession.getUnits();
  }

  getParticipants(): CivilWarParticipant[] {
    return Array.from(this.civilWarParticipants.values());
  }

  getSnapshot(): BattleUpdateEvent {
    return this.baseSession.getSnapshot();
  }

  // ==================== Cleanup ====================

  destroy(): void {
    this.baseSession.destroy();
    this.removeAllListeners();
    this.civilWarParticipants.clear();
    this.unitCivilWarFaction.clear();

    logger.info('[CivilWarTacticalSession] Destroyed', {
      battleId: this.battleId,
    });
  }
}

/**
 * 내전 전술 세션 매니저
 */
class CivilWarTacticalSessionManager {
  private sessions: Map<string, CivilWarTacticalSession> = new Map();

  createSession(
    sessionId: string,
    gridId: string,
    civilWarId: string,
    battleType?: 'FIELD_BATTLE' | 'SIEGE' | 'CAPITAL_ASSAULT'
  ): CivilWarTacticalSession {
    const session = new CivilWarTacticalSession(sessionId, gridId, civilWarId, battleType);
    this.sessions.set(session.getBattleId(), session);
    return session;
  }

  getSession(battleId: string): CivilWarTacticalSession | undefined {
    return this.sessions.get(battleId);
  }

  getSessionsByCivilWar(civilWarId: string): CivilWarTacticalSession[] {
    return Array.from(this.sessions.values()).filter(s => s.civilWarId === civilWarId);
  }

  removeSession(battleId: string): boolean {
    const session = this.sessions.get(battleId);
    if (session) {
      session.destroy();
      this.sessions.delete(battleId);
      return true;
    }
    return false;
  }
}

export const civilWarTacticalSessionManager = new CivilWarTacticalSessionManager();
export default CivilWarTacticalSession;







