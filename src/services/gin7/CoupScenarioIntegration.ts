/**
 * CoupScenarioIntegration - 쿠데타 시스템과 시나리오 이벤트 엔진 연동
 * 
 * 주요 시나리오 이벤트:
 * - 립슈타트 전역 (귀족 반란) - 은하제국 내전
 * - 구국군사회의 쿠데타 - 자유행성동맹 군부 쿠데타
 * - 페잔 자치령 몰락 - 정권 교체
 */

import { EventEmitter } from 'events';
import { ScenarioEventEngine, TriggerContext, EventExecutionResult } from './ScenarioEventEngine';
import { CoupService, coupService } from './CoupService';
import { CoupType, CoupScenarioEvent } from '../../types/gin7/coup.types';
import { ScenarioEvent, EventAction, EventChoice } from '../../types/gin7/scenario.types';
import { ScenarioSession } from '../../models/gin7/ScenarioSession';
import { Gin7Character } from '../../models/gin7/Character';
import { PoliticsService } from './PoliticsService';
import { logger } from '../../common/logger';

// ============================================================================
// 주요 시나리오 이벤트 정의
// ============================================================================

/**
 * 립슈타트 전역 (은하제국 귀족 반란)
 * 트리거: 라인하르트가 제국 수상이 되고, 귀족 불만이 높을 때
 */
export const LIPSTADT_WAR_EVENT: ScenarioEvent = {
  id: 'event_lipstadt_war',
  name: '립슈타트 전역',
  description: '브라운슈바이크 공작과 리텐하임 후작을 중심으로 한 귀족연합이 라인하르트에 대항하여 반란을 일으킨다.',
  
  trigger: {
    type: 'ON_CONDITION_MET',
    params: {
      conditionId: 'condition_noble_revolt'
    }
  },
  
  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'reinhard_is_regent' }
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'braunschweig' }
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'littenheim' }
        }
      ]
    }
  ],
  
  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'narrator',
        speakerName: '역사 기록',
        text: '우주력 797년, 제국 최대의 내전이 시작되었다. 골든바움 왕조의 수호를 명분으로 귀족연합군이 결성되어 신제국 원수 라인하르트 폰 로엔그람에게 반기를 들었다.',
        portrait: 'narrator_portrait',
        duration: 5000
      }
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'braunschweig',
        speakerName: '브라운슈바이크 공작',
        text: '금발의 꼬마 원수는 고작 타락한 황제의 총신에 불과하다! 우리 귀족이야말로 진정한 제국의 기둥이다!',
        portrait: 'braunschweig_portrait',
        duration: 4000
      }
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'lipstadt_war_started',
        flagValue: true
      }
    }
  ],
  
  choices: [
    {
      id: 'choice_join_nobles',
      text: '귀족연합에 가담한다',
      conditions: [
        {
          type: 'AND',
          checks: [
            {
              checkType: 'FLAG_SET',
              params: { flagName: 'player_is_noble' }
            }
          ]
        }
      ],
      actions: [
        {
          type: 'SET_FLAG',
          params: { flagName: 'player_joined_nobles', flagValue: true }
        },
        {
          type: 'CUSTOM',
          params: {
            scriptId: 'join_lipstadt_rebellion',
            customData: { side: 'nobles' }
          }
        }
      ],
      consequences: '귀족연합에 합류합니다. 승리하면 높은 작위를, 패배하면 반역죄로 처형당합니다.'
    },
    {
      id: 'choice_join_reinhard',
      text: '라인하르트 측에 선다',
      actions: [
        {
          type: 'SET_FLAG',
          params: { flagName: 'player_joined_reinhard', flagValue: true }
        },
        {
          type: 'CUSTOM',
          params: {
            scriptId: 'join_reinhard_forces',
            customData: { side: 'reinhard' }
          }
        }
      ],
      consequences: '라인하르트 휘하에 합류합니다. 승리하면 신제국의 공신이 됩니다.'
    },
    {
      id: 'choice_stay_neutral',
      text: '중립을 유지한다',
      actions: [
        {
          type: 'SET_FLAG',
          params: { flagName: 'player_neutral_lipstadt', flagValue: true }
        }
      ],
      consequences: '어느 쪽에도 가담하지 않습니다. 전쟁 후 양쪽 모두에게 경계받을 수 있습니다.'
    }
  ],
  
  once: true,
  priority: 100,
  enabled: true
};

