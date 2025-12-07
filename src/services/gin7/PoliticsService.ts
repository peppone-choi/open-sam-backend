import mongoose from 'mongoose';
import { 
  GovernmentStructure, 
  IGovernmentStructure, 
  GovernmentType, 
  PositionType,
  AuthorityType,
  IPositionHolder,
  INobilityTitle,
  IElection,
  IImpeachment,
  IDecree,
  createEmpirePositions,
  createAlliancePositions
} from '../../models/gin7/GovernmentStructure';
import { Gin7Error } from '../../common/errors/gin7-errors';

/**
 * 임명 결과
 */
export interface IAppointmentResult {
  success: boolean;
  positionId?: string;
  positionName?: string;
  error?: string;
}

/**
 * 선거 결과
 */
export interface IElectionResult {
  success: boolean;
  electionId?: string;
  winnerId?: string;
  winnerName?: string;
  totalVotes?: number;
  error?: string;
}

/**
 * 투표 결과
 */
export interface IVoteResult {
  success: boolean;
  message?: string;
  currentVotes?: number;
  error?: string;
}

/**
 * PoliticsService
 * 정부 구조 및 정치 시스템 관리
 */
export class PoliticsService {
  /**
   * 정부 구조 조회
   */
  static async getGovernment(
    sessionId: string,
    factionId: string
  ): Promise<IGovernmentStructure | null> {
    return GovernmentStructure.findOne({ sessionId, factionId });
  }

  /**
   * 정부 구조 생성
   */
  static async createGovernment(
    sessionId: string,
    factionId: string,
    factionName: string,
    governmentType: GovernmentType,
    governmentName: string
  ): Promise<IGovernmentStructure> {
    const governmentId = `GOV-${factionId}-${Date.now()}`;

    // 정부 유형에 따른 기본 직책 구조
    let positions: IPositionHolder[];
    let config: IGovernmentStructure['config'];

    switch (governmentType) {
      case 'empire':
        positions = createEmpirePositions();
        config = {
          allowElection: false,
          allowImpeachment: false,  // 황제 탄핵 불가
          allowNobility: true,
          minRankForVote: 'general',
          impeachmentThreshold: 75,
          termLength: 0  // 무기한
        };
        break;

      case 'alliance':
        positions = createAlliancePositions(365);
        config = {
          allowElection: true,
          allowImpeachment: true,
          allowNobility: false,
          minRankForVote: 'lieutenant',
          impeachmentThreshold: 66,
          termLength: 365
        };
        break;

      case 'republic':
        positions = createAlliancePositions(180);
        config = {
          allowElection: true,
          allowImpeachment: true,
          allowNobility: false,
          minRankForVote: 'ensign',
          impeachmentThreshold: 60,
          termLength: 180
        };
        break;

      case 'kingdom':
      default:
        positions = createEmpirePositions();
        config = {
          allowElection: false,
          allowImpeachment: true,
          allowNobility: true,
          minRankForVote: 'captain',
          impeachmentThreshold: 80,
          termLength: 0
        };
        break;
    }

    const government = new GovernmentStructure({
      governmentId,
      sessionId,
      factionId,
      factionName,
      governmentType,
      governmentName,
      positions,
      config,
      foundedAt: new Date(),
      lastUpdated: new Date()
    });

    await government.save();
    return government;
  }

  /**
   * 직책에 임명
   */
  static async appointToPosition(
    sessionId: string,
    factionId: string,
    positionId: string,
    characterId: string,
    characterName: string,
    appointedBy: string
  ): Promise<IAppointmentResult> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    // 권한 확인 (임명권자가 인사권을 가지고 있는지)
    if (!government.hasAuthority(appointedBy, 'personnel') && 
        !government.hasAuthority(appointedBy, 'all')) {
      // 황제/의장은 항상 임명 가능
      const isTopLeader = government.positions.some(
        (p: IPositionHolder) => 
          p.holderId === appointedBy && 
          ['emperor', 'council_chair'].includes(p.positionType)
      );
      if (!isTopLeader) {
        return { success: false, error: 'Insufficient authority to make appointments' };
      }
    }

