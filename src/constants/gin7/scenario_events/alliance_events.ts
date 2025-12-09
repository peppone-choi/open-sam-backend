/**
 * GIN7 Alliance Events - 동맹 시나리오 이벤트
 *
 * 구국군사회의 쿠데타 및 버밀리온 전투 관련 이벤트 정의
 * - 구국군사회의 쿠데타
 * - 양 웬리 귀환
 * - 버밀리온 성역 전투
 */

import {
  ScenarioEvent,
  EventTrigger,
  EventAction,
  EventChoice,
} from '../../../types/gin7/scenario.types';

// ============================================================================
// Event ID Constants
// ============================================================================

export const ALLIANCE_EVENT_IDS = {
  // 구국군사회의 관련
  MILITARY_CONGRESS_COUP: 'EVT_ALL_MILITARY_COUP',
  GREENHILL_ARREST: 'EVT_ALL_GREENHILL_ARREST',
  ARTEMIS_NECKLACE_BATTLE: 'EVT_ALL_ARTEMIS_BATTLE',

  // 양 웬리 관련
  YANG_WENLI_RETURN: 'EVT_ALL_YANG_RETURN',
  YANG_INQUIRY_HEARING: 'EVT_ALL_YANG_INQUIRY',

  // 버밀리온 전투 관련
  VERMILION_BATTLE: 'EVT_ALL_VERMILION',
  CEASEFIRE_ORDER: 'EVT_ALL_CEASEFIRE',

  // 추가 동맹 이벤트
  TRUNICHT_ESCAPE: 'EVT_ALL_TRUNICHT_ESCAPE',
  BUCOCK_LAST_STAND: 'EVT_ALL_BUCOCK_STAND',
} as const;

// ============================================================================
// Event Definitions
// ============================================================================

/**
 * 구국군사회의 쿠데타 이벤트
 * 그린힐 대장을 중심으로 한 군부 쿠데타
 */
export const MILITARY_CONGRESS_COUP_EVENT: ScenarioEvent = {
  id: ALLIANCE_EVENT_IDS.MILITARY_CONGRESS_COUP,
  name: '구국군사회의 쿠데타',
  description:
    '그린힐 대장을 중심으로 한 군부가 쿠데타를 일으킵니다. 하이네센은 혼란에 빠집니다.',

  trigger: {
    type: 'ON_TURN_RANGE',
    params: {
      turnMin: 10,
      turnMax: 25,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'alliance_political_crisis' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'greenhill' },
        },
        {
          checkType: 'FACTION_CONTROLS',
          params: {
            factionId: 'free_planets_alliance',
            locationId: 'heinessen',
          },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'greenhill',
        speakerName: '그린힐 대장',
        text: '부패한 정치인들이 이끄는 동맹에는 미래가 없다. 군이 나서서 국가를 바로잡아야 한다!',
        portrait: 'greenhill_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'narrator',
        speakerName: '나레이터',
        text: '우주력 798년, 구국군사회의가 쿠데타를 선언했습니다. 하이네센은 군의 지배 하에 들어갑니다.',
        duration: 4000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'military_congress_coup_active',
        flagValue: true,
      },
    },
    {
      type: 'CHANGE_OWNER',
      params: {
        locationId: 'heinessen',
        newOwnerId: 'military_congress',
        locationType: 'planet',
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'free_planets_alliance',
        resourceType: 'stability',
        amount: -50,
        operation: 'add',
      },
    },
    {
      type: 'TRIGGER_EVENT',
      params: {
        eventId: ALLIANCE_EVENT_IDS.YANG_WENLI_RETURN,
      },
      delay: 3000,
    },
  ],

  once: true,
  enabled: true,
  priority: 100,
};

/**
 * 양 웬리 귀환 이벤트
 * 이제를론에서 양 웬리가 쿠데타 진압을 위해 귀환
 */
