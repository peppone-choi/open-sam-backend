/**
 * NationCommandsAI.ts - 국가 AI 명령 (승진, 포상, 몰수, 외교)
 * 
 * PHP GeneralAI.php의 다음 메서드 포팅:
 * - do승진() - 장수 자동 승진
 * - do긴급포상() / do포상() - 자원 포상
 * - do몰수() - NPC 자원 몰수
 * - do선전포고() - 전쟁 선포
 * - do불가침제의() - 불가침 조약 제의
 * - do천도() - 수도 이전
 */

import { AICommandDecision } from './SimpleAI';
import { NationPolicyValues, DEFAULT_NATION_POLICY_VALUES } from './AutorunNationPolicy';
import { generalRepository } from '../repositories/general.repository';
import { nationRepository } from '../repositories/nation.repository';
import { cityRepository } from '../repositories/city.repository';
import { diplomacyRepository } from '../repositories/diplomacy.repository';
import { GameConst } from '../constants/GameConst';

/**
 * 승진 대상 장수 정보
 */
export interface PromotionCandidate {
  generalID: number;
  name: string;
  currentLevel: number;
  newLevel: number;
  score: number;       // 승진 점수 (공헌도, 능력치 종합)
  reason: string;
}

/**
 * 포상 대상 장수 정보
 */
export interface RewardCandidate {
  generalID: number;
  name: string;
  gold: number;
  rice: number;
  needsGold: boolean;  // 금 부족 여부
  needsRice: boolean;  // 쌀 부족 여부
  urgentLevel: 'critical' | 'urgent' | 'normal';
}

/**
 * 몰수 대상 장수 정보
 */
export interface ConfiscateCandidate {
  generalID: number;
  name: string;
  gold: number;
  rice: number;
  excessGold: number;  // 초과 금액
  excessRice: number;  // 초과 쌀
}

/**
 * NationCommandsAI - 국가 AI 명령 결정 클래스
 */
export class NationCommandsAI {
  private sessionId: string;
  private nationID: number;
  private policy: NationPolicyValues;
  private chiefGeneral: any;
  private nation: any;

  constructor(
    sessionId: string,
    nationID: number,
    chiefGeneral: any,
    nation: any,
    policy?: Partial<NationPolicyValues>
  ) {
    this.sessionId = sessionId;
    this.nationID = nationID;
    this.chiefGeneral = chiefGeneral;
    this.nation = nation;
    this.policy = { ...DEFAULT_NATION_POLICY_VALUES, ...policy };
  }

  // ========================================
  // 승진 시스템 (PHP do승진 참고)
  // ========================================

  /**
   * 승진 대상 장수 탐색
   * 
   * 승진 기준:
   * 1. 공헌도 (dedication) 높은 장수
   * 2. 현재 관직 대비 능력치 높은 장수
   * 3. NPC 부대장(npc=5)은 승진 제외
   */
  async findPromotionCandidates(): Promise<PromotionCandidate[]> {
    const candidates: PromotionCandidate[] = [];

    try {
      const generals = await generalRepository.findByNation(this.sessionId, this.nationID);
      
      for (const gen of generals) {
        const genData: any = (gen as any).data || gen;
        
        // 부대장 NPC(npc=5)는 승진 제외
        if (genData.npc === 5) continue;
        
        // 이미 군주(12)면 승진 불가
        const currentLevel = genData.officer_level || 1;
        if (currentLevel >= 12) continue;
        
        // 승진 점수 계산
        const score = this.calculatePromotionScore(genData);
        
        // 승진 기준 충족 여부 (점수 50 이상)
        if (score < 50) continue;
        
        // 새 관직 결정
        const newLevel = this.determineNewOfficerLevel(currentLevel, score);
        if (newLevel <= currentLevel) continue;
        
        candidates.push({
          generalID: genData.no,
          name: genData.name || `장수 ${genData.no}`,
          currentLevel,
          newLevel,
          score,
          reason: `공헌도/능력치 기반 승진 (점수: ${score.toFixed(0)})`
        });
      }
      
      // 점수 높은 순 정렬
      candidates.sort((a, b) => b.score - a.score);
      
    } catch (error) {
      console.error('[NationCommandsAI] 승진 대상 탐색 실패:', error);
    }

    return candidates;
  }

