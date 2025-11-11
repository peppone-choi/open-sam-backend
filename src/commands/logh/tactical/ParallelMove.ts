/**
 * [전술] 병렬 이동 (並列移動, Parallel Move)
 * 여러 함대를 포메이션 유지하며 동시 이동
 * 
 * 기능:
 * - 여러 함대를 하나의 그룹으로 묶어 이동
 * - 상대 위치 유지 (포메이션 유지)
 * - 리더 함대를 중심으로 나머지 함대가 따라감
 * - 함대 간 간격 자동 조정
 */

import { Fleet } from '../../../models/logh/Fleet.model';

interface FleetPosition {
  fleetId: string;
  offset: { x: number; y: number }; // 리더 기준 상대 위치
}

export class ParallelMoveTacticalCommand {
  getName(): string {
    return 'parallel_move';
  }

  getDisplayName(): string {
    return '병렬 이동';
  }

  getDescription(): string {
    return '여러 함대를 포메이션 유지하며 동시 이동합니다. 리더 함대를 중심으로 상대 위치를 유지합니다.';
  }

  getShortcut(): string {
    return 'p';
  }

  getExecutionDelay(): number {
    return 5; // 5 게임시간 (12.5초)
  }

  getExecutionDuration(): number {
    return 0;
  }

  /**
   * 함대 간 상대 위치 계산
   */
  private calculateRelativePositions(
    leaderPos: { x: number; y: number },
    followerFleets: Array<{ fleetId: string; position: { x: number; y: number } }>
  ): FleetPosition[] {
    return followerFleets.map(fleet => ({
      fleetId: fleet.fleetId,
      offset: {
        x: fleet.position.x - leaderPos.x,
        y: fleet.position.y - leaderPos.y,
      },
    }));
  }

  /**
   * 새 위치 계산 (리더 기준 + 오프셋)
   */
  private calculateNewPosition(
    leaderNewPos: { x: number; y: number },
    offset: { x: number; y: number }
  ): { x: number; y: number } {
    return {
      x: leaderNewPos.x + offset.x,
      y: leaderNewPos.y + offset.y,
    };
  }

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    const { sessionId, targetX, targetY, followerFleetIds } = params;

    // 리더 함대 조회 (명령을 내린 함대)
    const leaderFleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!leaderFleet) {
      return {
        success: false,
        message: '리더 함대를 찾을 수 없습니다.',
      };
    }

    if (!leaderFleet.tacticalPosition) {
      return {
        success: false,
        message: '리더 함대가 전술 맵에 배치되지 않았습니다.',
      };
    }

    // 목표 좌표 확인
    if (targetX === undefined || targetY === undefined) {
      return {
        success: false,
        message: '목표 좌표를 지정해야 합니다.',
      };
    }

    // 추종 함대 ID 목록 확인
    if (!followerFleetIds || !Array.isArray(followerFleetIds) || followerFleetIds.length === 0) {
      return {
        success: false,
        message: '병렬 이동할 추종 함대를 지정해야 합니다.',
      };
    }

    // 추종 함대들 조회
    const followerFleets = await Fleet.find({
      session_id: sessionId,
      fleetId: { $in: followerFleetIds },
    });

    if (followerFleets.length === 0) {
      return {
        success: false,
        message: '추종 함대를 찾을 수 없습니다.',
      };
    }

    // 전술 맵에 없는 함대 필터링
    const validFollowers = followerFleets.filter(f => f.tacticalPosition);
    
    if (validFollowers.length === 0) {
      return {
        success: false,
        message: '전술 맵에 배치된 추종 함대가 없습니다.',
      };
    }

    // 현재 상대 위치 계산
    const leaderCurrentPos = {
      x: leaderFleet.tacticalPosition.x,
      y: leaderFleet.tacticalPosition.y,
    };

    const relativePositions = this.calculateRelativePositions(
      leaderCurrentPos,
      validFollowers.map(f => ({
        fleetId: f.fleetId,
        position: { x: f.tacticalPosition!.x, y: f.tacticalPosition!.y },
      }))
    );

    // 리더 함대 이동
    leaderFleet.destination = { x: targetX, y: targetY };
    leaderFleet.isMoving = true;

    if (!leaderFleet.customData) leaderFleet.customData = {};
    leaderFleet.customData.isLeaderOfParallelMove = true;
    leaderFleet.customData.parallelMoveFollowers = followerFleetIds;

    await leaderFleet.save();

    // 추종 함대들 이동
    const updatedFollowers: string[] = [];
    
    for (const fleet of validFollowers) {
      const relPos = relativePositions.find(rp => rp.fleetId === fleet.fleetId);
      if (!relPos) continue;

      // 새 목표 위치 계산
      const newDestination = this.calculateNewPosition({ x: targetX, y: targetY }, relPos.offset);

      fleet.destination = newDestination;
      fleet.isMoving = true;

      if (!fleet.customData) fleet.customData = {};
      fleet.customData.isFollowerOfParallelMove = true;
      fleet.customData.parallelMoveLeader = fleetId;
      fleet.customData.parallelMoveOffset = relPos.offset;

      // 로그 기록
      if (!fleet.customData.combatLog) fleet.customData.combatLog = [];
      fleet.customData.combatLog.push({
        timestamp: new Date(),
        type: 'parallel_move',
        leaderFleetId: fleetId,
        destination: newDestination,
        offset: relPos.offset,
      });

      await fleet.save();
      updatedFollowers.push(fleet.name);
    }

    return {
      success: true,
      message: `병렬 이동 시작: 리더 "${leaderFleet.name}", 추종 함대 ${updatedFollowers.length}개 (${updatedFollowers.join(', ')})`,
    };
  }

  /**
   * 병렬 이동 취소
   */
  static async cancelParallelMove(fleetId: string, sessionId: string): Promise<any> {
    const fleet = await Fleet.findOne({
      session_id: sessionId,
      fleetId,
    });

    if (!fleet) {
      return { success: false, message: '함대를 찾을 수 없습니다.' };
    }

    // 리더인 경우
    if (fleet.customData?.isLeaderOfParallelMove) {
      const followerIds = fleet.customData.parallelMoveFollowers || [];
      
      // 추종 함대들 해제
      await Fleet.updateMany(
        {
          session_id: sessionId,
          fleetId: { $in: followerIds },
        },
        {
          $unset: {
            'customData.isFollowerOfParallelMove': '',
            'customData.parallelMoveLeader': '',
            'customData.parallelMoveOffset': '',
          },
        }
      );

      // 리더 해제
      fleet.customData.isLeaderOfParallelMove = false;
      fleet.customData.parallelMoveFollowers = [];
      await fleet.save();

      return { success: true, message: '병렬 이동이 취소되었습니다.' };
    }

    // 추종 함대인 경우
    if (fleet.customData?.isFollowerOfParallelMove) {
      fleet.customData.isFollowerOfParallelMove = false;
      fleet.customData.parallelMoveLeader = undefined;
      fleet.customData.parallelMoveOffset = undefined;
      await fleet.save();

      return { success: true, message: '병렬 이동에서 이탈했습니다.' };
    }

    return { success: false, message: '병렬 이동 중이 아닙니다.' };
  }
}
