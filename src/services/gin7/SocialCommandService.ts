/**
 * SocialCommandService - 사교 커맨드 실행 서비스
 * 매뉴얼 4713행~ 기반 구현
 *
 * 사교 커맨드:
 * - NIGHT_PARTY (夜会): 야회 - 귀족 사교 행사
 * - HUNTING (狩猟): 수렵 - 귀족 스포츠
 * - OFFICIAL_MEETING (会談): 회담 - 공식 회담
 * - INFORMAL_TALK (談話): 담화 - 비공식 대화
 * - PUBLIC_SPEECH (演説): 연설 - 대중 연설
 */

import { EventEmitter } from 'events';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { COMMAND_DEFINITIONS } from '../../constants/gin7/command_definitions';
import { logger } from '../../common/logger';

// ============================================================
// Types
// ============================================================

export interface SocialCommandRequest {
  sessionId: string;
  characterId: string;     // 실행자
  commandId: string;       // 커맨드 ID
  targetId?: string;       // 대상 캐릭터 (회담/담화 등)
  planetId?: string;       // 대상 행성
  params?: Record<string, any>; // 추가 파라미터
}

export interface SocialCommandResult {
  success: boolean;
  commandId: string;
  effects: {
    influenceChange?: number;
    friendshipChange?: number;
    supportChange?: number;
    reputationChange?: number;
  };
  cpCost: number;
  message?: string;
  error?: string;
}

export interface PartyParticipant {
  characterId: string;
  name: string;
  rank: string;
  faction: string;
}

export interface HuntingResult {
  success: boolean;
  trophies: number;        // 사냥 성과
  companionBonus: number;  // 동반자 보너스
}

// ============================================================
// SocialCommandService Class
// ============================================================

export class SocialCommandService extends EventEmitter {
  private static instance: SocialCommandService;

  private constructor() {
    super();
    logger.info('[SocialCommandService] Initialized');
  }

  public static getInstance(): SocialCommandService {
    if (!SocialCommandService.instance) {
      SocialCommandService.instance = new SocialCommandService();
    }
    return SocialCommandService.instance;
  }

  // ============================================================
  // 메인 실행
  // ============================================================

  /**
   * 사교 커맨드 라우터
   */
  public async executeSocialCommand(request: SocialCommandRequest): Promise<SocialCommandResult> {
    const { commandId } = request;

    switch (commandId) {
      case 'NIGHT_PARTY':
        return this.nightParty(request);
      case 'HUNTING':
        return this.hunting(request);
      case 'OFFICIAL_MEETING':
        return this.officialMeeting(request);
      case 'INFORMAL_TALK':
        return this.informalTalk(request);
      case 'PUBLIC_SPEECH':
        return this.publicSpeech(request);
      default:
        return this.errorResult(commandId, 0, '알 수 없는 사교 커맨드입니다.');
    }
  }

  // ============================================================
  // 사교 커맨드 구현
  // ============================================================

