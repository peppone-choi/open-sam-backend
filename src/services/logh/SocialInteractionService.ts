/**
 * SocialInteractionService
 * 사교, 인맥, 파벌 관련 비즈니스 로직
 */

import { Relationship, IRelationship } from '../../models/logh/Relationship.model';
import { Faction, IFaction } from '../../models/logh/Faction.model';
import { LoghCommander, ILoghCommander } from '../../models/logh/Commander.model';
import { Planet } from '../../models/logh/Planet.model';

export interface InteractionResult {
  success: boolean;
  friendshipChange: number;
  influenceChange: number;
  message: string;
  effects?: any[];
}

export class SocialInteractionService {
  /**
   * 우호도 조회 또는 생성
   */
  static async getOrCreateRelationship(
    sessionId: string,
    fromNo: number,
    toNo: number
  ): Promise<IRelationship> {
    let relationship = await Relationship.findOne({
      session_id: sessionId,
      fromCommanderNo: fromNo,
      toCommanderNo: toNo,
    });

    if (!relationship) {
      relationship = new Relationship({
        session_id: sessionId,
        fromCommanderNo: fromNo,
        toCommanderNo: toNo,
        friendship: 50,
        trust: 50,
        interactions: [],
      });
      await relationship.save();
    }

    return relationship;
  }

  /**
   * 양방향 우호도 가져오기 (평균)
   */
  static async getMutualFriendship(
    sessionId: string,
    commander1No: number,
    commander2No: number
  ): Promise<number> {
    const rel1 = await this.getOrCreateRelationship(sessionId, commander1No, commander2No);
    const rel2 = await this.getOrCreateRelationship(sessionId, commander2No, commander1No);
    return Math.round((rel1.friendship + rel2.friendship) / 2);
  }

  /**
   * 우호도 변경
   */
  static async modifyFriendship(
    sessionId: string,
    fromNo: number,
    toNo: number,
    change: number,
    interactionType: IRelationship['interactions'][0]['type'],
    notes?: string
  ): Promise<{ newFriendship: number; relationship: IRelationship }> {
    const relationship = await this.getOrCreateRelationship(sessionId, fromNo, toNo);
    
    const oldFriendship = relationship.friendship;
    relationship.friendship = Math.max(0, Math.min(100, relationship.friendship + change));
    
    // 상호작용 기록
    relationship.interactions.push({
      type: interactionType,
      date: new Date(),
      result: change > 0 ? 'success' : change < 0 ? 'failure' : 'neutral',
      friendshipChange: change,
      notes,
    });
    
    relationship.lastInteractionAt = new Date();
    
    // 관계 상태 자동 업데이트
    if (relationship.friendship >= 80) {
      relationship.isAlly = true;
      relationship.isEnemy = false;
    } else if (relationship.friendship <= 20) {
      relationship.isEnemy = true;
      relationship.isAlly = false;
    } else {
      relationship.isAlly = false;
      relationship.isEnemy = false;
    }
    
    await relationship.save();
    
    return { newFriendship: relationship.friendship, relationship };
  }

  /**
   * 회견(Interview) - 상급자 대상 1:1 대화
   */
  static async conductInterview(
    sessionId: string,
    fromNo: number,
    toNo: number,
    fromPolitics: number
  ): Promise<InteractionResult> {
    // 정치력에 따른 성공률 계산
    const baseChange = 5;
    const politicsBonus = Math.floor((fromPolitics - 50) / 10);
    const randomFactor = Math.floor(Math.random() * 6) - 2; // -2 ~ +3
    
    const friendshipChange = baseChange + politicsBonus + randomFactor;
    
    const { newFriendship } = await this.modifyFriendship(
      sessionId, fromNo, toNo, friendshipChange, 'meeting', '회견'
    );
    
    // 상대방도 약간의 우호도 상승
    await this.modifyFriendship(
      sessionId, toNo, fromNo, Math.floor(friendshipChange * 0.5), 'meeting', '회견(상대)'
    );
    
    return {
      success: friendshipChange > 0,
      friendshipChange,
      influenceChange: 0,
      message: friendshipChange > 0 
        ? `성공적인 회견이었습니다. 우호도 +${friendshipChange} (현재: ${newFriendship})`
        : `회견이 부자연스러웠습니다. 우호도 ${friendshipChange}`,
    };
  }

