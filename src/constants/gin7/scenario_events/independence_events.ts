/**
 * GIN7 Independence Events - 분리독립 시나리오 이벤트
 *
 * 엘 파실 독립정부 및 자치권 변동 관련 이벤트 정의
 * - 엘 파실 독립정부 수립
 * - 자치권 변동
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

export const INDEPENDENCE_EVENT_IDS = {
  // 엘 파실 관련
  EL_FACIL_INDEPENDENCE: 'EVT_IND_EL_FACIL',
  EL_FACIL_REVOLUTION: 'EVT_IND_EL_FACIL_REV',
  EL_FACIL_JOIN_YANG: 'EVT_IND_EL_FACIL_YANG',

  // 자치권 관련
  AUTONOMY_CHANGE: 'EVT_IND_AUTONOMY',
  AUTONOMY_EXPANSION: 'EVT_IND_AUTONOMY_EXPAND',
  AUTONOMY_RESTRICTION: 'EVT_IND_AUTONOMY_RESTRICT',

  // 추가 분리독립 이벤트
  ISERLOHN_REPUBLIC: 'EVT_IND_ISERLOHN_REPUBLIC',
  PHEZZAN_NEUTRALITY_END: 'EVT_IND_PHEZZAN_NEUTRAL_END',
} as const;

// ============================================================================
// Event Definitions
// ============================================================================

/**
 * 엘 파실 독립정부 수립 이벤트
 * 바라트 조약 이후 엘 파실이 독립을 선언
 */
export const EL_FACIL_INDEPENDENCE_EVENT: ScenarioEvent = {
  id: INDEPENDENCE_EVENT_IDS.EL_FACIL_INDEPENDENCE,
  name: '엘 파실 독립정부 수립',
  description:
    '바라트 조약에 불복한 엘 파실이 독립 혁명정부를 수립합니다.',

  trigger: {
    type: 'ON_EVENT_TRIGGERED',
    params: {
      eventId: 'EVT_ALL_CEASEFIRE', // 바라트 조약 체결 후
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'barat_treaty_signed' },
        },
        {
          checkType: 'FACTION_CONTROLS',
          params: {
            factionId: 'free_planets_alliance',
            locationId: 'el_facil',
          },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'romsky',
        speakerName: '롬스키 위원장',
        text: '우리는 제국에 굴복한 하이네센의 괴뢰 정권을 인정하지 않는다!',
        portrait: 'romsky_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'romsky',
        speakerName: '롬스키 위원장',
        text: '엘 파실 혁명정부는 오늘부터 자유와 민주주의의 불꽃을 지켜나갈 것이다!',
        portrait: 'romsky_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'narrator',
        speakerName: '나레이터',
        text: '우주력 799년, 엘 파실 혁명정부가 수립되었습니다. 제국에 저항하는 마지막 불꽃입니다.',
        duration: 4000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'el_facil_independent',
        flagValue: true,
      },
    },
    {
      type: 'CHANGE_OWNER',
      params: {
        locationId: 'el_facil',
        newOwnerId: 'el_facil_revolutionary_government',
        locationType: 'planet',
      },
    },
    {
      type: 'SPAWN_FLEET',
      params: {
        fleetData: {
          fleetId: 'el_facil_defense_fleet',
          name: '엘 파실 방위 함대',
          factionId: 'el_facil_revolutionary_government',
          commanderId: 'romsky',
          locationId: 'el_facil',
          composition: {
            battleships: 2000,
            cruisers: 1500,
            destroyers: 1000,
            carriers: 200,
            frigates: 800,
            transports: 100,
          },
        },
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'el_facil_revolutionary_government',
        resourceType: 'morale',
        amount: 80,
        operation: 'set',
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 90,
};

/**
 * 엘 파실 혁명 이벤트
 * 엘 파실 내부의 민중 봉기
 */
export const EL_FACIL_REVOLUTION_EVENT: ScenarioEvent = {
  id: INDEPENDENCE_EVENT_IDS.EL_FACIL_REVOLUTION,
  name: '엘 파실 혁명',
  description:
    '엘 파실 시민들이 자유를 위해 봉기합니다.',

  trigger: {
    type: 'ON_TURN_RANGE',
    params: {
      turnMin: 40,
      turnMax: 60,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'barat_treaty_signed' },
        },
        {
          checkType: 'CUSTOM',
          params: {
            checkType: 'RESOURCE_LTE',
            factionId: 'free_planets_alliance',
            resourceType: 'publicOrder',
            threshold: 30,
          },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'citizen',
        speakerName: '엘 파실 시민',
        text: '더 이상 제국의 속국으로 살 수 없다! 자유가 아니면 죽음을!',
        duration: 3000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'el_facil_revolution_started',
        flagValue: true,
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'free_planets_alliance',
        resourceType: 'stability',
        amount: -20,
        operation: 'add',
      },
    },
    {
      type: 'TRIGGER_EVENT',
      params: {
        eventId: INDEPENDENCE_EVENT_IDS.EL_FACIL_INDEPENDENCE,
      },
      delay: 2000,
    },
  ],

  once: true,
  enabled: true,
  priority: 85,
};