/**
 * 구국군사회의 쿠데타 (자유행성동맹)
 * 트리거: 동맹 정부의 지지율이 낮고, 전쟁 패배가 이어질 때
 */
export const SALVATION_MILITARY_COUNCIL_EVENT: ScenarioEvent = {
  id: 'event_salvation_council_coup',
  name: '구국군사회의 쿠데타',
  description: '그린힐 대장을 중심으로 한 군부 세력이 무능한 민간 정부를 타도하고 군사 정권을 수립하려 한다.',
  
  trigger: {
    type: 'ON_CONDITION_MET',
    params: {
      conditionId: 'condition_alliance_military_coup'
    }
  },
  
  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'alliance_war_weariness_high' }
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'greenhill_senior' }
        }
      ]
    }
  ],
  
  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'narrator',
        speakerName: '역사 기록',
        text: '우주력 798년, 자유행성동맹의 수도 하이네센에서 군부 쿠데타가 발생했다. 구국군사회의는 민주주의의 혼란을 바로잡겠다는 명분을 내세웠다.',
        portrait: 'narrator_portrait',
        duration: 5000
      }
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'greenhill_senior',
        speakerName: '드와이트 그린힐 대장',
        text: '무능한 정치인들의 시대는 끝났다. 군인이 이 나라를 바로잡아야 할 때가 왔다.',
        portrait: 'greenhill_portrait',
        duration: 4000
      }
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'salvation_council_coup_started',
        flagValue: true
      }
    }
  ],
  
  choices: [
    {
      id: 'choice_support_coup',
      text: '쿠데타에 협력한다',
      conditions: [
        {
          type: 'AND',
          checks: [
            {
              checkType: 'FLAG_SET',
              params: { flagName: 'player_is_alliance_military' }
            }
          ]
        }
      ],
      actions: [
        {
          type: 'SET_FLAG',
          params: { flagName: 'player_coup_supporter', flagValue: true }
        }
      ],
      consequences: '구국군사회의에 합류합니다. 쿠데타가 실패하면 반역죄로 처벌받습니다.'
    },
    {
      id: 'choice_oppose_coup',
      text: '쿠데타에 저항한다',
      actions: [
        {
          type: 'SET_FLAG',
          params: { flagName: 'player_coup_opposer', flagValue: true }
        }
      ],
      consequences: '합법 정부를 지지합니다. 양 웬리의 이제르론 함대와 협력하게 됩니다.'
    },
    {
      id: 'choice_flee_capital',
      text: '수도를 탈출한다',
      actions: [
        {
          type: 'SET_FLAG',
          params: { flagName: 'player_fled_heinessen', flagValue: true }
        }
      ],
      consequences: '혼란을 피해 수도를 떠납니다. 어느 쪽에도 가담하지 않습니다.'
    }
  ],
  
  once: true,
  priority: 100,
  enabled: true
};

// ============================================================================
// CoupScenarioIntegration Class
// ============================================================================

export class CoupScenarioIntegration {
  private static instance: CoupScenarioIntegration;
  private scenarioEngine: ScenarioEventEngine;
  private eventEmitter: EventEmitter;
  
  private constructor() {
    this.scenarioEngine = ScenarioEventEngine.getInstance();
    this.eventEmitter = new EventEmitter();
    this.registerCoupActions();
    this.subscribeToEvents();
  }
  