    const position = government.positions.find((p: IPositionHolder) => p.positionId === positionId);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    // 이미 누군가 있는지 확인
    if (!position.isVacant && position.holderId !== characterId) {
      return { success: false, error: 'Position is already occupied' };
    }

    // 임명 처리
    government.appointToPosition(positionId, characterId, characterName, appointedBy);
    government.lastUpdated = new Date();
    await government.save();

    return {
      success: true,
      positionId,
      positionName: position.positionName
    };
  }

  /**
   * 직책에서 해임
   */
  static async removeFromPosition(
    sessionId: string,
    factionId: string,
    positionId: string,
    removedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    // 권한 확인
    if (!government.hasAuthority(removedBy, 'personnel') && 
        !government.hasAuthority(removedBy, 'all')) {
      return { success: false, error: 'Insufficient authority to remove from position' };
    }

    const position = government.positions.find((p: IPositionHolder) => p.positionId === positionId);
    if (!position) {
      return { success: false, error: 'Position not found' };
    }

    // 황제는 해임 불가 (탄핵만 가능)
    if (position.positionType === 'emperor') {
      return { success: false, error: 'Cannot remove emperor from position' };
    }

    government.removeFromPosition(positionId);
    government.lastUpdated = new Date();
    await government.save();

    return { success: true };
  }

  /**
   * 작위 수여
   */
  static async grantNobilityTitle(
    sessionId: string,
    factionId: string,
    titleType: PositionType,
    titleName: string,
    characterId: string,
    characterName: string,
    grantedBy: string,
    fiefdoms: string[] = []
  ): Promise<{ success: boolean; titleId?: string; error?: string }> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    if (!government.config.allowNobility) {
      return { success: false, error: 'This government type does not support nobility' };
    }

    // 권한 확인 (황제만 작위 수여 가능)
    const isEmperor = government.positions.some(
      (p: IPositionHolder) => p.holderId === grantedBy && p.positionType === 'emperor'
    );
    if (!isEmperor) {
      return { success: false, error: 'Only the emperor can grant nobility titles' };
    }

    // 작위별 수입 계산
    const incomeByTitle: Record<string, number> = {
      duke: 50000,
      marquis: 30000,
      count: 15000,
      viscount: 8000,
      baron: 3000
    };

    const titleId = `TITLE-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const newTitle: INobilityTitle = {
      titleId,
      titleType: titleType as INobilityTitle['titleType'],
      titleName,
      holderId: characterId,
      holderName: characterName,
      grantedAt: new Date(),
      grantedBy,
      fiefdoms,
      annualIncome: incomeByTitle[titleType] || 5000,
      privileges: [],
      isHereditary: true
    };

    government.nobilityTitles.push(newTitle);
    government.lastUpdated = new Date();
    await government.save();

    return { success: true, titleId };
  }

  /**
   * 선거 시작
   */
  static async startElection(
    sessionId: string,
    factionId: string,
    electionType: IElection['electionType'],
    title: string,
    description?: string,
    registrationDays: number = 7,
    votingDays: number = 7
  ): Promise<{ success: boolean; electionId?: string; error?: string }> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    if (!government.config.allowElection) {
      return { success: false, error: 'Elections are not allowed in this government type' };
    }

    // 이미 진행 중인 선거가 있는지 확인
    if (government.currentElection && 
        ['registration', 'voting', 'counting'].includes(government.currentElection.status)) {
      return { success: false, error: 'An election is already in progress' };
    }

    const now = new Date();
    const electionId = `ELEC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const election: IElection = {
      electionId,
      electionType,
      title,
      description,
      candidates: [],
      status: 'registration',
      registrationStart: now,
      registrationEnd: new Date(now.getTime() + registrationDays * 24 * 60 * 60 * 1000),
      votingStart: new Date(now.getTime() + registrationDays * 24 * 60 * 60 * 1000),
      votingEnd: new Date(now.getTime() + (registrationDays + votingDays) * 24 * 60 * 60 * 1000),
      totalVotes: 0,
      quorum: 0,
      votedBy: []
    };

    government.currentElection = election;
    government.elections.push(election);
    government.lastUpdated = new Date();
    await government.save();

    return { success: true, electionId };
  }

  /**
   * 후보 등록
   */
  static async registerCandidate(
    sessionId: string,
    factionId: string,
    electionId: string,
    characterId: string,
    characterName: string,
    platform?: string
  ): Promise<{ success: boolean; error?: string }> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government || !government.currentElection) {
      return { success: false, error: 'No active election found' };
    }

    if (government.currentElection.electionId !== electionId) {
      return { success: false, error: 'Election ID mismatch' };
    }

    if (government.currentElection.status !== 'registration') {
      return { success: false, error: 'Registration period has ended' };
    }

    // 이미 등록했는지 확인
    const alreadyRegistered = government.currentElection.candidates.some(
      c => c.characterId === characterId
    );
    if (alreadyRegistered) {
      return { success: false, error: 'Already registered as a candidate' };
    }

    government.currentElection.candidates.push({
      characterId,
      characterName,
      platform,
      votes: 0
    });

    government.lastUpdated = new Date();
    await government.save();

    return { success: true };
  }

  /**
   * 투표
   */
  static async castVote(
    sessionId: string,
    factionId: string,
    electionId: string,
    voterId: string,
    candidateId: string
  ): Promise<IVoteResult> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government || !government.currentElection) {
      return { success: false, error: 'No active election found' };
    }

    if (government.currentElection.electionId !== electionId) {
      return { success: false, error: 'Election ID mismatch' };
    }

    if (government.currentElection.status !== 'voting') {
      return { success: false, error: 'Voting period is not active' };
    }

    // 이미 투표했는지 확인
    if (government.currentElection.votedBy.includes(voterId)) {
      return { success: false, error: 'Already voted in this election' };
    }

    // 후보 찾기
    const candidate = government.currentElection.candidates.find(
      c => c.characterId === candidateId
    );
    if (!candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    // 투표 처리
    candidate.votes++;
    government.currentElection.totalVotes++;
    government.currentElection.votedBy.push(voterId);
    
    government.lastUpdated = new Date();
    await government.save();

    return { 
      success: true, 
      message: `Voted for ${candidate.characterName}`,
      currentVotes: candidate.votes
    };
  }

  /**
   * 선거 결과 집계
   */
  static async finalizeElection(
    sessionId: string,
    factionId: string,
    electionId: string
  ): Promise<IElectionResult> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government || !government.currentElection) {
      return { success: false, error: 'No active election found' };
    }

    if (government.currentElection.electionId !== electionId) {
      return { success: false, error: 'Election ID mismatch' };
    }

    // 투표 종료 확인
    if (government.currentElection.status !== 'voting' && 
        new Date() < government.currentElection.votingEnd) {
      return { success: false, error: 'Voting period has not ended yet' };
    }

    government.currentElection.status = 'counting';

    // 최다 득표 후보 찾기
    const candidates = government.currentElection.candidates;
    if (candidates.length === 0) {
      government.currentElection.status = 'cancelled';
      government.lastUpdated = new Date();
      await government.save();
      return { success: false, error: 'No candidates registered' };
    }

    candidates.sort((a, b) => b.votes - a.votes);
    const winner = candidates[0];

    government.currentElection.winnerId = winner.characterId;
    government.currentElection.winnerName = winner.characterName;
    government.currentElection.status = 'completed';

    // 의장 선거인 경우 직책 자동 임명
    if (government.currentElection.electionType === 'council_chair') {
      government.appointToPosition(
        'council_chair',
        winner.characterId,
        winner.characterName,
        'ELECTION_SYSTEM'
      );
    }

    // 다음 선거 일정 설정
    if (government.config.termLength > 0) {
      government.nextElectionDate = new Date(
        Date.now() + government.config.termLength * 24 * 60 * 60 * 1000
      );
    }

    government.lastUpdated = new Date();
    await government.save();

    return {
      success: true,
      electionId,
      winnerId: winner.characterId,
      winnerName: winner.characterName,
      totalVotes: government.currentElection.totalVotes
    };
  }

  /**
   * 탄핵 발의
   */
  static async initiateImpeachment(
    sessionId: string,
    factionId: string,
    targetId: string,
    targetName: string,
    targetPosition: PositionType,
    charges: string[],
    initiatedBy: string,
    deadlineDays: number = 14
  ): Promise<{ success: boolean; impeachmentId?: string; error?: string }> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    if (!government.config.allowImpeachment) {
      return { success: false, error: 'Impeachment is not allowed in this government type' };
    }

    // 황제 탄핵은 불가능 (제국의 경우)
    if (targetPosition === 'emperor') {
      return { success: false, error: 'The emperor cannot be impeached' };
    }

    // 이미 진행 중인 탄핵이 있는지 확인
    const existingImpeachment = government.impeachments.find(
      imp => imp.targetId === targetId && imp.status === 'voting'
    );
    if (existingImpeachment) {
      return { success: false, error: 'An impeachment against this person is already in progress' };
    }

    const impeachmentId = `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const impeachment: IImpeachment = {
      impeachmentId,
      targetId,
      targetName,
      targetPosition,
      charges,
      initiatedBy,
      initiatedAt: new Date(),
      supportVotes: 1,  // 발의자의 찬성 투표
      opposeVotes: 0,
      votedBy: [initiatedBy],
      status: 'voting',
      requiredMajority: government.config.impeachmentThreshold,
      deadline: new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000)
    };

    government.impeachments.push(impeachment);
    government.lastUpdated = new Date();
    await government.save();

    return { success: true, impeachmentId };
  }

  /**
   * 탄핵 투표
   */
  static async voteOnImpeachment(
    sessionId: string,
    factionId: string,
    impeachmentId: string,
    voterId: string,
    support: boolean
  ): Promise<IVoteResult> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    const impeachment = government.impeachments.find(
      imp => imp.impeachmentId === impeachmentId
    );

    if (!impeachment) {
      return { success: false, error: 'Impeachment not found' };
    }

    if (impeachment.status !== 'voting') {
      return { success: false, error: 'Voting is not active for this impeachment' };
    }

    if (impeachment.votedBy.includes(voterId)) {
      return { success: false, error: 'Already voted on this impeachment' };
    }

    // 투표 처리
    if (support) {
      impeachment.supportVotes++;
    } else {
      impeachment.opposeVotes++;
    }
    impeachment.votedBy.push(voterId);

    // 결과 확인
    const totalVotes = impeachment.supportVotes + impeachment.opposeVotes;
    const supportPercentage = (impeachment.supportVotes / totalVotes) * 100;

    if (supportPercentage >= impeachment.requiredMajority) {
      // 탄핵 통과
      impeachment.status = 'passed';
      government.removeFromPosition(impeachment.targetPosition);
    } else if (new Date() >= impeachment.deadline || 
               (100 - supportPercentage) > (100 - impeachment.requiredMajority)) {
      // 탄핵 기각
      impeachment.status = 'rejected';
    }

    government.lastUpdated = new Date();
    await government.save();

    return {
      success: true,
      message: support ? 'Vote for impeachment recorded' : 'Vote against impeachment recorded',
      currentVotes: impeachment.supportVotes
    };
  }

  /**
   * 칙령/법령 발포
   */
  static async issueDecree(
    sessionId: string,
    factionId: string,
    issuerId: string,
    issuerName: string,
    decreeType: IDecree['decreeType'],
    title: string,
    content: string,
    effects: IDecree['effects'],
    durationDays?: number
  ): Promise<{ success: boolean; decreeId?: string; error?: string }> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    // 권한 확인
    const canIssueDecree = 
      government.hasAuthority(issuerId, 'legislation') ||
      government.hasAuthority(issuerId, 'all');

    if (!canIssueDecree) {
      return { success: false, error: 'Insufficient authority to issue decrees' };
    }

    const decreeId = `DEC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const decree: IDecree = {
      decreeId,
      decreeType,
      title,
      content,
      issuedBy: issuerId,
      issuedByName: issuerName,
      issuedAt: new Date(),
      effectiveFrom: new Date(),
      expiresAt: durationDays 
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
        : undefined,
      effects,
      isActive: true
    };

    government.decrees.push(decree);
    government.lastUpdated = new Date();
    await government.save();

    return { success: true, decreeId };
  }

  /**
   * 칙령 철회
   */
  static async revokeDecree(
    sessionId: string,
    factionId: string,
    decreeId: string,
    revokedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return { success: false, error: 'Government structure not found' };
    }

    const decree = government.decrees.find(d => d.decreeId === decreeId);
    if (!decree) {
      return { success: false, error: 'Decree not found' };
    }

    // 권한 확인
    const canRevoke = 
      government.hasAuthority(revokedBy, 'veto') ||
      government.hasAuthority(revokedBy, 'all') ||
      decree.issuedBy === revokedBy;

    if (!canRevoke) {
      return { success: false, error: 'Insufficient authority to revoke decrees' };
    }

    decree.isActive = false;
    decree.revokedAt = new Date();
    decree.revokedBy = revokedBy;

    government.lastUpdated = new Date();
    await government.save();

    return { success: true };
  }

  /**
   * 활성 칙령 목록 조회
   */
  static async getActiveDecrees(
    sessionId: string,
    factionId: string
  ): Promise<IDecree[]> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return [];
    }

    const now = new Date();
    return government.decrees.filter(
      d => d.isActive && (!d.expiresAt || d.expiresAt > now)
    );
  }

  /**
   * 정치 요약 정보
   */
  static async getPoliticalSummary(
    sessionId: string,
    factionId: string
  ): Promise<{
    governmentType: GovernmentType;
    governmentName: string;
    filledPositions: number;
    totalPositions: number;
    activeElection?: {
      title: string;
      status: string;
      candidateCount: number;
    };
    activeImpeachments: number;
    activeDecrees: number;
    nobilityCount: number;
  } | null> {
    const government = await GovernmentStructure.findOne({ sessionId, factionId });

    if (!government) {
      return null;
    }

    const filledPositions = government.positions.filter((p: IPositionHolder) => !p.isVacant).length;
    const now = new Date();
    const activeDecrees = government.decrees.filter(
      d => d.isActive && (!d.expiresAt || d.expiresAt > now)
    ).length;
    const activeImpeachments = government.impeachments.filter(
      imp => imp.status === 'voting'
    ).length;

    return {
      governmentType: government.governmentType,
      governmentName: government.governmentName,
      filledPositions,
      totalPositions: government.positions.length,
      activeElection: government.currentElection && 
        ['registration', 'voting'].includes(government.currentElection.status)
        ? {
            title: government.currentElection.title,
            status: government.currentElection.status,
            candidateCount: government.currentElection.candidates.length
          }
        : undefined,
      activeImpeachments,
      activeDecrees,
      nobilityCount: government.nobilityTitles.length
    };
  }

  /**
   * 선거 상태 자동 업데이트 (일일 처리)
   */
  static async processDailyElectionUpdate(sessionId: string): Promise<void> {
    const governments = await GovernmentStructure.find({ sessionId });
    const now = new Date();

    for (const government of governments) {
      if (!government.currentElection) continue;

      // 등록 기간 종료 -> 투표 시작
      if (government.currentElection.status === 'registration' &&
          now >= government.currentElection.registrationEnd) {
        
        if (government.currentElection.candidates.length < 2) {
          government.currentElection.status = 'cancelled';
        } else {
          government.currentElection.status = 'voting';
        }
        government.lastUpdated = now;
        await government.save();
      }
      // 투표 기간 종료 -> 집계
      else if (government.currentElection.status === 'voting' &&
               now >= government.currentElection.votingEnd) {
        await this.finalizeElection(
          sessionId,
          government.factionId,
          government.currentElection.electionId
        );
      }

      // 탄핵 기한 체크
      for (const imp of government.impeachments) {
        if (imp.status === 'voting' && now >= imp.deadline) {
          const totalVotes = imp.supportVotes + imp.opposeVotes;
          const supportPercentage = totalVotes > 0 
            ? (imp.supportVotes / totalVotes) * 100 
            : 0;

          if (supportPercentage >= imp.requiredMajority) {
            imp.status = 'passed';
            government.removeFromPosition(imp.targetPosition);
          } else {
            imp.status = 'rejected';
          }
          government.lastUpdated = now;
          await government.save();
        }
      }
    }
  }
}

export default PoliticsService;