/**
 * 자치권 변동 이벤트 (선택지 있음)
 * 특정 지역의 자치권 확대 또는 축소
 */
export const AUTONOMY_CHANGE_EVENT: ScenarioEvent = {
  id: INDEPENDENCE_EVENT_IDS.AUTONOMY_CHANGE,
  name: '자치권 변동',
  description:
    '특정 지역에서 자치권 요구가 높아지고 있습니다. 어떻게 대응하시겠습니까?',

  trigger: {
    type: 'ON_MONTH_START',
    params: {},
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'CUSTOM',
          params: {
            checkType: 'RANDOM_CHANCE',
            chance: 0.1, // 10% 확률로 매월 발생
          },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'advisor',
        speakerName: '참모',
        text: '보고드립니다. 변방 지역에서 자치권 확대를 요구하는 목소리가 높아지고 있습니다.',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'advisor',
        speakerName: '참모',
        text: '요구를 수용하면 해당 지역의 지지를 얻을 수 있지만, 다른 지역에서도 비슷한 요구가 이어질 수 있습니다.',
        duration: 5000,
      },
    },
  ],

  choices: [
    {
      id: 'choice_expand_autonomy',
      text: '자치권을 확대한다',
      conditions: [],
      actions: [
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'leader',
            speakerName: '지도자',
            text: '지역의 목소리에 귀 기울여야 한다. 자치권 확대를 승인한다.',
            duration: 3000,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'autonomy_expanded',
            flagValue: true,
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FACTION',
            targetId: 'current_faction',
            resourceType: 'regionalSupport',
            amount: 15,
            operation: 'add',
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FACTION',
            targetId: 'current_faction',
            resourceType: 'centralAuthority',
            amount: -10,
            operation: 'add',
          },
        },
      ],
      consequences: '지역 지지 상승, 중앙 권위 하락',
    },
    {
      id: 'choice_restrict_autonomy',
      text: '자치권 요구를 거부한다',
      conditions: [],
      actions: [
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'leader',
            speakerName: '지도자',
            text: '국가의 통합이 우선이다. 자치권 확대는 분열의 씨앗이 될 수 있다.',
            duration: 3000,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'autonomy_restricted',
            flagValue: true,
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FACTION',
            targetId: 'current_faction',
            resourceType: 'centralAuthority',
            amount: 10,
            operation: 'add',
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FACTION',
            targetId: 'current_faction',
            resourceType: 'regionalSupport',
            amount: -20,
            operation: 'add',
          },
        },
      ],
      consequences: '중앙 권위 상승, 지역 지지 하락 (반란 위험 증가)',
    },
    {
      id: 'choice_negotiate',
      text: '협상을 통해 절충안을 찾는다',
      conditions: [],
      actions: [
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'leader',
            speakerName: '지도자',
            text: '양측 모두가 수용할 수 있는 방안을 찾아보자.',
            duration: 3000,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'autonomy_negotiated',
            flagValue: true,
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FACTION',
            targetId: 'current_faction',
            resourceType: 'diplomacy',
            amount: 5,
            operation: 'add',
          },
        },
      ],
      consequences: '외교력 소폭 상승, 현상 유지',
    },
  ],

  repeatable: true,
  repeatDelay: 12, // 12턴(1년) 후 다시 발생 가능
  enabled: true,
  priority: 50,
};

