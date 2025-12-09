/**
 * HistoricalEventService - 역사적 이벤트 서비스
 * 
 * 구국군사회의 이벤트, 회랑의 전투 (이제르론/페잔),
 * 황제 암살 시도, 쿠데타 이벤트 트리거
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { Gin7Character, IGin7Character } from '../../models/gin7/Character';
import { Fleet, IFleet } from '../../models/gin7/Fleet';
import { Planet, IPlanet } from '../../models/gin7/Planet';
import { StarSystem, IStarSystem } from '../../models/gin7/StarSystem';
import { Faction, IFaction } from '../../models/gin7/Faction';
import { logger } from '../../common/logger';

// ============================================================
// Types & Interfaces
// ============================================================

/**
 * 역사적 이벤트
 */
export interface HistoricalEvent {
  eventId: string;
  sessionId: string;
  name: string;
  nameKo: string;
  description: string;
  
  // 이벤트 유형
  eventType: HistoricalEventType;
  
  // 트리거 조건
  triggerConditions: TriggerCondition[];
  
  // 효과
  effects: EventEffect[];
  
  // 선택지 (선택적)
  choices?: EventChoice[];
  
  // 상태
  status: EventStatus;
  triggeredAt?: Date;
  resolvedAt?: Date;
  
  // 관련 엔티티
  relatedFactions: string[];
  relatedCharacters: string[];
  relatedLocations: string[];
  
  // 결과
  outcome?: EventOutcome;
  
  // 메타데이터
  data: Record<string, unknown>;
}

/**
 * 역사적 이벤트 유형
 */
export type HistoricalEventType =
  | 'MILITARY_COUNCIL'       // 구국군사회의
  | 'CORRIDOR_BATTLE'        // 회랑의 전투
  | 'ASSASSINATION_ATTEMPT'  // 암살 시도
  | 'COUP_DETAT'            // 쿠데타
  | 'CIVIL_WAR_START'       // 내전 발발
  | 'PEACE_TREATY'          // 평화 조약
  | 'SUCCESSION_CRISIS'     // 계승 위기
  | 'REBELLION'             // 반란
  | 'ALLIANCE_FORMATION'    // 동맹 결성
  | 'TERRITORY_TRANSFER';   // 영토 이양

/**
 * 이벤트 상태
 */
export type EventStatus =
  | 'DORMANT'       // 대기 중 (트리거 전)
  | 'TRIGGERED'     // 트리거됨
  | 'ACTIVE'        // 활성화 (진행 중)
  | 'PENDING_CHOICE' // 선택 대기
  | 'RESOLVED'      // 해결됨
  | 'CANCELLED';    // 취소됨

/**
 * 트리거 조건
 */
export interface TriggerCondition {
  conditionId: string;
  type: TriggerConditionType;
  params: Record<string, unknown>;
  operator: 'AND' | 'OR';
  isRequired: boolean;
}

/**
 * 트리거 조건 유형
 */
export type TriggerConditionType =
  | 'DATE_REACHED'          // 특정 날짜 도달
  | 'TURN_REACHED'          // 특정 턴 도달
  | 'FACTION_POWER'         // 세력 파워 조건
  | 'CHARACTER_STATUS'      // 캐릭터 상태 조건
  | 'TERRITORY_CONTROL'     // 영토 통제 조건
  | 'MILITARY_STRENGTH'     // 군사력 조건
  | 'POLITICAL_STABILITY'   // 정치 안정도 조건
  | 'EVENT_TRIGGERED'       // 다른 이벤트 트리거됨
  | 'CUSTOM';               // 커스텀 조건

/**
 * 이벤트 효과
 */
export interface EventEffect {
  effectId: string;
  type: EventEffectType;
  target: EffectTarget;
  params: Record<string, unknown>;
  duration?: number;    // 지속 시간 (턴), 없으면 영구
  delay?: number;       // 지연 시간 (턴)
}

/**
 * 이벤트 효과 유형
 */
export type EventEffectType =
  | 'SPAWN_CHARACTER'       // 캐릭터 생성
  | 'KILL_CHARACTER'        // 캐릭터 사망
  | 'CHANGE_FACTION'        // 세력 변경
  | 'SPAWN_FLEET'           // 함대 생성
  | 'DESTROY_FLEET'         // 함대 파괴
  | 'TRANSFER_TERRITORY'    // 영토 이전
  | 'MODIFY_RELATIONS'      // 관계 수정
  | 'DECLARE_WAR'           // 전쟁 선포
  | 'OFFER_PEACE'           // 평화 제안
  | 'STAT_MODIFIER'         // 스탯 수정
  | 'RESOURCE_MODIFIER'     // 자원 수정
  | 'TRIGGER_BATTLE'        // 전투 트리거
  | 'UNLOCK_TECHNOLOGY'     // 기술 해금
  | 'SET_FLAG'              // 플래그 설정
  | 'SHOW_DIALOGUE';        // 대화 표시

