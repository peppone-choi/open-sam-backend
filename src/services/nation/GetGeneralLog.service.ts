// @ts-nocheck - Type issues need investigation
import { generalRepository } from '../../repositories/general.repository';
import { GeneralLog } from '../../models/general-log.model';

/**
 * GetGeneralLog Service
 * 장수 로그 조회 (행동/전투 기록)
 * PHP: /sam/hwe/sammo/API/Nation/GetGeneralLog.php
 */
export class GetGeneralLogService {
  static async execute(data: any, user?: any) {
    const sessionId = data.session_id || 'sangokushi_default';
    const generalId = user?.generalId || data.general_id;
    const targetGeneralId = parseInt(data.targetGeneralID || data.generalID);
    const reqType = data.reqType || 'generalHistory';
    const reqTo = data.reqTo ? parseInt(data.reqTo) : null;
    
    try {
      if (!generalId) {
        return { success: false, message: '장수 ID가 필요합니다' };
      }

      if (!targetGeneralId) {
        return { success: false, message: '대상 장수 ID가 필요합니다' };
      }

      const general = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': generalId
      });

      if (!general) {
        return { success: false, message: '장수를 찾을 수 없습니다' };
      }

      const targetGeneral = await generalRepository.findBySessionAndNo({
        session_id: sessionId,
        'data.no': targetGeneralId
      });

      if (!targetGeneral) {
        return { success: false, message: '대상 장수를 찾을 수 없습니다' };
      }

      const nationId = general.data?.nation || 0;
      const targetNationId = targetGeneral.data?.nation || 0;
      const officerLevel = general.data?.officer_level || 0;
      const permission = general.data?.permission || 'normal';
      const penalty = general.data?.penalty || 0;

      if (nationId === 0) {
        return { success: false, message: '국가에 소속되어 있지 않습니다' };
      }

      if (nationId !== targetNationId) {
        return { success: false, message: '같은 국가의 장수가 아닙니다' };
      }

      const permission_level = this.checkSecretPermission(officerLevel, permission, penalty);

      if (permission_level < 1) {
        return { success: false, message: '권한이 부족합니다. 수뇌부가 아니거나 사관년도가 부족합니다' };
      }

      const targetNpc = targetGeneral.data?.npc || 0;
      if (reqType === 'generalAction' && targetNpc < 2 && targetGeneralId !== generalId && permission_level < 2) {
        return { success: false, message: '권한이 부족합니다. 유저 장수의 개인 기록은 수뇌만 열람 가능합니다' };
      }

      let logs: any[] = [];
      const limit = 30;

      const logQuery: any = {
        session_id: sessionId,
        general_id: targetGeneralId
      };

      if (reqType === 'generalHistory') {
        logQuery.log_type = 'history';
      } else if (reqType === 'generalAction') {
        logQuery.log_type = 'action';
      } else if (reqType === 'battleResult') {
        logQuery.log_type = 'battle_result';
      } else if (reqType === 'battleDetail') {
        logQuery.log_type = 'battle_detail';
      }

      if (reqTo !== null) {
        logQuery.id = { $lt: reqTo };
      }

      const logRecords = await GeneralLog.find(logQuery)
        .sort({ id: -1 })
        .limit(limit);

      logs = logRecords.map(log => ({
        id: log.id,
        general_id: log.general_id,
        log_type: log.log_type,
        message: log.message,
        data: log.data,
        created_at: log.created_at
      }));

      return {
        success: true,
        result: true,
        reqType,
        generalID: targetGeneralId,
        log: logs
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  private static checkSecretPermission(officerLevel: number, permission: string, penalty: number): number {
    if (officerLevel >= 5) return 2;
    if (permission === 'ambassador') return 4;
    if (permission === 'auditor') return 3;
    if (penalty > 0) return -1;
    return 0;
  }
}
