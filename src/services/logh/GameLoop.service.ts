/**
 * LOGH Game Loop Service
 * 실시간 게임 루프 (턴제 아님)
 * 
 * 모든 함대 이동, 전투 처리를 실시간으로 업데이트
 */

import { RealtimeMovementService } from './RealtimeMovement.service';
import { RealtimeCombatService } from './RealtimeCombat.service';
import { TacticalMap } from '../../models/logh/TacticalMap.model';
import { LoghCommander } from '../../models/logh/Commander.model';
import { CommanderWrapper } from '../../models/logh/CommanderWrapper';

export class GameLoopService {
  private sessionId: string;
  private isRunning: boolean = false;
  private lastUpdateTime: number = Date.now();
  private updateInterval: NodeJS.Timeout | null = null;
  private targetFPS: number = 30; // 초당 30회 업데이트
  private lastCPRegenTime: number = Date.now(); // CP 회복 타이머
  private cpRegenIntervalMs: number = 5 * 60 * 1000; // 5분 (실시간)

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * 게임 루프 시작
   */
  start(): void {
    if (this.isRunning) {
      console.log('[GameLoop] Already running');
      return;
    }

    console.log(`[GameLoop] Starting for session: ${this.sessionId}`);
    this.isRunning = true;
    this.lastUpdateTime = Date.now();

    // 30 FPS = 33ms 간격
    const intervalMs = 1000 / this.targetFPS;

    this.updateInterval = setInterval(() => {
      this.update();
    }, intervalMs);
  }

  /**
   * 게임 루프 정지
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log(`[GameLoop] Stopping for session: ${this.sessionId}`);
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 게임 상태 업데이트
   */
  private async update(): Promise<void> {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // 초 단위
    this.lastUpdateTime = currentTime;

    try {
      // 1. 모든 이동 중인 함대 업데이트 (전략 맵)
      await RealtimeMovementService.updateAllMovingFleets(
        this.sessionId,
        deltaTime
      );

      // 2. 모든 활성 전투 업데이트 (전술 맵)
      await this.updateAllActiveCombats(deltaTime);

      // 3. 후퇴 진행 상황 체크 (전술 맵 → 전략 맵)
      await this.checkRetreatingFleets();

      // 4. CP 회복 체크 (5분마다)
      if (currentTime - this.lastCPRegenTime >= this.cpRegenIntervalMs) {
        await this.regenerateCommandPoints();
        this.lastCPRegenTime = currentTime;
      }

      // 5. 완료된 커맨드 처리
      await this.processCompletedCommands();

    } catch (error) {
      console.error('[GameLoop] Update error:', error);
    }
  }

  /**
   * 모든 활성 전투 업데이트
   */
  private async updateAllActiveCombats(deltaTime: number): Promise<void> {
    const activeCombats = await TacticalMap.find({
      session_id: this.sessionId,
      status: 'active',
    });

    for (const combat of activeCombats) {
      try {
        const result = await RealtimeCombatService.updateCombat(
          this.sessionId,
          combat.tacticalMapId,
          deltaTime
        );

        // 전투 종료 조건 체크
        if (this.shouldEndCombat(result)) {
          await RealtimeCombatService.concludeCombat(
            this.sessionId,
            combat.tacticalMapId
          );
          console.log(`[GameLoop] Combat concluded: ${combat.tacticalMapId}`);
        }
      } catch (error) {
        console.error(`[GameLoop] Combat update error for ${combat.tacticalMapId}:`, error);
      }
    }
  }

  /**
   * 전투 종료 조건 체크
   */
  private shouldEndCombat(result: any): boolean {
    // 한쪽 진영이 전멸했는지 확인
    const empireFleets = result.fleetPositions.filter((f: any) => 
      f.faction === 'empire'
    );
    const allianceFleets = result.fleetPositions.filter((f: any) => 
      f.faction === 'alliance'
    );

    
    return empireFleets.length === 0 || allianceFleets.length === 0;
  }

  /**
   * 후퇴 중인 함대들의 진행 상황 체크
   * 전술 맵 경계 도달시 전략 맵으로 이동
   */
  private async checkRetreatingFleets(): Promise<void> {
    try {
      const { Fleet } = await import('../../models/logh/Fleet.model');
      const { RetreatTacticalCommand } = await import('../../commands/logh/tactical/Retreat');

      // 후퇴 중인 모든 함대 조회
      const retreatingFleets = await Fleet.find({
        session_id: this.sessionId,
        status: 'retreating',
        isInCombat: true,
      });

      const retreatCommand = new RetreatTacticalCommand();

      for (const fleet of retreatingFleets) {
        try {
          // 후퇴 진행 상황 체크 (경계 도달시 전략 맵으로 이동)
          const retreatCompleted = await retreatCommand.checkRetreatProgress(
            fleet.fleetId,
            this.sessionId
          );

          if (retreatCompleted) {
            console.log(`[GameLoop] Fleet ${fleet.fleetId} successfully retreated from combat`);
          }
        } catch (error) {
          console.error(`[GameLoop] Error checking retreat progress for ${fleet.fleetId}:`, error);
        }
      }
    } catch (error) {
      console.error('[GameLoop] Error checking retreating fleets:', error);
    }
  }