/**
 * 효과 대상
 */
export interface EffectTarget {
  type: 'CHARACTER' | 'FACTION' | 'FLEET' | 'PLANET' | 'SYSTEM' | 'GLOBAL';
  targetIds?: string[];
  filter?: Record<string, unknown>;
}

/**
 * 이벤트 선택지
 */
export interface EventChoice {
  choiceId: string;
  text: string;
  textKo: string;
  
  // 선택 조건
  requirements?: ChoiceRequirement[];
  
  // 선택 시 효과
  effects: EventEffect[];
  
  // 결과 텍스트
  resultText: string;
  resultTextKo: string;
  
  // 후속 이벤트
  followUpEventId?: string;
}

/**
 * 선택 조건
 */
export interface ChoiceRequirement {
  type: 'RESOURCE' | 'CHARACTER' | 'STAT' | 'RELATION' | 'FLAG';
  params: Record<string, unknown>;
}

/**
 * 이벤트 결과
 */
export interface EventOutcome {
  success: boolean;
  chosenOption?: string;
  effectsApplied: string[];
  description: string;
}

// ============================================================
// Historical Event Definitions
// ============================================================

/**
 * 구국군사회의 이벤트 정의
 */
export const MILITARY_COUNCIL_EVENT: Omit<HistoricalEvent, 'eventId' | 'sessionId' | 'status' | 'data'> = {
  name: 'National Salvation Military Council',
  nameKo: '구국군사회의',
  description: '위기 상황에서 군부가 정권을 장악하려는 시도',
  eventType: 'MILITARY_COUNCIL',
  
  triggerConditions: [
    {
      conditionId: 'political_crisis',
      type: 'POLITICAL_STABILITY',
      params: { stability: 30, operator: 'lt' }, // 30 미만
      operator: 'AND',
      isRequired: true,
    },
    {
      conditionId: 'military_power',
      type: 'MILITARY_STRENGTH',
      params: { threshold: 70, operator: 'gt' }, // 70 초과
      operator: 'AND',
      isRequired: true,
    },
  ],
  
  effects: [
    {
      effectId: 'declare_martial_law',
      type: 'SET_FLAG',
      target: { type: 'GLOBAL' },
      params: { flagName: 'martial_law', value: true },
    },
    {
      effectId: 'political_turmoil',
      type: 'STAT_MODIFIER',
      target: { type: 'FACTION', filter: { isPlayer: true } },
      params: { stat: 'stability', modifier: -20 },
      duration: 10,
    },
  ],
  
  choices: [
    {
      choiceId: 'support_council',
      text: 'Support the Military Council',
      textKo: '군사회의를 지지한다',
      effects: [
        {
          effectId: 'military_support',
          type: 'STAT_MODIFIER',
          target: { type: 'FACTION', filter: { isPlayer: true } },
          params: { stat: 'militaryMorale', modifier: 30 },
        },
        {
          effectId: 'civil_unrest',
          type: 'STAT_MODIFIER',
          target: { type: 'FACTION', filter: { isPlayer: true } },
          params: { stat: 'civilianMorale', modifier: -20 },
        },
      ],
      resultText: 'You have backed the Military Council. The military is pleased, but civilians are concerned.',
      resultTextKo: '군사회의를 지지했습니다. 군부는 기뻐하지만 민간인들은 불안해합니다.',
    },
    {
      choiceId: 'oppose_council',
      text: 'Oppose the Military Council',
      textKo: '군사회의에 반대한다',
      effects: [
        {
          effectId: 'civil_support',
          type: 'STAT_MODIFIER',
          target: { type: 'FACTION', filter: { isPlayer: true } },
          params: { stat: 'civilianMorale', modifier: 20 },
        },
        {
          effectId: 'military_opposition',
          type: 'STAT_MODIFIER',
          target: { type: 'FACTION', filter: { isPlayer: true } },
          params: { stat: 'militaryMorale', modifier: -30 },
        },
      ],
      resultText: 'You have opposed the Military Council. Civilians support you, but the military is displeased.',
      resultTextKo: '군사회의에 반대했습니다. 민간인들은 지지하지만 군부는 불만입니다.',
      followUpEventId: 'coup_attempt',
    },
    {
      choiceId: 'negotiate',
      text: 'Negotiate a compromise',
      textKo: '타협을 시도한다',
      requirements: [
        { type: 'STAT', params: { stat: 'politics', minimum: 70 } },
      ],
      effects: [
        {
          effectId: 'compromise',
          type: 'SET_FLAG',
          target: { type: 'GLOBAL' },
          params: { flagName: 'military_compromise', value: true },
        },
      ],
      resultText: 'You have negotiated a compromise. Tensions ease somewhat.',
      resultTextKo: '타협에 성공했습니다. 긴장이 다소 완화됩니다.',
    },
  ],
  
  relatedFactions: [],
  relatedCharacters: [],
  relatedLocations: [],
};

