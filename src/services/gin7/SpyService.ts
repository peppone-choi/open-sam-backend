/**
 * SpyService - 첩보 시스템
 * 매뉴얼 5460-5574행 기반
 *
 * 첩보관의 잠입, 정보 수집, 파괴 공작 등을 관리합니다.
 *
 * 커맨드 목록:
 * - 逮捕命令 (체포 명령): 특정 인물 체포 시도
 * - 査閲 (사열): 쿠데타 조짐 감지
 * - 襲撃 (습격): 동일 스폿 타 진영 인물 습격
 * - 監視 (감시): 특정 인물 미행
 * - 潜入工作 (침투 공작): 적 시설 잠입
 * - 脱出工作 (탈출 공작): 잠입 스폿 탈출
 * - 情報工作 (정보 공작): 시설 정보 획득
 * - 破壊工作 (파괴 공작): 시한폭탄 설치
 * - 煽動工作 (선동 공작): 정부 지지율 하락 유도
 * - 侵入工作 (침입 공작): 타 세력 행성 침입
 * - 帰還工作 (귀환 공작): 본국 귀환
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { logger } from '../../common/logger';
import { FacilityService } from './FacilityService';
import { PlanetaryGovernmentService, planetaryGovernmentService } from './PlanetaryGovernmentService';
import JobCardService, { AUTHORITY_TO_COMMAND_CATEGORY } from './JobCardService';
import ConspiracyService from './ConspiracyService';
import { coupService } from './CoupService';
import { CoupStatus } from '../../constants/gin7/operation_definitions';

/**
 * 첩보 시스템 상수
 * 게임 밸런스 조절을 위해 한 곳에서 관리
 */
export const SPY_CONSTANTS = {
  // 직위/권한 관련
  REQUIRED_AUTHORITY: 'intelligence',         // 첩보관 배치에 필요한 권한
  ARREST_AUTHORITY: ['intelligence', 'personnel_high'], // 체포에 필요한 권한 (하나만 있으면 됨)
  
  // 발각 위험도 증가량
  RISK_INFILTRATE_FAIL: 30,
  RISK_INFILTRATE_SUCCESS: 20,
  RISK_INTEL_GATHER: 15,
  RISK_SABOTAGE: 40,
  RISK_AGITATE: 25,
  RISK_PER_TICK: 1,
  
  // 성공률 기본값
  BASE_ARREST_RATE: 30,
  BASE_ASSAULT_RATE: 20,
  BASE_INFILTRATE_RATE: 20,
  BASE_INTEL_RATE: 30,
  BASE_SABOTAGE_RATE: 15,
  BASE_AGITATE_RATE: 25,
  BASE_COUP_DETECT_RATE: 20,
  
  // 능력치 보정 계수
  INTELLECT_MULTIPLIER: 2,
  MIGHT_MULTIPLIER: 2,
  POLITICS_MULTIPLIER: 2,
  
  // 성공률 상한
  MAX_ARREST_RATE: 90,
  MAX_ASSAULT_RATE: 80,
  MAX_INFILTRATE_RATE: 70,
  MAX_INTEL_RATE: 80,
  MAX_SABOTAGE_RATE: 60,
  MAX_AGITATE_RATE: 70,
  
  // 파괴 공작 데미지
  SABOTAGE_BASE_DAMAGE: 50,
  SABOTAGE_RANDOM_DAMAGE: 100,
  
  // 선동 효과
  AGITATE_BASE_APPROVAL_DROP: 5,
  AGITATE_RANDOM_APPROVAL_DROP: 10,
  AGITATE_BASE_STABILITY_DROP: 3,
  AGITATE_RANDOM_STABILITY_DROP: 7,
  
  // 체포 임계값
  CAPTURE_THRESHOLD: 100,
};

/**
 * 첩보관 상태
 */
export enum SpyStatus {
  ACTIVE = 'ACTIVE',               // 활동 중 (본국)
  INFILTRATED = 'INFILTRATED',     // 잠입 중 (적국)
  MONITORING = 'MONITORING',       // 감시 중
  CAPTURED = 'CAPTURED',           // 체포됨
  ESCAPED = 'ESCAPED',             // 탈출 중
}

/**
 * 공작 유형
 */
export enum OperationType {
  INFILTRATE = 'INFILTRATE',       // 침투
  ESCAPE = 'ESCAPE',               // 탈출
  INTEL_GATHER = 'INTEL_GATHER',   // 정보 수집
  SABOTAGE = 'SABOTAGE',           // 파괴
  AGITATE = 'AGITATE',             // 선동
  INVADE = 'INVADE',               // 침입
  RETURN = 'RETURN',               // 귀환
  ARREST = 'ARREST',               // 체포
  INSPECT = 'INSPECT',             // 사열
  ASSAULT = 'ASSAULT',             // 습격
  MONITOR = 'MONITOR',             // 감시
}

/**
 * 첩보관 정보
 */
export interface SpyAgent {
  agentId: string;
  sessionId: string;
  characterId: string;
  characterName: string;
  faction: string;
  coverIdentity?: string;           // 위장 신분
  status: SpyStatus;
  currentPlanetId?: string;         // 현재 위치
  currentFacilityId?: string;
  targetCharacterId?: string;       // 감시 대상
  infiltrationDate?: Date;          // 잠입 시작일
  discoveryRisk: number;            // 발각 위험도 (0-100)
  missions: SpyMission[];           // 수행 중인 임무
  intelGathered: IntelReport[];     // 수집한 정보
  createdAt: Date;
  lastUpdated: Date;
}

/**
 * 첩보 임무
 */
export interface SpyMission {
  missionId: string;
  type: OperationType;
  targetId: string;                 // 대상 행성/인물/시설 ID
  targetName: string;
  status: 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' | 'ABORTED';
  startDate: Date;
  endDate?: Date;
  successRate: number;              // 성공 확률
  result?: string;
}

/**
 * 정보 보고서
 */
export interface IntelReport {
  reportId: string;
  agentId: string;
  type: 'MILITARY' | 'POLITICAL' | 'ECONOMIC' | 'PERSONNEL' | 'COUP_SIGN';
  title: string;
  content: string;
  importance: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  targetFaction: string;
  sourcePlanetId: string;
  gatheredAt: Date;
  transmitted: boolean;             // 본국 전송 여부
}

/**
 * 공작 결과
 */
export interface OperationResult {
  success: boolean;
  operationType: OperationType;
  agentId?: string;
  targetId?: string;
  message: string;
  discoveryRiskChange?: number;     // 발각 위험도 변화
  intelReport?: IntelReport;
  consequences?: string[];
}