  /**
   * 승진 점수 계산
   */
  private calculatePromotionScore(genData: any): number {
    const dedication = genData.dedication || 0;
    const leadership = genData.leadership || 50;
    const strength = genData.strength || 50;
    const intel = genData.intel || 50;
    
    // 공헌도 점수 (최대 50점)
    const dedicationScore = Math.min(dedication / 1000, 50);
    
    // 능력치 점수 (최대 50점)
    const avgStat = (leadership + strength + intel) / 3;
    const statScore = (avgStat / 100) * 50;
    
    return dedicationScore + statScore;
  }

  /**
   * 새 관직 결정
   */
  private determineNewOfficerLevel(currentLevel: number, score: number): number {
    // 점수에 따른 최대 승진 가능 레벨
    let maxLevel = currentLevel;
    
    if (score >= 90) maxLevel = Math.min(currentLevel + 3, 11);
    else if (score >= 75) maxLevel = Math.min(currentLevel + 2, 10);
    else if (score >= 50) maxLevel = Math.min(currentLevel + 1, 9);
    
    return maxLevel;
  }

  /**
   * 승진 명령 생성
   */
  async generatePromotionCommand(): Promise<AICommandDecision | null> {
    const candidates = await this.findPromotionCandidates();
    
    if (candidates.length === 0) return null;
    
    // 가장 점수 높은 장수 승진
    const best = candidates[0];
    
    return {
      command: 'che_승진',
      args: {
        destGeneralID: best.generalID,
        newOfficerLevel: best.newLevel
      },
      weight: 30,
      reason: `${best.name} 승진 (${best.currentLevel} → ${best.newLevel}, ${best.reason})`
    };
  }

  // ========================================
  // 포상 시스템 (PHP do포상 참고)
  // ========================================

  /**
   * 포상 대상 장수 탐색
   * 
   * 포상 기준:
   * 1. 금/쌀 부족한 장수 (전쟁 준비 불가)
   * 2. 유저장 우선, NPC 차순위
   * 3. 긴급: 자원 < 긴급 기준, 보통: 자원 < 권장 기준
   */
  async findRewardCandidates(isUrgent: boolean = false, isUserOnly: boolean = false): Promise<RewardCandidate[]> {
    const candidates: RewardCandidate[] = [];

    try {
      const generals = await generalRepository.findByNation(this.sessionId, this.nationID);
      
      const urgentGold = isUserOnly ? this.policy.reqHumanWarUrgentGold : this.policy.reqNPCWarGold;
      const urgentRice = isUserOnly ? this.policy.reqHumanWarUrgentRice : this.policy.reqNPCWarRice;
      const recommendGold = isUserOnly ? this.policy.reqHumanWarRecommandGold : this.policy.reqNPCDevelGold;
      const recommendRice = isUserOnly ? this.policy.reqHumanWarRecommandRice : this.policy.reqNPCDevelRice;
      
      for (const gen of generals) {
        const genData: any = (gen as any).data || gen;
        
        // 유저장 필터링
        const isUser = (genData.npc || 0) < 2;
        if (isUserOnly && !isUser) continue;
        if (!isUserOnly && isUser) continue;
        
        const gold = genData.gold || 0;
        const rice = genData.rice || 0;
        
        // 긴급 여부 판단
        let urgentLevel: 'critical' | 'urgent' | 'normal' = 'normal';
        let needsGold = false;
        let needsRice = false;
        
        if (isUrgent) {
          // 긴급 포상: 자원 < 긴급 기준
          needsGold = gold < urgentGold;
          needsRice = rice < urgentRice;
          
          if (gold < urgentGold / 2 || rice < urgentRice / 2) {
            urgentLevel = 'critical';
          } else if (needsGold || needsRice) {
            urgentLevel = 'urgent';
          }
        } else {
          // 일반 포상: 자원 < 권장 기준
          needsGold = gold < recommendGold;
          needsRice = rice < recommendRice;
        }
        
        if (!needsGold && !needsRice) continue;
        
        candidates.push({
          generalID: genData.no,
          name: genData.name || `장수 ${genData.no}`,
          gold,
          rice,
          needsGold,
          needsRice,
          urgentLevel
        });
      }
      
      // 긴급 레벨 순 정렬
      candidates.sort((a, b) => {
        const levelOrder = { critical: 0, urgent: 1, normal: 2 };
        return levelOrder[a.urgentLevel] - levelOrder[b.urgentLevel];
      });
      
    } catch (error) {
      console.error('[NationCommandsAI] 포상 대상 탐색 실패:', error);
    }

    return candidates;
  }

