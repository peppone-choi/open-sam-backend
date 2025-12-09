/**
 * CounterIntelService - 대첩보 활동 서비스
 * 매뉴얼 5460-5574행 기반 확장
 *
 * 적 첩보 활동에 대응하는 방첩 활동을 관리합니다.
 *
 * 기능:
 * - 일제 수색: 특정 인물/첩보원 위치 파악
 * - 사열 (점검): 시설/부대 내 이상 징후 탐지
 * - 체포 절차: 용의자 체포
 * - 심문: 체포된 첩보원으로부터 정보 획득
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';

// ============================================================
// 타입 정의
// ============================================================

/**
 * 수색 타입
 */
export enum SearchType {
  MASS_SEARCH = 'MASS_SEARCH',           // 일제 수색
  TARGETED_SEARCH = 'TARGETED_SEARCH',   // 표적 수색
  RANDOM_CHECK = 'RANDOM_CHECK',         // 무작위 검문
  FACILITY_SWEEP = 'FACILITY_SWEEP',     // 시설 일소
}

/**
 * 점검 타입
 */
export enum InspectionType {
  FACILITY_INSPECTION = 'FACILITY_INSPECTION',   // 시설 점검
  UNIT_INSPECTION = 'UNIT_INSPECTION',           // 부대 점검
  DOCUMENT_AUDIT = 'DOCUMENT_AUDIT',             // 문서 감사
  PERSONNEL_REVIEW = 'PERSONNEL_REVIEW',         // 인원 검토
  SECURITY_AUDIT = 'SECURITY_AUDIT',             // 보안 감사
}

/**
 * 체포 상태
 */
export enum ArrestStatus {
  WARRANT_ISSUED = 'WARRANT_ISSUED',     // 영장 발부됨
  IN_PURSUIT = 'IN_PURSUIT',             // 추적 중
  ARRESTED = 'ARRESTED',                 // 체포됨
  ESCAPED = 'ESCAPED',                   // 도주함
  RELEASED = 'RELEASED',                 // 석방됨
  TRANSFERRED = 'TRANSFERRED',           // 이송됨
}

/**
 * 심문 방법
 */
export enum InterrogationMethod {
  STANDARD = 'STANDARD',                 // 표준 심문
  PSYCHOLOGICAL = 'PSYCHOLOGICAL',       // 심리적 압박
  INTENSIVE = 'INTENSIVE',               // 강도 높은 심문
  NEGOTIATION = 'NEGOTIATION',           // 협상/회유
  TRUTH_SERUM = 'TRUTH_SERUM',           // 약물 사용
}

/**
 * 심문 결과
 */
export enum InterrogationResult {
  NO_INFORMATION = 'NO_INFORMATION',     // 정보 없음
  PARTIAL_INFO = 'PARTIAL_INFO',         // 부분 정보
  FULL_CONFESSION = 'FULL_CONFESSION',   // 완전 자백
  MISINFORMATION = 'MISINFORMATION',     // 허위 정보
  DEATH = 'DEATH',                       // 사망 (극단적 심문 시)
}

/**
 * 수색 기록
 */
export interface SearchRecord {
  searchId: string;
  sessionId: string;
  type: SearchType;
  executorId: string;              // 실행자 (헌병 등)
  executorName: string;
  targetPlanetId: string;
  targetFacilityId?: string;
  targetCharacterId?: string;      // 표적 수색 시 대상
  executedAt: Date;
  success: boolean;
  foundSuspects: string[];         // 발견된 용의자 ID 목록
  notes?: string;
}

/**
 * 점검 기록
 */
export interface InspectionRecord {
  inspectionId: string;
  sessionId: string;
  type: InspectionType;
  inspectorId: string;
  inspectorName: string;
  targetPlanetId: string;
  targetFacilityId?: string;
  targetUnitId?: string;
  executedAt: Date;
  anomaliesFound: AnomalyReport[];
  overallRating: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR' | 'CRITICAL';
}