  /**
   * 담화(Talk) - 동료/하급자 대상 1:1 대화
   */
  static async conductTalk(
    sessionId: string,
    fromNo: number,
    toNo: number,
    fromPolitics: number,
    fromLeadership: number
  ): Promise<InteractionResult> {
    // 통솔력 + 정치력 기반
    const baseChange = 8;
    const statBonus = Math.floor((fromPolitics + fromLeadership - 100) / 20);
    const randomFactor = Math.floor(Math.random() * 8) - 3; // -3 ~ +4
    
    const friendshipChange = baseChange + statBonus + randomFactor;
    
    const { newFriendship } = await this.modifyFriendship(
      sessionId, fromNo, toNo, friendshipChange, 'talk', '담화'
    );
    
    // 상대방도 우호도 상승
    await this.modifyFriendship(
      sessionId, toNo, fromNo, Math.floor(friendshipChange * 0.7), 'talk', '담화(상대)'
    );
    
    return {
      success: friendshipChange > 0,
      friendshipChange,
      influenceChange: 0,
      message: `담화를 나누었습니다. 우호도 ${friendshipChange > 0 ? '+' : ''}${friendshipChange} (현재: ${newFriendship})`,
    };
  }

  /**
   * 밀담(Secret Meeting) - 비밀 대화, 로그 안 남음
   */
  static async conductSecretMeeting(
    sessionId: string,
    fromNo: number,
    toNo: number,
    fromIntelligence: number
  ): Promise<InteractionResult> {
    // 지략 기반
    const baseChange = 10;
    const intelligenceBonus = Math.floor((fromIntelligence - 50) / 8);
    const randomFactor = Math.floor(Math.random() * 10) - 4; // -4 ~ +5
    
    const friendshipChange = baseChange + intelligenceBonus + randomFactor;
    
    // 신뢰도도 함께 상승
    const relationship = await this.getOrCreateRelationship(sessionId, fromNo, toNo);
    relationship.trust = Math.min(100, relationship.trust + Math.floor(friendshipChange * 0.5));
    await relationship.save();
    
    const { newFriendship } = await this.modifyFriendship(
      sessionId, fromNo, toNo, friendshipChange, 'secret_meeting', '밀담'
    );
    
    // 상대방 신뢰도 + 우호도
    const targetRel = await this.getOrCreateRelationship(sessionId, toNo, fromNo);
    targetRel.trust = Math.min(100, targetRel.trust + Math.floor(friendshipChange * 0.4));
    await targetRel.save();
    
    await this.modifyFriendship(
      sessionId, toNo, fromNo, Math.floor(friendshipChange * 0.8), 'secret_meeting', '밀담(상대)'
    );
    
    return {
      success: friendshipChange > 0,
      friendshipChange,
      influenceChange: 0,
      message: `밀담을 나누었습니다. (기록에 남지 않음)`,
    };
  }

  /**
   * 야회(Party) - 다수 초대 이벤트, 영향력 상승
   */
  static async hostParty(
    sessionId: string,
    hostNo: number,
    inviteeNos: number[],
    hostPolitics: number,
    hostInfluence: number
  ): Promise<InteractionResult> {
    const host = await LoghCommander.findOne({ session_id: sessionId, no: hostNo });
    if (!host) {
      return { success: false, friendshipChange: 0, influenceChange: 0, message: '호스트를 찾을 수 없습니다.' };
    }

    let totalFriendshipGain = 0;
    const baseInfluenceGain = 5 + Math.floor(inviteeNos.length * 2);
    
    for (const inviteeNo of inviteeNos) {
      const friendshipChange = 3 + Math.floor(Math.random() * 5); // 3~7
      await this.modifyFriendship(sessionId, hostNo, inviteeNo, friendshipChange, 'party', '야회 초대');
      await this.modifyFriendship(sessionId, inviteeNo, hostNo, Math.floor(friendshipChange * 0.6), 'party', '야회 참석');
      totalFriendshipGain += friendshipChange;
    }
    
    // 호스트 영향력 상승
    const politicsBonus = Math.floor((hostPolitics - 50) / 10);
    const influenceGain = baseInfluenceGain + politicsBonus;
    
    host.fame = (host.fame || 0) + influenceGain;
    await host.save();
    
    return {
      success: true,
      friendshipChange: totalFriendshipGain,
      influenceChange: influenceGain,
      message: `야회를 개최했습니다. ${inviteeNos.length}명의 손님과 교류. 영향력 +${influenceGain}`,
      effects: [{ type: 'party', attendees: inviteeNos.length, influenceGain }],
    };
  }