  /**
   * 포상 명령 생성
   */
  async generateRewardCommand(isUrgent: boolean = false, isUserOnly: boolean = false): Promise<AICommandDecision | null> {
    // 국가 자원 확인
    const nationData = this.nation?.data || this.nation;
    const nationGold = nationData?.gold || 0;
    const nationRice = nationData?.rice || 0;
    
    // 국가 자원이 최소 기준 미달이면 포상 불가
    if (nationGold < this.policy.reqNationGold || nationRice < this.policy.reqNationRice) {
      return null;
    }
    
    const candidates = await this.findRewardCandidates(isUrgent, isUserOnly);
    
    if (candidates.length === 0) return null;
    
    const best = candidates[0];
    
    // 포상 금액 결정
    const maxAmount = this.policy.maximumResourceActionAmount;
    const minAmount = this.policy.minimumResourceActionAmount;
    
    let goldAmount = 0;
    let riceAmount = 0;
    
    if (best.needsGold) {
      goldAmount = Math.min(maxAmount, Math.max(minAmount, nationGold * 0.1));
    }
    if (best.needsRice) {
      riceAmount = Math.min(maxAmount, Math.max(minAmount, nationRice * 0.1));
    }
    
    const commandName = isUrgent 
      ? (isUserOnly ? 'che_유저장긴급포상' : 'che_NPC긴급포상')
      : (isUserOnly ? 'che_유저장포상' : 'che_NPC포상');
    
    return {
      command: commandName,
      args: {
        destGeneralID: best.generalID,
        goldAmount,
        riceAmount
      },
      weight: isUrgent ? 80 : 40,
      reason: `${best.name} 포상 (금:${goldAmount}, 쌀:${riceAmount}, ${best.urgentLevel})`
    };
  }

  // ========================================
  // 몰수 시스템 (PHP do몰수 참고)
  // ========================================

  /**
   * 몰수 대상 NPC 탐색
   * 
   * 몰수 기준:
   * 1. NPC만 대상 (npc >= 2)
   * 2. 자원이 권장치 이상 초과
   * 3. 국가 자원이 부족할 때
   */
  async findConfiscateCandidates(): Promise<ConfiscateCandidate[]> {
    const candidates: ConfiscateCandidate[] = [];

    try {
      const generals = await generalRepository.findByNation(this.sessionId, this.nationID);
      
      const maxGold = this.policy.reqNPCWarGold * 2;
      const maxRice = this.policy.reqNPCWarRice * 2;
      
      for (const gen of generals) {
        const genData: any = (gen as any).data || gen;
        
        // NPC만 대상
        if ((genData.npc || 0) < 2) continue;
        
        const gold = genData.gold || 0;
        const rice = genData.rice || 0;
        
        const excessGold = Math.max(0, gold - maxGold);
        const excessRice = Math.max(0, rice - maxRice);
        
        if (excessGold <= 0 && excessRice <= 0) continue;
        
        candidates.push({
          generalID: genData.no,
          name: genData.name || `장수 ${genData.no}`,
          gold,
          rice,
          excessGold,
          excessRice
        });
      }
      
      // 초과 자원 많은 순 정렬
      candidates.sort((a, b) => (b.excessGold + b.excessRice) - (a.excessGold + a.excessRice));
      
    } catch (error) {
      console.error('[NationCommandsAI] 몰수 대상 탐색 실패:', error);
    }

    return candidates;
  }

  /**
   * 몰수 명령 생성
   */
  async generateConfiscateCommand(): Promise<AICommandDecision | null> {
    // 국가 자원이 충분하면 몰수 불필요
    const nationData = this.nation?.data || this.nation;
    const nationGold = nationData?.gold || 0;
    const nationRice = nationData?.rice || 0;
    
    if (nationGold >= this.policy.reqNationGold && nationRice >= this.policy.reqNationRice) {
      return null;
    }
    
    const candidates = await this.findConfiscateCandidates();
    
    if (candidates.length === 0) return null;
    
    const best = candidates[0];
    
    return {
      command: 'che_몰수',
      args: {
        destGeneralID: best.generalID,
        goldAmount: best.excessGold,
        riceAmount: best.excessRice
      },
      weight: 20,
      reason: `${best.name} 몰수 (초과 금:${best.excessGold}, 쌀:${best.excessRice})`
    };
  }