  public static getInstance(): CoupScenarioIntegration {
    if (!CoupScenarioIntegration.instance) {
      CoupScenarioIntegration.instance = new CoupScenarioIntegration();
    }
    return CoupScenarioIntegration.instance;
  }
  
  /**
   * 쿠데타 관련 커스텀 액션 핸들러 등록
   */
  private registerCoupActions(): void {
    // 립슈타트 반란 참여 액션
    this.scenarioEngine.registerActionHandler('CUSTOM', async (action, context) => {
      const scriptId = action.params.scriptId as string;
      
      switch (scriptId) {
        case 'join_lipstadt_rebellion':
          await this.handleJoinLipstadt(context, action.params.customData as { side: string });
          break;
        case 'join_reinhard_forces':
          await this.handleJoinReinhard(context);
          break;
        case 'start_coup_from_scenario':
          await this.handleStartCoupFromScenario(context, action.params.customData as any);
          break;
        case 'resolve_coup_outcome':
          await this.handleResolveCoupOutcome(context, action.params.customData as any);
          break;
      }
    });
  }
  
  /**
   * 쿠데타 서비스 이벤트 구독
   */
  private subscribeToEvents(): void {
    // CoupService 결과를 시나리오 플래그로 전파
    this.eventEmitter.on('coup:success', async (data: { sessionId: string; coupType: CoupType }) => {
      await ScenarioSession.updateOne(
        { sessionId: data.sessionId },
        { 
          $set: { 
            [`flags.coup_${data.coupType}_success`]: true,
            [`flags.last_coup_result`]: 'success'
          } 
        }
      );
    });
    
    this.eventEmitter.on('coup:failed', async (data: { sessionId: string; coupType: CoupType }) => {
      await ScenarioSession.updateOne(
        { sessionId: data.sessionId },
        { 
          $set: { 
            [`flags.coup_${data.coupType}_failed`]: true,
            [`flags.last_coup_result`]: 'failed'
          } 
        }
      );
    });
  }
  
  // ============================================================================
  // 시나리오 이벤트 트리거 체크
  // ============================================================================
  
  /**
   * 립슈타트 전역 트리거 조건 체크
   */
  async checkLipstadtTrigger(sessionId: string): Promise<boolean> {
    const session = await ScenarioSession.findOne({ sessionId });
    if (!session) return false;
    
    // 이미 시작된 경우 스킵
    if (session.flags.get('lipstadt_war_started')) return false;
    
    // 라인하르트가 섭정인지 확인
    if (!session.flags.get('reinhard_is_regent')) return false;
    
    // 귀족 불만도 체크
    const government = await PoliticsService.getGovernment(sessionId, 'empire');
    if (!government) return false;
    
    // 귀족 수가 충분하고, 반라인하르트 세력이 있는지
    const antiReinhardNobles = government.nobilityTitles.filter(t => {
      // 브라운슈바이크, 리텐하임 등 주요 귀족
      return ['braunschweig', 'littenheim', 'flegel'].includes(t.holderId);
    });
    
    return antiReinhardNobles.length >= 2;
  }
  
  /**
   * 구국군사회의 쿠데타 트리거 조건 체크
   */
  async checkSalvationCouncilTrigger(sessionId: string): Promise<boolean> {
    const session = await ScenarioSession.findOne({ sessionId });
    if (!session) return false;
    
    // 이미 시작된 경우 스킵
    if (session.flags.get('salvation_council_coup_started')) return false;
    
    // 전쟁 피로도 체크
    if (!session.flags.get('alliance_war_weariness_high')) return false;
    
    // 그린힐 대장 생존 확인
    const greenhill = await Gin7Character.findOne({
      sessionId,
      characterId: 'greenhill_senior',
      state: { $ne: 'dead' }
    });
    
    return !!greenhill;
  }
  