  /**
   * 야회 (夜会) - 귀족 사교 행사
   * 수도에서 개최. 참석자들과의 교류를 통해 영향력 획득
   * CP: 320
   */
  public async nightParty(request: SocialCommandRequest): Promise<SocialCommandResult> {
    const { sessionId, characterId, params } = request;
    const cpCost = this.getCommandCost('NIGHT_PARTY');

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('NIGHT_PARTY', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 수도에서만 개최 가능 여부 체크 (선택적)
      const locationValid = await this.validateCapitalLocation(sessionId, character);
      if (!locationValid) {
        return this.errorResult('NIGHT_PARTY', cpCost, '야회는 수도에서만 개최할 수 있습니다.');
      }

      // 작위 보유 시 추가 보너스
      const nobilityBonus = this.calculateNobilityBonus(character);
      
      // 매력 기반 영향력 증가
      const charmStat = character.stats?.charm || 50;
      const charmBonus = charmStat / 100;
      const baseInfluence = 5;
      const influenceGain = Math.floor(baseInfluence * (1 + charmBonus) * (1 + nobilityBonus));

      // 명성 변화 (소규모)
      const reputationGain = Math.floor(2 * (1 + nobilityBonus));

      // 영향력 업데이트
      if (!character.data) character.data = {};
      const currentInfluence = character.data.influence || 0;
      const currentReputation = character.data.reputation || 0;
      character.data.influence = currentInfluence + influenceGain;
      character.data.reputation = currentReputation + reputationGain;
      await character.save();

      // 참석자 목록 (선택적 - params에서 제공)
      const participants: PartyParticipant[] = params?.participants || [];

      this.emit('social:nightParty', {
        sessionId,
        characterId,
        characterName: character.name,
        influenceGain,
        reputationGain,
        participants,
        timestamp: new Date(),
      });

      logger.info(`[SocialCommandService] Night party hosted by ${character.name}, influence +${influenceGain}`);

      return {
        success: true,
        commandId: 'NIGHT_PARTY',
        effects: {
          influenceChange: influenceGain,
          reputationChange: reputationGain,
        },
        cpCost,
        message: `야회를 개최하여 영향력이 ${influenceGain} 상승했습니다.`,
      };
    } catch (error) {
      logger.error('[SocialCommandService] Night party error:', error);
      return this.errorResult('NIGHT_PARTY', cpCost, '야회 처리 중 오류 발생');
    }
  }