/**
 * 이상 징후 보고서
 */
export interface AnomalyReport {
  type: 'SECURITY_BREACH' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY' |
        'DOCUMENT_TAMPERING' | 'LOYALTY_CONCERN' | 'EQUIPMENT_SABOTAGE';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  relatedCharacterIds?: string[];
}

/**
 * 체포 기록
 */
export interface ArrestRecord {
  arrestId: string;
  sessionId: string;
  targetId: string;
  targetName: string;
  targetFaction: string;
  status: ArrestStatus;
  warrantIssuedBy?: string;
  warrantIssuedAt?: Date;
  arrestedBy?: string;
  arrestedAt?: Date;
  arrestLocation?: string;
  charges: string[];               // 혐의
  detentionFacilityId?: string;
  notes?: string;
}

/**
 * 심문 기록
 */
export interface InterrogationRecord {
  interrogationId: string;
  sessionId: string;
  arrestId: string;
  subjectId: string;
  subjectName: string;
  interrogatorId: string;
  interrogatorName: string;
  method: InterrogationMethod;
  executedAt: Date;
  duration: number;                // 시간 (분)
  result: InterrogationResult;
  obtainedInformation?: string[];
  subjectCondition: 'HEALTHY' | 'STRESSED' | 'BROKEN' | 'CRITICAL' | 'DECEASED';
}

/**
 * 대첩보 활동 결과
 */
export interface CounterIntelResult {
  success: boolean;
  message: string;
  recordId?: string;
  foundSuspects?: string[];
  anomalies?: AnomalyReport[];
  obtainedInfo?: string[];
  cpCost: number;
}

// ============================================================
// 기본 설정
// ============================================================

const SEARCH_CONFIG: Record<SearchType, {
  baseCost: number;
  baseSuccessRate: number;
  duration: number;  // 시간 (분)
}> = {
  [SearchType.MASS_SEARCH]: { baseCost: 160, baseSuccessRate: 0.6, duration: 480 },
  [SearchType.TARGETED_SEARCH]: { baseCost: 80, baseSuccessRate: 0.75, duration: 240 },
  [SearchType.RANDOM_CHECK]: { baseCost: 40, baseSuccessRate: 0.3, duration: 60 },
  [SearchType.FACILITY_SWEEP]: { baseCost: 120, baseSuccessRate: 0.7, duration: 360 },
};

const INTERROGATION_CONFIG: Record<InterrogationMethod, {
  successRate: number;
  misinfoRate: number;
  healthRisk: number;
  duration: number;
}> = {
  [InterrogationMethod.STANDARD]: { successRate: 0.3, misinfoRate: 0.1, healthRisk: 0.0, duration: 60 },
  [InterrogationMethod.PSYCHOLOGICAL]: { successRate: 0.5, misinfoRate: 0.2, healthRisk: 0.1, duration: 180 },
  [InterrogationMethod.INTENSIVE]: { successRate: 0.7, misinfoRate: 0.3, healthRisk: 0.3, duration: 360 },
  [InterrogationMethod.NEGOTIATION]: { successRate: 0.4, misinfoRate: 0.05, healthRisk: 0.0, duration: 120 },
  [InterrogationMethod.TRUTH_SERUM]: { successRate: 0.8, misinfoRate: 0.1, healthRisk: 0.2, duration: 90 },
};

// ============================================================
// CounterIntelService 클래스
// ============================================================

export class CounterIntelService extends EventEmitter {
  private static instance: CounterIntelService;
  private searchRecords: Map<string, SearchRecord[]> = new Map();
  private inspectionRecords: Map<string, InspectionRecord[]> = new Map();
  private arrestRecords: Map<string, ArrestRecord[]> = new Map();
  private interrogationRecords: Map<string, InterrogationRecord[]> = new Map();