  /**
   * 턴 시작 시 쿠데타 조건 체크 (TimeEngine 연동)
   */
  async checkCoupTriggersOnTurnStart(sessionId: string): Promise<void> {
    // 립슈타트 전역 체크
    if (await this.checkLipstadtTrigger(sessionId)) {
      await this.triggerScenarioEvent(sessionId, LIPSTADT_WAR_EVENT);
    }
    
    // 구국군사회의 체크
    if (await this.checkSalvationCouncilTrigger(sessionId)) {
      await this.triggerScenarioEvent(sessionId, SALVATION_MILITARY_COUNCIL_EVENT);
    }
  }
  
  // ============================================================================
  // 이벤트 핸들러
  // ============================================================================
  
  /**
   * 시나리오 이벤트 트리거
   */
  private async triggerScenarioEvent(
    sessionId: string, 
    event: ScenarioEvent
  ): Promise<EventExecutionResult> {
    const session = await ScenarioSession.findOne({ sessionId });
    if (!session) {
      return { success: false, eventId: event.id, actionsExecuted: 0, error: 'Session not found' };
    }
    
    const context: TriggerContext = {
      sessionId,
      turn: session.currentTurn,
      gameDate: session.gameDate
    };
    
    return this.scenarioEngine.executeEvent(event, context, session);
  }
  
  /**
   * 립슈타트 반란 참여 처리
   */
  private async handleJoinLipstadt(
    context: TriggerContext, 
    data: { side: string }
  ): Promise<void> {
    const session = await ScenarioSession.findOne({ sessionId: context.sessionId });
    if (!session) return;
    
    // 플레이어 캐릭터 확인
    const playerCharacter = await Gin7Character.findOne({
      sessionId: context.sessionId,
      'data.isPlayer': true
    });
    
    if (!playerCharacter) return;
    
    if (data.side === 'nobles') {
      // 귀족연합 가담: 공모에 참여
      const conspiracy = await coupService.canAttemptCoup(
        context.sessionId,
        ['braunschweig', 'littenheim', playerCharacter.characterId]
      );
      
      logger.info('[CoupScenarioIntegration] Player joined noble rebellion', {
        sessionId: context.sessionId,
        playerId: playerCharacter.characterId,
        feasibility: conspiracy.overallChance
      });
    }
  }
  
  /**
   * 라인하르트 진영 참여 처리
   */
  private async handleJoinReinhard(context: TriggerContext): Promise<void> {
    const playerCharacter = await Gin7Character.findOne({
      sessionId: context.sessionId,
      'data.isPlayer': true
    });
    
    if (!playerCharacter) return;
    
    // 라인하르트 휘하로 편입
    playerCharacter.data = playerCharacter.data || {};
    playerCharacter.data.allegiance = 'reinhard';
    playerCharacter.markModified('data');
    await playerCharacter.save();
    
    logger.info('[CoupScenarioIntegration] Player joined Reinhard forces', {
      sessionId: context.sessionId,
      playerId: playerCharacter.characterId
    });
  }
  
  /**
   * 시나리오에서 쿠데타 시작
   */
  private async handleStartCoupFromScenario(
    context: TriggerContext,
    data: {
      leaderId: string;
      coupType: CoupType;
      conspirators: string[];
      fleetIds: string[];
      targetFactionId: string;
    }
  ): Promise<void> {
    try {
      const result = await coupService.executeCoup({
        sessionId: context.sessionId,
        leaderId: data.leaderId,
        targetGovernmentId: `GOV-${data.targetFactionId}`,
        targetFactionId: data.targetFactionId,
        coupType: data.coupType,
        conspirators: data.conspirators,
        fleetIds: data.fleetIds
      });
      
      // 결과를 시나리오 플래그로 저장
      if (result.success) {
        this.eventEmitter.emit('coup:success', {
          sessionId: context.sessionId,
          coupType: data.coupType
        });
      } else {
        this.eventEmitter.emit('coup:failed', {
          sessionId: context.sessionId,
          coupType: data.coupType
        });
      }
      
      logger.info('[CoupScenarioIntegration] Coup executed from scenario', {
        sessionId: context.sessionId,
        coupId: result.coupId,
        success: result.success
      });
    } catch (error) {
      logger.error('[CoupScenarioIntegration] Failed to execute coup from scenario', { error });
    }
  }
  