/**
 * 황제 암살 시도 이벤트 정의
 */
export const ASSASSINATION_ATTEMPT_EVENT: Omit<HistoricalEvent, 'eventId' | 'sessionId' | 'status' | 'data'> = {
  name: 'Assassination Attempt',
  nameKo: '황제 암살 시도',
  description: '황제에 대한 암살 시도가 발생',
  eventType: 'ASSASSINATION_ATTEMPT',
  
  triggerConditions: [
    {
      conditionId: 'emperor_exists',
      type: 'CHARACTER_STATUS',
      params: { role: 'emperor', isAlive: true },
      operator: 'AND',
      isRequired: true,
    },
    {
      conditionId: 'dissent_high',
      type: 'POLITICAL_STABILITY',
      params: { stability: 40, operator: 'lt' },
      operator: 'AND',
      isRequired: true,
    },
  ],
  
  effects: [],
  
  choices: [
    {
      choiceId: 'assassination_success',
      text: 'The assassination succeeds',
      textKo: '암살이 성공한다',
      effects: [
        {
          effectId: 'kill_emperor',
          type: 'KILL_CHARACTER',
          target: { type: 'CHARACTER', filter: { role: 'emperor' } },
          params: { cause: 'assassination' },
        },
        {
          effectId: 'succession_crisis',
          type: 'SET_FLAG',
          target: { type: 'GLOBAL' },
          params: { flagName: 'succession_crisis', value: true },
        },
      ],
      resultText: 'The Emperor has been assassinated! The empire plunges into chaos.',
      resultTextKo: '황제가 암살되었습니다! 제국은 혼란에 빠집니다.',
      followUpEventId: 'succession_crisis',
    },
    {
      choiceId: 'assassination_failed',
      text: 'The assassination fails',
      textKo: '암살이 실패한다',
      effects: [
        {
          effectId: 'purge',
          type: 'SET_FLAG',
          target: { type: 'GLOBAL' },
          params: { flagName: 'political_purge', value: true },
        },
        {
          effectId: 'security_tightened',
          type: 'STAT_MODIFIER',
          target: { type: 'FACTION', filter: { isEmpire: true } },
          params: { stat: 'security', modifier: 30 },
        },
      ],
      resultText: 'The assassination attempt has failed. A purge of suspected conspirators begins.',
      resultTextKo: '암살 시도가 실패했습니다. 의심되는 공모자들에 대한 숙청이 시작됩니다.',
    },
  ],
  
  relatedFactions: [],
  relatedCharacters: [],
  relatedLocations: [],
};

/**
 * 쿠데타 이벤트 정의
 */
