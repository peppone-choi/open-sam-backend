/**
 * CoupService - 쿠데타/반란 시스템 서비스
 * 
 * 은하영웅전설에서 쿠데타는 핵심적인 정치 이벤트:
 * - 립슈타트 전역 (귀족 반란) - 귀족들의 라인하르트 타도 시도
 * - 구국군사회의 쿠데타 (동맹) - 군부의 민주주의 정부 전복 시도
 * 
 * ConspiracyService와 연계하여 동작
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  CoupType, 
  CoupStatus, 
  CoupFeasibility, 
  ExecuteCoupParams, 
  CoupResult,
  SuppressCoupParams,
  SuppressionResult,
  RegimeChangeParams,
  CoupDocument,
  CoupFaction
} from '../../types/gin7/coup.types';
import { Gin7Conspiracy, IGin7Conspiracy } from '../../models/gin7/Conspiracy';
import { GovernmentStructure, IGovernmentStructure } from '../../models/gin7/GovernmentStructure';
import { Gin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { FleetService } from './FleetService';
import { PoliticsService } from './PoliticsService';
import ConspiracyService from './ConspiracyService';
import mongoose from 'mongoose';

// ============================================================================
// Coup Document Model
// ============================================================================

const CoupSchema = new mongoose.Schema<CoupDocument>({
  coupId: { type: String, required: true },
  sessionId: { type: String, required: true },
  coupType: { 
    type: String, 
    enum: ['military', 'noble_revolt', 'palace_coup', 'popular_uprising', 'secession'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['planning', 'mobilizing', 'executing', 'success', 'failed', 'suppressed'],
    default: 'planning'
  },
  targetFactionId: { type: String, required: true },
  targetGovernmentId: { type: String, required: true },
  coupFaction: { type: mongoose.Schema.Types.Mixed, required: true },
  plannedAt: { type: Date, default: Date.now },
  executedAt: { type: Date },
  resolvedAt: { type: Date },
  result: { type: mongoose.Schema.Types.Mixed },
  triggeredByEventId: { type: String },
  scenarioFlags: [{ type: String }],
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

CoupSchema.index({ coupId: 1, sessionId: 1 }, { unique: true });
CoupSchema.index({ sessionId: 1, targetFactionId: 1, status: 1 });

const Coup = mongoose.models.Coup || mongoose.model<CoupDocument>('Coup', CoupSchema);

// ============================================================================
// CoupService Class
// ============================================================================

export class CoupService {
  // 쿠데타 성공에 필요한 최소 요건
  private static readonly MIN_MILITARY_RATIO = 0.3;      // 정부군 대비 30% 이상
  private static readonly MIN_POLITICAL_SUPPORT = 20;     // 정치 지지율 20% 이상
  private static readonly MIN_PUBLIC_SUPPORT = 10;        // 여론 지지율 10% 이상
  
  // 가중치
  private static readonly WEIGHT_MILITARY = 0.4;
  private static readonly WEIGHT_CAPITAL = 0.25;
  private static readonly WEIGHT_POLITICAL = 0.2;
  private static readonly WEIGHT_PUBLIC = 0.15;

  /**
   * 쿠데타 가능 여부 체크
   * 
   * @param sessionId 세션 ID
   * @param conspirators 공모자 캐릭터 ID 목록
   * @returns 쿠데타 가능성 분석 결과
   */
  async canAttemptCoup(
    sessionId: string, 
    conspirators: string[]
  ): Promise<CoupFeasibility> {
    // 1. 공모자 정보 수집
    const characters = await Gin7Character.find({
      sessionId,
      characterId: { $in: conspirators }
    });

    if (characters.length === 0) {
      return this.createFailedFeasibility('공모자를 찾을 수 없습니다.');
    }

    // 2. 대상 세력 확인 (공모자들의 현재 소속 세력)
    const targetFactionId = characters[0].data?.factionId;
    if (!targetFactionId) {
      return this.createFailedFeasibility('대상 세력을 확인할 수 없습니다.');
    }

    // 3. 현 정부 정보 조회
    const government = await PoliticsService.getGovernment(sessionId, targetFactionId);
    if (!government) {
      return this.createFailedFeasibility('정부 구조를 찾을 수 없습니다.');
    }

    // 4. 군사력 분석
    const militaryAnalysis = await this.analyzeMilitaryStrength(
      sessionId, 
      targetFactionId, 
      conspirators
    );

    // 5. 수도 장악 가능성 분석
    const capitalAnalysis = await this.analyzeCapitalControl(
      sessionId,
      targetFactionId,
      conspirators
    );

    // 6. 정치적 지지 분석
    const politicalAnalysis = await this.analyzePoliticalSupport(
      sessionId,
      targetFactionId,
      conspirators,
      government
    );

    // 7. 여론/민심 분석
    const publicAnalysis = await this.analyzePublicOpinion(
      sessionId,
      targetFactionId,
      government
    );

    // 8. 외세 개입 가능성 분석
    const foreignAnalysis = await this.analyzeForeignIntervention(
      sessionId,
      targetFactionId
    );

    // 9. 종합 점수 계산
    const overallScore = 
      militaryAnalysis.score * CoupService.WEIGHT_MILITARY +
      capitalAnalysis.score * CoupService.WEIGHT_CAPITAL +
      politicalAnalysis.score * CoupService.WEIGHT_POLITICAL +
      publicAnalysis.score * CoupService.WEIGHT_PUBLIC -
      foreignAnalysis.score * 0.1;  // 외세 개입은 감점

    const overallChance = Math.max(0, Math.min(100, overallScore));

    // 10. 최소 조건 충족 여부
    const canAttempt = 
      militaryAnalysis.met &&
      (capitalAnalysis.met || politicalAnalysis.met) &&
      foreignAnalysis.riskLevel !== 'certain';

    // 11. 권고사항 생성
    const recommendations = this.generateRecommendations(
      militaryAnalysis,
      capitalAnalysis,
      politicalAnalysis,
      publicAnalysis,
      foreignAnalysis
    );

    return {
      canAttempt,
      overallChance,
      conditions: {
        military: militaryAnalysis,
        capitalControl: capitalAnalysis,
        politicalSupport: politicalAnalysis,
        publicOpinion: publicAnalysis,
        foreignIntervention: foreignAnalysis
      },
      failureConsequences: {
        leaderPunishment: overallChance < 30 ? 'execution' : 
                          overallChance < 50 ? 'imprisonment' : 'exile',
        supporterPunishment: overallChance < 30 ? 'imprisonment' : 'demotion',
        estimatedCasualties: Math.floor(militaryAnalysis.currentStrength * (100 - overallChance) / 100)
      },
      recommendations
    };
  }

  /**
   * 쿠데타 실행
   */
  async executeCoup(params: ExecuteCoupParams): Promise<CoupResult> {
    const { 
      sessionId, 
      leaderId, 
      targetGovernmentId, 
      targetFactionId,
      coupType,
      conspirators,
      fleetIds,
      options 
    } = params;

    // 1. 가능 여부 재확인
    const feasibility = await this.canAttemptCoup(sessionId, [leaderId, ...conspirators]);
    
    // 2. 쿠데타 문서 생성
    const coupId = `COUP-${uuidv4().slice(0, 8)}`;
    const coupFaction = await this.buildCoupFaction(
      sessionId, 
      leaderId, 
      conspirators, 
      fleetIds
    );

    const coup = new Coup({
      coupId,
      sessionId,
      coupType,
      status: 'executing',
      targetFactionId,
      targetGovernmentId,
      coupFaction,
      plannedAt: new Date(),
      executedAt: new Date()
    });

    await coup.save();

    // 3. 쿠데타 성공 여부 결정
    const successRoll = Math.random() * 100;
    const isSuccess = successRoll < feasibility.overallChance;

    // 4. 전투 시뮬레이션 (군사적 충돌이 있는 경우)
    const battleResults = await this.simulateCoupBattle(
      sessionId,
      coupFaction,
      targetFactionId,
      isSuccess
    );

    // 5. 결과 처리
    let result: CoupResult;
    
    if (isSuccess) {
      result = await this.handleCoupSuccess(
        sessionId,
        coupId,
        coupFaction,
        targetFactionId,
        targetGovernmentId,
        coupType,
        battleResults,
        options
      );
      coup.status = 'success';
    } else {
      result = await this.handleCoupFailure(
        sessionId,
        coupId,
        coupFaction,
        targetFactionId,
        battleResults
      );
      coup.status = 'failed';
    }

    coup.result = result;
    coup.resolvedAt = new Date();
    await coup.save();

    return result;
  }

  /**
   * 쿠데타 진압
   */
  async suppressCoup(params: SuppressCoupParams): Promise<SuppressionResult> {
    const {
      sessionId,
      coupId,
      governmentLeaderId,
      loyalistFleetIds,
      loyalistCharacterIds,
      options
    } = params;

    // 1. 쿠데타 정보 조회
    const coup = await Coup.findOne({ sessionId, coupId, status: 'executing' });
    if (!coup) {
      throw new Error('진행 중인 쿠데타를 찾을 수 없습니다.');
    }

    // 2. 진압군 군사력 계산
    const loyalistStrength = await this.calculateMilitaryStrength(sessionId, loyalistFleetIds);
    const coupStrength = coup.coupFaction.militaryStrength;

    // 3. 진압 성공 확률 계산
    let suppressionChance = (loyalistStrength / (loyalistStrength + coupStrength)) * 100;
    
    // 협상 옵션 효과
    if (options?.negotiateTerms) {
      suppressionChance += 10;
    }
    if (options?.offerAmnesty) {
      suppressionChance += 15;  // 사면 제안은 투항 유도
    }
    if (options?.foreignAid) {
      suppressionChance += 20;  // 외세 개입
    }

    // 4. 진압 시도
    const suppressionRoll = Math.random() * 100;
    let outcome: SuppressionResult['outcome'];
    
    if (suppressionRoll < suppressionChance) {
      if (options?.negotiateTerms && suppressionRoll < suppressionChance * 0.7) {
        outcome = 'negotiated';
      } else {
        outcome = 'suppressed';
      }
    } else if (suppressionRoll > suppressionChance + 20) {
      outcome = 'failed';
    } else {
      outcome = 'stalemate';
    }

    // 5. 사상자 계산
    const casualties = {
      governmentForces: outcome === 'negotiated' ? 
        Math.floor(loyalistStrength * 0.05) : 
        Math.floor(loyalistStrength * 0.2),
      coupForces: outcome === 'failed' ? 
        Math.floor(coupStrength * 0.1) : 
        Math.floor(coupStrength * 0.4),
      civilians: options?.useForce ? 
        Math.floor(Math.random() * 1000) : 
        Math.floor(Math.random() * 100)
    };

    // 6. 처분 결정
    const coupLeaderFate = this.determineFate(outcome, 'leader', options?.offerAmnesty);
    const participantFates = coup.coupFaction.supporterIds.map(id => ({
      characterId: id,
      fate: this.determineFate(outcome, 'supporter', options?.offerAmnesty)
    }));

    // 7. 후속 효과
    const aftermath = {
      governmentStabilityChange: outcome === 'suppressed' ? 10 : 
                                  outcome === 'negotiated' ? 5 : -20,
      publicOrderChange: -15 + (outcome === 'negotiated' ? 10 : 0),
      loyalistRewards: outcome !== 'failed' ? 
        loyalistCharacterIds.slice(0, 5).map(id => ({
          characterId: id,
          reward: 'promotion' as const
        })) : undefined
    };

    // 8. 쿠데타 상태 업데이트
    if (outcome === 'suppressed' || outcome === 'negotiated') {
      coup.status = 'suppressed';
      coup.resolvedAt = new Date();
      await coup.save();

      // 캐릭터 처분 적용
      await this.applyFates(sessionId, coup.coupFaction.leaderId, coupLeaderFate);
      for (const pf of participantFates) {
        await this.applyFates(sessionId, pf.characterId, pf.fate);
      }
    }

    return {
      success: outcome === 'suppressed' || outcome === 'negotiated',
      outcome,
      casualties,
      coupLeaderFate,
      participantFates,
      aftermath
    };
  }

  /**
   * 정권 교체 처리
   */
  async handleRegimeChange(params: RegimeChangeParams): Promise<void> {
    const {
      sessionId,
      factionId,
      newLeaderId,
      newGovernmentType,
      newGovernmentName,
      newCabinet,
      initialDecrees
    } = params;

    // 1. 기존 정부 해체 또는 수정
    const oldGovernment = await PoliticsService.getGovernment(sessionId, factionId);
    
    if (oldGovernment) {
      // 모든 직책 비우기
      for (const position of oldGovernment.positions) {
        if (!position.isVacant) {
          oldGovernment.removeFromPosition(position.positionId);
        }
      }
      oldGovernment.lastUpdated = new Date();
      await oldGovernment.save();
    }

    // 2. 새 정부 생성 또는 기존 정부 갱신
    if (newGovernmentType && newGovernmentName) {
      // 기존 정부 삭제 후 새로 생성
      await GovernmentStructure.deleteOne({ sessionId, factionId });
      
      const faction = await Gin7Character.findOne({ sessionId, characterId: newLeaderId });
      const factionName = faction?.data?.factionName || 'New Government';
      
      await PoliticsService.createGovernment(
        sessionId,
        factionId,
        factionName,
        newGovernmentType,
        newGovernmentName
      );
    }

    // 3. 새 지도자 임명
    const newGovernment = await PoliticsService.getGovernment(sessionId, factionId);
    if (!newGovernment) {
      throw new Error('새 정부 생성 실패');
    }

    // 최고 권력자 직책 찾기
    const leaderPosition = newGovernment.positions.find(p => 
      ['emperor', 'council_chair', 'president', 'king'].includes(p.positionType)
    );

    if (leaderPosition) {
      const leader = await Gin7Character.findOne({ sessionId, characterId: newLeaderId });
      newGovernment.appointToPosition(
        leaderPosition.positionId,
        newLeaderId,
        leader?.name || 'Unknown',
        'COUP_SYSTEM'
      );
    }

    // 4. 내각 구성
    if (newCabinet) {
      for (const appointment of newCabinet) {
        const character = await Gin7Character.findOne({ 
          sessionId, 
          characterId: appointment.characterId 
        });
        if (character) {
          await PoliticsService.appointToPosition(
            sessionId,
            factionId,
            appointment.positionId,
            appointment.characterId,
            character.name,
            newLeaderId
          );
        }
      }
    }

    // 5. 초기 칙령 발포
    if (initialDecrees) {
      const leader = await Gin7Character.findOne({ sessionId, characterId: newLeaderId });
      for (const decree of initialDecrees) {
        await PoliticsService.issueDecree(
          sessionId,
          factionId,
          newLeaderId,
          leader?.name || 'Unknown',
          decree.type as any,
          decree.title,
          decree.content,
          {}
        );
      }
    }

    newGovernment.lastUpdated = new Date();
    await newGovernment.save();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * 실패한 가능성 평가 결과 생성
   */
  private createFailedFeasibility(reason: string): CoupFeasibility {
    return {
      canAttempt: false,
      overallChance: 0,
      conditions: {
        military: { met: false, currentStrength: 0, requiredStrength: 0, score: 0 },
        capitalControl: { met: false, nearbyForces: 0, governmentForces: 0, score: 0 },
        politicalSupport: { met: false, supportRate: 0, requiredRate: 20, score: 0 },
        publicOpinion: { met: false, favorability: 0, governmentApproval: 0, score: 0 },
        foreignIntervention: { riskLevel: 'certain', potentialIntervenors: [], score: 100 }
      },
      failureConsequences: {
        leaderPunishment: 'execution',
        supporterPunishment: 'imprisonment',
        estimatedCasualties: 0
      },
      recommendations: [reason]
    };
  }

  /**
   * 군사력 분석
   */
  private async analyzeMilitaryStrength(
    sessionId: string,
    targetFactionId: string,
    conspirators: string[]
  ): Promise<CoupFeasibility['conditions']['military']> {
    // 공모자가 지휘하는 함대들
    const conspiratorFleets = await Fleet.find({
      sessionId,
      commanderId: { $in: conspirators }
    });

    // 전체 세력 함대
    const allFactionFleets = await Fleet.find({
      sessionId,
      factionId: targetFactionId
    });

    const coupStrength = conspiratorFleets.reduce((sum, f) => 
      sum + FleetService.calculateCombatPower(f), 0);
    const totalStrength = allFactionFleets.reduce((sum, f) => 
      sum + FleetService.calculateCombatPower(f), 0);
    const governmentStrength = totalStrength - coupStrength;

    const ratio = governmentStrength > 0 ? coupStrength / governmentStrength : 1;
    const met = ratio >= CoupService.MIN_MILITARY_RATIO;
    const score = Math.min(100, ratio * 100);

    return {
      met,
      currentStrength: coupStrength,
      requiredStrength: Math.floor(governmentStrength * CoupService.MIN_MILITARY_RATIO),
      score
    };
  }

  /**
   * 수도 장악 가능성 분석
   */
  private async analyzeCapitalControl(
    sessionId: string,
    targetFactionId: string,
    conspirators: string[]
  ): Promise<CoupFeasibility['conditions']['capitalControl']> {
    // 수도 위치 확인 (간소화: 첫 번째 영토를 수도로 가정)
    // TODO: Territory 모델과 연동하여 실제 수도 확인
    
    // 수도 근처 공모자 함대
    const conspiratorFleets = await Fleet.find({
      sessionId,
      commanderId: { $in: conspirators }
    });

    // 수도 근처 정부군 함대
    const loyalistFleets = await Fleet.find({
      sessionId,
      factionId: targetFactionId,
      commanderId: { $nin: conspirators }
    });

    const nearbyForces = conspiratorFleets.reduce((sum, f) => 
      sum + FleetService.calculateCombatPower(f), 0);
    const governmentForces = loyalistFleets.reduce((sum, f) => 
      sum + FleetService.calculateCombatPower(f), 0);

    const ratio = (governmentForces + nearbyForces) > 0 ? 
      nearbyForces / (governmentForces + nearbyForces) : 0;
    const met = ratio > 0.5;
    const score = ratio * 100;

    return {
      met,
      nearbyForces,
      governmentForces,
      score
    };
  }

  /**
   * 정치적 지지 분석
   */
  private async analyzePoliticalSupport(
    sessionId: string,
    targetFactionId: string,
    conspirators: string[],
    government: IGovernmentStructure
  ): Promise<CoupFeasibility['conditions']['politicalSupport']> {
    // 고위직 공모자 수
    const highRankConspirators = government.positions.filter(p => 
      !p.isVacant && conspirators.includes(p.holderId!)
    ).length;

    // 전체 직책 수
    const filledPositions = government.positions.filter(p => !p.isVacant).length;

    // 귀족 지지 (제국의 경우)
    let nobilitySupport = 0;
    if (government.governmentType === 'empire') {
      const supportingNobles = government.nobilityTitles.filter(t =>
        conspirators.includes(t.holderId)
      ).length;
      nobilitySupport = government.nobilityTitles.length > 0 ?
        (supportingNobles / government.nobilityTitles.length) * 50 : 0;
    }

    const positionSupport = filledPositions > 0 ?
      (highRankConspirators / filledPositions) * 50 : 0;
    
    const supportRate = positionSupport + nobilitySupport;
    const met = supportRate >= CoupService.MIN_POLITICAL_SUPPORT;

    return {
      met,
      supportRate,
      requiredRate: CoupService.MIN_POLITICAL_SUPPORT,
      score: supportRate
    };
  }

  /**
   * 여론/민심 분석
   */
  private async analyzePublicOpinion(
    sessionId: string,
    targetFactionId: string,
    government: IGovernmentStructure
  ): Promise<CoupFeasibility['conditions']['publicOpinion']> {
    // TODO: 실제 여론 시스템과 연동
    // 현재는 정부 유형별 기본값 사용
    
    let governmentApproval = 50;  // 기본 지지율
    
    // 진행 중인 탄핵이 있으면 지지율 감소
    const activeImpeachments = government.impeachments.filter(
      imp => imp.status === 'voting'
    ).length;
    governmentApproval -= activeImpeachments * 10;

    // 활성 칙령에 따른 효과
    const activeDecrees = government.decrees.filter(d => d.isActive).length;
    governmentApproval += activeDecrees * 2;

    governmentApproval = Math.max(0, Math.min(100, governmentApproval));
    
    const favorability = 100 - governmentApproval;  // 정부 불만 = 쿠데타 지지
    const met = favorability >= CoupService.MIN_PUBLIC_SUPPORT;

    return {
      met,
      favorability,
      governmentApproval,
      score: favorability
    };
  }

  /**
   * 외세 개입 가능성 분석
   */
  private async analyzeForeignIntervention(
    sessionId: string,
    targetFactionId: string
  ): Promise<CoupFeasibility['conditions']['foreignIntervention']> {
    // TODO: 외교 시스템과 연동하여 동맹국/적대국 분석
    // 현재는 기본값 반환
    
    const potentialIntervenors: string[] = [];
    let riskLevel: CoupFeasibility['conditions']['foreignIntervention']['riskLevel'] = 'low';
    let score = 20;

    // 세력 ID에 따른 기본 개입 위험
    if (targetFactionId.includes('alliance') || targetFactionId.includes('동맹')) {
      // 동맹은 제국의 개입 가능성
      riskLevel = 'medium';
      score = 50;
    } else if (targetFactionId.includes('empire') || targetFactionId.includes('제국')) {
      // 제국은 내부 문제로 외부 개입 낮음
      riskLevel = 'low';
      score = 20;
    } else if (targetFactionId.includes('fezzan') || targetFactionId.includes('페잔')) {
      // 페잔은 양대 세력 모두 개입 가능
      riskLevel = 'high';
      score = 70;
    }

    return {
      riskLevel,
      potentialIntervenors,
      score
    };
  }

  /**
   * 권고사항 생성
   */
  private generateRecommendations(
    military: CoupFeasibility['conditions']['military'],
    capital: CoupFeasibility['conditions']['capitalControl'],
    political: CoupFeasibility['conditions']['politicalSupport'],
    publicOpinion: CoupFeasibility['conditions']['publicOpinion'],
    foreign: CoupFeasibility['conditions']['foreignIntervention']
  ): string[] {
    const recommendations: string[] = [];

    if (!military.met) {
      recommendations.push(`군사력이 부족합니다. 최소 ${military.requiredStrength} 이상의 병력이 필요합니다.`);
    }
    if (!capital.met) {
      recommendations.push('수도 장악 가능성이 낮습니다. 수도 인근에 더 많은 병력을 배치하세요.');
    }
    if (!political.met) {
      recommendations.push('정치적 지지가 부족합니다. 더 많은 고위직 인사를 포섭하세요.');
    }
    if (!publicOpinion.met) {
      recommendations.push('여론이 불리합니다. 정부의 실정을 알려 민심을 얻으세요.');
    }
    if (foreign.riskLevel === 'high' || foreign.riskLevel === 'certain') {
      recommendations.push('외세 개입 위험이 높습니다. 외교적 준비가 필요합니다.');
    }

    if (recommendations.length === 0) {
      recommendations.push('쿠데타 조건이 충족되었습니다. 신중히 결정하세요.');
    }

    return recommendations;
  }

  /**
   * 쿠데타 세력 구성
   */
  private async buildCoupFaction(
    sessionId: string,
    leaderId: string,
    conspirators: string[],
    fleetIds: string[]
  ): Promise<CoupFaction> {
    const leader = await Gin7Character.findOne({ sessionId, characterId: leaderId });
    const fleets = await Fleet.find({ sessionId, fleetId: { $in: fleetIds } });
    
    const militaryStrength = fleets.reduce((sum, f) => 
      sum + FleetService.calculateCombatPower(f), 0);

    return {
      leaderId,
      leaderName: leader?.name || 'Unknown',
      supporterIds: conspirators,
      controlledFleetIds: fleetIds,
      controlledTerritoryIds: [],  // TODO: Territory 연동
      militaryStrength,
      politicalSupport: 30,  // 기본값
      publicSupport: 20       // 기본값
    };
  }

  /**
   * 함대들의 총 군사력 계산
   */
  private async calculateMilitaryStrength(
    sessionId: string,
    fleetIds: string[]
  ): Promise<number> {
    const fleets = await Fleet.find({ sessionId, fleetId: { $in: fleetIds } });
    return fleets.reduce((sum, f) => sum + FleetService.calculateCombatPower(f), 0);
  }

  /**
   * 쿠데타 전투 시뮬레이션
   */
  private async simulateCoupBattle(
    sessionId: string,
    coupFaction: CoupFaction,
    targetFactionId: string,
    isSuccess: boolean
  ): Promise<CoupResult['outcome']['battleResults']> {
    // 간소화된 전투 시뮬레이션
    const coupStrength = coupFaction.militaryStrength;
    
    // 정부군 함대
    const governmentFleets = await Fleet.find({
      sessionId,
      factionId: targetFactionId,
      fleetId: { $nin: coupFaction.controlledFleetIds }
    });
    const govStrength = governmentFleets.reduce((sum, f) => 
      sum + FleetService.calculateCombatPower(f), 0);

    const casualtyRate = isSuccess ? 0.2 : 0.4;
    
    return {
      coupCasualties: Math.floor(coupStrength * casualtyRate),
      governmentCasualties: Math.floor(govStrength * (isSuccess ? 0.3 : 0.15)),
      civilianCasualties: Math.floor(Math.random() * 500)
    };
  }

  /**
   * 쿠데타 성공 처리
   */
  private async handleCoupSuccess(
    sessionId: string,
    coupId: string,
    coupFaction: CoupFaction,
    targetFactionId: string,
    targetGovernmentId: string,
    coupType: CoupType,
    battleResults: CoupResult['outcome']['battleResults'],
    options?: ExecuteCoupParams['options']
  ): Promise<CoupResult> {
    // 이전 지도자 처리
    const oldGovernment = await PoliticsService.getGovernment(sessionId, targetFactionId);
    const previousLeaderId = oldGovernment?.positions.find(p => 
      ['emperor', 'council_chair', 'president'].includes(p.positionType) && !p.isVacant
    )?.holderId;

    let previousLeaderFate: CoupResult['consequences']['previousLeader'] | undefined;
    if (previousLeaderId) {
      const fate = options?.arrestTarget === previousLeaderId ? 'imprisoned' : 'fled';
      previousLeaderFate = {
        characterId: previousLeaderId,
        fate: fate as any
      };
      await this.applyFates(sessionId, previousLeaderId, fate);
    }

    // 새 정부 수립
    await this.handleRegimeChange({
      sessionId,
      factionId: targetFactionId,
      newLeaderId: coupFaction.leaderId
    });

    // 참여자 보상
    const participantConsequences = coupFaction.supporterIds.map(id => ({
      characterId: id,
      fate: 'promoted' as const
    }));

    return {
      success: true,
      coupId,
      outcome: {
        newGovernmentId: targetGovernmentId,
        newLeaderId: coupFaction.leaderId,
        battleResults,
        politicalChanges: {
          governmentTypeChange: undefined,
          factionSplit: false
        }
      },
      consequences: {
        coupLeader: {
          characterId: coupFaction.leaderId,
          fate: 'new_leader'
        },
        coupParticipants: participantConsequences,
        previousLeader: previousLeaderFate,
        loyalists: []
      },
      aftermath: {
        stabilityPenalty: 30,
        publicOrderPenalty: 20,
        economicDamage: 15,
        diplomaticReputation: -20,
        civilWarRisk: 25
      }
    };
  }

  /**
   * 쿠데타 실패 처리
   */
  private async handleCoupFailure(
    sessionId: string,
    coupId: string,
    coupFaction: CoupFaction,
    targetFactionId: string,
    battleResults: CoupResult['outcome']['battleResults']
  ): Promise<CoupResult> {
    // 쿠데타 지도자 처벌
    await this.applyFates(sessionId, coupFaction.leaderId, 'execution');

    // 참여자 처벌
    const participantConsequences = coupFaction.supporterIds.map(id => {
      const fate = Math.random() < 0.3 ? 'executed' : 'imprisoned';
      this.applyFates(sessionId, id, fate);
      return {
        characterId: id,
        fate: fate as 'executed' | 'imprisoned' | 'exiled' | 'pardoned'
      };
    });

    return {
      success: false,
      coupId,
      outcome: {
        battleResults
      },
      consequences: {
        coupLeader: {
          characterId: coupFaction.leaderId,
          fate: 'executed'
        },
        coupParticipants: participantConsequences
      },
      aftermath: {
        stabilityPenalty: 10,
        publicOrderPenalty: 15,
        economicDamage: 5,
        diplomaticReputation: 0,
        civilWarRisk: 5
      }
    };
  }

  /**
   * 처분 결정
   */
  private determineFate(
    outcome: SuppressionResult['outcome'],
    role: 'leader' | 'supporter',
    amnesty?: boolean
  ): SuppressionResult['coupLeaderFate'] {
    if (amnesty && outcome === 'negotiated') {
      return 'pardoned';
    }

    if (outcome === 'failed') {
      return 'escaped';
    }

    if (outcome === 'negotiated') {
      return role === 'leader' ? 'exiled' : 'pardoned';
    }

    // suppressed
    if (role === 'leader') {
      return Math.random() < 0.7 ? 'executed' : 'imprisoned';
    }
    return Math.random() < 0.3 ? 'executed' : 'imprisoned';
  }

  /**
   * 캐릭터 처분 적용
   */
  private async applyFates(
    sessionId: string,
    characterId: string,
    fate: string
  ): Promise<void> {
    const character = await Gin7Character.findOne({ sessionId, characterId });
    if (!character) return;

    switch (fate) {
      case 'execution':
      case 'executed':
        character.data = character.data || {};
        character.data.status = 'dead';
        character.data.deathCause = 'executed_for_treason';
        character.data.deathDate = new Date();
        break;
      case 'imprisonment':
      case 'imprisoned':
        character.data = character.data || {};
        character.data.status = 'imprisoned';
        character.data.imprisonedDate = new Date();
        break;
      case 'exile':
      case 'exiled':
        character.data = character.data || {};
        character.data.status = 'exiled';
        character.data.exiledDate = new Date();
        character.data.factionId = null;  // 세력 이탈
        break;
      case 'fled':
      case 'escaped':
        character.data = character.data || {};
        character.data.status = 'fugitive';
        break;
      case 'pardoned':
        // 사면 - 상태 변경 없음
        break;
      case 'promoted':
        // 승진 - 별도 처리 필요
        break;
    }

    character.markModified('data');
    await character.save();
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * 진행 중인 쿠데타 조회
   */
  async getActiveCoup(sessionId: string, factionId: string): Promise<CoupDocument | null> {
    return Coup.findOne({
      sessionId,
      targetFactionId: factionId,
      status: { $in: ['planning', 'mobilizing', 'executing'] }
    });
  }

  /**
   * 쿠데타 기록 조회
   */
  async getCoupHistory(sessionId: string, factionId?: string): Promise<CoupDocument[]> {
    const query: any = { sessionId };
    if (factionId) {
      query.targetFactionId = factionId;
    }
    return Coup.find(query).sort({ plannedAt: -1 });
  }

  /**
   * 특정 쿠데타 조회
   */
  async getCoup(sessionId: string, coupId: string): Promise<CoupDocument | null> {
    return Coup.findOne({ sessionId, coupId });
  }
}

// 싱글톤 인스턴스 export
export const coupService = new CoupService();
export default coupService;