  /**
   * 수렵(Hunting) - 봉토에서 수렵, 친밀도 대폭 상승
   */
  static async hostHunting(
    sessionId: string,
    hostNo: number,
    inviteeNos: number[],
    hostCommand: number,
    hostManeuver: number
  ): Promise<InteractionResult> {
    const host = await LoghCommander.findOne({ session_id: sessionId, no: hostNo });
    if (!host) {
      return { success: false, friendshipChange: 0, influenceChange: 0, message: '호스트를 찾을 수 없습니다.' };
    }

    let totalFriendshipGain = 0;
    const tacticBonus = Math.floor((hostCommand + hostManeuver - 100) / 20);
    
    for (const inviteeNo of inviteeNos) {
      // 수렵은 친밀도가 크게 오름
      const baseFriendship = 10;
      const friendshipChange = baseFriendship + tacticBonus + Math.floor(Math.random() * 8); // 10~17+
      
      await this.modifyFriendship(sessionId, hostNo, inviteeNo, friendshipChange, 'hunting', '수렵 초대');
      await this.modifyFriendship(sessionId, inviteeNo, hostNo, Math.floor(friendshipChange * 0.9), 'hunting', '수렵 참석');
      totalFriendshipGain += friendshipChange;
    }
    
    // 영향력도 약간 상승
    const influenceGain = 3 + inviteeNos.length;
    host.fame = (host.fame || 0) + influenceGain;
    await host.save();
    
    return {
      success: true,
      friendshipChange: totalFriendshipGain,
      influenceChange: influenceGain,
      message: `수렵을 개최했습니다. ${inviteeNos.length}명과 함께. 총 우호도 +${totalFriendshipGain}`,
      effects: [{ type: 'hunting', attendees: inviteeNos.length, totalFriendshipGain }],
    };
  }

  /**
   * 연설(Speech) - 대중 대상, 지지율 상승
   */
  static async deliverSpeech(
    sessionId: string,
    commanderNo: number,
    planetId: string,
    politics: number,
    leadership: number
  ): Promise<InteractionResult> {
    const commander = await LoghCommander.findOne({ session_id: sessionId, no: commanderNo });
    const planet = await Planet.findOne({ session_id: sessionId, planetId });
    
    if (!commander || !planet) {
      return { success: false, friendshipChange: 0, influenceChange: 0, message: '커맨더 또는 행성을 찾을 수 없습니다.' };
    }

    // 정치력 + 통솔력 기반 성공률
    const avgStat = (politics + leadership) / 2;
    const baseApprovalChange = Math.floor((avgStat - 40) / 5); // -2 ~ +12
    const randomFactor = Math.floor(Math.random() * 10) - 4; // -4 ~ +5
    
    const approvalChange = baseApprovalChange + randomFactor;
    const influenceGain = Math.max(0, Math.floor(approvalChange * 1.5));
    
    // 행성 지지율 변경
    const oldApproval = planet.stats.approvalRating;
    planet.stats.approvalRating = Math.max(0, Math.min(100, oldApproval + approvalChange));
    await planet.save();
    
    // 커맨더 영향력 상승
    commander.fame = (commander.fame || 0) + influenceGain;
    await commander.save();
    
    const resultMessage = approvalChange > 0
      ? `연설이 성공적이었습니다. ${planet.name} 지지율 +${approvalChange}% (현재: ${planet.stats.approvalRating}%)`
      : `연설이 효과적이지 못했습니다. ${planet.name} 지지율 ${approvalChange}%`;
    
    return {
      success: approvalChange > 0,
      friendshipChange: 0,
      influenceChange: influenceGain,
      message: resultMessage,
      effects: [{ type: 'speech', planetId, approvalChange, newApproval: planet.stats.approvalRating }],
    };
  }

  // ===== 파벌 시스템 =====

