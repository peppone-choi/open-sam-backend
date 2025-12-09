/**
 * CommandCommandService - 지휘 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 지휘 커맨드:
 * - OPERATION_PLAN (작전계획): 작전 목표 설정
 * - OPERATION_CANCEL (작전철회): 작전 중지
 * - ISSUE_ORDER (발령): 작전에 부대 배정
 * - FORM_UNIT (부대결성): 유닛 편성
 * - DISBAND_UNIT (부대해산): 부대 해산
 * - LECTURE (강의): 사관학교 강의
 * - TRANSPORT_PLAN (수송계획): 수송 패키지 작성
 * - TRANSPORT_CANCEL (수송중지): 수송 계획 취소
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Gin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet, IShipUnit } from '../../models/gin7/Fleet';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { OperationService, operationService } from './OperationService';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface CommandRequest {
  sessionId: string;
  characterId: string;     // 실행자
  commandId: string;
  params?: Record<string, any>;
}

export interface CommandResult {
  success: boolean;
  commandId: string;
  details?: string;
  createdId?: string;      // 생성된 작전/부대 ID
  cpCost: number;
  error?: string;
}

// 작전 계획 타입
export enum OperationObjective {
  OCCUPATION = 'OCCUPATION',         // 점령
  DEFENSE = 'DEFENSE',               // 방어
  SWEEP = 'SWEEP',                   // 소탕
  RECONNAISSANCE = 'RECONNAISSANCE', // 정찰
  ESCORT = 'ESCORT',                 // 호위
  BLOCKADE = 'BLOCKADE',             // 봉쇄
  RAID = 'RAID',                     // 급습
}

// 부대 편성 요청
export interface UnitFormationRequest {
  sessionId: string;
  fleetId: string;
  unitConfig: {
    name: string;
    shipClass: string;
    shipCount: number;
    commanderId?: string;
  };
}

// ============================================================
// CommandCommandService Class
// ============================================================

export class CommandCommandService extends EventEmitter {
  private static instance: CommandCommandService;

  private constructor() {
    super();
    logger.info('[CommandCommandService] Initialized');
  }

  public static getInstance(): CommandCommandService {
    if (!CommandCommandService.instance) {
      CommandCommandService.instance = new CommandCommandService();
    }
    return CommandCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 지휘 커맨드 라우터
   */
  public async executeCommandCommand(request: CommandRequest): Promise<CommandResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'OPERATION_PLAN':
        return this.executeOperationPlan(request);
      case 'OPERATION_CANCEL':
        return this.executeOperationCancel(request);
      case 'ISSUE_ORDER':
        return this.executeIssueOrder(request);
      case 'FORM_UNIT':
        return this.executeFormUnit(request);
      case 'DISBAND_UNIT':
        return this.executeDisbandUnit(request);
      case 'LECTURE':
        return this.executeLecture(request);
      case 'TRANSPORT_PLAN':
        return this.executeTransportPlan(request);
      case 'TRANSPORT_CANCEL':
        return this.executeTransportCancel(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 지휘 커맨드입니다.');
    }
  }

  // ============================================================
  // 작전 커맨드
  // ============================================================

  /**
   * 작전계획 - 작전 목표 설정
   */
  private async executeOperationPlan(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.calculateOperationPlanCost(params?.scale || 'small');

    const { objective, targetId, scale, duration, notes } = params || {};

    if (!objective || !targetId) {
      return this.errorResult('OPERATION_PLAN', cpCost, '작전 목표와 대상이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('OPERATION_PLAN', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 작전 생성 (OperationService 사용)
      const result = await operationService.createOperation({
        sessionId,
        creatorId: characterId,
        factionId: character.factionId,
        objective,
        targetId,
        scale,
        expectedDuration: duration || 24,
        notes,
      });

      if (!result.success) {
        return this.errorResult('OPERATION_PLAN', cpCost, result.error || '작전 생성 실패');
      }

      this.emit('command:operationPlanned', {
        sessionId,
        characterId,
        operationId: result.operationId,
        objective,
        targetId,
      });

      return {
        success: true,
        commandId: 'OPERATION_PLAN',
        details: `작전 계획 완료: ${objective}`,
        createdId: result.operationId,
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Operation plan error:', error);
      return this.errorResult('OPERATION_PLAN', cpCost, '작전 계획 중 오류 발생');
    }
  }

  /**
   * 작전철회 - 작전 중지
   */
  private async executeOperationCancel(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('OPERATION_CANCEL');

    const operationId = params?.operationId;
    if (!operationId) {
      return this.errorResult('OPERATION_CANCEL', cpCost, '작전 ID가 필요합니다.');
    }

    try {
      const success = await operationService.cancelOperation(sessionId, operationId, characterId);

      if (!success) {
        return this.errorResult('OPERATION_CANCEL', cpCost, '작전 철회 실패');
      }

      this.emit('command:operationCancelled', {
        sessionId,
        characterId,
        operationId,
      });

      return {
        success: true,
        commandId: 'OPERATION_CANCEL',
        details: '작전 철회 완료',
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Operation cancel error:', error);
      return this.errorResult('OPERATION_CANCEL', cpCost, '작전 철회 중 오류 발생');
    }
  }

  /**
   * 발령 - 작전에 부대 배정
   */
  private async executeIssueOrder(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('ISSUE_ORDER');

    const { operationId, fleetId, role } = params || {};
    if (!operationId || !fleetId) {
      return this.errorResult('ISSUE_ORDER', cpCost, '작전 ID와 함대 ID가 필요합니다.');
    }

    try {
      const result = await operationService.assignFleet(operationId, fleetId, role);

      if (!result.success) {
        return this.errorResult('ISSUE_ORDER', cpCost, result.error || '발령 실패');
      }

      this.emit('command:orderIssued', {
        sessionId,
        characterId,
        operationId,
        fleetId,
        role,
      });

      return {
        success: true,
        commandId: 'ISSUE_ORDER',
        details: '발령 완료',
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Issue order error:', error);
      return this.errorResult('ISSUE_ORDER', cpCost, '발령 중 오류 발생');
    }
  }

  // ============================================================
  // 부대 편성
  // ============================================================

  /**
   * 부대결성 - 유닛 편성
   */
  private async executeFormUnit(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('FORM_UNIT');

    const { fleetId, name, shipClass, shipCount, commanderId } = params || {};
    if (!fleetId || !name || !shipClass) {
      return this.errorResult('FORM_UNIT', cpCost, '함대 ID, 유닛명, 함급이 필요합니다.');
    }

    try {
      const fleet = await Fleet.findOne({ sessionId, fleetId });
      if (!fleet) {
        return this.errorResult('FORM_UNIT', cpCost, '함대를 찾을 수 없습니다.');
      }

      // 유닛 생성
      const unitId = `UNIT-${uuidv4().slice(0, 8)}`;
      const newUnit: IShipUnit = {
        unitId,
        name,
        shipClass,
        count: shipCount || 0,
        currentShipCount: shipCount || 0,
        maxShipCount: shipCount || 100,
        hp: 100,
        currentHp: 100,
        maxHp: 100,
        morale: 80,
        fuel: 100,
        maxFuel: 100,
        ammo: 100,
        maxAmmo: 100,
        crewCount: shipCount ? shipCount * 10 : 100,
        maxCrew: shipCount ? shipCount * 10 : 100,
        veterancy: 0,
        destroyed: 0,
        damaged: 0,
        commanderId,
        training: {
          navigation: 50,
          ground: 50,
          air: 50,
          discipline: 50,
        },
        position: { x: 0, y: 0, z: 0 },
      };

      if (!fleet.units) fleet.units = [];
      fleet.units.push(newUnit);
      await fleet.save();

      this.emit('command:unitFormed', {
        sessionId,
        characterId,
        fleetId,
        unitId,
        name,
        shipClass,
      });

      return {
        success: true,
        commandId: 'FORM_UNIT',
        details: `유닛 "${name}" 편성 완료`,
        createdId: unitId,
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Form unit error:', error);
      return this.errorResult('FORM_UNIT', cpCost, '부대 결성 중 오류 발생');
    }
  }

  /**
   * 부대해산 - 유닛 해산
   */
  private async executeDisbandUnit(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('DISBAND_UNIT');

    const { fleetId, unitId } = params || {};
    if (!fleetId || !unitId) {
      return this.errorResult('DISBAND_UNIT', cpCost, '함대 ID와 유닛 ID가 필요합니다.');
    }

    try {
      const fleet = await Fleet.findOne({ sessionId, fleetId });
      if (!fleet) {
        return this.errorResult('DISBAND_UNIT', cpCost, '함대를 찾을 수 없습니다.');
      }

      const unitIndex = fleet.units?.findIndex(u => u.unitId === unitId);
      if (unitIndex === undefined || unitIndex < 0) {
        return this.errorResult('DISBAND_UNIT', cpCost, '유닛을 찾을 수 없습니다.');
      }

      const disbandedUnit = fleet.units![unitIndex];
      fleet.units!.splice(unitIndex, 1);
      await fleet.save();

      this.emit('command:unitDisbanded', {
        sessionId,
        characterId,
        fleetId,
        unitId,
        unitName: disbandedUnit.name,
      });

      return {
        success: true,
        commandId: 'DISBAND_UNIT',
        details: `유닛 "${disbandedUnit.name}" 해산 완료`,
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Disband unit error:', error);
      return this.errorResult('DISBAND_UNIT', cpCost, '부대 해산 중 오류 발생');
    }
  }

  // ============================================================
  // 교육/수송
  // ============================================================

  /**
   * 강의 - 사관학교 강의
   */
  private async executeLecture(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('LECTURE');

    const { subject, studentIds } = params || {};
    if (!subject || !studentIds?.length) {
      return this.errorResult('LECTURE', cpCost, '과목과 수강생이 필요합니다.');
    }

    try {
      const instructor = await Gin7Character.findOne({ sessionId, characterId });
      if (!instructor) {
        return this.errorResult('LECTURE', cpCost, '강사를 찾을 수 없습니다.');
      }

      // 강사 능력치 기반 교육 효과
      const instructorStat = (instructor.stats as any)?.[subject] || 50;
      const bonusRate = instructorStat / 100;
      const baseGain = 2;

      let studentsUpdated = 0;

      for (const studentId of studentIds) {
        const student = await Gin7Character.findOne({ sessionId, characterId: studentId });
        if (student) {
          const currentValue = (student.stats as any)?.[subject] || 50;
          const gain = Math.floor(baseGain * (1 + bonusRate));
          const newValue = Math.min(100, currentValue + gain);
          
          if (!student.stats) student.stats = { command: 50, might: 50, intellect: 50, politics: 50, charm: 50 };
          (student.stats as any)[subject] = newValue;
          await student.save();
          studentsUpdated++;
        }
      }

      this.emit('command:lectureGiven', {
        sessionId,
        characterId,
        instructorName: instructor.name,
        subject,
        studentCount: studentsUpdated,
      });

      return {
        success: true,
        commandId: 'LECTURE',
        details: `${studentsUpdated}명의 학생에게 ${subject} 강의 완료`,
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Lecture error:', error);
      return this.errorResult('LECTURE', cpCost, '강의 중 오류 발생');
    }
  }

  /**
   * 수송계획 - 수송 패키지 작성
   */
  private async executeTransportPlan(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('TRANSPORT_PLAN');

    const { sourcePlanetId, targetPlanetId, resources, priority } = params || {};
    if (!sourcePlanetId || !targetPlanetId) {
      return this.errorResult('TRANSPORT_PLAN', cpCost, '출발지와 도착지가 필요합니다.');
    }

    try {
      // 수송 계획 생성
      const planId = `TRANSPORT-${uuidv4().slice(0, 8)}`;
      
      // TODO: TransportPlan 모델에 저장
      
      this.emit('command:transportPlanned', {
        sessionId,
        characterId,
        planId,
        sourcePlanetId,
        targetPlanetId,
        resources,
      });

      return {
        success: true,
        commandId: 'TRANSPORT_PLAN',
        details: '수송 계획 작성 완료',
        createdId: planId,
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Transport plan error:', error);
      return this.errorResult('TRANSPORT_PLAN', cpCost, '수송 계획 중 오류 발생');
    }
  }

  /**
   * 수송중지 - 수송 계획 취소
   */
  private async executeTransportCancel(request: CommandRequest): Promise<CommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('TRANSPORT_CANCEL');

    const planId = params?.planId;
    if (!planId) {
      return this.errorResult('TRANSPORT_CANCEL', cpCost, '계획 ID가 필요합니다.');
    }

    try {
      // TODO: TransportPlan 취소
      
      this.emit('command:transportCancelled', {
        sessionId,
        characterId,
        planId,
      });

      return {
        success: true,
        commandId: 'TRANSPORT_CANCEL',
        details: '수송 계획 취소 완료',
        cpCost,
      };
    } catch (error) {
      logger.error('[CommandCommandService] Transport cancel error:', error);
      return this.errorResult('TRANSPORT_CANCEL', cpCost, '수송 계획 취소 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 160;
  }

  private calculateOperationPlanCost(scale: string): number {
    const scaleCosts: Record<string, number> = {
      small: 160,
      medium: 320,
      large: 640,
      massive: 1280,
    };
    return scaleCosts[scale] || 160;
  }

  private errorResult(commandId: string, cpCost: number, error: string): CommandResult {
    return {
      success: false,
      commandId,
      cpCost,
      error,
    };
  }
}

export const commandCommandService = CommandCommandService.getInstance();
export default CommandCommandService;