  // ========================================
  // 외교 시스템 (PHP do선전포고, do불가침제의 참고)
  // ========================================

  /**
   * 선전포고 대상 국가 탐색
   */
  async findWarTargets(): Promise<Array<{ nationID: number; name: string; priority: number }>> {
    const targets: Array<{ nationID: number; name: string; priority: number }> = [];

    try {
      // 인접 국가 목록 (전방 도시의 인접 도시 소유 국가)
      const frontCities = await cityRepository.findByFilter({
        session_id: this.sessionId,
        'data.nation': this.nationID,
        'data.front': { $gt: 0 }
      });
      
      const adjacentNations = new Set<number>();
      
      for (const city of frontCities) {
        // FUTURE: 인접 도시 정보에서 적 국가 추출
        // 현재는 간단히 스킵
      }
      
      // 외교 관계 확인
      const diplomacies = await diplomacyRepository.findByFilter({
        session_id: this.sessionId,
        me: this.nationID
      });
      
      // 중립 관계(state=2)인 국가만 선포 가능
      for (const dip of diplomacies) {
        if (dip.state === 2 && adjacentNations.has(dip.you)) {
          const targetNation = await nationRepository.findByNationNum(this.sessionId, dip.you);
          if (targetNation) {
            const targetData = targetNation.data || targetNation;
            targets.push({
              nationID: dip.you,
              name: targetData.name || `국가 ${dip.you}`,
              priority: 50 // 기본 우선순위
            });
          }
        }
      }
      
    } catch (error) {
      console.error('[NationCommandsAI] 선전포고 대상 탐색 실패:', error);
    }

    return targets;
  }

  /**
   * 선전포고 명령 생성
   */
  async generateDeclareWarCommand(): Promise<AICommandDecision | null> {
    const chiefData = this.chiefGeneral?.data || this.chiefGeneral;
    
    // 군주만 선포 가능
    if ((chiefData?.officer_level || 0) < 12) return null;
    
    const targets = await this.findWarTargets();
    
    if (targets.length === 0) return null;
    
    // 우선순위 높은 대상 선택
    targets.sort((a, b) => b.priority - a.priority);
    const best = targets[0];
    
    return {
      command: 'che_선전포고',
      args: {
        destNationID: best.nationID
      },
      weight: 60,
      reason: `${best.name}에 선전포고 (우선순위: ${best.priority})`
    };
  }

  /**
   * 불가침 제의 명령 생성
   */
  async generateNonAggressionCommand(): Promise<AICommandDecision | null> {
    const chiefData = this.chiefGeneral?.data || this.chiefGeneral;
    
    // 군주만 제의 가능
    if ((chiefData?.officer_level || 0) < 12) return null;
    
    try {
      // 전쟁 중인 국가 목록
      const diplomacies = await diplomacyRepository.findByFilter({
        session_id: this.sessionId,
        me: this.nationID,
        state: { $in: [0, 1] } // 전쟁 중 또는 선포 상태
      });
      
      if (diplomacies.length === 0) return null;
      
      // 가장 오래된 전쟁 (먼저 불가침 제의)
      const oldest = diplomacies[0];
      
      return {
        command: 'che_불가침제의',
        args: {
          destNationID: oldest.you
        },
        weight: 30,
        reason: `국가 ${oldest.you}에 불가침 제의`
      };
      
    } catch (error) {
      console.error('[NationCommandsAI] 불가침 제의 대상 탐색 실패:', error);
    }

    return null;
  }

  // ========================================
  // 천도 시스템 (PHP do천도 참고)
  // ========================================

