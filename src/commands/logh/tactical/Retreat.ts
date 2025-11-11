/**
 * [전술] 철퇴 (撤退, Retreat)
 * 전술 맵에서 전투 이탈
 * 
 * 개념:
 * - 전략 맵 1칸 = 전술 맵 10000x10000 좌표계
 * - 철퇴는 전술 맵 경계까지 이동하여 전략 맵으로 빠져나가는 것
 * - 경계 도달 시 해당 전략 그리드의 인접 칸으로 이동
 * 
 * 철퇴 조건:
 * - 사기 30 이상 필요
 * - 철퇴 진형으로 자동 변경 (기동력 +30%, 공격력 -50%)
 * - 전술 맵 경계(0 or 10000)까지 이동하면 이탈 성공
 * - 철퇴 중 공격받으면 추가 사상자 발생 가능
 */

import { Fleet } from '../../../models/logh/Fleet.model';
import { TacticalMap } from '../../../models/logh/TacticalMap.model';

export class RetreatTacticalCommand {
  getName(): string {
    return 'retreat';
  }

  getDisplayName(): string {
    return '철퇴';
  }

  getDescription(): string {
    return '전술 맵에서 이탈합니다. 사기 30 이상 필요, 후퇴 진형으로 자동 변경됩니다.';
  }

  getShortcut(): string {
    return 'e';
  }

  getExecutionDelay(): number {
    return 10; // 10 게임시간 (25초)
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 철퇴 가능 여부 체크
   */
  private canRetreat(fleet: any): string | null {
    // 전투 중이 아니면 철퇴 불가
    if (!fleet.isInCombat) {
      return '전투 중이 아닙니다.';
    }

    // 사기 체크
    if (fleet.morale < 30) {
      return '사기가 너무 낮아 철퇴할 수 없습니다. (최소 30 필요)';
    }

    // 이미 후퇴 중이면
    if (fleet.status === 'retreating') {
      return '이미 철퇴 중입니다.';
    }

    return null;
  }

  /**
   * 철퇴 방향 계산 (가장 가까운 전술 맵 경계)
   * 전술 맵: 10000x10000 좌표계
   */
  private calculateRetreatDirection(
    position: { x: number; y: number }, 
    tacticalSize: { width: number; height: number }
  ): { x: number; y: number; direction: string } {
    const { x, y } = position;
    const { width, height } = tacticalSize;

    // 4개 경계까지의 거리 계산
    const distances = {
      north: y,                    // 상단(y=0)까지
      south: height - y,           // 하단(y=10000)까지
      west: x,                     // 좌측(x=0)까지
      east: width - x,             // 우측(x=10000)까지
    };

    // 가장 가까운 경계 찾기
    const nearest = Object.entries(distances).reduce((min, [dir, dist]) => 
      dist < min.dist ? { dir, dist } : min,
      { dir: 'north', dist: Infinity }
    );

    // 경계 방향으로 이동 목표 설정
    let targetX = x;
    let targetY = y;

    switch (nearest.dir) {
      case 'north':
        targetY = 0;
        break;
      case 'south':
        targetY = height;
        break;
      case 'west':
        targetX = 0;
        break;
      case 'east':
        targetX = width;
        break;
    }

    return { 
      x: targetX, 
      y: targetY,
      direction: nearest.dir 
    };
  }

  /**
   * 철퇴 성공 시 전략 맵에서의 목적지 계산
   * 전술 맵 경계를 넘어 인접 전략 그리드로 이동
   */
  private calculateStrategicDestination(
    currentStrategicPos: { x: number; y: number },
    retreatDirection: string
  ): { x: number; y: number } {
    let newX = currentStrategicPos.x;
    let newY = currentStrategicPos.y;

    // 철퇴 방향에 따라 인접 그리드로 이동
    switch (retreatDirection) {
      case 'north':
        newY = Math.max(0, newY - 1);
        break;
      case 'south':
        newY = Math.min(49, newY + 1);
        break;
      case 'west':
        newX = Math.max(0, newX - 1);
        break;
      case 'east':
        newX = Math.min(99, newX + 1);
        break;
    }

    return { x: newX, y: newY };
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId } = params;

    // 함대 조회
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 철퇴 가능 여부 체크
    const canRetreat = this.canRetreat(fleet);
    if (canRetreat) {
      return {
        success: false,
        message: canRetreat,
      };
    }

    // 전술 맵 조회
    const tacticalMap = await TacticalMap.findOne({
      session_id: sessionId,
      tacticalMapId: fleet.tacticalMapId,
    });

    if (!tacticalMap) {
      return {
        success: false,
        message: '전술 맵을 찾을 수 없습니다.',
      };
    }

    // 후퇴 진형으로 자동 변경
    const oldFormation = fleet.formation;
    fleet.formation = 'retreat';
    fleet.status = 'retreating';

    // 현재 전술 맵 위치
    const currentTacticalPos = fleet.tacticalPosition || { 
      x: tacticalMap.tacticalSize.width / 2, 
      y: tacticalMap.tacticalSize.height / 2 
    };

    // 후퇴 방향 및 목표 계산 (가장 가까운 전술 맵 경계)
    const retreatInfo = this.calculateRetreatDirection(
      currentTacticalPos,
      tacticalMap.tacticalSize
    );

    // 후퇴 목표 설정 (전술 맵 경계)
    fleet.destination = { x: retreatInfo.x, y: retreatInfo.y };
    fleet.isMoving = true;

    // 사기 하락 (철퇴는 사기에 악영향)
    fleet.morale = Math.max(0, fleet.morale - 10);

    // 로그 기록
    if (!fleet.customData) fleet.customData = {};
    if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
    fleet.customData.combatLog.push({
      timestamp: new Date(),
      type: 'retreat_start',
      fromFormation: oldFormation,
      retreatDirection: retreatInfo.direction,
      retreatTarget: { x: retreatInfo.x, y: retreatInfo.y },
      moraleAfter: fleet.morale,
      strategicGridPosition: tacticalMap.strategicGridPosition,
    });

    await fleet.save();

    return {
      success: true,
      message: `철퇴를 시작했습니다. ${retreatInfo.direction} 방향 전술 맵 경계로 후퇴합니다. (사기 -10)`,
    };
  }

