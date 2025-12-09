/**
 * IntelligenceCommandService - 첩보 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 첩보 커맨드:
 * - SEARCH_ALL (일제수색): 특정 인물 수색
 * - ARREST_PERMIT (체포허가): 체포 대상 등록
 * - ARREST_ORDER (체포명령): 체포 시도
 * - EXECUTE_ORDER (집행명령): 체포 권한 부여
 * - INSPECTION (사열): 쿠데타 징후 탐지
 * - RAID (습격): 적 인물 습격
 * - SURVEILLANCE (감시): 인물 감시
 * - INFILTRATE (잠입공작): 시설 잠입
 * - ESCAPE (탈출공작): 잠입 탈출
 * - INFO_OP (정보공작): 선전/역정보
 * - SABOTAGE (파괴공작): 시설 파괴
 * - AGITATION (선동): 민심 선동
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { SpyService, spyService } from './SpyService';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface IntelRequest {
  sessionId: string;
  executorId: string;      // 실행자 (첩보관 등)
  agentId?: string;        // 공작원
  targetId?: string;       // 대상 캐릭터
  planetId?: string;       // 대상 행성
  commandId: string;
  params?: Record<string, any>;
}

export interface IntelResult {
  success: boolean;
  commandId: string;
  detected: boolean;       // 발각 여부
  outcome?: string;        // 결과 상세
  cpCost: number;
  error?: string;
}

// 성공 확률 기본값
const BASE_SUCCESS_RATES: Record<string, number> = {
  SEARCH_ALL: 0.7,
  ARREST_PERMIT: 1.0,     // 허가는 항상 성공
  ARREST_ORDER: 0.6,
  EXECUTE_ORDER: 1.0,
  INSPECTION: 0.5,
  RAID: 0.4,
  SURVEILLANCE: 0.8,
  INFILTRATE: 0.5,
  ESCAPE: 0.6,
  INFO_OP: 0.6,
  SABOTAGE: 0.4,
  AGITATION: 0.5,
};

// ============================================================
// IntelligenceCommandService Class
// ============================================================

export class IntelligenceCommandService extends EventEmitter {
  private static instance: IntelligenceCommandService;

  private constructor() {
    super();
    logger.info('[IntelligenceCommandService] Initialized');
  }

  public static getInstance(): IntelligenceCommandService {
    if (!IntelligenceCommandService.instance) {
      IntelligenceCommandService.instance = new IntelligenceCommandService();
    }
    return IntelligenceCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 첩보 커맨드 라우터
   */
  public async executeIntelCommand(request: IntelRequest): Promise<IntelResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'SEARCH_ALL':
        return this.executeSearchAll(request);
      case 'ARREST_PERMIT':
        return this.executeArrestPermit(request);
      case 'ARREST_ORDER':
        return this.executeArrestOrder(request);
      case 'EXECUTE_ORDER':
        return this.executeExecuteOrder(request);
      case 'INSPECTION':
        return this.executeInspection(request);
      case 'RAID':
        return this.executeRaid(request);
      case 'SURVEILLANCE':
        return this.executeSurveillance(request);
      case 'INFILTRATE':
        return this.executeInfiltrate(request);
      case 'ESCAPE':
        return this.executeEscape(request);
      case 'INFO_OP':
        return this.executeInfoOp(request);
      case 'SABOTAGE':
        return this.executeSabotage(request);
      case 'AGITATION':
        return this.executeAgitation(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 첩보 커맨드입니다.');
    }
  }

  // ============================================================
  // 수색/체포 커맨드
  // ============================================================

  /**
   * 일제수색 - 특정 인물 위치 파악
   */
  private async executeSearchAll(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, targetId } = request;
    const cpCost = this.getCommandCost('SEARCH_ALL');

    if (!targetId) {
      return this.errorResult('SEARCH_ALL', cpCost, '수색 대상이 필요합니다.');
    }

    try {
      const executor = await Gin7Character.findOne({ sessionId, characterId: executorId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!executor || !target) {
        return this.errorResult('SEARCH_ALL', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 성공 확률 계산 (정보력 기반)
      const successRate = this.calculateSuccessRate('SEARCH_ALL', executor);
      const success = Math.random() < successRate;

      if (success) {
        // 대상 위치 정보 반환
        this.emit('intel:searchSuccess', {
          sessionId,
          executorId,
          targetId,
          targetName: target.name,
          location: target.location,
        });

        return {
          success: true,
          commandId: 'SEARCH_ALL',
          detected: false,
          outcome: `${target.name}의 위치를 파악했습니다.`,
          cpCost,
        };
      } else {
        return {
          success: false,
          commandId: 'SEARCH_ALL',
          detected: false,
          outcome: '수색에 실패했습니다.',
          cpCost,
        };
      }
    } catch (error) {
      logger.error('[IntelligenceCommandService] Search all error:', error);
      return this.errorResult('SEARCH_ALL', cpCost, '수색 처리 중 오류 발생');
    }
  }

  /**
   * 체포허가 - 체포 대상 등록
   */
  private async executeArrestPermit(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, targetId } = request;
    const cpCost = this.getCommandCost('ARREST_PERMIT');

    if (!targetId) {
      return this.errorResult('ARREST_PERMIT', cpCost, '체포 대상이 필요합니다.');
    }

    try {
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });
      if (!target) {
        return this.errorResult('ARREST_PERMIT', cpCost, '대상을 찾을 수 없습니다.');
      }

      // 체포 대상 등록
      if (!target.data) target.data = {};
      target.data.arrestPermit = {
        issuedBy: executorId,
        issuedAt: new Date(),
        active: true,
      };
      await target.save();

      this.emit('intel:arrestPermitIssued', {
        sessionId,
        executorId,
        targetId,
        targetName: target.name,
      });

      return {
        success: true,
        commandId: 'ARREST_PERMIT',
        detected: false,
        outcome: `${target.name}에 대한 체포허가가 발부되었습니다.`,
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Arrest permit error:', error);
      return this.errorResult('ARREST_PERMIT', cpCost, '체포허가 처리 중 오류 발생');
    }
  }

  /**
   * 체포명령 - 체포 시도
   */
  private async executeArrestOrder(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, agentId, targetId } = request;
    const cpCost = this.getCommandCost('ARREST_ORDER');

    if (!targetId) {
      return this.errorResult('ARREST_ORDER', cpCost, '체포 대상이 필요합니다.');
    }

    try {
      const agent = await Gin7Character.findOne({ 
        sessionId, 
        characterId: agentId || executorId 
      });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!agent || !target) {
        return this.errorResult('ARREST_ORDER', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 체포허가 확인
      if (!target.data?.arrestPermit?.active) {
        return this.errorResult('ARREST_ORDER', cpCost, '체포허가가 없습니다.');
      }

      // 성공 확률 계산
      const successRate = this.calculateSuccessRate('ARREST_ORDER', agent);
      const success = Math.random() < successRate;
      const detected = Math.random() < 0.3; // 30% 발각 확률

      if (success) {
        target.status = 'DETAINED';
        target.data.arrestPermit.active = false;
        target.data.detainedBy = executorId;
        target.data.detainedAt = new Date();
        await target.save();

        this.emit('intel:arrested', {
          sessionId,
          executorId,
          agentId,
          targetId,
          targetName: target.name,
        });

        return {
          success: true,
          commandId: 'ARREST_ORDER',
          detected,
          outcome: `${target.name}을(를) 체포했습니다.`,
          cpCost,
        };
      } else {
        return {
          success: false,
          commandId: 'ARREST_ORDER',
          detected,
          outcome: '체포에 실패했습니다.',
          cpCost,
        };
      }
    } catch (error) {
      logger.error('[IntelligenceCommandService] Arrest order error:', error);
      return this.errorResult('ARREST_ORDER', cpCost, '체포 처리 중 오류 발생');
    }
  }

  /**
   * 집행명령 - 체포 권한 부여 (다른 사람에게)
   */
  private async executeExecuteOrder(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, agentId, targetId } = request;
    const cpCost = this.getCommandCost('EXECUTE_ORDER');

    if (!agentId || !targetId) {
      return this.errorResult('EXECUTE_ORDER', cpCost, '집행자와 대상이 필요합니다.');
    }

    try {
      const agent = await Gin7Character.findOne({ sessionId, characterId: agentId });
      if (!agent) {
        return this.errorResult('EXECUTE_ORDER', cpCost, '집행자를 찾을 수 없습니다.');
      }

      // 집행 권한 부여
      if (!agent.data) agent.data = {};
      if (!agent.data.executePermits) agent.data.executePermits = [];
      agent.data.executePermits.push({
        targetId,
        issuedBy: executorId,
        issuedAt: new Date(),
      });
      await agent.save();

      this.emit('intel:executeOrderIssued', {
        sessionId,
        executorId,
        agentId,
        targetId,
      });

      return {
        success: true,
        commandId: 'EXECUTE_ORDER',
        detected: false,
        outcome: `체포 집행 권한이 부여되었습니다.`,
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Execute order error:', error);
      return this.errorResult('EXECUTE_ORDER', cpCost, '집행명령 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 사열/습격
  // ============================================================

  /**
   * 사열 - 쿠데타 징후 탐지
   */
  private async executeInspection(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, targetId } = request;
    const cpCost = this.getCommandCost('INSPECTION');

    try {
      const executor = await Gin7Character.findOne({ sessionId, characterId: executorId });
      if (!executor) {
        return this.errorResult('INSPECTION', cpCost, '실행자를 찾을 수 없습니다.');
      }

      // SpyService의 inspectionCommand 호출
      const result = await spyService.inspectionCommand(sessionId, executorId, targetId);

      this.emit('intel:inspection', {
        sessionId,
        executorId,
        targetId,
        result,
      });

      return {
        success: result.success,
        commandId: 'INSPECTION',
        detected: false,
        outcome: result.success ? '사열을 실시했습니다.' : '사열에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Inspection error:', error);
      return this.errorResult('INSPECTION', cpCost, '사열 처리 중 오류 발생');
    }
  }

  /**
   * 습격 - 적 인물 습격
   */
  private async executeRaid(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, agentId, targetId } = request;
    const cpCost = this.getCommandCost('RAID');

    if (!targetId) {
      return this.errorResult('RAID', cpCost, '습격 대상이 필요합니다.');
    }

    try {
      const agent = await Gin7Character.findOne({ 
        sessionId, 
        characterId: agentId || executorId 
      });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!agent || !target) {
        return this.errorResult('RAID', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // SpyService의 raidCommand 호출
      const result = await spyService.raidCommand(sessionId, agent.characterId, targetId);

      const detected = Math.random() < 0.5; // 50% 발각 확률

      this.emit('intel:raid', {
        sessionId,
        executorId,
        agentId: agent.characterId,
        targetId,
        success: result.success,
        detected,
      });

      return {
        success: result.success,
        commandId: 'RAID',
        detected,
        outcome: result.success 
          ? `${target.name}을(를) 습격했습니다.` 
          : '습격에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Raid error:', error);
      return this.errorResult('RAID', cpCost, '습격 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 감시/잠입
  // ============================================================

  /**
   * 감시 - 인물 감시
   */
  private async executeSurveillance(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, targetId } = request;
    const cpCost = this.getCommandCost('SURVEILLANCE');

    if (!targetId) {
      return this.errorResult('SURVEILLANCE', cpCost, '감시 대상이 필요합니다.');
    }

    try {
      const result = await spyService.surveillanceCommand(sessionId, executorId, targetId);

      this.emit('intel:surveillance', {
        sessionId,
        executorId,
        targetId,
        result,
      });

      return {
        success: result.success,
        commandId: 'SURVEILLANCE',
        detected: false,
        outcome: result.success ? '감시를 시작했습니다.' : '감시 설정에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Surveillance error:', error);
      return this.errorResult('SURVEILLANCE', cpCost, '감시 처리 중 오류 발생');
    }
  }

  /**
   * 잠입공작 - 시설 잠입
   */
  private async executeInfiltrate(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, agentId, planetId } = request;
    const cpCost = this.getCommandCost('INFILTRATE');

    if (!planetId) {
      return this.errorResult('INFILTRATE', cpCost, '잠입할 행성이 필요합니다.');
    }

    try {
      const agent = await Gin7Character.findOne({ 
        sessionId, 
        characterId: agentId || executorId 
      });
      if (!agent) {
        return this.errorResult('INFILTRATE', cpCost, '공작원을 찾을 수 없습니다.');
      }

      const result = await spyService.infiltrationCommand(sessionId, agent.characterId, planetId);

      const detected = !result.success && Math.random() < 0.4;

      this.emit('intel:infiltrate', {
        sessionId,
        executorId,
        agentId: agent.characterId,
        planetId,
        success: result.success,
        detected,
      });

      return {
        success: result.success,
        commandId: 'INFILTRATE',
        detected,
        outcome: result.success ? '잠입에 성공했습니다.' : '잠입에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Infiltrate error:', error);
      return this.errorResult('INFILTRATE', cpCost, '잠입 처리 중 오류 발생');
    }
  }

  /**
   * 탈출공작 - 잠입 탈출
   */
  private async executeEscape(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, agentId } = request;
    const cpCost = this.getCommandCost('ESCAPE');

    try {
      const agent = await Gin7Character.findOne({ 
        sessionId, 
        characterId: agentId || executorId 
      });
      if (!agent) {
        return this.errorResult('ESCAPE', cpCost, '공작원을 찾을 수 없습니다.');
      }

      const result = await spyService.returnOperationCommand(sessionId, agent.characterId, {});

      this.emit('intel:escape', {
        sessionId,
        executorId,
        agentId: agent.characterId,
        success: result.success,
      });

      return {
        success: result.success,
        commandId: 'ESCAPE',
        detected: false,
        outcome: result.success ? '탈출에 성공했습니다.' : '탈출에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Escape error:', error);
      return this.errorResult('ESCAPE', cpCost, '탈출 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 정보공작/파괴공작/선동
  // ============================================================

  /**
   * 정보공작 - 선전/역정보
   */
  private async executeInfoOp(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, planetId, params } = request;
    const cpCost = this.getCommandCost('INFO_OP');

    if (!planetId) {
      return this.errorResult('INFO_OP', cpCost, '대상 행성이 필요합니다.');
    }

    try {
      const result = await spyService.informationOperationCommand(
        sessionId, 
        executorId, 
        { facilityId: planetId, content: params?.content || 'default' }
      );

      this.emit('intel:infoOp', {
        sessionId,
        executorId,
        planetId,
        success: result.success,
      });

      return {
        success: result.success,
        commandId: 'INFO_OP',
        detected: false,
        outcome: result.success ? '정보공작을 실시했습니다.' : '정보공작에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Info op error:', error);
      return this.errorResult('INFO_OP', cpCost, '정보공작 처리 중 오류 발생');
    }
  }

  /**
   * 파괴공작 - 시설 파괴
   */
  private async executeSabotage(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, agentId, planetId, params } = request;
    const cpCost = this.getCommandCost('SABOTAGE');

    if (!planetId) {
      return this.errorResult('SABOTAGE', cpCost, '대상 행성이 필요합니다.');
    }

    try {
      const agent = await Gin7Character.findOne({ 
        sessionId, 
        characterId: agentId || executorId 
      });
      if (!agent) {
        return this.errorResult('SABOTAGE', cpCost, '공작원을 찾을 수 없습니다.');
      }

      const result = await spyService.sabotageCommand(
        sessionId,
        agent.characterId,
        { targetFacilityId: params?.facilityId || planetId }
      );

      const detected = Math.random() < 0.5;

      this.emit('intel:sabotage', {
        sessionId,
        executorId,
        agentId: agent.characterId,
        planetId,
        success: result.success,
        detected,
      });

      return {
        success: result.success,
        commandId: 'SABOTAGE',
        detected,
        outcome: result.success ? '파괴공작에 성공했습니다.' : '파괴공작에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Sabotage error:', error);
      return this.errorResult('SABOTAGE', cpCost, '파괴공작 처리 중 오류 발생');
    }
  }

  /**
   * 선동 - 민심 선동
   */
  private async executeAgitation(request: IntelRequest): Promise<IntelResult> {
    const { sessionId, executorId, agentId, planetId } = request;
    const cpCost = this.getCommandCost('AGITATION');

    if (!planetId) {
      return this.errorResult('AGITATION', cpCost, '대상 행성이 필요합니다.');
    }

    try {
      const agent = await Gin7Character.findOne({ 
        sessionId, 
        characterId: agentId || executorId 
      });
      if (!agent) {
        return this.errorResult('AGITATION', cpCost, '공작원을 찾을 수 없습니다.');
      }

      const result = await spyService.agitationCommand(sessionId, agent.characterId, planetId);

      const detected = Math.random() < 0.4;

      this.emit('intel:agitation', {
        sessionId,
        executorId,
        agentId: agent.characterId,
        planetId,
        success: result.success,
        detected,
      });

      return {
        success: result.success,
        commandId: 'AGITATION',
        detected,
        outcome: result.success ? '선동에 성공했습니다.' : '선동에 실패했습니다.',
        cpCost,
      };
    } catch (error) {
      logger.error('[IntelligenceCommandService] Agitation error:', error);
      return this.errorResult('AGITATION', cpCost, '선동 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 160;
  }

  private calculateSuccessRate(commandId: string, agent: IGin7Character): number {
    const baseRate = BASE_SUCCESS_RATES[commandId] || 0.5;
    const intelBonus = (agent.stats?.intellect || 50) / 200; // 0 ~ 0.5
    return Math.min(0.95, baseRate + intelBonus);
  }

  private errorResult(commandId: string, cpCost: number, error: string): IntelResult {
    return {
      success: false,
      commandId,
      detected: false,
      cpCost,
      error,
    };
  }
}

export const intelligenceCommandService = IntelligenceCommandService.getInstance();
export default IntelligenceCommandService;