  /**
   * 천도 대상 도시 탐색
   */
  async findCapitalCandidates(): Promise<Array<{ cityID: number; name: string; score: number }>> {
    const candidates: Array<{ cityID: number; name: string; score: number }> = [];

    try {
      const cities = await cityRepository.findByNation(this.sessionId, this.nationID);
      const currentCapital = this.nation?.data?.capital || this.nation?.capital || 0;
      
      for (const city of cities) {
        const cityData = city.data || city;
        const cityID = cityData.city;
        
        // 현재 수도는 제외
        if (cityID === currentCapital) continue;
        
        // 보급선 연결 필수
        if (!cityData.supply) continue;
        
        // 전방 도시는 수도로 부적합
        if (cityData.front > 0) continue;
        
        // 점수 계산: 인구 + 개발도 + 레벨
        const pop = cityData.pop || 0;
        const level = cityData.level || 1;
        const dev = (cityData.agri || 0) + (cityData.comm || 0) + (cityData.secu || 0);
        
        const score = pop / 1000 + level * 10 + dev / 1000;
        
        candidates.push({
          cityID,
          name: cityData.name || `도시 ${cityID}`,
          score
        });
      }
      
      // 점수 순 정렬
      candidates.sort((a, b) => b.score - a.score);
      
    } catch (error) {
      console.error('[NationCommandsAI] 천도 대상 탐색 실패:', error);
    }

    return candidates;
  }

  /**
   * 천도 명령 생성
   */
  async generateMoveCapitalCommand(): Promise<AICommandDecision | null> {
    const chiefData = this.chiefGeneral?.data || this.chiefGeneral;
    
    // 군주만 천도 가능
    if ((chiefData?.officer_level || 0) < 12) return null;
    
    // 현재 수도가 위험한지 확인 (전방이거나 보급선 없음)
    const currentCapital = this.nation?.data?.capital || this.nation?.capital || 0;
    
    try {
      const capitalCity = await cityRepository.findByCityNum(this.sessionId, currentCapital);
      if (capitalCity) {
        const capitalData: any = (capitalCity as any).data || capitalCity;
        
        // 수도가 안전하면 천도 불필요
        if (capitalData.supply && capitalData.front === 0) {
          return null;
        }
      }
    } catch (error) {
      // 수도 조회 실패 시 계속 진행
    }
    
    const candidates = await this.findCapitalCandidates();
    
    if (candidates.length === 0) return null;
    
    const best = candidates[0];
    
    return {
      command: 'che_천도',
      args: {
        destCityID: best.cityID
      },
      weight: 70,
      reason: `${best.name}으로 천도 (점수: ${best.score.toFixed(0)})`
    };
  }

  // ========================================
  // 통합 명령 결정
  // ========================================

  /**
   * 모든 국가 AI 명령 평가 및 선택
   */
  async decideNationCommand(): Promise<AICommandDecision | null> {
    const candidates: AICommandDecision[] = [];

    // 1. 천도 (수도 위험 시 최우선)
    const moveCapital = await this.generateMoveCapitalCommand();
    if (moveCapital) candidates.push(moveCapital);

    // 2. 긴급 포상 (유저장)
    const urgentUserReward = await this.generateRewardCommand(true, true);
    if (urgentUserReward) candidates.push(urgentUserReward);

    // 3. 긴급 포상 (NPC)
    const urgentNPCReward = await this.generateRewardCommand(true, false);
    if (urgentNPCReward) candidates.push(urgentNPCReward);

    // 4. 선전포고
    const declareWar = await this.generateDeclareWarCommand();
    if (declareWar) candidates.push(declareWar);

    // 5. 일반 포상 (유저장)
    const userReward = await this.generateRewardCommand(false, true);
    if (userReward) candidates.push(userReward);

    // 6. 일반 포상 (NPC)
    const npcReward = await this.generateRewardCommand(false, false);
    if (npcReward) candidates.push(npcReward);

    // 7. 승진
    const promotion = await this.generatePromotionCommand();
    if (promotion) candidates.push(promotion);

    // 8. 몰수
    const confiscate = await this.generateConfiscateCommand();
    if (confiscate) candidates.push(confiscate);

    // 9. 불가침 제의
    const nonAggression = await this.generateNonAggressionCommand();
    if (nonAggression) candidates.push(nonAggression);

    if (candidates.length === 0) return null;

    // 가중치 기반 선택
    candidates.sort((a, b) => b.weight - a.weight);
    
    // 최고 가중치 명령 선택 (확률적 요소 추가)
    const topWeight = candidates[0].weight;
    const topCandidates = candidates.filter(c => c.weight >= topWeight * 0.8);
    
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    
    console.log(`[NationCommandsAI] 선택된 명령: ${selected.command} (가중치: ${selected.weight}, 이유: ${selected.reason})`);
    
    return selected;
  }
}

export default NationCommandsAI;
