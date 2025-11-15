/**
 * IssueOperation - 작전 발령 커맨드
 *
 * gin7manual.txt: 작전 계획을 발령하여 복수의 함대를 조율합니다.
 * 작전은 여러 단계(phase)로 구성되며, 각 단계마다 특정 턴이 소요됩니다.
 */

import { BaseLoghCommand, ILoghCommandContext } from './BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../constraints/ConstraintHelper';

export type OperationType = 'attack' | 'defend' | 'occupy' | 'scout';

export interface IOperationPlan {
  id: string;
  name: string;
  type: OperationType;
  issuerId: number;
  targetId: string; // 목표 행성/성계 ID
  fleetIds: string[];
  phases: {
    phase: number;
    description: string;
    requiredTurns: number;
    completed: boolean;
  }[];
  status: 'planning' | 'issued' | 'executing' | 'completed' | 'failed';
}

export class IssueOperationCommand extends BaseLoghCommand {
  getName(): string {
    return 'issue_operation';
  }

  getDisplayName(): string {
    return '작전 발령';
  }

  getDescription(): string {
    return '복수의 함대를 조율하는 작전 계획을 발령합니다. 계급이 높을수록 큰 작전을 수행할 수 있습니다.';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'strategic';
  }

  getRequiredCommandPoints(): number {
    return 5; // 작전 발령은 고급 커맨드
  }

  getRequiredTurns(): number {
    return 2; // 작전 계획 수립에 2턴
  }

  getConstraints(): IConstraint[] {
    return [
      // 준장 이상만 작전 발령 가능 (gin7manual.txt: 職務権限カード)
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => {
          const rank = input.commander.getRank();
          const allowedRanks = ['准将', '少将', '中将', '大将', '上級大将', '元帥'];
          return allowedRanks.includes(rank);
        },
        '작전 발령 권한이 없습니다. (준장 이상 필요)'
      ),
    ];
  }

  /**
   * 계급별 작전 규모 제한
   */
  private getMaxFleetsByRank(rank: string): number {
    const rankLimits: Record<string, number> = {
      '准将': 2,
      '少将': 3,
      '中将': 5,
      '大将': 8,
      '上級大将': 12,
      '元帥': 20,
    };

    return rankLimits[rank] || 1;
  }

  /**
   * 작전 타입별 페이즈 생성
   */
  private createOperationPhases(type: OperationType): IOperationPlan['phases'] {
    switch (type) {
      case 'attack':
        return [
          {
            phase: 1,
            description: '함대 집결 및 정찰',
            requiredTurns: 2,
            completed: false,
          },
          {
            phase: 2,
            description: '공격 개시 및 전투',
            requiredTurns: 3,
            completed: false,
          },
          {
            phase: 3,
            description: '점령 및 안정화',
            requiredTurns: 2,
            completed: false,
          },
        ];

      case 'defend':
        return [
          {
            phase: 1,
            description: '방어 진지 구축',
            requiredTurns: 1,
            completed: false,
          },
          {
            phase: 2,
            description: '방어 전투',
            requiredTurns: 4,
            completed: false,
          },
        ];

      case 'occupy':
        return [
          {
            phase: 1,
            description: '무혈 점령 협상',
            requiredTurns: 2,
            completed: false,
          },
          {
            phase: 2,
            description: '행정 인수',
            requiredTurns: 3,
            completed: false,
          },
        ];

      case 'scout':
        return [
          {
            phase: 1,
            description: '정찰 실시',
            requiredTurns: 1,
            completed: false,
          },
        ];

      default:
        return [];
    }
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // 작전 파라미터
    const operationName = env.operationName || '무명 작전';
    const operationType: OperationType = env.operationType || 'attack';
    const targetId = env.targetId;
    const fleetIds: string[] = env.fleetIds || [];

    if (!targetId) {
      return {
        success: false,
        message: '작전 목표가 지정되지 않았습니다.',
      };
    }

    // 함대 수 제한 체크
    const maxFleets = this.getMaxFleetsByRank(commander.getRank());
    if (fleetIds.length > maxFleets) {
      return {
        success: false,
        message: `계급상 최대 ${maxFleets}개 함대까지만 지휘할 수 있습니다.`,
      };
    }

    // 작전 계획 생성
    const operationPlan: IOperationPlan = {
      id: `op_${Date.now()}_${commander.no}`,
      name: operationName,
      type: operationType,
      issuerId: commander.no,
      targetId,
      fleetIds,
      phases: this.createOperationPhases(operationType),
      status: 'issued',
    };

    // 작전 저장 (실제로는 MongoDB OperationPlan 컬렉션에 저장)
    commander.data.current_operation = operationPlan;
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    await commander.save();

    const totalTurns = operationPlan.phases.reduce(
      (sum, phase) => sum + phase.requiredTurns,
      0
    );

    return {
      success: true,
      message: `작전 "${operationName}"이 발령되었습니다. 총 ${totalTurns}턴 소요 예정입니다.`,
      effects: [
        {
          type: 'operation_issued',
          operation: operationPlan,
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    const { commander } = context;

    const operation: IOperationPlan | null = commander.data.current_operation;

    if (!operation || operation.status !== 'executing') {
      return;
    }

    // 현재 진행 중인 페이즈 찾기
    const currentPhase = operation.phases.find((p) => !p.completed);

    if (!currentPhase) {
      // 모든 페이즈 완료
      operation.status = 'completed';
      commander.data.current_operation = operation;
      await commander.save();
      return;
    }

    // 페이즈 턴 카운트 감소
    currentPhase.requiredTurns--;

    if (currentPhase.requiredTurns <= 0) {
      currentPhase.completed = true;
      console.log(
        `[LOGH] Operation "${operation.name}" phase ${currentPhase.phase} completed: ${currentPhase.description}`
      );
    }

    commander.data.current_operation = operation;
    await commander.save();
  }
}