export const COUP_EVENT: Omit<HistoricalEvent, 'eventId' | 'sessionId' | 'status' | 'data'> = {
  name: 'Coup d\'État',
  nameKo: '쿠데타',
  description: '군부 또는 정치 세력에 의한 정권 전복 시도',
  eventType: 'COUP_DETAT',
  
  triggerConditions: [
    {
      conditionId: 'instability',
      type: 'POLITICAL_STABILITY',
      params: { stability: 25, operator: 'lt' },
      operator: 'AND',
      isRequired: true,
    },
    {
      conditionId: 'military_dissent',
      type: 'CUSTOM',
      params: { customCheck: 'military_loyalty_low' },
      operator: 'AND',
      isRequired: true,
    },
  ],
  
  effects: [
    {
      effectId: 'capital_lockdown',
      type: 'SET_FLAG',
      target: { type: 'GLOBAL' },
      params: { flagName: 'capital_lockdown', value: true },
    },
  ],
  
  choices: [
    {
      choiceId: 'coup_succeeds',
      text: 'The coup succeeds',
      textKo: '쿠데타가 성공한다',
      effects: [
        {
          effectId: 'regime_change',
          type: 'SET_FLAG',
          target: { type: 'GLOBAL' },
          params: { flagName: 'regime_changed', value: true },
        },
        {
          effectId: 'new_leader',
          type: 'CHANGE_FACTION',
          target: { type: 'FACTION', filter: { isCapital: true } },
          params: { newLeader: 'coup_leader' },
        },
      ],
      resultText: 'The coup has succeeded. A new regime takes power.',
      resultTextKo: '쿠데타가 성공했습니다. 새로운 정권이 권력을 장악합니다.',
    },
    {
      choiceId: 'coup_fails',
      text: 'The coup fails',
      textKo: '쿠데타가 실패한다',
      effects: [
        {
          effectId: 'loyalist_victory',
          type: 'STAT_MODIFIER',
          target: { type: 'FACTION', filter: { isLoyalist: true } },
          params: { stat: 'loyalty', modifier: 20 },
        },
        {
          effectId: 'rebel_purge',
          type: 'SET_FLAG',
          target: { type: 'GLOBAL' },
          params: { flagName: 'rebel_purge', value: true },
        },
      ],
      resultText: 'The coup has failed. Loyalist forces have prevailed.',
      resultTextKo: '쿠데타가 실패했습니다. 충성파가 승리했습니다.',
    },
    {
      choiceId: 'civil_war',
      text: 'Civil war erupts',
      textKo: '내전이 발발한다',
      effects: [
        {
          effectId: 'civil_war_start',
          type: 'DECLARE_WAR',
          target: { type: 'FACTION' },
          params: { warType: 'civil_war' },
        },
      ],
      resultText: 'Neither side can gain the upper hand. Civil war begins.',
      resultTextKo: '어느 쪽도 우위를 점하지 못합니다. 내전이 시작됩니다.',
      followUpEventId: 'civil_war_start',
    },
  ],
  
  relatedFactions: [],
  relatedCharacters: [],
  relatedLocations: [],
};

/**
 * 회랑의 전투 이벤트 정의 (이제르론/페잔)
 */
export const CORRIDOR_BATTLE_EVENT: Omit<HistoricalEvent, 'eventId' | 'sessionId' | 'status' | 'data'> = {
  name: 'Battle of the Corridor',
  nameKo: '회랑의 전투',
  description: '전략적 요충지인 회랑에서의 대규모 전투',
  eventType: 'CORRIDOR_BATTLE',
  
  triggerConditions: [
    {
      conditionId: 'corridor_contested',
      type: 'TERRITORY_CONTROL',
      params: { locationType: 'corridor', isContested: true },
      operator: 'AND',
      isRequired: true,
    },
    {
      conditionId: 'large_fleets',
      type: 'MILITARY_STRENGTH',
      params: { fleetsInArea: 3, operator: 'gte' },
      operator: 'AND',
      isRequired: true,
    },
  ],
  
  effects: [
    {
      effectId: 'strategic_importance',
      type: 'SET_FLAG',
      target: { type: 'GLOBAL' },
      params: { flagName: 'corridor_battle_active', value: true },
    },
    {
      effectId: 'mobilization',
      type: 'STAT_MODIFIER',
      target: { type: 'FACTION' },
      params: { stat: 'warReadiness', modifier: 20 },
    },
  ],
  
  choices: [
    {
      choiceId: 'full_assault',
      text: 'Launch a full assault',
      textKo: '전면 공격을 감행한다',
      effects: [
        {
          effectId: 'trigger_battle',
          type: 'TRIGGER_BATTLE',
          target: { type: 'SYSTEM', filter: { isCorridor: true } },
          params: { battleType: 'major', scale: 'large' },
        },
      ],
      resultText: 'You commit your forces to a decisive battle.',
      resultTextKo: '결정적인 전투에 병력을 투입합니다.',
    },
    {
      choiceId: 'defensive_position',
      text: 'Hold defensive positions',
      textKo: '방어 진지를 유지한다',
      effects: [
        {
          effectId: 'fortify',
          type: 'STAT_MODIFIER',
          target: { type: 'FLEET', filter: { inCorridor: true } },
          params: { stat: 'defense', modifier: 30 },
        },
      ],
      resultText: 'Your forces dig in and prepare for the enemy assault.',
      resultTextKo: '병력이 참호를 파고 적의 공격에 대비합니다.',
    },
    {
      choiceId: 'flanking_maneuver',
      text: 'Attempt a flanking maneuver',
      textKo: '측면 기동을 시도한다',
      requirements: [
        { type: 'STAT', params: { stat: 'tactics', minimum: 80 } },
      ],
      effects: [
        {
          effectId: 'flanking',
          type: 'TRIGGER_BATTLE',
          target: { type: 'SYSTEM', filter: { isCorridor: true } },
          params: { battleType: 'flanking', attackerBonus: 25 },
        },
      ],
      resultText: 'Your bold maneuver catches the enemy off guard.',
      resultTextKo: '대담한 기동이 적의 허를 찔렀습니다.',
    },
  ],
  
  relatedFactions: [],
  relatedCharacters: [],
  relatedLocations: [],
};