export const YANG_WENLI_RETURN_EVENT: ScenarioEvent = {
  id: ALLIANCE_EVENT_IDS.YANG_WENLI_RETURN,
  name: '양 웬리 귀환',
  description:
    '이제를론 요새에서 양 웬리가 쿠데타를 진압하기 위해 하이네센으로 귀환합니다.',

  trigger: {
    type: 'ON_EVENT_TRIGGERED',
    params: {
      eventId: ALLIANCE_EVENT_IDS.MILITARY_CONGRESS_COUP,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'military_congress_coup_active' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'yang_wenli' },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'yang_wenli',
        speakerName: '양 웬리',
        text: '군인이 정치에 개입하는 것은... 민주주의의 가장 큰 적이야.',
        portrait: 'yang_wenli_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'yang_wenli',
        speakerName: '양 웬리',
        text: '불쾌하지만... 쿠데타를 진압해야겠군. 이것이 민주주의를 지키는 방법이라면.',
        portrait: 'yang_wenli_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SPAWN_FLEET',
      params: {
        fleetData: {
          fleetId: 'yang_fleet_return',
          name: '양 웬리 함대',
          factionId: 'free_planets_alliance',
          commanderId: 'yang_wenli',
          locationId: 'iserlohn_corridor',
          composition: {
            battleships: 8000,
            cruisers: 5000,
            destroyers: 4000,
            carriers: 800,
            frigates: 2000,
            transports: 300,
          },
        },
      },
    },
    {
      type: 'MOVE_FLEET',
      params: {
        fleetId: 'yang_fleet_return',
        targetLocationId: 'heinessen',
        targetLocationType: 'planet',
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'yang_returning_to_heinessen',
        flagValue: true,
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 95,
};

/**
 * 버밀리온 성역 전투 이벤트 (선택지 있음)
 * 라인하르트 vs 양 웬리 최종 대결
 */
export const VERMILION_BATTLE_EVENT: ScenarioEvent = {
  id: ALLIANCE_EVENT_IDS.VERMILION_BATTLE,
  name: '버밀리온 성역 전투',
  description:
    '라인하르트 폰 로엔그람과 양 웬리의 숙명적인 대결. 은하의 운명이 결정됩니다.',

  trigger: {
    type: 'ON_TURN_RANGE',
    params: {
      turnMin: 30,
      turnMax: 50,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'reinhard_von_lohengramm' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'yang_wenli' },
        },
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'lipstadt_war_ended' },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'reinhard',
        speakerName: '라인하르트 폰 로엔그람',
        text: '드디어 만났군, 양 웬리. 이번에야말로 승부를 가리겠다.',
        portrait: 'reinhard_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'yang_wenli',
        speakerName: '양 웬리',
        text: '전쟁에서 이기는 것과 역사에서 이기는 것은 다르다... 하지만 오늘은 싸워야겠군.',
        portrait: 'yang_wenli_portrait',
        duration: 4000,
      },
    },
    {
      type: 'CAMERA_FOCUS',
      params: {
        targetType: 'PLANET',
        targetId: 'vermilion_sector',
        customData: {
          zoom: 1.5,
          duration: 2000,
        },
      },
    },
    {
      type: 'START_BATTLE',
      params: {
        attackerFleetId: 'yang_fleet_vermilion',
        defenderFleetId: 'reinhard_fleet_vermilion',
        battleType: 'space',
        specialRules: ['LEGENDARY_COMMANDERS', 'TACTICAL_GENIUS_BONUS'],
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'vermilion_battle_active',
        flagValue: true,
      },
    },
  ],

  choices: [
    {
      id: 'choice_continue_attack',
      text: '공격을 계속한다 (라인하르트 기함에 총공세)',
      conditions: [],
      actions: [
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'yang_wenli',
            speakerName: '양 웬리',
            text: '지금이다! 전 함대, 적 기함에 집중 공격!',
            portrait: 'yang_wenli_portrait',
            duration: 3000,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'vermilion_attack_continued',
            flagValue: true,
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FLEET',
            targetId: 'reinhard_fleet_vermilion',
            resourceType: 'health',
            amount: -30,
            operation: 'add',
          },
        },
      ],
      consequences: '라인하르트 함대 큰 피해, 하지만 정전 명령이 도착할 수도...',
    },
    {
      id: 'choice_accept_ceasefire',
      text: '휴전을 수락한다 (정전 명령 준수)',
      conditions: [],
      actions: [
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'yang_wenli',
            speakerName: '양 웬리',
            text: '...정전 명령이군. 군인은 민간 정부의 명령에 따라야 해.',
            portrait: 'yang_wenli_portrait',
            duration: 4000,
          },
        },
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'narrator',
            speakerName: '나레이터',
            text: '양 웬리는 승리를 눈앞에 두고 정전 명령에 복종했습니다. 민주주의의 원칙을 지키기 위해...',
            duration: 5000,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'vermilion_ceasefire_accepted',
            flagValue: true,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'vermilion_battle_active',
            flagValue: false,
          },
        },
        {
          type: 'TRIGGER_EVENT',
          params: {
            eventId: ALLIANCE_EVENT_IDS.CEASEFIRE_ORDER,
          },
        },
      ],
      consequences: '전투 종료, 바라트 조약 체결로 이어짐',
    },
  ],

  once: true,
  enabled: true,
  priority: 100,
};

/**
 * 정전 명령 이벤트
 * 버밀리온 전투 중 동맹 정부의 정전 명령
 */
export const CEASEFIRE_ORDER_EVENT: ScenarioEvent = {
  id: ALLIANCE_EVENT_IDS.CEASEFIRE_ORDER,
  name: '바라트 조약',
  description:
    '동맹 정부가 제국과 평화 조약을 체결합니다. 자유행성동맹은 사실상 제국의 속국이 됩니다.',

  trigger: {
    type: 'ON_EVENT_TRIGGERED',
    params: {
      eventId: ALLIANCE_EVENT_IDS.VERMILION_BATTLE,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'vermilion_ceasefire_accepted' },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'narrator',
        speakerName: '나레이터',
        text: '우주력 799년, 바라트 조약이 체결되었습니다. 자유행성동맹은 영토의 절반을 잃고 사실상 제국의 보호령이 됩니다.',
        duration: 5000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'barat_treaty_signed',
        flagValue: true,
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'free_planets_alliance',
        resourceType: 'territory',
        amount: -50,
        operation: 'add',
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'free_planets_alliance',
        resourceType: 'sovereignty',
        amount: -70,
        operation: 'add',
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 85,
};

// ============================================================================
// Event Collection Export
// ============================================================================

/**
 * 모든 동맹 이벤트 목록
 */
export const ALLIANCE_EVENTS: ScenarioEvent[] = [
  MILITARY_CONGRESS_COUP_EVENT,
  YANG_WENLI_RETURN_EVENT,
  VERMILION_BATTLE_EVENT,
  CEASEFIRE_ORDER_EVENT,
];

/**
 * 이벤트 ID로 이벤트 조회
 */
export function getAllianceEventById(eventId: string): ScenarioEvent | undefined {
  return ALLIANCE_EVENTS.find((event) => event.id === eventId);
}

/**
 * 트리거 타입으로 이벤트 필터링
 */
export function getAllianceEventsByTrigger(
  triggerType: EventTrigger['type']
): ScenarioEvent[] {
  return ALLIANCE_EVENTS.filter((event) => event.trigger.type === triggerType);
}

export default ALLIANCE_EVENTS;

