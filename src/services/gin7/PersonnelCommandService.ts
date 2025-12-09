/**
 * PersonnelCommandService - 인사 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 인사 커맨드:
 * - PROMOTE (승진): 계급 1위 승진
 * - PROMOTE_SPECIAL (발탁): 임의 승진
 * - DEMOTE (강등): 강등
 * - GRANT_TITLE (서작): 작위 수여
 * - GRANT_MEDAL (서훈): 훈장 수여
 * - APPOINT (임명): 직위 임명
 * - DISMISS (파면): 직위 해임
 * - RESIGN (사임): 직위 사임
 * - GRANT_FIEF (봉토수여): 봉토 수여
 * - REVOKE_FIEF (봉토직할): 봉토 회수
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { AppointmentService } from './AppointmentService';
import { NobilityService, nobilityService } from './NobilityService';
import { MedalService, medalService } from './MedalService';
import { MedalCode } from '../../constants/gin7/nobility_definitions';
import { FiefService, fiefService } from './FiefService';
import { MeritService, meritService } from './MeritService';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface PersonnelRequest {
  sessionId: string;
  executorId: string;      // 실행자
  targetId: string;        // 대상
  commandId: string;       // 커맨드 ID
  params?: Record<string, any>; // 추가 파라미터 (작위, 훈장 코드 등)
}

export interface PersonnelResult {
  success: boolean;
  commandId: string;
  targetId: string;
  targetName: string;
  details?: string;
  cpCost: number;
  error?: string;
}

// ============================================================
// PersonnelCommandService Class
// ============================================================

export class PersonnelCommandService extends EventEmitter {
  private static instance: PersonnelCommandService;

  private constructor() {
    super();
    logger.info('[PersonnelCommandService] Initialized');
  }

  public static getInstance(): PersonnelCommandService {
    if (!PersonnelCommandService.instance) {
      PersonnelCommandService.instance = new PersonnelCommandService();
    }
    return PersonnelCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 인사 커맨드 라우터
   */
  public async executePersonnelCommand(request: PersonnelRequest): Promise<PersonnelResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'PROMOTE':
        return this.executePromotion(request);
      case 'PROMOTE_SPECIAL':
        return this.executeSpecialPromotion(request);
      case 'DEMOTE':
        return this.executeDemotion(request);
      case 'GRANT_TITLE':
        return this.executeGrantTitle(request);
      case 'GRANT_MEDAL':
        return this.executeGrantMedal(request);
      case 'APPOINT':
        return this.executeAppointment(request);
      case 'DISMISS':
        return this.executeDismissal(request);
      case 'RESIGN':
        return this.executeResignation(request);
      case 'GRANT_FIEF':
        return this.executeGrantFief(request);
      case 'REVOKE_FIEF':
        return this.executeRevokeFief(request);
      default:
        return this.errorResult(commandId, request.targetId, '', 0, '알 수 없는 인사 커맨드입니다.');
    }
  }

  // ============================================================
  // 승진/강등
  // ============================================================

  /**
   * 승진 (계급 래더 1위)
   */
  private async executePromotion(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'PROMOTE');
    const cpCost = commandDef?.cost || 160;

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('PROMOTE', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      // 래더 1위 확인
      const isTop = await meritService.isTopOfRankLadder(sessionId, targetId);
      if (!isTop) {
        return this.errorResult('PROMOTE', targetId, target.name, cpCost, '계급 래더 1위만 승진 가능합니다.');
      }

      // 승진 실행 (MeritService 사용)
      const result = await meritService.promoteCharacter(sessionId, targetId, executorId);
      if (!result.success) {
        return this.errorResult('PROMOTE', targetId, target.name, cpCost, result.error || '승진 실패');
      }

      this.emit('personnel:promoted', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        oldRank: result.oldRank,
        newRank: result.newRank,
      });

      return {
        success: true,
        commandId: 'PROMOTE',
        targetId,
        targetName: target.name,
        details: `${result.oldRank} → ${result.newRank}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Promotion error:', error);
      return this.errorResult('PROMOTE', targetId, '', cpCost, '승진 처리 중 오류 발생');
    }
  }

  /**
   * 발탁 (임의 승진)
   */
  private async executeSpecialPromotion(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'PROMOTE_SPECIAL');
    const cpCost = commandDef?.cost || 640;

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('PROMOTE_SPECIAL', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      // 발탁 승진 (래더 확인 없이)
      const result = await meritService.promoteCharacter(sessionId, targetId, executorId);
      if (!result.success) {
        return this.errorResult('PROMOTE_SPECIAL', targetId, target.name, cpCost, result.error || '발탁 실패');
      }

      this.emit('personnel:specialPromoted', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        oldRank: result.oldRank,
        newRank: result.newRank,
      });

      return {
        success: true,
        commandId: 'PROMOTE_SPECIAL',
        targetId,
        targetName: target.name,
        details: `발탁: ${result.oldRank} → ${result.newRank}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Special promotion error:', error);
      return this.errorResult('PROMOTE_SPECIAL', targetId, '', cpCost, '발탁 처리 중 오류 발생');
    }
  }

  /**
   * 강등
   */
  private async executeDemotion(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'DEMOTE');
    const cpCost = commandDef?.cost || 320;

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('DEMOTE', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      const result = await meritService.demoteCharacter(sessionId, targetId, executorId);
      if (!result.success) {
        return this.errorResult('DEMOTE', targetId, target.name, cpCost, result.error || '강등 실패');
      }

      this.emit('personnel:demoted', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        oldRank: result.oldRank,
        newRank: result.newRank,
      });

      return {
        success: true,
        commandId: 'DEMOTE',
        targetId,
        targetName: target.name,
        details: `${result.oldRank} → ${result.newRank}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Demotion error:', error);
      return this.errorResult('DEMOTE', targetId, '', cpCost, '강등 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 작위/훈장
  // ============================================================

  /**
   * 서작 (작위 수여)
   */
  private async executeGrantTitle(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId, params } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'GRANT_TITLE');
    const cpCost = commandDef?.cost || 160;

    const titleCode = params?.titleCode;
    if (!titleCode) {
      return this.errorResult('GRANT_TITLE', targetId, '', cpCost, '작위 코드가 필요합니다.');
    }

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('GRANT_TITLE', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      const result = await nobilityService.grantTitle(sessionId, targetId, titleCode, executorId);
      if (!result.success) {
        return this.errorResult('GRANT_TITLE', targetId, target.name, cpCost, result.error || '작위 수여 실패');
      }

      this.emit('personnel:titleGranted', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        titleCode,
      });

      return {
        success: true,
        commandId: 'GRANT_TITLE',
        targetId,
        targetName: target.name,
        details: `작위 수여: ${titleCode}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Grant title error:', error);
      return this.errorResult('GRANT_TITLE', targetId, '', cpCost, '작위 수여 중 오류 발생');
    }
  }

  /**
   * 서훈 (훈장 수여)
   */
  private async executeGrantMedal(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId, params } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'GRANT_MEDAL');
    const cpCost = commandDef?.cost || 160;

    const medalCode = params?.medalCode;
    if (!medalCode) {
      return this.errorResult('GRANT_MEDAL', targetId, '', cpCost, '훈장 코드가 필요합니다.');
    }

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('GRANT_MEDAL', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      const result = await medalService.awardMedal(sessionId, executorId, targetId, medalCode as MedalCode, '인사 명령');
      if (!result.success) {
        return this.errorResult('GRANT_MEDAL', targetId, target.name, cpCost, result.error || '훈장 수여 실패');
      }

      this.emit('personnel:medalGranted', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        medalCode,
      });

      return {
        success: true,
        commandId: 'GRANT_MEDAL',
        targetId,
        targetName: target.name,
        details: `훈장 수여: ${medalCode}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Grant medal error:', error);
      return this.errorResult('GRANT_MEDAL', targetId, '', cpCost, '훈장 수여 중 오류 발생');
    }
  }

  // ============================================================
  // 임명/해임/사임
  // ============================================================

  /**
   * 임명
   */
  private async executeAppointment(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId, params } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'APPOINT');
    const cpCost = commandDef?.cost || 160;

    const positionId = params?.positionId;
    if (!positionId) {
      return this.errorResult('APPOINT', targetId, '', cpCost, '직위 ID가 필요합니다.');
    }

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('APPOINT', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      // AppointmentService 사용
      const appointmentService = AppointmentService.getInstance();
      const result = await appointmentService.appoint(
        sessionId,
        executorId,
        targetId,
        positionId,
      );

      if (!result.success) {
        return this.errorResult('APPOINT', targetId, target.name, cpCost, result.error || '임명 실패');
      }

      this.emit('personnel:appointed', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        positionId,
      });

      return {
        success: true,
        commandId: 'APPOINT',
        targetId,
        targetName: target.name,
        details: `임명: ${positionId}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Appointment error:', error);
      return this.errorResult('APPOINT', targetId, '', cpCost, '임명 처리 중 오류 발생');
    }
  }

  /**
   * 파면
   */
  private async executeDismissal(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId, params } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'DISMISS');
    const cpCost = commandDef?.cost || 160;

    const positionId = params?.positionId;

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('DISMISS', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      const appointmentService = AppointmentService.getInstance();
      const result = await appointmentService.dismiss(
        sessionId,
        executorId,
        targetId,
        '인사 명령으로 파면',
      );

      if (!result.success) {
        return this.errorResult('DISMISS', targetId, target.name, cpCost, result.error || '파면 실패');
      }

      this.emit('personnel:dismissed', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        positionId,
      });

      return {
        success: true,
        commandId: 'DISMISS',
        targetId,
        targetName: target.name,
        details: `파면: ${positionId || '전체 직위'}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Dismissal error:', error);
      return this.errorResult('DISMISS', targetId, '', cpCost, '파면 처리 중 오류 발생');
    }
  }

  /**
   * 사임
   */
  private async executeResignation(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, targetId, params } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'RESIGN');
    const cpCost = commandDef?.cost || 80;

    const positionId = params?.positionId;

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('RESIGN', targetId, '', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      const appointmentService = AppointmentService.getInstance();
      const result = await appointmentService.resign(
        sessionId,
        targetId,
        '자발적 사임',
      );

      if (!result.success) {
        return this.errorResult('RESIGN', targetId, target.name, cpCost, result.error || '사임 실패');
      }

      this.emit('personnel:resigned', {
        sessionId,
        targetId,
        targetName: target.name,
        positionId,
      });

      return {
        success: true,
        commandId: 'RESIGN',
        targetId,
        targetName: target.name,
        details: `사임: ${positionId || '전체 직위'}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Resignation error:', error);
      return this.errorResult('RESIGN', targetId, '', cpCost, '사임 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 봉토
  // ============================================================

  /**
   * 봉토 수여
   */
  private async executeGrantFief(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId, params } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'GRANT_FIEF');
    const cpCost = commandDef?.cost || 640;

    const planetId = params?.planetId;
    if (!planetId) {
      return this.errorResult('GRANT_FIEF', targetId, '', cpCost, '행성 ID가 필요합니다.');
    }

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('GRANT_FIEF', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      const result = await fiefService.grantFief(sessionId, targetId, planetId, executorId);
      if (!result.success) {
        return this.errorResult('GRANT_FIEF', targetId, target.name, cpCost, result.error || '봉토 수여 실패');
      }

      this.emit('personnel:fiefGranted', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        planetId,
      });

      return {
        success: true,
        commandId: 'GRANT_FIEF',
        targetId,
        targetName: target.name,
        details: `봉토 수여: ${planetId}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Grant fief error:', error);
      return this.errorResult('GRANT_FIEF', targetId, '', cpCost, '봉토 수여 중 오류 발생');
    }
  }

  /**
   * 봉토 회수
   */
  private async executeRevokeFief(request: PersonnelRequest): Promise<PersonnelResult> {
    const { sessionId, executorId, targetId, params } = request;
    const commandDef = COMMAND_DEFINITIONS.find(c => c.id === 'REVOKE_FIEF');
    const cpCost = commandDef?.cost || 640;

    const planetId = params?.planetId;

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('REVOKE_FIEF', targetId, '', cpCost, '대상을 찾을 수 없습니다.');
      }

      const result = await fiefService.revokeFief(sessionId, executorId, planetId);
      if (!result.success) {
        return this.errorResult('REVOKE_FIEF', targetId, target.name, cpCost, result.error || '봉토 회수 실패');
      }

      this.emit('personnel:fiefRevoked', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
        planetId,
      });

      return {
        success: true,
        commandId: 'REVOKE_FIEF',
        targetId,
        targetName: target.name,
        details: `봉토 회수: ${planetId || '전체'}`,
        cpCost,
      };
    } catch (error) {
      logger.error('[PersonnelCommandService] Revoke fief error:', error);
      return this.errorResult('REVOKE_FIEF', targetId, '', cpCost, '봉토 회수 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private errorResult(
    commandId: string,
    targetId: string,
    targetName: string,
    cpCost: number,
    error: string,
  ): PersonnelResult {
    return {
      success: false,
      commandId,
      targetId,
      targetName,
      cpCost,
      error,
    };
  }
}

export const personnelCommandService = PersonnelCommandService.getInstance();
export default PersonnelCommandService;