  /**
   * 쿠데타 결과 처리 (시나리오 연동)
   */
  private async handleResolveCoupOutcome(
    context: TriggerContext,
    data: {
      coupId: string;
      outcome: 'success' | 'failed' | 'suppressed';
      triggeredEvents?: string[];
    }
  ): Promise<void> {
    // 후속 이벤트 트리거
    if (data.triggeredEvents) {
      for (const eventId of data.triggeredEvents) {
        await this.scenarioEngine.checkTriggersForType('ON_EVENT_TRIGGERED', {
          ...context,
          customData: { triggeredEventId: eventId }
        });
      }
    }
  }
  
  // ============================================================================
  // Public API
  // ============================================================================
  
  /**
   * 시나리오 이벤트로 쿠데타 시작
   */
  async startScenarioCoup(
    sessionId: string,
    coupEventConfig: CoupScenarioEvent
  ): Promise<void> {
    if (!coupEventConfig.automatic) {
      // 선택지 이벤트로 처리
      const event: ScenarioEvent = {
        id: coupEventConfig.eventId,
        name: coupEventConfig.name,
        description: coupEventConfig.description,
        trigger: { type: 'MANUAL', params: {} },
        actions: [],
        choices: [
          {
            id: 'start_coup',
            text: '쿠데타를 일으킨다',
            actions: [{
              type: 'CUSTOM',
              params: {
                scriptId: 'start_coup_from_scenario',
                customData: coupEventConfig.onTriggered
              }
            }]
          },
          {
            id: 'cancel_coup',
            text: '쿠데타를 취소한다',
            actions: [{
              type: 'SET_FLAG',
              params: { flagName: `coup_${coupEventConfig.eventId}_cancelled`, flagValue: true }
            }]
          }
        ],
        once: true,
        enabled: true
      };
      
      const session = await ScenarioSession.findOne({ sessionId });
      if (session) {
        await this.scenarioEngine.executeEvent(event, {
          sessionId,
          turn: session.currentTurn,
          gameDate: session.gameDate
        }, session);
      }
    } else {
      // 자동 실행
      await this.handleStartCoupFromScenario(
        {
          sessionId,
          turn: 0,
          gameDate: { year: 797, month: 1, day: 1 }
        },
        {
          leaderId: coupEventConfig.onTriggered.coupLeaderId,
          coupType: coupEventConfig.onTriggered.coupType,
          conspirators: coupEventConfig.onTriggered.coupSupporterIds,
          fleetIds: [],
          targetFactionId: 'empire'
        }
      );
    }
  }
  
  /**
   * 쿠데타 관련 시나리오 플래그 조회
   */
  async getCoupScenarioFlags(sessionId: string): Promise<Record<string, unknown>> {
    const session = await ScenarioSession.findOne({ sessionId });
    if (!session) return {};
    
    const coupFlags: Record<string, unknown> = {};
    
    for (const [key, value] of session.flags.entries()) {
      if (key.startsWith('coup_') || key.includes('lipstadt') || key.includes('salvation')) {
        coupFlags[key] = value;
      }
    }
    
    return coupFlags;
  }
}

// 싱글톤 인스턴스 export
export const coupScenarioIntegration = CoupScenarioIntegration.getInstance();
export default coupScenarioIntegration;

// 시나리오 이벤트 export
export const COUP_SCENARIO_EVENTS = {
  LIPSTADT_WAR: LIPSTADT_WAR_EVENT,
  SALVATION_MILITARY_COUNCIL: SALVATION_MILITARY_COUNCIL_EVENT
};