  /**
   * 수렵 (狩猟) - 귀족 스포츠
   * 봉토에서 사냥. 동반자와 함께 시 우호도 상승
   * CP: 320
   */
  public async hunting(request: SocialCommandRequest): Promise<SocialCommandResult> {
    const { sessionId, characterId, targetId, params } = request;
    const cpCost = this.getCommandCost('HUNTING');

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      if (!character) {
        return this.errorResult('HUNTING', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 봉토 소유 여부 체크 (남작 이상)
      const hasFief = await this.checkFiefOwnership(sessionId, characterId);
      if (!hasFief) {
        return this.errorResult('HUNTING', cpCost, '수렵은 자신의 봉토에서만 가능합니다.');
      }

      // 기본 영향력 증가
      const baseInfluenceGain = 3;
      let influenceGain = baseInfluenceGain;
      let friendshipGain = 0;

      // 사냥 성과 (랜덤 요소)
      const huntingSkill = (character.stats?.agility || 50) / 100;
      const trophies = Math.floor(Math.random() * 5 * (1 + huntingSkill)) + 1;
      influenceGain += Math.floor(trophies / 2);

      // 동반자가 있는 경우 우호도 상승
      let companionName = '';
      if (targetId) {
        const companion = await Gin7Character.findOne({ sessionId, characterId: targetId });
        if (companion) {
          companionName = companion.name;
          // 매력 기반 우호도 상승
          const charmBonus = (character.stats?.charm || 50) / 100;
          friendshipGain = Math.floor(8 * (1 + charmBonus));
          
          // 우호도 데이터 저장
          await this.updateFriendship(sessionId, characterId, targetId, friendshipGain);
        }
      }

      // 영향력 업데이트
      if (!character.data) character.data = {};
      const currentInfluence = character.data.influence || 0;
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      const huntingResult: HuntingResult = {
        success: true,
        trophies,
        companionBonus: friendshipGain,
      };

      this.emit('social:hunting', {
        sessionId,
        characterId,
        characterName: character.name,
        companionId: targetId,
        companionName,
        influenceGain,
        friendshipGain,
        trophies,
        timestamp: new Date(),
      });

      logger.info(`[SocialCommandService] Hunting by ${character.name}, trophies: ${trophies}, influence +${influenceGain}`);

      const message = companionName
        ? `${companionName}과(와) 함께 수렵을 즐겼습니다. 영향력 +${influenceGain}, 우호도 +${friendshipGain}`
        : `수렵을 즐겼습니다. 사냥 성과: ${trophies}, 영향력 +${influenceGain}`;

      return {
        success: true,
        commandId: 'HUNTING',
        effects: {
          influenceChange: influenceGain,
          friendshipChange: friendshipGain,
        },
        cpCost,
        message,
      };
    } catch (error) {
      logger.error('[SocialCommandService] Hunting error:', error);
      return this.errorResult('HUNTING', cpCost, '수렵 처리 중 오류 발생');
    }
  }

  /**
   * 회담 (会談) - 공식 회담
   * 호텔에서 개최. 정치적 협상을 통한 영향력 변화
   * CP: 320
   */
  public async officialMeeting(request: SocialCommandRequest): Promise<SocialCommandResult> {
    const { sessionId, characterId, targetId } = request;
    const cpCost = this.getCommandCost('CONFERENCE');

    if (!targetId) {
      return this.errorResult('OFFICIAL_MEETING', cpCost, '회담 대상이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!character || !target) {
        return this.errorResult('OFFICIAL_MEETING', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 같은 위치에 있는지 체크
      const sameLocation = await this.checkSameLocation(character, target);
      if (!sameLocation) {
        return this.errorResult('OFFICIAL_MEETING', cpCost, '같은 장소에 있어야 회담이 가능합니다.');
      }

      // 정치력 기반 영향력 변화
      const politicsStat = character.stats?.politics || 50;
      const politicsBonus = politicsStat / 100;
      const targetPolitics = target.stats?.politics || 50;

      // 양측 정치력 비교로 영향력 결정
      const politicsDiff = (politicsStat - targetPolitics) / 100;
      const baseInfluence = 5;
      const influenceGain = Math.floor(baseInfluence * (1 + politicsBonus + politicsDiff * 0.5));

      // 회담 결과에 따른 소폭의 우호도 변화
      const friendshipChange = Math.floor(3 * politicsBonus);

      // 영향력 업데이트
      if (!character.data) character.data = {};
      const currentInfluence = character.data.influence || 0;
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      // 우호도 업데이트
      if (friendshipChange > 0) {
        await this.updateFriendship(sessionId, characterId, targetId, friendshipChange);
      }

      this.emit('social:officialMeeting', {
        sessionId,
        characterId,
        characterName: character.name,
        targetId,
        targetName: target.name,
        influenceGain,
        friendshipChange,
        timestamp: new Date(),
      });

      logger.info(`[SocialCommandService] Official meeting: ${character.name} with ${target.name}, influence +${influenceGain}`);

      return {
        success: true,
        commandId: 'OFFICIAL_MEETING',
        effects: {
          influenceChange: influenceGain,
          friendshipChange,
        },
        cpCost,
        message: `${target.name}과(와)의 회담을 통해 영향력이 ${influenceGain} 상승했습니다.`,
      };
    } catch (error) {
      logger.error('[SocialCommandService] Official meeting error:', error);
      return this.errorResult('OFFICIAL_MEETING', cpCost, '회담 처리 중 오류 발생');
    }
  }

  /**
   * 담화 (談話) - 비공식 대화
   * 호텔에서 진행. 친밀감 형성을 통한 우호도/영향력 변화
   * CP: 320
   */
  public async informalTalk(request: SocialCommandRequest): Promise<SocialCommandResult> {
    const { sessionId, characterId, targetId } = request;
    const cpCost = this.getCommandCost('TALK');

    if (!targetId) {
      return this.errorResult('INFORMAL_TALK', cpCost, '담화 대상이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      const target = await Gin7Character.findOne({ sessionId, characterId: targetId });

      if (!character || !target) {
        return this.errorResult('INFORMAL_TALK', cpCost, '캐릭터를 찾을 수 없습니다.');
      }

      // 같은 위치 체크
      const sameLocation = await this.checkSameLocation(character, target);
      if (!sameLocation) {
        return this.errorResult('INFORMAL_TALK', cpCost, '같은 장소에 있어야 담화가 가능합니다.');
      }

      // 매력 기반 우호도/영향력 변화
      const charmStat = character.stats?.charm || 50;
      const charmBonus = charmStat / 100;

      // 담화는 우호도 중심
      const friendshipGain = Math.floor(10 * charmBonus);
      const influenceGain = Math.floor(3 * charmBonus);

      // 기존 우호도에 따른 보너스
      const existingFriendship = await this.getFriendship(sessionId, characterId, targetId);
      const friendshipBonus = Math.floor(existingFriendship / 20);
      const totalFriendshipGain = friendshipGain + friendshipBonus;

      // 영향력 업데이트
      if (!character.data) character.data = {};
      const currentInfluence = character.data.influence || 0;
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      // 양방향 우호도 업데이트
      await this.updateFriendship(sessionId, characterId, targetId, totalFriendshipGain);
      await this.updateFriendship(sessionId, targetId, characterId, Math.floor(totalFriendshipGain * 0.5));

      this.emit('social:informalTalk', {
        sessionId,
        characterId,
        characterName: character.name,
        targetId,
        targetName: target.name,
        friendshipGain: totalFriendshipGain,
        influenceGain,
        timestamp: new Date(),
      });

      logger.info(`[SocialCommandService] Informal talk: ${character.name} with ${target.name}, friendship +${totalFriendshipGain}`);

      return {
        success: true,
        commandId: 'INFORMAL_TALK',
        effects: {
          friendshipChange: totalFriendshipGain,
          influenceChange: influenceGain,
        },
        cpCost,
        message: `${target.name}과(와)의 담화를 통해 우호도가 ${totalFriendshipGain} 상승했습니다.`,
      };
    } catch (error) {
      logger.error('[SocialCommandService] Informal talk error:', error);
      return this.errorResult('INFORMAL_TALK', cpCost, '담화 처리 중 오류 발생');
    }
  }

  /**
   * 연설 (演説) - 대중 연설
   * 광장에서 진행. 대중에 대한 영향력/지지율 변화
   * CP: 320
   */
  public async publicSpeech(request: SocialCommandRequest): Promise<SocialCommandResult> {
    const { sessionId, characterId, planetId, params } = request;
    const cpCost = this.getCommandCost('SPEECH');

    if (!planetId) {
      return this.errorResult('PUBLIC_SPEECH', cpCost, '연설할 행성이 필요합니다.');
    }

    try {
      const character = await Gin7Character.findOne({ sessionId, characterId });
      const planet = await Planet.findOne({ sessionId, planetId });

      if (!character) {
        return this.errorResult('PUBLIC_SPEECH', cpCost, '캐릭터를 찾을 수 없습니다.');
      }
      if (!planet) {
        return this.errorResult('PUBLIC_SPEECH', cpCost, '행성을 찾을 수 없습니다.');
      }

      // 매력 기반 효과
      const charmStat = character.stats?.charm || 50;
      const charmBonus = charmStat / 100;

      // 정치력도 연설 효과에 영향
      const politicsStat = character.stats?.politics || 50;
      const politicsBonus = politicsStat / 200; // 절반 가중치

      // 지지율 변화 (연설의 주 효과)
      const baseSupportGain = 10;
      const supportGain = Math.floor(baseSupportGain * (1 + charmBonus + politicsBonus));

      // 영향력 변화 (부가 효과)
      const baseInfluenceGain = 5;
      const influenceGain = Math.floor(baseInfluenceGain * (1 + charmBonus));

      // 연설 주제에 따른 보너스 (선택적)
      const speechTopic = params?.topic || 'general';
      const topicBonus = this.calculateSpeechTopicBonus(speechTopic, planet);
      const totalSupportGain = supportGain + topicBonus;

      // 행성 지지율 업데이트
      const currentLoyalty = planet.loyalty || 50;
      planet.loyalty = Math.min(100, currentLoyalty + totalSupportGain);
      await planet.save();

      // 캐릭터 영향력 업데이트
      if (!character.data) character.data = {};
      const currentInfluence = character.data.influence || 0;
      character.data.influence = currentInfluence + influenceGain;
      await character.save();

      this.emit('social:publicSpeech', {
        sessionId,
        characterId,
        characterName: character.name,
        planetId,
        planetName: planet.name,
        supportGain: totalSupportGain,
        influenceGain,
        topic: speechTopic,
        timestamp: new Date(),
      });

      logger.info(`[SocialCommandService] Public speech by ${character.name} on ${planet.name}, support +${totalSupportGain}`);

      return {
        success: true,
        commandId: 'PUBLIC_SPEECH',
        effects: {
          supportChange: totalSupportGain,
          influenceChange: influenceGain,
        },
        cpCost,
        message: `${planet.name}에서의 연설로 지지율이 ${totalSupportGain}% 상승했습니다.`,
      };
    } catch (error) {
      logger.error('[SocialCommandService] Public speech error:', error);
      return this.errorResult('PUBLIC_SPEECH', cpCost, '연설 처리 중 오류 발생');
    }
  }

  // ============================================================
  // 헬퍼 메서드
  // ============================================================

  private getCommandCost(commandId: string): number {
    const def = COMMAND_DEFINITIONS.find(c => c.id === commandId);
    return def?.cost || 320;
  }

  private errorResult(commandId: string, cpCost: number, error: string): SocialCommandResult {
    return {
      success: false,
      commandId,
      effects: {},
      cpCost,
      error,
    };
  }

  /**
   * 수도 위치 검증
   */
  private async validateCapitalLocation(sessionId: string, character: IGin7Character): Promise<boolean> {
    // TODO: 실제 위치 검증 로직 구현
    // 현재는 항상 통과
    return true;
  }

  /**
   * 봉토 소유 여부 확인
   */
  private async checkFiefOwnership(sessionId: string, characterId: string): Promise<boolean> {
    // TODO: FiefService 연동하여 봉토 소유 확인
    // 현재는 항상 통과
    return true;
  }

  /**
   * 작위 보너스 계산 (제국군)
   */
  private calculateNobilityBonus(character: IGin7Character): number {
    const title = character.data?.nobility?.title;
    if (!title) return 0;

    const bonusMap: Record<string, number> = {
      'duke': 0.5,      // 공작
      'marquis': 0.4,   // 후작
      'count': 0.3,     // 백작
      'viscount': 0.2,  // 자작
      'baron': 0.15,    // 남작
      'knight': 0.05,   // 기사
    };

    return bonusMap[title] || 0;
  }

  /**
   * 같은 위치인지 확인
   */
  private async checkSameLocation(char1: IGin7Character, char2: IGin7Character): Promise<boolean> {
    // TODO: SpotService 연동하여 실제 위치 비교
    // 현재는 항상 통과
    return true;
  }

  /**
   * 우호도 업데이트
   */
  private async updateFriendship(
    sessionId: string,
    fromCharId: string,
    toCharId: string,
    change: number
  ): Promise<void> {
    // TODO: 우호도 시스템 구현 시 실제 데이터 저장
    logger.debug(`[SocialCommandService] Friendship update: ${fromCharId} -> ${toCharId}, +${change}`);
  }

  /**
   * 우호도 조회
   */
  private async getFriendship(
    sessionId: string,
    fromCharId: string,
    toCharId: string
  ): Promise<number> {
    // TODO: 우호도 시스템 구현 시 실제 데이터 조회
    return 50; // 기본값
  }

  /**
   * 연설 주제 보너스 계산
   */
  private calculateSpeechTopicBonus(topic: string, planet: IPlanet): number {
    // 행성 상황에 맞는 주제일 경우 보너스
    const topicBonuses: Record<string, (p: IPlanet) => number> = {
      'war': (p) => (p.loyalty || 50) < 50 ? 5 : 2,     // 전쟁 관련 - 불안정 지역에서 효과적
      'economy': (p) => ((p as any).economy || 50) < 50 ? 5 : 2, // 경제 관련 - 경제 침체 지역에서 효과적
      'security': (p) => ((p as any).defense || 50) < 50 ? 5 : 2, // 안보 관련
      'general': () => 3, // 일반 연설
    };

    const bonusFunc = topicBonuses[topic] || topicBonuses.general;
    return bonusFunc(planet);
  }
}

export const socialCommandService = SocialCommandService.getInstance();
export default SocialCommandService;