/**
 * SpyService 클래스
 */
export class SpyService extends EventEmitter {
  private static instance: SpyService;
  private agents: Map<string, SpyAgent[]> = new Map(); // sessionId -> SpyAgent[]
  private intelReports: Map<string, IntelReport[]> = new Map(); // sessionId -> IntelReport[]

  private constructor() {
    super();
    logger.info('[SpyService] Initialized');
  }

  public static getInstance(): SpyService {
    if (!SpyService.instance) {
      SpyService.instance = new SpyService();
    }
    return SpyService.instance;
  }

  // ==================== 세션 관리 ====================

  public initializeSession(sessionId: string): void {
    this.agents.set(sessionId, []);
    this.intelReports.set(sessionId, []);
    logger.info(`[SpyService] Session ${sessionId} initialized`);
  }

  public cleanupSession(sessionId: string): void {
    this.agents.delete(sessionId);
    this.intelReports.delete(sessionId);
    logger.info(`[SpyService] Session ${sessionId} cleaned up`);
  }

  // ==================== 첩보관 관리 ====================

  /**
   * 첩보관 배치
   */
  public async deployAgent(
    sessionId: string,
    characterId: string,
  ): Promise<{ success: boolean; agent?: SpyAgent; error?: string }> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) {
      return { success: false, error: '캐릭터를 찾을 수 없습니다.' };
    }

    // 이미 첩보관으로 배치되었는지 확인
    const existingAgent = this.getAgentByCharacter(sessionId, characterId);
    if (existingAgent) {
      return { success: false, error: '이미 첩보관으로 배치되어 있습니다.' };
    }

    // 직위/권한 검증 (첩보권 필요)
    // JobCardService를 통해 intelligence 권한 보유 여부 확인
    const jobCardService = JobCardService.getInstance();
    const authSummary = await jobCardService.getAvailableCommands(sessionId, characterId);
    
    const hasIntelAuthority = authSummary.authorities.includes(SPY_CONSTANTS.REQUIRED_AUTHORITY);
    
    // intelligence 권한이 없으면 commandCards에서도 확인
    const hasIntelCard = character.commandCards?.some(card => 
      card.cardId?.toLowerCase().includes(SPY_CONSTANTS.REQUIRED_AUTHORITY)
    ) || false;
    
    if (!hasIntelAuthority && !hasIntelCard) {
      logger.warn(`[SpyService] Deploy rejected: ${character.name} lacks intelligence authority`);
      return { 
        success: false, 
        error: '첩보관 배치에는 첩보권(intelligence) 권한이 필요합니다. 해당 직위가 없습니다.' 
      };
    }

    const newAgent: SpyAgent = {
      agentId: `SPY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      sessionId,
      characterId,
      characterName: character.name,
      faction: character.faction,
      status: SpyStatus.ACTIVE,
      currentPlanetId: character.locationPlanetId,
      discoveryRisk: 0,
      missions: [],
      intelGathered: [],
      createdAt: new Date(),
      lastUpdated: new Date(),
    };

    this.agents.get(sessionId)?.push(newAgent);
    this.emit('spy:deployed', newAgent);
    logger.info(`[SpyService] Agent ${character.name} deployed`);

    return { success: true, agent: newAgent };
  }

  // ==================== 체포 명령 (逮捕命令) ====================

  /**
   * 체포 시도
   */
  public async attemptArrest(
    sessionId: string,
    arresterId: string,
    targetId: string,
  ): Promise<OperationResult> {
    const arrester = await Gin7Character.findOne({ sessionId, characterId: arresterId });
    const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

    if (!arrester || !target) {
      return { success: false, operationType: OperationType.ARREST, message: '캐릭터를 찾을 수 없습니다.' };
    }

    // 동일 스폿/그리드 확인
    if (arrester.locationPlanetId !== target.locationPlanetId) {
      return { success: false, operationType: OperationType.ARREST, message: '동일 위치에 있어야 합니다.' };
    }

    // 체포 권한 확인 (첩보권 또는 고위인사권 필요 - 헌병/치안 담당자)
    const jobCardService = JobCardService.getInstance();
    const authSummary = await jobCardService.getAvailableCommands(sessionId, arresterId);
    
    const hasArrestAuthority = SPY_CONSTANTS.ARREST_AUTHORITY.some(auth => 
      authSummary.authorities.includes(auth)
    );
    
    // commandCards에서도 확인
    const hasArrestCard = arrester.commandCards?.some(card => 
      SPY_CONSTANTS.ARREST_AUTHORITY.some(auth => 
        card.cardId?.toLowerCase().includes(auth)
      )
    ) || false;
    
    if (!hasArrestAuthority && !hasArrestCard) {
      logger.warn(`[SpyService] Arrest rejected: ${arrester.name} lacks authority`);
      return { 
        success: false, 
        operationType: OperationType.ARREST, 
        message: '체포 명령에는 첩보권(intelligence) 또는 고위인사권(personnel_high) 권한이 필요합니다.' 
      };
    }

    // 성공률 계산 (지력 기반)
    const successRate = Math.min(
      SPY_CONSTANTS.MAX_ARREST_RATE, 
      SPY_CONSTANTS.BASE_ARREST_RATE + (arrester.stats?.intellect || 0) * SPY_CONSTANTS.INTELLECT_MULTIPLIER
    );
    const success = Math.random() * 100 < successRate;

    if (success) {
      target.status = 'DETAINED';
      target.detentionDetails = {
        detainedBy: arresterId,
        reason: '체포됨',
        detainedAt: new Date(),
      };
      await target.save();

      this.emit('spy:arrest_success', { sessionId, arresterId, targetId });
      logger.info(`[SpyService] ${arrester.name} arrested ${target.name}`);

      return {
        success: true,
        operationType: OperationType.ARREST,
        targetId,
        message: `${target.name}을(를) 체포했습니다.`,
      };
    } else {
      this.emit('spy:arrest_failed', { sessionId, arresterId, targetId });
      return {
        success: false,
        operationType: OperationType.ARREST,
        targetId,
        message: `${target.name} 체포에 실패했습니다.`,
      };
    }
  }

  // ==================== 사열 (査閲) ====================

  /**
   * 쿠데타 조짐 감지
   * ConspiracyService와 CoupService를 통해 실제 진행 중인 음모/쿠데타를 조회합니다.
   * 
   * 사용 예시:
   * const result = await spyService.inspectForCoup('session1', 'inspector-char-id', 'unit-1');
   * if (result.success && result.intelReport?.type === 'COUP_SIGN') {
   *   // 쿠데타 조짐 발견 시 후속 조치
   * }
   */
  public async inspectForCoup(
    sessionId: string,
    inspectorId: string,
    unitId: string,
  ): Promise<OperationResult> {
    const inspector = await Gin7Character.findOne({ sessionId, characterId: inspectorId });
    if (!inspector) {
      return { success: false, operationType: OperationType.INSPECT, message: '검열관을 찾을 수 없습니다.' };
    }

    const planetId = inspector.locationPlanetId || '';
    const factionId = inspector.faction || inspector.factionId || '';
    
    // 지력 기반 감지율
    const baseDetectionRate = SPY_CONSTANTS.BASE_COUP_DETECT_RATE;
    const intellectBonus = (inspector.stats?.intellect || 0) * 3;
    const detectionRate = Math.min(90, baseDetectionRate + intellectBonus);

    // 실제 쿠데타/음모 조회
    // 1. CoupService에서 해당 행성을 대상으로 한 활성 쿠데타 조회
    const activeCoups = coupService.getActiveCoups(sessionId).filter(
      coup => coup.targetPlanetId === planetId
    );
    
    // 2. ConspiracyService에서 해당 세력을 대상으로 한 음모 조회
    let activeConspiracies: any[] = [];
    try {
      activeConspiracies = await ConspiracyService.detectConspiracies(
        sessionId,
        factionId,
        inspector.stats?.intellect || 50
      );
    } catch (error) {
      logger.warn(`[SpyService] Error detecting conspiracies:`, error);
    }

    // 실제로 음모/쿠데타가 있는지 확인
    const hasRealThreat = activeCoups.length > 0 || activeConspiracies.length > 0;
    
    // 감지 성공 여부 (실제 위협이 있어야 감지 가능)
    const roll = Math.random() * 100;
    const detectionSuccessful = hasRealThreat && roll < detectionRate;
    
    // 거짓 양성 (위협이 없는데 감지했다고 착각) - 낮은 확률
    const falsePositive = !hasRealThreat && roll < 5;
    
    const detected = detectionSuccessful || falsePositive;

    // 감지된 참가자 목록 수집
    const discoveredParticipants: string[] = [];
    let coupDetails = '';
    
    if (detectionSuccessful) {
      // 쿠데타 참가자 일부 노출 (30% 확률)
      for (const coup of activeCoups) {
        for (const participant of coup.participants) {
          if (Math.random() < 0.3) {
            discoveredParticipants.push(participant.characterId);
          }
        }
        coupDetails += `쿠데타 모의 감지 (상태: ${coup.status}). `;
      }
      
      // 음모 참가자 일부 노출
      for (const conspiracy of activeConspiracies) {
        for (const participant of conspiracy.participants || []) {
          if (Math.random() < 0.3) {
            discoveredParticipants.push(participant.characterId);
          }
        }
        coupDetails += `반란 음모 감지 (비밀 유지도: ${conspiracy.secrecy}%). `;
      }
    }

    // 감지된 참가자 이름 조회
    let participantNames: string[] = [];
    if (discoveredParticipants.length > 0) {
      const participants = await Gin7Character.find({
        sessionId,
        characterId: { $in: discoveredParticipants }
      });
      participantNames = participants.map(p => p.name);
    }

    // 보고서 내용 생성
    let reportContent: string;
    let reportImportance: IntelReport['importance'];
    
    if (detectionSuccessful && discoveredParticipants.length > 0) {
      reportContent = `${coupDetails}관련 인물: ${participantNames.join(', ')}`;
      reportImportance = 'CRITICAL';
    } else if (detectionSuccessful) {
      reportContent = `${coupDetails}구체적인 관련자는 파악되지 않았으나 반란 징후가 감지됨.`;
      reportImportance = 'HIGH';
    } else if (falsePositive) {
      reportContent = '의심스러운 동향이 있으나 확실하지 않음. 추가 조사 필요.';
      reportImportance = 'MEDIUM';
    } else {
      reportContent = '부대 사열 결과 이상 없음. 충성도 양호.';
      reportImportance = 'LOW';
    }

    const intelReport: IntelReport = {
      reportId: `INTEL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId: inspectorId,
      type: 'COUP_SIGN',
      title: '부대 사열 보고서',
      content: reportContent,
      importance: reportImportance,
      targetFaction: factionId,
      sourcePlanetId: planetId,
      gatheredAt: new Date(),
      transmitted: false,
    };

    this.intelReports.get(sessionId)?.push(intelReport);
    
    this.emit('spy:inspection_complete', { 
      sessionId, 
      inspectorId, 
      detected,
      realThreat: hasRealThreat,
      discoveredParticipants,
      activeCoups: activeCoups.length,
      activeConspiracies: activeConspiracies.length
    });

    logger.info(`[SpyService] Inspection complete by ${inspector.name}: detected=${detected}, realThreat=${hasRealThreat}, discovered=${discoveredParticipants.length}`);

    return {
      success: true,
      operationType: OperationType.INSPECT,
      message: detected 
        ? (discoveredParticipants.length > 0 
            ? `쿠데타 조짐 감지! 관련자: ${participantNames.join(', ')}`
            : '쿠데타 조짐이 감지되었습니다!')
        : '이상 없음.',
      intelReport,
    };
  }

  // ==================== 습격 (襲撃) ====================

  /**
   * 습격 시도
   */
  public async attemptAssault(
    sessionId: string,
    attackerId: string,
    targetId: string,
  ): Promise<OperationResult> {
    const attacker = await Gin7Character.findOne({ sessionId, characterId: attackerId });
    const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

    if (!attacker || !target) {
      return { success: false, operationType: OperationType.ASSAULT, message: '캐릭터를 찾을 수 없습니다.' };
    }

    // 동일 스폿 확인
    if (attacker.locationPlanetId !== target.locationPlanetId) {
      return { success: false, operationType: OperationType.ASSAULT, message: '동일 위치에 있어야 합니다.' };
    }

    // 타 진영 확인
    if (attacker.faction === target.faction) {
      return { success: false, operationType: OperationType.ASSAULT, message: '타 진영 인물만 습격할 수 있습니다.' };
    }

    // 성공률 (무력 기반)
    const successRate = Math.min(80, 20 + (attacker.stats?.might || 0) * 2);
    const success = Math.random() * 100 < successRate;

    if (success) {
      // 부상 처리
      target.status = 'INJURED';
      target.injuryDetails = {
        injuredBy: attackerId,
        injuredAt: new Date(),
        severity: 'MODERATE',
        recoveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
      };
      await target.save();

      this.emit('spy:assault_success', { sessionId, attackerId, targetId });
      logger.warn(`[SpyService] ${attacker.name} assaulted ${target.name}`);

      return {
        success: true,
        operationType: OperationType.ASSAULT,
        targetId,
        message: `${target.name}을(를) 습격하여 부상을 입혔습니다.`,
      };
    } else {
      this.emit('spy:assault_failed', { sessionId, attackerId, targetId });
      return {
        success: false,
        operationType: OperationType.ASSAULT,
        targetId,
        message: `${target.name} 습격에 실패했습니다.`,
      };
    }
  }

  // ==================== 감시 (監視) ====================

  /**
   * 감시 시작
   */
  public async startMonitoring(
    sessionId: string,
    agentId: string,
    targetId: string,
  ): Promise<OperationResult> {
    const agents = this.agents.get(sessionId);
    const agent = agents?.find(a => a.agentId === agentId);

    if (!agent) {
      return { success: false, operationType: OperationType.MONITOR, message: '첩보관을 찾을 수 없습니다.' };
    }

    agent.status = SpyStatus.MONITORING;
    agent.targetCharacterId = targetId;
    agent.lastUpdated = new Date();

    const mission: SpyMission = {
      missionId: `MISSION-${Date.now()}`,
      type: OperationType.MONITOR,
      targetId,
      targetName: '감시 대상',
      status: 'IN_PROGRESS',
      startDate: new Date(),
      successRate: 80,
    };
    agent.missions.push(mission);

    this.emit('spy:monitoring_started', { sessionId, agentId, targetId });
    logger.info(`[SpyService] Agent ${agent.characterName} started monitoring ${targetId}`);

    return {
      success: true,
      operationType: OperationType.MONITOR,
      agentId,
      targetId,
      message: '감시를 시작했습니다.',
    };
  }

  // ==================== 침투 공작 (潜入工作) ====================

  /**
   * 적 시설 침투
   */
  public async infiltrateFacility(
    sessionId: string,
    agentId: string,
    planetId: string,
    facilityId: string,
  ): Promise<OperationResult> {
    const agents = this.agents.get(sessionId);
    const agent = agents?.find(a => a.agentId === agentId);

    if (!agent) {
      return { success: false, operationType: OperationType.INFILTRATE, message: '첩보관을 찾을 수 없습니다.' };
    }

    const planet = await Planet.findOne({ sessionId, planetId });
    if (!planet) {
      return { success: false, operationType: OperationType.INFILTRATE, message: '행성을 찾을 수 없습니다.' };
    }

    // 적대 행성 여부 확인
    if (!this.isHostilePlanet(planet, agent.faction)) {
      return { 
        success: false, 
        operationType: OperationType.INFILTRATE, 
        message: '아군 또는 중립 행성에는 침투할 수 없습니다. 적대 세력의 행성만 대상이 됩니다.' 
      };
    }

    // 침투 성공률 (지력 기반)
    const character = await Gin7Character.findOne({ sessionId, characterId: agent.characterId });
    const successRate = Math.min(70, 20 + (character?.stats?.intellect || 0) * 2.5);
    const success = Math.random() * 100 < successRate;

    if (success) {
      agent.status = SpyStatus.INFILTRATED;
      agent.currentPlanetId = planetId;
      agent.currentFacilityId = facilityId;
      agent.infiltrationDate = new Date();
      agent.discoveryRisk = 20; // 초기 발각 위험도
      agent.lastUpdated = new Date();

      this.emit('spy:infiltrated', { sessionId, agentId, planetId, facilityId });
      logger.info(`[SpyService] Agent ${agent.characterName} infiltrated ${planet.name}`);

      return {
        success: true,
        operationType: OperationType.INFILTRATE,
        agentId,
        message: `${planet.name}의 시설에 침투했습니다.`,
        discoveryRiskChange: 20,
      };
    } else {
      // 침투 실패 - 발각 가능성
      agent.discoveryRisk += 30;
      agent.lastUpdated = new Date();

      if (agent.discoveryRisk >= 100) {
        agent.status = SpyStatus.CAPTURED;
        this.emit('spy:captured', { sessionId, agentId, planetId });
        return {
          success: false,
          operationType: OperationType.INFILTRATE,
          agentId,
          message: '침투에 실패하여 체포되었습니다.',
          consequences: ['첩보관 체포', '외교 문제 발생 가능'],
        };
      }

      this.emit('spy:infiltration_failed', { sessionId, agentId, planetId });
      return {
        success: false,
        operationType: OperationType.INFILTRATE,
        agentId,
        message: '침투에 실패했습니다.',
        discoveryRiskChange: 30,
      };
    }
  }

  // ==================== 정보 공작 (情報工作) ====================

  /**
   * 정보 수집
   */
  public async gatherIntelligence(
    sessionId: string,
    agentId: string,
    intelType: IntelReport['type'],
  ): Promise<OperationResult> {
    const agents = this.agents.get(sessionId);
    const agent = agents?.find(a => a.agentId === agentId);

    if (!agent) {
      return { success: false, operationType: OperationType.INTEL_GATHER, message: '첩보관을 찾을 수 없습니다.' };
    }

    if (agent.status !== SpyStatus.INFILTRATED) {
      return { success: false, operationType: OperationType.INTEL_GATHER, message: '잠입 상태에서만 정보 수집이 가능합니다.' };
    }

    // 정보 수집 성공률 (지력 기반)
    const character = await Gin7Character.findOne({ sessionId, characterId: agent.characterId });
    const successRate = Math.min(80, 30 + (character?.stats?.intellect || 0) * 2);
    const success = Math.random() * 100 < successRate;

    // 발각 위험도 증가
    agent.discoveryRisk += 15;
    agent.lastUpdated = new Date();

    if (success) {
      const intelReport: IntelReport = {
        reportId: `INTEL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        agentId,
        type: intelType,
        title: this.generateIntelTitle(intelType),
        content: this.generateIntelContent(intelType, agent.currentPlanetId || ''),
        importance: this.calculateIntelImportance(intelType),
        targetFaction: agent.faction === 'empire' ? 'alliance' : 'empire',
        sourcePlanetId: agent.currentPlanetId || '',
        gatheredAt: new Date(),
        transmitted: false,
      };

      agent.intelGathered.push(intelReport);
      this.intelReports.get(sessionId)?.push(intelReport);

      this.emit('spy:intel_gathered', { sessionId, agentId, intelReport });
      logger.info(`[SpyService] Agent ${agent.characterName} gathered ${intelType} intel`);

      return {
        success: true,
        operationType: OperationType.INTEL_GATHER,
        agentId,
        message: `${intelReport.title} 정보를 수집했습니다.`,
        discoveryRiskChange: 15,
        intelReport,
      };
    } else {
      return {
        success: false,
        operationType: OperationType.INTEL_GATHER,
        agentId,
        message: '정보 수집에 실패했습니다.',
        discoveryRiskChange: 15,
      };
    }
  }

  // ==================== 파괴 공작 (破壊工作) ====================

  /**
   * 시설 파괴 공작
   */
  public async sabotage(
    sessionId: string,
    agentId: string,
    targetFacilityId: string,
  ): Promise<OperationResult> {
    const agents = this.agents.get(sessionId);
    const agent = agents?.find(a => a.agentId === agentId);

    if (!agent) {
      return { success: false, operationType: OperationType.SABOTAGE, message: '첩보관을 찾을 수 없습니다.' };
    }

    if (agent.status !== SpyStatus.INFILTRATED) {
      return { success: false, operationType: OperationType.SABOTAGE, message: '잠입 상태에서만 파괴 공작이 가능합니다.' };
    }

    // 파괴 공작 성공률 (지력 기반, 낮음)
    const character = await Gin7Character.findOne({ sessionId, characterId: agent.characterId });
    const successRate = Math.min(60, 15 + (character?.stats?.intellect || 0) * 2);
    const success = Math.random() * 100 < successRate;

    // 발각 위험도 대폭 증가
    agent.discoveryRisk += 40;
    agent.lastUpdated = new Date();

    if (success) {
      // 시설 파괴 로직 - FacilityService.damageFacility를 통해 데미지 적용
      // (Agent 01이 구현한 향상된 API 사용 - 레벨 다운, 상태 변경 포함)
      const planetId = agent.currentPlanetId;
      if (!planetId) {
        return { 
          success: false, 
          operationType: OperationType.SABOTAGE, 
          message: '현재 위치를 확인할 수 없습니다.' 
        };
      }

      // 파괴 공작 데미지 계산 (지력 기반)
      const baseDamage = SPY_CONSTANTS.SABOTAGE_BASE_DAMAGE + 
        Math.floor(Math.random() * SPY_CONSTANTS.SABOTAGE_RANDOM_DAMAGE);
      const intellectBonus = (character?.stats?.intellect || 0) * SPY_CONSTANTS.INTELLECT_MULTIPLIER;
      const totalDamage = baseDamage + intellectBonus;

      try {
        // FacilityService.damageFacility 사용 (향상된 API)
        const damageResult = await FacilityService.damageFacility(
          sessionId,
          planetId,
          targetFacilityId,
          totalDamage
        );

        if (!damageResult.success) {
          return {
            success: false,
            operationType: OperationType.SABOTAGE,
            agentId,
            message: damageResult.error || '시설 파괴 중 오류가 발생했습니다.',
            discoveryRiskChange: SPY_CONSTANTS.RISK_SABOTAGE,
          };
        }

        // 사보타주 기록 남기기
        await FacilityService.markFacilitySabotaged(sessionId, planetId, targetFacilityId, {
          operationType: 'spy_sabotage',
          executedBy: agent.characterId,
          damage: totalDamage,
          timestamp: new Date(),
          notes: `첩보관 ${agent.characterName}에 의한 파괴 공작`
        });

        const consequences: string[] = [];
        if (damageResult.destroyed) {
          consequences.push('시설 완전 파괴');
          consequences.push('복구 필요');
        } else {
          consequences.push(`시설 손상 (HP: ${damageResult.remainingHp})`);
          if (damageResult.levelDowngraded) {
            consequences.push('시설 레벨 하락');
          }
          if (damageResult.operationalStatusChanged) {
            consequences.push('시설 운영 중단');
          }
          if (damageResult.remainingHp < 50) {
            consequences.push('생산 효율 저하');
          }
        }

        this.emit('spy:sabotage_success', { 
          sessionId, 
          agentId, 
          targetFacilityId,
          damage: totalDamage,
          destroyed: damageResult.destroyed,
          remainingHp: damageResult.remainingHp,
          levelDowngraded: damageResult.levelDowngraded
        });
        logger.warn(`[SpyService] Agent ${agent.characterName} sabotaged facility ${targetFacilityId}, damage: ${totalDamage}, destroyed: ${damageResult.destroyed}, levelDown: ${damageResult.levelDowngraded}`);

        return {
          success: true,
          operationType: OperationType.SABOTAGE,
          agentId,
          targetId: targetFacilityId,
          message: damageResult.destroyed 
            ? '시설 파괴 공작에 성공하여 시설을 완전히 파괴했습니다.' 
            : `시설 파괴 공작에 성공했습니다. (피해: ${totalDamage}, 잔여 HP: ${damageResult.remainingHp})`,
          discoveryRiskChange: SPY_CONSTANTS.RISK_SABOTAGE,
          consequences,
        };
      } catch (error) {
        logger.error(`[SpyService] Sabotage error:`, error);
        return {
          success: false,
          operationType: OperationType.SABOTAGE,
          agentId,
          message: '시설 파괴 중 오류가 발생했습니다.',
          discoveryRiskChange: SPY_CONSTANTS.RISK_SABOTAGE,
        };
      }
    } else {
      // 실패 시 발각 확률 높음
      if (agent.discoveryRisk >= 100) {
        agent.status = SpyStatus.CAPTURED;
        this.emit('spy:captured', { sessionId, agentId });
        return {
          success: false,
          operationType: OperationType.SABOTAGE,
          agentId,
          message: '파괴 공작에 실패하여 체포되었습니다.',
          consequences: ['첩보관 체포', '외교 위기'],
        };
      }

      return {
        success: false,
        operationType: OperationType.SABOTAGE,
        agentId,
        message: '파괴 공작에 실패했습니다.',
        discoveryRiskChange: 40,
      };
    }
  }

  // ==================== 선동 공작 (煽動工作) ====================

  /**
   * 시민 선동
   */
  public async agitate(
    sessionId: string,
    agentId: string,
  ): Promise<OperationResult> {
    const agents = this.agents.get(sessionId);
    const agent = agents?.find(a => a.agentId === agentId);

    if (!agent) {
      return { success: false, operationType: OperationType.AGITATE, message: '첩보관을 찾을 수 없습니다.' };
    }

    if (agent.status !== SpyStatus.INFILTRATED) {
      return { success: false, operationType: OperationType.AGITATE, message: '잠입 상태에서만 선동 공작이 가능합니다.' };
    }

    const planet = await Planet.findOne({ sessionId, planetId: agent.currentPlanetId });
    if (!planet) {
      return { success: false, operationType: OperationType.AGITATE, message: '행성을 찾을 수 없습니다.' };
    }

    // 선동 성공률 (정치 능력 기반)
    const character = await Gin7Character.findOne({ sessionId, characterId: agent.characterId });
    const successRate = Math.min(70, 25 + (character?.stats?.politics || 0) * 2);
    const success = Math.random() * 100 < successRate;

    // 발각 위험도 증가
    agent.discoveryRisk += 25;
    agent.lastUpdated = new Date();

    if (success) {
      // 선동 효과 계산 (정치력 기반)
      // Agent 01이 구현한 decreaseSupport/decreasePublicOrder API 사용
      const baseApprovalDrop = SPY_CONSTANTS.AGITATE_BASE_APPROVAL_DROP + 
        Math.floor(Math.random() * SPY_CONSTANTS.AGITATE_RANDOM_APPROVAL_DROP);
      const politicsBonus = Math.floor((character?.stats?.politics || 0) / 10);
      const approvalDrop = baseApprovalDrop + politicsBonus;

      const baseStabilityDrop = SPY_CONSTANTS.AGITATE_BASE_STABILITY_DROP + 
        Math.floor(Math.random() * SPY_CONSTANTS.AGITATE_RANDOM_STABILITY_DROP);
      const stabilityDrop = baseStabilityDrop + Math.floor(politicsBonus / 2);

      const planetId = agent.currentPlanetId!;
      const government = planetaryGovernmentService.getGovernment(planetId);
      
      let actualApprovalDrop = 0;
      let actualStabilityDrop = 0;
      let riotTriggered = false;
      let riotLevel: string | undefined;
      
      if (government) {
        // 자치정부가 있는 경우 (동맹 행성) - decreaseSupport/decreasePublicOrder API 사용
        const newApproval = planetaryGovernmentService.decreaseSupport(
          sessionId,
          planetId,
          approvalDrop,
          `첩보관 ${agent.characterName}의 선동 공작`
        );
        
        if (newApproval >= 0) {
          actualApprovalDrop = approvalDrop;
        }
        
        const publicOrderResult = planetaryGovernmentService.decreasePublicOrder(
          sessionId,
          planetId,
          stabilityDrop,
          `첩보관 ${agent.characterName}의 선동 공작`
        );
        
        if (publicOrderResult.newPublicOrder >= 0) {
          actualStabilityDrop = stabilityDrop;
          riotTriggered = publicOrderResult.riotTriggered;
          riotLevel = publicOrderResult.riotLevel;
        }

        logger.info(`[SpyService] Government stats updated - Approval: ${newApproval}, PublicOrder: ${publicOrderResult.newPublicOrder}, RiotTriggered: ${riotTriggered}`);
      } else {
        // 자치정부가 없는 경우 (제국 행성 등) - 직접 행성 데이터 수정
        const updatedPlanet = await Planet.findOneAndUpdate(
          { sessionId, planetId },
          {
            $inc: {
              morale: -approvalDrop,
              loyalty: -stabilityDrop
            }
          },
          { new: true }
        );

        if (updatedPlanet) {
          // 범위 제한 (0-100)
          const oldMorale = updatedPlanet.morale + approvalDrop;
          const oldLoyalty = updatedPlanet.loyalty + stabilityDrop;
          
          updatedPlanet.morale = Math.max(0, Math.min(100, updatedPlanet.morale));
          updatedPlanet.loyalty = Math.max(0, Math.min(100, updatedPlanet.loyalty));
          await updatedPlanet.save();
          
          actualApprovalDrop = approvalDrop;
          actualStabilityDrop = stabilityDrop;
          
          // 제국 행성도 폭동 임계값 체크 (직접 구현)
          if (updatedPlanet.loyalty <= 10 && oldLoyalty > 10) {
            riotTriggered = true;
            riotLevel = 'riot';
          } else if (updatedPlanet.loyalty <= 25 && oldLoyalty > 25) {
            riotTriggered = true;
            riotLevel = 'protest';
          } else if (updatedPlanet.loyalty <= 40 && oldLoyalty > 40) {
            riotTriggered = true;
            riotLevel = 'unrest';
          }
          
          logger.info(`[SpyService] Planet stats updated - Morale: ${updatedPlanet.morale}, Loyalty: ${updatedPlanet.loyalty}`);
        }
      }

      const consequences: string[] = [];
      if (actualApprovalDrop >= 10) {
        consequences.push('대규모 지지율 하락');
      }
      if (actualStabilityDrop >= 5) {
        consequences.push('사회 불안 증가');
      }
      if (actualApprovalDrop + actualStabilityDrop >= 15) {
        consequences.push('반정부 분위기 조성');
      }
      if (riotTriggered) {
        consequences.push(`${riotLevel === 'riot' ? '폭동' : riotLevel === 'protest' ? '시위' : '소요사태'} 발생!`);
      }

      this.emit('spy:agitation_success', { 
        sessionId, 
        agentId, 
        planetId,
        approvalDrop: actualApprovalDrop,
        stabilityDrop: actualStabilityDrop,
        riotTriggered,
        riotLevel
      });
      logger.info(`[SpyService] Agent ${agent.characterName} agitated citizens on ${planet.name} (approval -${actualApprovalDrop}%, stability -${actualStabilityDrop}%, riot: ${riotTriggered})`);

      return {
        success: true,
        operationType: OperationType.AGITATE,
        agentId,
        message: riotTriggered 
          ? `시민 선동에 성공! 정부 지지율 -${actualApprovalDrop}%, 안정성 -${actualStabilityDrop}%. ${riotLevel === 'riot' ? '폭동' : '시위'}가 발생했습니다!`
          : `시민 선동에 성공했습니다. 정부 지지율 -${actualApprovalDrop}%, 안정성 -${actualStabilityDrop}%`,
        discoveryRiskChange: SPY_CONSTANTS.RISK_AGITATE,
        consequences,
      };
    } else {
      return {
        success: false,
        operationType: OperationType.AGITATE,
        agentId,
        message: '선동 공작에 실패했습니다.',
        discoveryRiskChange: 25,
      };
    }
  }

  // ==================== 귀환 공작 (帰還工作) ====================

  /**
   * 본국 귀환
   */
  public async returnToHomeland(
    sessionId: string,
    agentId: string,
  ): Promise<OperationResult> {
    const agents = this.agents.get(sessionId);
    const agent = agents?.find(a => a.agentId === agentId);

    if (!agent) {
      return { success: false, operationType: OperationType.RETURN, message: '첩보관을 찾을 수 없습니다.' };
    }

    if (agent.status !== SpyStatus.INFILTRATED) {
      return { success: false, operationType: OperationType.RETURN, message: '잠입 상태에서만 귀환이 가능합니다.' };
    }

    // 귀환 성공률 (발각 위험도에 따라)
    const successRate = Math.max(30, 90 - agent.discoveryRisk);
    const success = Math.random() * 100 < successRate;

    if (success) {
      // 귀환 처리 - 수집한 정보 전송
      for (const intel of agent.intelGathered) {
        if (!intel.transmitted) {
          intel.transmitted = true;
          this.emit('spy:intel_transmitted', { sessionId, agentId, intelReport: intel });
        }
      }

      agent.status = SpyStatus.ACTIVE;
      agent.currentPlanetId = undefined;
      agent.currentFacilityId = undefined;
      agent.discoveryRisk = 0;
      agent.lastUpdated = new Date();

      this.emit('spy:returned', { sessionId, agentId });
      logger.info(`[SpyService] Agent ${agent.characterName} returned to homeland`);

      return {
        success: true,
        operationType: OperationType.RETURN,
        agentId,
        message: '안전하게 귀환했습니다. 수집한 정보가 전송되었습니다.',
      };
    } else {
      agent.status = SpyStatus.CAPTURED;
      this.emit('spy:captured', { sessionId, agentId });

      return {
        success: false,
        operationType: OperationType.RETURN,
        agentId,
        message: '귀환 중 체포되었습니다.',
        consequences: ['첩보관 체포', '수집 정보 노출'],
      };
    }
  }

  // ==================== 유틸리티 ====================

  /**
   * 발각 위험도 증가 및 체포 체크
   * 중복 코드 방지를 위한 헬퍼 함수
   * 
   * @param sessionId 세션 ID
   * @param agent 첩보관 정보
   * @param riskIncrease 증가할 위험도
   * @returns { captured: 체포 여부, newRisk: 새 위험도 }
   * 
   * 사용 예시:
   * const result = this.increaseDiscoveryRisk(sessionId, agent, SPY_CONSTANTS.RISK_SABOTAGE);
   * if (result.captured) { return captureResult; }
   */
  private increaseDiscoveryRisk(
    sessionId: string,
    agent: SpyAgent,
    riskIncrease: number
  ): { captured: boolean; newRisk: number } {
    const previousRisk = agent.discoveryRisk;
    agent.discoveryRisk = Math.min(100, agent.discoveryRisk + riskIncrease);
    agent.lastUpdated = new Date();

    logger.debug(`[SpyService] Risk increased for ${agent.characterName}: ${previousRisk} -> ${agent.discoveryRisk} (+${riskIncrease})`);

    // 체포 임계값 체크
    if (agent.discoveryRisk >= SPY_CONSTANTS.CAPTURE_THRESHOLD) {
      this.handleCapture(sessionId, agent);
      return { captured: true, newRisk: agent.discoveryRisk };
    }

    return { captured: false, newRisk: agent.discoveryRisk };
  }

  /**
   * 첩보관 체포 처리
   * 상태 변경, 이벤트 발생, 로그 기록을 일괄 처리
   * 
   * @param sessionId 세션 ID
   * @param agent 체포될 첩보관
   * 
   * 사용 예시:
   * if (agent.discoveryRisk >= 100) {
   *   this.handleCapture(sessionId, agent);
   * }
   */
  private handleCapture(sessionId: string, agent: SpyAgent): void {
    const previousStatus = agent.status;
    agent.status = SpyStatus.CAPTURED;
    agent.lastUpdated = new Date();

    // 진행 중인 모든 임무 실패 처리
    for (const mission of agent.missions) {
      if (mission.status === 'IN_PROGRESS') {
        mission.status = 'FAILED';
        mission.endDate = new Date();
        mission.result = '첩보관 체포로 인한 임무 실패';
      }
    }

    this.emit('spy:captured', {
      sessionId,
      agentId: agent.agentId,
      characterId: agent.characterId,
      characterName: agent.characterName,
      previousStatus,
      planetId: agent.currentPlanetId,
      facilityId: agent.currentFacilityId,
      intelCount: agent.intelGathered.filter(i => !i.transmitted).length,
    });

    logger.warn(`[SpyService] Agent ${agent.characterName} CAPTURED! Risk: ${agent.discoveryRisk}, Previous status: ${previousStatus}`);
  }

  /**
   * 첩보관 위험도 감소 (안전 행동 수행 시)
   * 
   * @param agent 첩보관
   * @param decrease 감소량
   * @returns 새 위험도
   */
  private decreaseDiscoveryRisk(agent: SpyAgent, decrease: number): number {
    agent.discoveryRisk = Math.max(0, agent.discoveryRisk - decrease);
    agent.lastUpdated = new Date();
    return agent.discoveryRisk;
  }

  /**
   * 적대 행성 여부 확인
   * @param planet 대상 행성
   * @param agentFaction 첩보관 소속 세력
   * @returns 적대 세력 소유 행성이면 true
   */
  private isHostilePlanet(planet: IPlanet, agentFaction: string): boolean {
    // 소유 세력이 없는 경우 (중립 행성)
    if (!planet.ownerId && !planet.controllingFaction) {
      return false;
    }

    const targetFaction = planet.controllingFaction || planet.ownerId;
    
    // 동일 세력이면 적대가 아님
    if (targetFaction === agentFaction) {
      return false;
    }

    // 진영 기반 적대 판정 (은하영웅전설: 제국 vs 동맹)
    const HOSTILE_FACTIONS: Record<string, string[]> = {
      'empire': ['alliance', 'free_planets', 'rebel'],
      'alliance': ['empire', 'galactic_empire'],
      'galactic_empire': ['alliance', 'free_planets', 'rebel'],
      'free_planets': ['empire', 'galactic_empire'],
    };

    const hostiles = HOSTILE_FACTIONS[agentFaction.toLowerCase()] || [];
    if (hostiles.some(h => targetFaction?.toLowerCase().includes(h))) {
      return true;
    }

    // 기본적으로 다른 세력은 적대로 간주
    return targetFaction !== agentFaction;
  }

  private getAgentByCharacter(sessionId: string, characterId: string): SpyAgent | undefined {
    return this.agents.get(sessionId)?.find(a => a.characterId === characterId);
  }

  private generateIntelTitle(type: IntelReport['type']): string {
    const titles: Record<IntelReport['type'], string> = {
      MILITARY: '군사 배치 보고서',
      POLITICAL: '정치 동향 보고서',
      ECONOMIC: '경제 현황 보고서',
      PERSONNEL: '인사 정보 보고서',
      COUP_SIGN: '쿠데타 조짐 보고서',
    };
    return titles[type];
  }

  private generateIntelContent(type: IntelReport['type'], planetId: string): string {
    // 실제로는 해당 행성의 상태에 따라 동적 생성
    const contents: Record<IntelReport['type'], string> = {
      MILITARY: `${planetId} 행성의 군사 배치 현황과 함대 이동 정보`,
      POLITICAL: `${planetId} 행성의 정치 상황 및 주요 인물 동향`,
      ECONOMIC: `${planetId} 행성의 경제 지표 및 자원 현황`,
      PERSONNEL: `${planetId} 행성의 주요 인물 신상 정보`,
      COUP_SIGN: `${planetId} 행성에서 감지된 반정부 활동 징후`,
    };
    return contents[type];
  }

  private calculateIntelImportance(type: IntelReport['type']): IntelReport['importance'] {
    const baseImportance: Record<IntelReport['type'], IntelReport['importance']> = {
      MILITARY: 'HIGH',
      POLITICAL: 'MEDIUM',
      ECONOMIC: 'LOW',
      PERSONNEL: 'MEDIUM',
      COUP_SIGN: 'CRITICAL',
    };
    return baseImportance[type];
  }

  /**
   * 매 틱마다 발각 위험도 체크
   */
  public processGameTick(sessionId: string): void {
    const agents = this.agents.get(sessionId);
    if (!agents) return;

    for (const agent of agents) {
      if (agent.status === SpyStatus.INFILTRATED) {
        // 시간이 지남에 따라 발각 위험도 증가
        agent.discoveryRisk += 1;

        // 발각 체크
        if (Math.random() * 100 < agent.discoveryRisk) {
          agent.status = SpyStatus.CAPTURED;
          this.emit('spy:captured', { sessionId, agentId: agent.agentId });
          logger.warn(`[SpyService] Agent ${agent.characterName} was discovered and captured`);
        }
      }
    }
  }

  // ==================== 조회 ====================

  public getAgent(sessionId: string, agentId: string): SpyAgent | undefined {
    return this.agents.get(sessionId)?.find(a => a.agentId === agentId);
  }

  public getAgentsByFaction(sessionId: string, faction: string): SpyAgent[] {
    return (this.agents.get(sessionId) || []).filter(a => a.faction === faction);
  }

  public getIntelReportsByFaction(sessionId: string, faction: string): IntelReport[] {
    const agents = this.getAgentsByFaction(sessionId, faction);
    const agentIds = agents.map(a => a.agentId);
    return (this.intelReports.get(sessionId) || []).filter(r => agentIds.includes(r.agentId));
  }

  // ============================================================
  // Command wrapper methods for IntelligenceCommandService
  // These delegate to existing methods or provide stubs
  // ============================================================

  /**
   * 査閲 (사열) 커맨드 - inspectForCoup 래퍼
   */
  public async inspectionCommand(
    sessionId: string,
    characterId: string,
    paramsOrTargetId: Record<string, any> | string
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const targetId = typeof paramsOrTargetId === 'string' ? paramsOrTargetId : paramsOrTargetId?.targetId;
      const result = await this.inspectForCoup(sessionId, characterId, targetId);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 襲撃 (습격) 커맨드 - attemptAssault 래퍼
   */
  public async raidCommand(
    sessionId: string,
    characterId: string,
    paramsOrTargetId: Record<string, any> | string
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const targetId = typeof paramsOrTargetId === 'string' ? paramsOrTargetId : paramsOrTargetId?.targetId;
      const result = await this.attemptAssault(sessionId, characterId, targetId);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 監視 (감시) 커맨드 - startMonitoring 래퍼
   */
  public async surveillanceCommand(
    sessionId: string,
    characterId: string,
    paramsOrTargetId: Record<string, any> | string
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const targetId = typeof paramsOrTargetId === 'string' ? paramsOrTargetId : paramsOrTargetId?.targetId;
      const result = await this.startMonitoring(sessionId, characterId, targetId);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 潜入工作 (침투 공작) 커맨드 - infiltrateFacility 래퍼
   */
  public async infiltrationCommand(
    sessionId: string,
    characterId: string,
    paramsOrFacilityId: Record<string, any> | string
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const params = typeof paramsOrFacilityId === 'string' 
        ? { facilityId: paramsOrFacilityId } 
        : paramsOrFacilityId;
      const result = await this.infiltrateFacility(
        sessionId, 
        characterId, 
        params?.planetId || '', 
        params?.facilityId || ''
      );
      return { success: result.success, error: result.message, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 帰還工作 (귀환 공작) 커맨드 - returnToHomeland 래퍼
   */
  public async returnOperationCommand(
    sessionId: string,
    characterId: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const result = await this.returnToHomeland(sessionId, characterId);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 情報工作 (정보 공작) 커맨드 - gatherIntelligence 래퍼
   */
  public async informationOperationCommand(
    sessionId: string,
    characterId: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const result = await this.gatherIntelligence(sessionId, characterId, params.facilityId);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 破壊工作 (파괴 공작) 커맨드 - sabotage 래퍼
   */
  public async sabotageCommand(
    sessionId: string,
    characterId: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      const result = await this.sabotage(sessionId, characterId, params.targetFacilityId || params.targetId);
      return { success: result.success, error: result.message, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 煽動工作 (선동 공작) 커맨드 - agitate 래퍼
   */
  public async agitationCommand(
    sessionId: string,
    characterId: string,
    paramsOrPlanetId?: Record<string, any> | string
  ): Promise<{ success: boolean; error?: string; result?: any }> {
    try {
      // agitate는 2개 인자만 받음 (sessionId, agentId)
      const result = await this.agitate(sessionId, characterId);
      return { success: result.success, error: result.message, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const spyService = SpyService.getInstance();
export default SpyService;