  /**
   * 파벌 생성
   */
  static async createFaction(
    sessionId: string,
    leaderNo: number,
    name: string
  ): Promise<IFaction | null> {
    const leader = await LoghCommander.findOne({ session_id: sessionId, no: leaderNo });
    if (!leader) return null;

    // 이미 다른 파벌의 리더인지 확인
    const existingFaction = await Faction.findOne({ 
      session_id: sessionId, 
      leaderNo, 
      isActive: true 
    });
    if (existingFaction) return null;

    const factionId = `faction_${leaderNo}_${Date.now()}`;
    
    const faction = new Faction({
      session_id: sessionId,
      factionId,
      name,
      alignment: leader.faction,
      leaderNo,
      leaderName: leader.name,
      members: [{
        commanderNo: leaderNo,
        name: leader.name,
        role: 'leader',
        joinedAt: new Date(),
        influence: 100,
      }],
      stats: {
        totalInfluence: leader.fame || 0,
        politicalPower: leader.stats?.politics || 50,
        militaryPower: leader.stats?.command || 50,
        economicPower: 0,
        popularity: 0,
      },
      treasury: 0,
      relations: [],
      policies: [],
      isActive: true,
    });

    await faction.save();
    return faction;
  }

  /**
   * 파벌 가입
   */
  static async joinFaction(
    sessionId: string,
    factionId: string,
    commanderNo: number
  ): Promise<boolean> {
    const faction = await Faction.findOne({ session_id: sessionId, factionId, isActive: true });
    const commander = await LoghCommander.findOne({ session_id: sessionId, no: commanderNo });
    
    if (!faction || !commander) return false;
    
    // 이미 멤버인지 확인
    if (faction.members.some(m => m.commanderNo === commanderNo)) return false;
    
    faction.members.push({
      commanderNo,
      name: commander.name,
      role: 'member',
      joinedAt: new Date(),
      influence: 10,
    });
    
    // 파벌 영향력 재계산
    await this.recalculateFactionStats(faction);
    await faction.save();
    
    return true;
  }

  /**
   * 파벌 탈퇴
   */
  static async leaveFaction(
    sessionId: string,
    factionId: string,
    commanderNo: number
  ): Promise<boolean> {
    const faction = await Faction.findOne({ session_id: sessionId, factionId, isActive: true });
    if (!faction) return false;
    
    // 리더는 탈퇴 불가 (해체만 가능)
    if (faction.leaderNo === commanderNo) return false;
    
    faction.members = faction.members.filter(m => m.commanderNo !== commanderNo);
    
    await this.recalculateFactionStats(faction);
    await faction.save();
    
    return true;
  }

  /**
   * 파벌 해체
   */
  static async dissolveFaction(
    sessionId: string,
    factionId: string,
    commanderNo: number
  ): Promise<boolean> {
    const faction = await Faction.findOne({ session_id: sessionId, factionId, isActive: true });
    if (!faction) return false;
    
    // 리더만 해체 가능
    if (faction.leaderNo !== commanderNo) return false;
    
    faction.isActive = false;
    faction.dissolvedAt = new Date();
    await faction.save();
    
    return true;
  }

  /**
   * 파벌 스탯 재계산
   */
  private static async recalculateFactionStats(faction: IFaction): Promise<void> {
    let totalInfluence = 0;
    let totalPolitics = 0;
    let totalMilitary = 0;
    
    for (const member of faction.members) {
      const commander = await LoghCommander.findOne({ 
        session_id: faction.session_id, 
        no: member.commanderNo 
      });
      if (commander) {
        totalInfluence += commander.fame || 0;
        totalPolitics += commander.stats?.politics || 50;
        totalMilitary += commander.stats?.command || 50;
      }
    }
    
    const memberCount = faction.members.length || 1;
    faction.stats.totalInfluence = totalInfluence;
    faction.stats.politicalPower = Math.round(totalPolitics / memberCount);
    faction.stats.militaryPower = Math.round(totalMilitary / memberCount);
  }

  /**
   * 커맨더가 속한 파벌 조회
   */
  static async getCommanderFaction(
    sessionId: string,
    commanderNo: number
  ): Promise<IFaction | null> {
    return await Faction.findOne({
      session_id: sessionId,
      'members.commanderNo': commanderNo,
      isActive: true,
    });
  }

  // ===== 사재 시스템 =====