  /**
   * CP 회복 처리
   * gin7manual: 정치 능력과 운영 능력이 회복량에 영향
   * 전술 게임 중인 커맨더는 회복 안됨
   */
  private async regenerateCommandPoints(): Promise<void> {
    try {
      const commanders = await LoghCommander.find({
        session_id: this.sessionId,
        isActive: true,
      });

      for (const commander of commanders) {
        // 전술 게임(전투) 중인지 체크
        const isInCombat = commander.fleetId 
          ? await this.isFleetInCombat(commander.fleetId)
          : false;

        if (isInCombat) {
          // 전투 중에는 CP 회복 안됨
          continue;
        }

        // 정치, 운영 능력에 따른 회복량 계산
        const politics = commander.stats?.politics || 50;
        const management = commander.stats?.operations || 50; // 운영 능력으로 operations 사용

        // 기본 회복량: 1 CP
        // 정치 50 기준, 10당 +0.2 CP
        // 운영 50 기준, 10당 +0.2 CP
        const politicsBonus = (politics - 50) * 0.02;
        const managementBonus = (management - 50) * 0.02;
        
        const baseRegen = 1;
        const totalRegen = Math.max(1, Math.round(baseRegen + politicsBonus + managementBonus));

        const wrapper = new CommanderWrapper(commander);
        wrapper.regenerateCP(totalRegen);

        await commander.save();
      }

      console.log(`[GameLoop] CP regenerated for ${commanders.length} commanders`);
    } catch (error) {
      console.error('[GameLoop] CP regeneration error:', error);
    }
  }

  /**
   * 함대가 전투 중인지 체크
   */
  private async isFleetInCombat(fleetId: string): Promise<boolean> {
    const tacticalMap = await TacticalMap.findOne({
      session_id: this.sessionId,
      status: 'active',
    });

    if (!tacticalMap) {
      return false;
    }

    // 해당 함대가 전술 맵에 있는지 확인
    const { Fleet } = await import('../../models/logh/Fleet.model');
    const fleet = await Fleet.findOne({
      session_id: this.sessionId,
      fleetId,
      tacticalMapId: tacticalMap.tacticalMapId,
    });

    return !!fleet;
  }

  /**
   * 완료된 커맨드 처리
   */
  private async processCompletedCommands(): Promise<void> {
    try {
      const commanders = await LoghCommander.find({
        session_id: this.sessionId,
        isActive: true,
        activeCommands: { $exists: true, $ne: [] },
      });

      for (const commander of commanders) {
        const wrapper = new CommanderWrapper(commander);
        const completedCommands = wrapper.getCompletedCommands();

        if (completedCommands.length > 0) {
          console.log(`[GameLoop] Completed commands for commander ${commander.no}:`, 
            completedCommands.map(c => c.commandType)
          );

          
          // 예: 워프 항행 완료 → 함대 위치 업데이트
          // 예: 작전 페이즈 완료 → 다음 페이즈 진행

          await commander.save();
        }
      }
    } catch (error) {
      console.error('[GameLoop] Command completion error:', error);
    }
  }

  /**
   * 현재 FPS 가져오기
   */
  getFPS(): number {
    return this.targetFPS;
  }

  /**
   * FPS 설정
   */
  setFPS(fps: number): void {
    if (fps < 1 || fps > 60) {
      console.warn('[GameLoop] FPS must be between 1 and 60');
      return;
    }

    this.targetFPS = fps;

    // 실행 중이면 재시작
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * 게임 루프 상태
   */
  getStatus(): {
    isRunning: boolean;
    sessionId: string;
    fps: number;
  } {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      fps: this.targetFPS,
    };
  }
}

/**
 * 전역 게임 루프 매니저
 */
export class GameLoopManager {
  private static loops: Map<string, GameLoopService> = new Map();

  /**
   * 세션의 게임 루프 가져오기 (없으면 생성)
   */
  static getLoop(sessionId: string): GameLoopService {
    if (!this.loops.has(sessionId)) {
      const loop = new GameLoopService(sessionId);
      this.loops.set(sessionId, loop);
    }
    return this.loops.get(sessionId)!;
  }

  /**
   * 세션의 게임 루프 시작
   */
  static startLoop(sessionId: string): void {
    const loop = this.getLoop(sessionId);
    loop.start();
  }

  /**
   * 세션의 게임 루프 정지
   */
  static stopLoop(sessionId: string): void {
    const loop = this.loops.get(sessionId);
    if (loop) {
      loop.stop();
    }
  }

  /**
   * 모든 게임 루프 정지
   */
  static stopAllLoops(): void {
    for (const loop of this.loops.values()) {
      loop.stop();
    }
    this.loops.clear();
  }

  /**
   * 활성 루프 개수
   */
  static getActiveLoopCount(): number {
    let count = 0;
    for (const loop of this.loops.values()) {
      if (loop.getStatus().isRunning) {
        count++;
      }
    }
    return count;
  }
}