// ============================================================
// HistoricalEventService Class
// ============================================================

export class HistoricalEventService extends EventEmitter {
  private static instance: HistoricalEventService;
  private activeEvents: Map<string, HistoricalEvent> = new Map();
  private eventTemplates: Map<HistoricalEventType, Omit<HistoricalEvent, 'eventId' | 'sessionId' | 'status' | 'data'>>;
  
  private constructor() {
    super();
    this.eventTemplates = new Map();
    this.registerDefaultTemplates();
    logger.info('[HistoricalEventService] Initialized');
  }
  
  public static getInstance(): HistoricalEventService {
    if (!HistoricalEventService.instance) {
      HistoricalEventService.instance = new HistoricalEventService();
    }
    return HistoricalEventService.instance;
  }
  
  /**
   * 기본 이벤트 템플릿 등록
   */
  private registerDefaultTemplates(): void {
    this.eventTemplates.set('MILITARY_COUNCIL', MILITARY_COUNCIL_EVENT);
    this.eventTemplates.set('ASSASSINATION_ATTEMPT', ASSASSINATION_ATTEMPT_EVENT);
    this.eventTemplates.set('COUP_DETAT', COUP_EVENT);
    this.eventTemplates.set('CORRIDOR_BATTLE', CORRIDOR_BATTLE_EVENT);
  }
  
  // ============================================================
  // Event Creation & Management
  // ============================================================
  
  /**
   * 역사적 이벤트 생성
   */
  createEvent(
    sessionId: string,
    eventType: HistoricalEventType,
    overrides?: Partial<HistoricalEvent>
  ): HistoricalEvent {
    const template = this.eventTemplates.get(eventType);
    if (!template) {
      throw new Error(`Unknown event type: ${eventType}`);
    }
    
    const event: HistoricalEvent = {
      eventId: `HE-${uuidv4().slice(0, 8)}`,
      sessionId,
      ...template,
      status: 'DORMANT',
      data: {},
      ...overrides,
    };
    
    this.activeEvents.set(event.eventId, event);
    
    logger.info('[HistoricalEventService] Event created', {
      eventId: event.eventId,
      eventType,
      name: event.nameKo,
    });
    
    return event;
  }
  
  /**
   * 커스텀 이벤트 생성
   */
  createCustomEvent(
    sessionId: string,
    eventData: Omit<HistoricalEvent, 'eventId' | 'sessionId' | 'status'>
  ): HistoricalEvent {
    const event: HistoricalEvent = {
      ...eventData,
      eventId: `HE-${uuidv4().slice(0, 8)}`,
      sessionId,
      status: 'DORMANT',
    };
    
    this.activeEvents.set(event.eventId, event);
    
    logger.info('[HistoricalEventService] Custom event created', {
      eventId: event.eventId,
      name: event.nameKo,
    });
    
    return event;
  }
  
  /**
   * 이벤트 템플릿 등록
   */
  registerEventTemplate(
    eventType: HistoricalEventType,
    template: Omit<HistoricalEvent, 'eventId' | 'sessionId' | 'status' | 'data'>
  ): void {
    this.eventTemplates.set(eventType, template);
    logger.info('[HistoricalEventService] Template registered', { eventType });
  }
  
  // ============================================================
  // Trigger Condition Checking
  // ============================================================
  
  /**
   * 이벤트 트리거 조건 체크
   */
  async checkTriggerConditions(
    event: HistoricalEvent
  ): Promise<{ triggered: boolean; failedConditions: string[] }> {
    const failedConditions: string[] = [];
    let andConditionsMet = true;
    let orConditionMet = false;
    
    for (const condition of event.triggerConditions) {
      const isMet = await this.checkSingleCondition(condition, event.sessionId);
      
      if (condition.operator === 'AND') {
        if (!isMet && condition.isRequired) {
          andConditionsMet = false;
          failedConditions.push(condition.conditionId);
        }
      } else if (condition.operator === 'OR') {
        if (isMet) {
          orConditionMet = true;
        }
      }
    }
    
    // AND 조건이 모두 충족되어야 하고, OR 조건이 있다면 하나 이상 충족
    const hasOrConditions = event.triggerConditions.some(c => c.operator === 'OR');
    const triggered = andConditionsMet && (!hasOrConditions || orConditionMet);
    
    return { triggered, failedConditions };
  }
  