  /**
   * 철퇴 진행 상황 체크 (게임 루프에서 호출)
   * 전술 맵 경계에 도달하면 전략 맵의 인접 그리드로 이동
   */
  async checkRetreatProgress(fleetId: string, sessionId: string): Promise<boolean> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet || fleet.status !== 'retreating') {
      return false;
    }

    const tacticalMap = await TacticalMap.findOne({
      session_id: sessionId,
      tacticalMapId: fleet.tacticalMapId,
    });

    if (!tacticalMap) {
      return false;
    }

    const pos = fleet.tacticalPosition || { 
      x: tacticalMap.tacticalSize.width / 2, 
      y: tacticalMap.tacticalSize.height / 2 
    };
    const tacticalSize = tacticalMap.tacticalSize;

    // 전술 맵 경계에 도달했는지 체크 (경계값: 100 이내)
    const boundaryThreshold = 100;
    let reachedBoundary = false;
    let direction = '';

    if (pos.x <= boundaryThreshold) {
      reachedBoundary = true;
      direction = 'west';
    } else if (pos.x >= tacticalSize.width - boundaryThreshold) {
      reachedBoundary = true;
      direction = 'east';
    } else if (pos.y <= boundaryThreshold) {
      reachedBoundary = true;
      direction = 'north';
    } else if (pos.y >= tacticalSize.height - boundaryThreshold) {
      reachedBoundary = true;
      direction = 'south';
    }

    if (reachedBoundary) {
      // 철퇴 성공! 전략 맵의 인접 그리드로 이동
      const currentStrategicPos = tacticalMap.strategicGridPosition;
      const newStrategicPos = this.calculateStrategicDestination(currentStrategicPos, direction);

      // 함대를 전략 맵으로 복귀
      fleet.isInCombat = false;
      fleet.status = 'idle';
      fleet.combatTarget = undefined;
      fleet.tacticalMapId = undefined;
      fleet.tacticalPosition = undefined;
      fleet.isMoving = false;
      fleet.destination = undefined;
      fleet.formation = 'standard'; // 표준 진형으로 복귀

      // 전략 맵 위치 업데이트 (철퇴 방향의 인접 그리드)
      fleet.strategicPosition = newStrategicPos;
      if (fleet.gridPosition) {
        fleet.gridPosition = newStrategicPos;
      }

      // 로그 기록
      if (!fleet.customData) fleet.customData = {};
      if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
      fleet.customData.combatLog.push({
        timestamp: new Date(),
        type: 'retreat_success',
        fromStrategicGrid: currentStrategicPos,
        toStrategicGrid: newStrategicPos,
        direction,
      });

      await fleet.save();

      return true;
    }

    return false;
  }
}