  private constructor() {
    super();
    logger.info('[CounterIntelService] Initialized');
  }

  public static getInstance(): CounterIntelService {
    if (!CounterIntelService.instance) {
      CounterIntelService.instance = new CounterIntelService();
    }
    return CounterIntelService.instance;
  }

  // ============================================================
  // 세션 관리
  // ============================================================

  public initializeSession(sessionId: string): void {
    this.searchRecords.set(sessionId, []);
    this.inspectionRecords.set(sessionId, []);
    this.arrestRecords.set(sessionId, []);
    this.interrogationRecords.set(sessionId, []);
    logger.info(`[CounterIntelService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.searchRecords.delete(sessionId);
    this.inspectionRecords.delete(sessionId);
    this.arrestRecords.delete(sessionId);
    this.interrogationRecords.delete(sessionId);
    logger.info(`[CounterIntelService] Session ${sessionId} cleaned up`);
  }

  // ============================================================
  // 일제 수색 (conductMassSearch)
  // ============================================================

  /**
   * 일제 수색 실시
   */
  public async conductMassSearch(
    sessionId: string,
    executorId: string,
    targetPlanetId: string,
    targetCharacterId?: string,
  ): Promise<CounterIntelResult> {
    const searchType = targetCharacterId ? SearchType.TARGETED_SEARCH : SearchType.MASS_SEARCH;
    const config = SEARCH_CONFIG[searchType];

    try {
      const executor = await Gin7Character.findOne({ sessionId, characterId: executorId });
      if (!executor) {
        return { success: false, message: '실행자를 찾을 수 없습니다.', cpCost: 0 };
      }

      const planet = await Planet.findOne({ sessionId, planetId: targetPlanetId });
      if (!planet) {
        return { success: false, message: '대상 행성을 찾을 수 없습니다.', cpCost: 0 };
      }

      // 성공률 계산 (정보력 기반)
      const intelligenceBonus = (executor.stats?.intellect || 50) / 200;
      const successRate = Math.min(0.95, config.baseSuccessRate + intelligenceBonus);
      const success = Math.random() < successRate;

      const foundSuspects: string[] = [];

      if (success) {
        // 해당 행성의 잠입 중인 적 첩보원 탐지
        // 실제로는 SpyService/InfiltrationService와 연동
        if (targetCharacterId) {
          // 표적 수색 - 특정 인물 발견
          const target = await Gin7Character.findOne({
            sessionId,
            characterId: targetCharacterId,
            locationPlanetId: targetPlanetId,
          });
          if (target) {
            foundSuspects.push(targetCharacterId);
          }
        } else {
          // 일제 수색 - 숨어있는 의심스러운 인물 탐지
          const suspiciousChars = await Gin7Character.find({
            sessionId,
            locationPlanetId: targetPlanetId,
            faction: { $ne: executor.faction },
            status: { $in: ['INFILTRATED', 'HIDING'] },
          });
          foundSuspects.push(...suspiciousChars.map(c => c.characterId));
        }
      }

      // 기록 저장
      const record: SearchRecord = {
        searchId: `SEARCH-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        type: searchType,
        executorId,
        executorName: executor.name,
        targetPlanetId,
        targetCharacterId,
        executedAt: new Date(),
        success,
        foundSuspects,
      };

      this.searchRecords.get(sessionId)?.push(record);

      this.emit('counterintel:search_completed', { sessionId, record });
      logger.info(`[CounterIntelService] ${searchType} completed by ${executor.name}`);

      return {
        success,
        message: success
          ? foundSuspects.length > 0
            ? `수색 완료. ${foundSuspects.length}명의 용의자를 발견했습니다.`
            : '수색 완료. 특이사항 없음.'
          : '수색에 실패했습니다.',
        recordId: record.searchId,
        foundSuspects: success ? foundSuspects : undefined,
        cpCost: config.baseCost,
      };
    } catch (error) {
      logger.error('[CounterIntelService] Mass search error:', error);
      return { success: false, message: '수색 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 사열/점검 (conductInspection)
  // ============================================================

  /**
   * 시설/부대 점검 실시
   */
  public async conductInspection(
    sessionId: string,
    inspectorId: string,
    inspectionType: InspectionType,
    targetPlanetId: string,
    targetFacilityId?: string,
    targetUnitId?: string,
  ): Promise<CounterIntelResult> {
    const cpCost = 160;

    try {
      const inspector = await Gin7Character.findOne({ sessionId, characterId: inspectorId });
      if (!inspector) {
        return { success: false, message: '점검관을 찾을 수 없습니다.', cpCost: 0 };
      }

      // 점검 실시
      const anomalies: AnomalyReport[] = [];

      // 점검 유형별 이상 징후 탐지
      const detectionChance = 0.3 + (inspector.stats?.intellect || 50) / 200;

      // 보안 위반 탐지
      if (Math.random() < detectionChance * 0.5) {
        anomalies.push({
          type: 'SECURITY_BREACH',
          description: '미승인 접근 기록 발견',
          severity: 'MEDIUM',
        });
      }

      // 문서 변조 탐지
      if (inspectionType === InspectionType.DOCUMENT_AUDIT && Math.random() < detectionChance * 0.3) {
        anomalies.push({
          type: 'DOCUMENT_TAMPERING',
          description: '문서 위변조 흔적 발견',
          severity: 'HIGH',
        });
      }

      // 충성도 문제 탐지 (부대 점검 시)
      if (inspectionType === InspectionType.UNIT_INSPECTION && Math.random() < detectionChance * 0.2) {
        anomalies.push({
          type: 'LOYALTY_CONCERN',
          description: '일부 인원의 충성도 의심',
          severity: 'HIGH',
        });
      }

      // 의심스러운 활동 탐지
      if (Math.random() < detectionChance * 0.4) {
        anomalies.push({
          type: 'SUSPICIOUS_ACTIVITY',
          description: '정상적이지 않은 행동 패턴 감지',
          severity: 'MEDIUM',
        });
      }

      // 전체 등급 결정
      let overallRating: InspectionRecord['overallRating'];
      const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
      const highCount = anomalies.filter(a => a.severity === 'HIGH').length;

      if (criticalCount > 0) {
        overallRating = 'CRITICAL';
      } else if (highCount > 1) {
        overallRating = 'POOR';
      } else if (highCount === 1 || anomalies.length > 2) {
        overallRating = 'ACCEPTABLE';
      } else if (anomalies.length > 0) {
        overallRating = 'GOOD';
      } else {
        overallRating = 'EXCELLENT';
      }

      // 기록 저장
      const record: InspectionRecord = {
        inspectionId: `INSP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        type: inspectionType,
        inspectorId,
        inspectorName: inspector.name,
        targetPlanetId,
        targetFacilityId,
        targetUnitId,
        executedAt: new Date(),
        anomaliesFound: anomalies,
        overallRating,
      };

      this.inspectionRecords.get(sessionId)?.push(record);

      this.emit('counterintel:inspection_completed', { sessionId, record });
      logger.info(`[CounterIntelService] ${inspectionType} completed by ${inspector.name}`);

      return {
        success: true,
        message: `점검 완료. 등급: ${overallRating}. ${anomalies.length}건의 이상 징후 발견.`,
        recordId: record.inspectionId,
        anomalies,
        cpCost,
      };
    } catch (error) {
      logger.error('[CounterIntelService] Inspection error:', error);
      return { success: false, message: '점검 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 체포 절차 개시 (initiateArrest)
  // ============================================================

  /**
   * 체포 절차 개시 (영장 발부)
   */
  public async initiateArrest(
    sessionId: string,
    issuerId: string,
    targetId: string,
    charges: string[],
  ): Promise<CounterIntelResult> {
    const cpCost = 800;

    try {
      const issuer = await Gin7Character.findOne({ sessionId, characterId: issuerId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!issuer) {
        return { success: false, message: '발부자를 찾을 수 없습니다.', cpCost: 0 };
      }

      if (!target) {
        return { success: false, message: '대상자를 찾을 수 없습니다.', cpCost: 0 };
      }

      // 기존 체포 영장 확인
      const existingArrest = this.arrestRecords.get(sessionId)
        ?.find(a => a.targetId === targetId && a.status === ArrestStatus.WARRANT_ISSUED);

      if (existingArrest) {
        return { success: false, message: '이미 체포 영장이 발부되어 있습니다.', cpCost: 0 };
      }

      // 체포 영장 발부
      const record: ArrestRecord = {
        arrestId: `ARR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        targetId,
        targetName: target.name,
        targetFaction: target.faction,
        status: ArrestStatus.WARRANT_ISSUED,
        warrantIssuedBy: issuerId,
        warrantIssuedAt: new Date(),
        charges,
      };

      this.arrestRecords.get(sessionId)?.push(record);

      // 대상자에 체포 영장 표시
      if (!target.data) target.data = {};
      target.data.arrestWarrant = {
        arrestId: record.arrestId,
        issuedBy: issuerId,
        issuedAt: new Date(),
        charges,
      };
      await target.save();

      this.emit('counterintel:arrest_warrant_issued', { sessionId, record });
      logger.info(`[CounterIntelService] Arrest warrant issued for ${target.name}`);

      return {
        success: true,
        message: `${target.name}에 대한 체포 영장이 발부되었습니다.`,
        recordId: record.arrestId,
        cpCost,
      };
    } catch (error) {
      logger.error('[CounterIntelService] Initiate arrest error:', error);
      return { success: false, message: '체포 절차 개시 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 체포 실행 (executeArrest)
  // ============================================================

  /**
   * 체포 실행
   */
  public async executeArrest(
    sessionId: string,
    arresterId: string,
    arrestId: string,
  ): Promise<CounterIntelResult> {
    const cpCost = 160;

    try {
      const arrester = await Gin7Character.findOne({ sessionId, characterId: arresterId });
      if (!arrester) {
        return { success: false, message: '체포 집행자를 찾을 수 없습니다.', cpCost: 0 };
      }

      const record = this.arrestRecords.get(sessionId)?.find(a => a.arrestId === arrestId);
      if (!record) {
        return { success: false, message: '체포 기록을 찾을 수 없습니다.', cpCost: 0 };
      }

      if (record.status !== ArrestStatus.WARRANT_ISSUED && record.status !== ArrestStatus.IN_PURSUIT) {
        return { success: false, message: `현재 상태(${record.status})에서는 체포를 실행할 수 없습니다.`, cpCost: 0 };
      }

      const target = await Gin7Character.findOne({ sessionId, characterId: record.targetId });
      if (!target) {
        return { success: false, message: '대상자를 찾을 수 없습니다.', cpCost: 0 };
      }

      // 동일 위치 확인
      if (arrester.locationPlanetId !== target.locationPlanetId) {
        record.status = ArrestStatus.IN_PURSUIT;
        return {
          success: false,
          message: '대상자와 같은 위치에 있어야 합니다. 추적 상태로 전환됩니다.',
          recordId: arrestId,
          cpCost: cpCost / 2,
        };
      }

      // 체포 성공률 계산
      const arresterSkill = (arrester.stats?.might || 50) + (arrester.stats?.intellect || 50);
      const targetSkill = (target.stats?.agility || 50) + (target.stats?.intellect || 50);
      const successRate = Math.min(0.9, Math.max(0.3, 0.5 + (arresterSkill - targetSkill) / 200));

      const success = Math.random() < successRate;

      if (success) {
        // 체포 성공
        record.status = ArrestStatus.ARRESTED;
        record.arrestedBy = arresterId;
        record.arrestedAt = new Date();
        record.arrestLocation = target.locationPlanetId;

        // 대상자 상태 변경
        target.status = 'DETAINED';
        target.detentionDetails = {
          detainedBy: arresterId,
          reason: record.charges.join(', '),
          detainedAt: new Date(),
        };
        await target.save();

        this.emit('counterintel:arrest_executed', { sessionId, record, success: true });
        logger.info(`[CounterIntelService] ${target.name} arrested by ${arrester.name}`);

        return {
          success: true,
          message: `${target.name}을(를) 체포했습니다.`,
          recordId: arrestId,
          cpCost,
        };
      } else {
        // 체포 실패 - 도주
        record.status = ArrestStatus.ESCAPED;
        record.notes = `체포 시도 실패. ${target.name}이(가) 도주함.`;

        this.emit('counterintel:arrest_executed', { sessionId, record, success: false });
        logger.warn(`[CounterIntelService] ${target.name} escaped arrest`);

        return {
          success: false,
          message: `${target.name}이(가) 체포를 피해 도주했습니다.`,
          recordId: arrestId,
          cpCost,
        };
      }
    } catch (error) {
      logger.error('[CounterIntelService] Execute arrest error:', error);
      return { success: false, message: '체포 실행 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 심문 (interrogate)
  // ============================================================

  /**
   * 심문 실시
   */
  public async interrogate(
    sessionId: string,
    interrogatorId: string,
    arrestId: string,
    method: InterrogationMethod,
  ): Promise<CounterIntelResult> {
    const cpCost = 160;
    const config = INTERROGATION_CONFIG[method];

    try {
      const interrogator = await Gin7Character.findOne({ sessionId, characterId: interrogatorId });
      if (!interrogator) {
        return { success: false, message: '심문관을 찾을 수 없습니다.', cpCost: 0 };
      }

      const arrestRecord = this.arrestRecords.get(sessionId)?.find(a => a.arrestId === arrestId);
      if (!arrestRecord) {
        return { success: false, message: '체포 기록을 찾을 수 없습니다.', cpCost: 0 };
      }

      if (arrestRecord.status !== ArrestStatus.ARRESTED) {
        return { success: false, message: '체포된 상태에서만 심문이 가능합니다.', cpCost: 0 };
      }

      const subject = await Gin7Character.findOne({ sessionId, characterId: arrestRecord.targetId });
      if (!subject) {
        return { success: false, message: '심문 대상자를 찾을 수 없습니다.', cpCost: 0 };
      }

      // 심문 성공률 계산
      const skillBonus = (interrogator.stats?.intellect || 50) / 200;
      const subjectResistance = (subject.stats?.willpower || subject.stats?.intellect || 50) / 400;
      const successRate = Math.min(0.9, config.successRate + skillBonus - subjectResistance);

      // 심문 결과 판정
      let result: InterrogationResult;
      let obtainedInfo: string[] = [];
      let subjectCondition: InterrogationRecord['subjectCondition'] = 'HEALTHY';

      const roll = Math.random();

      // 건강 위험 체크
      if (Math.random() < config.healthRisk) {
        if (Math.random() < 0.1) {
          // 사망 (매우 낮은 확률)
          subjectCondition = 'DECEASED';
          result = InterrogationResult.NO_INFORMATION;
        } else if (Math.random() < 0.3) {
          subjectCondition = 'CRITICAL';
        } else {
          subjectCondition = 'BROKEN';
        }
      } else if (config.healthRisk > 0) {
        subjectCondition = 'STRESSED';
      }

      if (subjectCondition !== 'DECEASED') {
        if (roll < successRate * 0.5) {
          // 완전 자백
          result = InterrogationResult.FULL_CONFESSION;
          obtainedInfo = [
            '소속 조직 정보',
            '공작 임무 상세',
            '협력자 명단',
            '통신 방법',
            '향후 작전 계획',
          ];
        } else if (roll < successRate) {
          // 부분 정보
          result = InterrogationResult.PARTIAL_INFO;
          obtainedInfo = [
            '소속 진영 확인',
            '임무 유형 (부분)',
          ];
        } else if (roll < successRate + config.misinfoRate) {
          // 허위 정보
          result = InterrogationResult.MISINFORMATION;
          obtainedInfo = ['(허위 정보) 가짜 협력자 명단'];
        } else {
          // 정보 없음
          result = InterrogationResult.NO_INFORMATION;
        }
      } else {
        result = InterrogationResult.NO_INFORMATION;
      }

      // 심문 기록 저장
      const record: InterrogationRecord = {
        interrogationId: `INT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        sessionId,
        arrestId,
        subjectId: arrestRecord.targetId,
        subjectName: subject.name,
        interrogatorId,
        interrogatorName: interrogator.name,
        method,
        executedAt: new Date(),
        duration: config.duration,
        result,
        obtainedInformation: obtainedInfo.length > 0 ? obtainedInfo : undefined,
        subjectCondition,
      };

      this.interrogationRecords.get(sessionId)?.push(record);

      // 심문 대상 상태 업데이트
      if (subjectCondition === 'DECEASED') {
        subject.status = 'DEAD';
        subject.deathDetails = {
          cause: 'INTERROGATION',
          deathAt: new Date(),
        };
      }
      await subject.save();

      this.emit('counterintel:interrogation_completed', { sessionId, record });
      logger.info(`[CounterIntelService] Interrogation of ${subject.name} completed: ${result}`);

      let message = '';
      switch (result) {
        case InterrogationResult.FULL_CONFESSION:
          message = '완전 자백을 얻어냈습니다.';
          break;
        case InterrogationResult.PARTIAL_INFO:
          message = '부분적인 정보를 획득했습니다.';
          break;
        case InterrogationResult.MISINFORMATION:
          message = '정보를 획득했습니다. (진위 불확실)';
          break;
        case InterrogationResult.NO_INFORMATION:
          message = subjectCondition === 'DECEASED'
            ? '심문 중 대상자가 사망했습니다.'
            : '유효한 정보를 얻지 못했습니다.';
          break;
      }

      return {
        success: result !== InterrogationResult.NO_INFORMATION,
        message,
        recordId: record.interrogationId,
        obtainedInfo: obtainedInfo.length > 0 ? obtainedInfo : undefined,
        cpCost,
      };
    } catch (error) {
      logger.error('[CounterIntelService] Interrogation error:', error);
      return { success: false, message: '심문 중 오류가 발생했습니다.', cpCost: 0 };
    }
  }

  // ============================================================
  // 조회 메서드
  // ============================================================

  public getSearchRecords(sessionId: string): SearchRecord[] {
    return this.searchRecords.get(sessionId) || [];
  }

  public getInspectionRecords(sessionId: string): InspectionRecord[] {
    return this.inspectionRecords.get(sessionId) || [];
  }

  public getArrestRecords(sessionId: string): ArrestRecord[] {
    return this.arrestRecords.get(sessionId) || [];
  }

  public getActiveArrestWarrants(sessionId: string): ArrestRecord[] {
    return (this.arrestRecords.get(sessionId) || [])
      .filter(a => a.status === ArrestStatus.WARRANT_ISSUED || a.status === ArrestStatus.IN_PURSUIT);
  }

  public getInterrogationRecords(sessionId: string): InterrogationRecord[] {
    return this.interrogationRecords.get(sessionId) || [];
  }

  public getInterrogationsByArrest(sessionId: string, arrestId: string): InterrogationRecord[] {
    return (this.interrogationRecords.get(sessionId) || [])
      .filter(r => r.arrestId === arrestId);
  }
}

export const counterIntelService = CounterIntelService.getInstance();
export default CounterIntelService;