  /**
   * 단일 조건 체크
   */
  private async checkSingleCondition(
    condition: TriggerCondition,
    sessionId: string
  ): Promise<boolean> {
    const params = condition.params;
    
    switch (condition.type) {
      case 'DATE_REACHED':
        // 날짜 조건 체크 (실제 구현 필요)
        return true;
        
      case 'TURN_REACHED':
        // 턴 조건 체크 (실제 구현 필요)
        return true;
        
      case 'FACTION_POWER':
        return this.checkFactionPower(
          sessionId,
          params.factionId as string,
          params.power as number,
          params.operator as string
        );
        
      case 'CHARACTER_STATUS':
        return this.checkCharacterStatus(
          sessionId,
          params.role as string,
          params.isAlive as boolean
        );
        
      case 'TERRITORY_CONTROL':
        return this.checkTerritoryControl(
          sessionId,
          params.locationType as string,
          params.isContested as boolean
        );
        
      case 'MILITARY_STRENGTH':
        return this.checkMilitaryStrength(
          sessionId,
          params.threshold as number,
          params.operator as string
        );
        
      case 'POLITICAL_STABILITY':
        return this.checkPoliticalStability(
          sessionId,
          params.stability as number,
          params.operator as string
        );
        
      case 'EVENT_TRIGGERED':
        return this.checkEventTriggered(
          sessionId,
          params.eventId as string
        );
        
      case 'CUSTOM':
        return this.checkCustomCondition(sessionId, params);
        
      default:
        return true;
    }
  }
  
  /**
   * 세력 파워 체크
   */
  private async checkFactionPower(
    sessionId: string,
    factionId: string,
    power: number,
    operator: string
  ): Promise<boolean> {
    const faction = await Faction.findOne({ sessionId, factionId });
    if (!faction) return false;
    
    const factionPower = (faction as any).power || 0;
    return this.compareValues(factionPower, power, operator);
  }
  
  /**
   * 캐릭터 상태 체크
   */
  private async checkCharacterStatus(
    sessionId: string,
    role: string,
    isAlive: boolean
  ): Promise<boolean> {
    const character = await Gin7Character.findOne({
      sessionId,
      'position.title': role,
    });
    
    if (!character) return !isAlive;
    return isAlive ? character.state !== 'dead' : character.state === 'dead';
  }
  
  /**
   * 영토 통제 체크
   */
  private async checkTerritoryControl(
    sessionId: string,
    locationType: string,
    isContested: boolean
  ): Promise<boolean> {
    // 회랑/요새 등 특수 지역 체크
    const systems = await StarSystem.find({
      sessionId,
      'data.locationType': locationType,
    });
    
    for (const system of systems) {
      const contested = (system as any).data?.isContested || false;
      if (isContested === contested) return true;
    }
    
    return false;
  }
  
  /**
   * 군사력 체크
   */
  private async checkMilitaryStrength(
    sessionId: string,
    threshold: number,
    operator: string
  ): Promise<boolean> {
    const fleets = await Fleet.find({ sessionId, status: { $ne: 'DESTROYED' } });
    const totalStrength = fleets.length;
    return this.compareValues(totalStrength, threshold, operator);
  }
  
  /**
   * 정치 안정도 체크
   */
  private async checkPoliticalStability(
    sessionId: string,
    stability: number,
    operator: string
  ): Promise<boolean> {
    // 평균 충성도로 안정도 계산
    const planets = await Planet.find({ sessionId });
    if (planets.length === 0) return false;
    
    const avgLoyalty = planets.reduce((sum, p) => sum + (p.loyalty || 50), 0) / planets.length;
    return this.compareValues(avgLoyalty, stability, operator);
  }
  
  /**
   * 다른 이벤트 트리거 여부 체크
   */
  private checkEventTriggered(sessionId: string, eventId: string): boolean {
    const event = Array.from(this.activeEvents.values())
      .find(e => e.sessionId === sessionId && e.eventId === eventId);
    
    return event?.status === 'TRIGGERED' || event?.status === 'RESOLVED';
  }
  
  /**
   * 커스텀 조건 체크
   */
  private async checkCustomCondition(
    sessionId: string,
    params: Record<string, unknown>
  ): Promise<boolean> {
    const customCheck = params.customCheck as string;
    
    switch (customCheck) {
      case 'military_loyalty_low':
        // 군부 충성도 체크 로직
        return Math.random() < 0.3; // 임시 구현
        
      default:
        return true;
    }
  }
  
  /**
   * 값 비교 헬퍼
   */
  private compareValues(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }
  
  // ============================================================
  // Event Execution
  // ============================================================
  