  /**
   * 사재로 공공 사업 기부 (명성/공적치 환산)
   */
  static async donate(
    sessionId: string,
    commanderNo: number,
    amount: number
  ): Promise<InteractionResult> {
    const commander = await LoghCommander.findOne({ session_id: sessionId, no: commanderNo });
    if (!commander) {
      return { success: false, friendshipChange: 0, influenceChange: 0, message: '커맨더를 찾을 수 없습니다.' };
    }

    const personalFunds = commander.customData?.personalFunds || 0;
    if (personalFunds < amount) {
      return { success: false, friendshipChange: 0, influenceChange: 0, message: '사재가 부족합니다.' };
    }

    // 사재 차감
    if (!commander.customData) commander.customData = {};
    commander.customData.personalFunds = personalFunds - amount;
    
    // 명성/공적 상승 (기부액의 1/100)
    const fameGain = Math.floor(amount / 100);
    const meritGain = Math.floor(amount / 50);
    
    commander.fame = (commander.fame || 0) + fameGain;
    commander.merit = (commander.merit || 0) + meritGain;
    
    commander.markModified('customData');
    await commander.save();
    
    return {
      success: true,
      friendshipChange: 0,
      influenceChange: fameGain,
      message: `${amount} 기부. 명성 +${fameGain}, 공적 +${meritGain}`,
      effects: [{ type: 'donate', amount, fameGain, meritGain }],
    };
  }

  /**
   * 로비 - 인사 청탁 등
   */
  static async lobby(
    sessionId: string,
    commanderNo: number,
    targetNo: number,
    amount: number,
    purpose: string
  ): Promise<InteractionResult> {
    const commander = await LoghCommander.findOne({ session_id: sessionId, no: commanderNo });
    const target = await LoghCommander.findOne({ session_id: sessionId, no: targetNo });
    
    if (!commander || !target) {
      return { success: false, friendshipChange: 0, influenceChange: 0, message: '대상을 찾을 수 없습니다.' };
    }

    const personalFunds = commander.customData?.personalFunds || 0;
    if (personalFunds < amount) {
      return { success: false, friendshipChange: 0, influenceChange: 0, message: '사재가 부족합니다.' };
    }

    // 사재 차감
    if (!commander.customData) commander.customData = {};
    commander.customData.personalFunds = personalFunds - amount;
    
    // 로비 성공률 계산 (금액 + 상대방 청렴도 기반)
    const targetPolitics = target.stats?.politics || 50;
    const successChance = Math.min(90, 30 + Math.floor(amount / 100) - Math.floor(targetPolitics / 5));
    const roll = Math.random() * 100;
    
    const success = roll < successChance;
    
    if (success) {
      // 우호도 대폭 상승
      const friendshipGain = 15 + Math.floor(amount / 200);
      await this.modifyFriendship(sessionId, targetNo, commanderNo, friendshipGain, 'meeting', '로비 수락');
      
      commander.markModified('customData');
      await commander.save();
      
      return {
        success: true,
        friendshipChange: friendshipGain,
        influenceChange: 0,
        message: `로비 성공. ${target.name}의 호의를 얻었습니다. 우호도 +${friendshipGain}`,
        effects: [{ type: 'lobby', targetNo, amount, purpose, result: 'success' }],
      };
    } else {
      // 실패 - 금액만 소모
      commander.markModified('customData');
      await commander.save();
      
      return {
        success: false,
        friendshipChange: 0,
        influenceChange: 0,
        message: `로비 실패. ${target.name}은(는) 제안을 거절했습니다.`,
        effects: [{ type: 'lobby', targetNo, amount, purpose, result: 'failure' }],
      };
    }
  }

  /**
   * 사재 조회
   */
  static async getPersonalFunds(sessionId: string, commanderNo: number): Promise<number> {
    const commander = await LoghCommander.findOne({ session_id: sessionId, no: commanderNo });
    return commander?.customData?.personalFunds || 0;
  }

  /**
   * 사재 추가/차감
   */
  static async modifyPersonalFunds(
    sessionId: string,
    commanderNo: number,
    change: number
  ): Promise<number> {
    const commander = await LoghCommander.findOne({ session_id: sessionId, no: commanderNo });
    if (!commander) return 0;

    if (!commander.customData) commander.customData = {};
    const currentFunds = commander.customData.personalFunds || 0;
    const newFunds = Math.max(0, currentFunds + change);
    commander.customData.personalFunds = newFunds;
    
    commander.markModified('customData');
    await commander.save();
    
    return newFunds;
  }
}