/**
 * 이제를론 공화국 수립 이벤트
 * 양 웬리 사후 이제를론 기반 독립 정부
 */
export const ISERLOHN_REPUBLIC_EVENT: ScenarioEvent = {
  id: INDEPENDENCE_EVENT_IDS.ISERLOHN_REPUBLIC,
  name: '이제를론 공화국 수립',
  description:
    '양 웬리의 뜻을 이은 이들이 이제를론을 거점으로 공화국을 선포합니다.',

  trigger: {
    type: 'ON_EVENT_TRIGGERED',
    params: {
      eventId: 'EVT_ALL_YANG_DEATH', // 양 웬리 사망 이벤트 후
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'yang_wenli_dead' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'julian_mintz' },
        },
        {
          checkType: 'FACTION_CONTROLS',
          params: {
            factionId: 'yang_fleet_remnants',
            locationId: 'iserlohn_fortress',
          },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'julian_mintz',
        speakerName: '율리안 민츠',
        text: '양 제독의 뜻을 이어받아... 우리는 민주주의의 불꽃을 지켜나갈 것입니다.',
        portrait: 'julian_mintz_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'frederica',
        speakerName: '프레데리카 그린힐',
        text: '이제를론 공화정부의 수립을 선포합니다.',
        portrait: 'frederica_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'iserlohn_republic_founded',
        flagValue: true,
      },
    },
    {
      type: 'CHANGE_OWNER',
      params: {
        locationId: 'iserlohn_fortress',
        newOwnerId: 'iserlohn_republic',
        locationType: 'base',
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'iserlohn_republic',
        resourceType: 'legitimacy',
        amount: 70,
        operation: 'set',
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 95,
};

/**
 * 페잔 중립 종료 이벤트
 * 제국의 페잔 점령으로 중립 지위 상실
 */
export const PHEZZAN_NEUTRALITY_END_EVENT: ScenarioEvent = {
  id: INDEPENDENCE_EVENT_IDS.PHEZZAN_NEUTRALITY_END,
  name: '페잔 중립 종료',
  description:
    '제국군이 페잔을 점령하고 중립 지위가 종료됩니다.',

  trigger: {
    type: 'ON_PLANET_CAPTURED',
    params: {
      locationId: 'phezzan',
      factionId: 'galactic_empire',
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'phezzan_invasion_started' },
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
        text: '우주력 798년, 제국군이 페잔을 점령했습니다. 150년간 유지되어 온 페잔의 중립이 종료됩니다.',
        duration: 5000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'phezzan_neutrality_ended',
        flagValue: true,
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'phezzan',
        resourceType: 'neutralStatus',
        amount: 0,
        operation: 'set',
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'rubinsky',
        speakerName: '아드리안 루빈스키',
        text: '역사의 수레바퀴는 내 예상보다 빨리 돌아갔군...',
        portrait: 'rubinsky_portrait',
        duration: 4000,
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 88,
};

// ============================================================================
// Event Collection Export
// ============================================================================

/**
 * 모든 분리독립 이벤트 목록
 */
export const INDEPENDENCE_EVENTS: ScenarioEvent[] = [
  EL_FACIL_INDEPENDENCE_EVENT,
  EL_FACIL_REVOLUTION_EVENT,
  AUTONOMY_CHANGE_EVENT,
  ISERLOHN_REPUBLIC_EVENT,
  PHEZZAN_NEUTRALITY_END_EVENT,
];

/**
 * 이벤트 ID로 이벤트 조회
 */
export function getIndependenceEventById(eventId: string): ScenarioEvent | undefined {
  return INDEPENDENCE_EVENTS.find((event) => event.id === eventId);
}

/**
 * 트리거 타입으로 이벤트 필터링
 */
export function getIndependenceEventsByTrigger(
  triggerType: EventTrigger['type']
): ScenarioEvent[] {
  return INDEPENDENCE_EVENTS.filter((event) => event.trigger.type === triggerType);
}

export default INDEPENDENCE_EVENTS;