  /**
   * 이벤트 트리거
   */
  async triggerEvent(eventId: string): Promise<HistoricalEvent> {
    const event = this.activeEvents.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    
    if (event.status !== 'DORMANT') {
      throw new Error(`Event ${eventId} is not in DORMANT status`);
    }
    
    // 조건 체크
    const { triggered, failedConditions } = await this.checkTriggerConditions(event);
    
    if (!triggered) {
      logger.warn('[HistoricalEventService] Trigger conditions not met', {
        eventId,
        failedConditions,
      });
      throw new Error(`Trigger conditions not met: ${failedConditions.join(', ')}`);
    }
    
    event.status = 'TRIGGERED';
    event.triggeredAt = new Date();
    
    // 즉시 효과 적용
    for (const effect of event.effects) {
      if (!effect.delay) {
        await this.applyEffect(effect, event.sessionId);
      }
    }
    
    // 선택지가 있으면 PENDING_CHOICE로
    if (event.choices && event.choices.length > 0) {
      event.status = 'PENDING_CHOICE';
    } else {
      event.status = 'ACTIVE';
    }
    
    logger.info('[HistoricalEventService] Event triggered', {
      eventId,
      name: event.nameKo,
      status: event.status,
    });
    
    this.emit('event:triggered', {
      eventId,
      sessionId: event.sessionId,
      eventType: event.eventType,
      name: event.nameKo,
      hasChoices: event.status === 'PENDING_CHOICE',
    });
    
    return event;
  }
  
