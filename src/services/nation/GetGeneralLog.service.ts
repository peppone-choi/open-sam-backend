// @ts-nocheck - Type issues need investigation
import { generalRepository } from '../../repositories/general.repository';
import { GeneralRecord } from '../../models/general_record.model';

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

      // reqType 매핑: 프론트엔드에서 오는 값 -> 백엔드 log_type
      // 프론트엔드: 'action' | 'battle' | 'history' | 'personal'
      // 레거시: 'generalHistory' | 'generalAction' | 'battleResult' | 'battleDetail'
      if (reqType === 'history' || reqType === 'generalHistory') {
        logQuery.log_type = 'history';
      } else if (reqType === 'action' || reqType === 'generalAction') {
        logQuery.log_type = 'action';
      } else if (reqType === 'battle' || reqType === 'battleResult') {
        logQuery.log_type = 'battle_result';
      } else if (reqType === 'personal' || reqType === 'battleDetail') {
        logQuery.log_type = 'battle_detail';
      }

      if (reqTo !== null) {
        logQuery._id = { $lt: reqTo };
      }

      const logRecords = await GeneralRecord.find(logQuery)
        .sort({ _id: -1 })
        .limit(limit)
        .lean();

      logs = logRecords.map(log => ({
        id: log._id?.toString() || log.id,
        text: log.text || '', // GeneralRecord는 'text' 필드 사용
        date: log.created_at || '',
        general_id: log.general_id,
        log_type: log.log_type,
        year: log.year,
        month: log.month,
      }));

      return {
        success: true,
        result: true,
        reqType,
        generalID: targetGeneralId,
        logs: logs // 'log' -> 'logs'로 변경 (프론트엔드 호환)
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