  /**
   * 선택지 처리
   */
  async processChoice(eventId: string, choiceId: string): Promise<HistoricalEvent> {
    const event = this.activeEvents.get(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    
    if (event.status !== 'PENDING_CHOICE') {
      throw new Error(`Event ${eventId} is not awaiting choice`);
    }
    
    const choice = event.choices?.find(c => c.choiceId === choiceId);
    if (!choice) {
      throw new Error(`Choice ${choiceId} not found in event ${eventId}`);
    }
    
    // 선택 조건 체크
    if (choice.requirements) {
      for (const req of choice.requirements) {
        const met = await this.checkChoiceRequirement(req, event.sessionId);
        if (!met) {
          throw new Error(`Choice requirement not met: ${req.type}`);
        }
      }
    }
    
    // 선택 효과 적용
    const effectsApplied: string[] = [];
    for (const effect of choice.effects) {
      await this.applyEffect(effect, event.sessionId);
      effectsApplied.push(effect.effectId);
    }
    
    // 결과 기록
    event.outcome = {
      success: true,
      chosenOption: choiceId,
      effectsApplied,
      description: choice.resultTextKo,
    };
    
    event.status = 'RESOLVED';
    event.resolvedAt = new Date();
    
    logger.info('[HistoricalEventService] Choice processed', {
      eventId,
      choiceId,
      effectsApplied,
    });
    
    this.emit('event:resolved', {
      eventId,
      sessionId: event.sessionId,
      choiceId,
      outcome: event.outcome,
    });
    
    // 후속 이벤트 트리거
    if (choice.followUpEventId) {
      const followUp = this.activeEvents.get(choice.followUpEventId);
      if (followUp && followUp.status === 'DORMANT') {
        setTimeout(() => {
          this.triggerEvent(choice.followUpEventId!).catch(err => {
            logger.error('[HistoricalEventService] Follow-up event trigger failed', { err });
          });
        }, 1000);
      }
    }
    
    return event;
  }
  
  /**
   * 선택 조건 체크
   */
  private async checkChoiceRequirement(
    req: ChoiceRequirement,
    sessionId: string
  ): Promise<boolean> {
    const params = req.params;
    
    switch (req.type) {
      case 'RESOURCE':
        // 자원 조건 체크
        return true;
        
      case 'STAT':
        // 스탯 조건 체크
        return true;
        
      case 'FLAG':
        // 플래그 체크
        return true;
        
      default:
        return true;
    }
  }
  
  /**
   * 효과 적용
   */
  private async applyEffect(effect: EventEffect, sessionId: string): Promise<void> {
    const { type, target, params } = effect;
    
    switch (type) {
      case 'SET_FLAG':
        this.emit('effect:setFlag', {
          sessionId,
          flagName: params.flagName,
          value: params.value,
        });
        break;
        
      case 'STAT_MODIFIER':
        this.emit('effect:statModifier', {
          sessionId,
          target,
          stat: params.stat,
          modifier: params.modifier,
          duration: effect.duration,
        });
        break;
        
      case 'KILL_CHARACTER':
        await this.killCharacter(sessionId, target, params);
        break;
        
      case 'CHANGE_FACTION':
        this.emit('effect:changeFaction', {
          sessionId,
          target,
          params,
        });
        break;
        
      case 'DECLARE_WAR':
        this.emit('effect:declareWar', {
          sessionId,
          target,
          warType: params.warType,
        });
        break;
        
      case 'TRIGGER_BATTLE':
        this.emit('effect:triggerBattle', {
          sessionId,
          target,
          battleType: params.battleType,
          scale: params.scale,
        });
        break;
        
      case 'SHOW_DIALOGUE':
        this.emit('effect:dialogue', {
          sessionId,
          text: params.text,
          speaker: params.speaker,
        });
        break;
        
      default:
        logger.warn('[HistoricalEventService] Unknown effect type', { type });
    }
  }
  
  /**
   * 캐릭터 사망 처리
   */
  private async killCharacter(
    sessionId: string,
    target: EffectTarget,
    params: Record<string, unknown>
  ): Promise<void> {
    const query: Record<string, unknown> = { sessionId };
    
    if (target.targetIds && target.targetIds.length > 0) {
      query.characterId = { $in: target.targetIds };
    } else if (target.filter) {
      if (target.filter.role) {
        query['position.title'] = target.filter.role;
      }
    }
    
    const characters = await Gin7Character.find(query);
    
    for (const character of characters) {
      character.state = 'dead';
      character.data = character.data || {};
      (character.data as any).deathCause = params.cause || 'unknown';
      (character.data as any).deathDate = new Date();
      await character.save();
      
      logger.info('[HistoricalEventService] Character killed', {
        characterId: character.characterId,
        name: character.name,
        cause: params.cause,
      });
      
      this.emit('character:death', {
        sessionId,
        characterId: character.characterId,
        name: character.name,
        cause: params.cause,
      });
    }
  }
  
  // ============================================================
  // Periodic Check
  // ============================================================
  
  /**
   * 모든 대기 중인 이벤트 조건 체크
   */
  async checkAllDormantEvents(sessionId: string): Promise<HistoricalEvent[]> {
    const triggeredEvents: HistoricalEvent[] = [];
    
    const dormantEvents = Array.from(this.activeEvents.values())
      .filter(e => e.sessionId === sessionId && e.status === 'DORMANT');
    
    for (const event of dormantEvents) {
      try {
        const { triggered } = await this.checkTriggerConditions(event);
        if (triggered) {
          const triggeredEvent = await this.triggerEvent(event.eventId);
          triggeredEvents.push(triggeredEvent);
        }
      } catch (error) {
        logger.error('[HistoricalEventService] Event check failed', {
          eventId: event.eventId,
          error,
        });
      }
    }
    
    return triggeredEvents;
  }
  
  // ============================================================
  // Query Methods
  // ============================================================
  
  /**
   * 이벤트 조회
   */
  getEvent(eventId: string): HistoricalEvent | undefined {
    return this.activeEvents.get(eventId);
  }
  
  /**
   * 세션의 모든 이벤트 조회
   */
  getSessionEvents(sessionId: string): HistoricalEvent[] {
    return Array.from(this.activeEvents.values())
      .filter(e => e.sessionId === sessionId);
  }
  
  /**
   * 상태별 이벤트 조회
   */
  getEventsByStatus(sessionId: string, status: EventStatus): HistoricalEvent[] {
    return Array.from(this.activeEvents.values())
      .filter(e => e.sessionId === sessionId && e.status === status);
  }
  
  /**
   * 선택 대기 중인 이벤트 조회
   */
  getPendingChoiceEvents(sessionId: string): HistoricalEvent[] {
    return this.getEventsByStatus(sessionId, 'PENDING_CHOICE');
  }
  
  /**
   * 이벤트 취소
   */
  cancelEvent(eventId: string): boolean {
    const event = this.activeEvents.get(eventId);
    if (!event) return false;
    
    if (event.status === 'RESOLVED') {
      throw new Error('Cannot cancel resolved event');
    }
    
    event.status = 'CANCELLED';
    
    logger.info('[HistoricalEventService] Event cancelled', { eventId });
    
    this.emit('event:cancelled', {
      eventId,
      sessionId: event.sessionId,
    });
    
    return true;
  }
  
  /**
   * 이벤트 삭제
   */
  removeEvent(eventId: string): boolean {
    return this.activeEvents.delete(eventId);
  }
  
  /**
   * 세션 이벤트 정리
   */
  cleanupSession(sessionId: string): number {
    let removed = 0;
    for (const [id, event] of this.activeEvents) {
      if (event.sessionId === sessionId) {
        this.activeEvents.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

// ============================================================
// Singleton Export
// ============================================================

export const historicalEventService = HistoricalEventService.getInstance();





