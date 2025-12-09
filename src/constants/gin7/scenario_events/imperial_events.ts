/**
 * GIN7 Imperial Events - 제국 시나리오 이벤트
 *
 * 립슈타트 전역 관련 이벤트 정의
 * - 귀족 연합 결성
 * - 베스터란트 학살
 * - 가이에스부르크 공방전
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

export const IMPERIAL_EVENT_IDS = {
  // 립슈타트 전역 관련
  LIPSTADT_WAR_START: 'EVT_IMP_LIPSTADT_START',
  NOBLE_ALLIANCE_FORMATION: 'EVT_IMP_NOBLE_ALLIANCE',
  WESTERLAND_MASSACRE: 'EVT_IMP_WESTERLAND',
  GEIERSBURG_BATTLE: 'EVT_IMP_GEIERSBURG',

  // 추가 제국 이벤트
  REINHARD_CORONATION: 'EVT_IMP_REINHARD_CORONATION',
  LICHTENLADE_REMOVAL: 'EVT_IMP_LICHTENLADE_REMOVAL',
  BRAUNSCHWEIG_DEATH: 'EVT_IMP_BRAUNSCHWEIG_DEATH',
  LITTENHEIM_DEATH: 'EVT_IMP_LITTENHEIM_DEATH',
} as const;

// ============================================================================
// Event Definitions
// ============================================================================

/**
 * 립슈타트 전역 발발 이벤트
 * 귀족 연합이 라인하르트에 대항하여 전쟁을 선포
 */
export const LIPSTADT_WAR_START_EVENT: ScenarioEvent = {
  id: IMPERIAL_EVENT_IDS.LIPSTADT_WAR_START,
  name: '립슈타트 전역 발발',
  description:
    '귀족 연합이 라인하르트 폰 로엔그람에 대항하여 전쟁을 선포합니다. 제국 내전의 시작입니다.',

  trigger: {
    type: 'ON_EVENT_TRIGGERED',
    params: {
      eventId: IMPERIAL_EVENT_IDS.NOBLE_ALLIANCE_FORMATION,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'noble_alliance_formed' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'reinhard_von_lohengramm' },
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
        text: '우주력 797년(제국력 488년), 립슈타트 전역이 발발했습니다. 은하제국의 운명을 건 내전이 시작됩니다.',
        duration: 5000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'lipstadt_war_active',
        flagValue: true,
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'empire_reinhard',
        resourceType: 'morale',
        amount: 10,
        operation: 'add',
      },
    },
    {
      type: 'MODIFY_RESOURCE',
      params: {
        targetType: 'FACTION',
        targetId: 'noble_alliance',
        resourceType: 'morale',
        amount: 20,
        operation: 'add',
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 100,
};

/**
 * 귀족 연합 결성 이벤트
 * 브라운슈바이크 공작과 리텐하임 후작이 연합을 결성
 */
export const NOBLE_ALLIANCE_FORMATION_EVENT: ScenarioEvent = {
  id: IMPERIAL_EVENT_IDS.NOBLE_ALLIANCE_FORMATION,
  name: '귀족 연합 결성',
  description:
    '브라운슈바이크 공작과 리텐하임 후작이 연합을 결성하여 라인하르트에 대항합니다.',

  trigger: {
    type: 'ON_TURN',
    params: {
      turn: 1,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'braunschweig' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'littenheim' },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'braunschweig',
        speakerName: '브라운슈바이크 공작',
        text: '골든바움 왕조의 정통성을 지키기 위해, 저 금발의 악동을 반드시 처단해야 합니다!',
        portrait: 'braunschweig_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'littenheim',
        speakerName: '리텐하임 후작',
        text: '귀족의 명예와 제국의 전통을 위해 함께 싸웁시다.',
        portrait: 'littenheim_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'noble_alliance_formed',
        flagValue: true,
      },
    },
    {
      type: 'SPAWN_FLEET',
      params: {
        fleetData: {
          fleetId: 'noble_alliance_main_fleet',
          name: '귀족 연합 주력 함대',
          factionId: 'noble_alliance',
          commanderId: 'braunschweig',
          locationId: 'geiersburg',
          composition: {
            battleships: 15000,
            cruisers: 8000,
            destroyers: 5000,
            carriers: 1000,
            frigates: 3000,
            transports: 500,
          },
        },
      },
    },
    {
      type: 'TRIGGER_EVENT',
      params: {
        eventId: IMPERIAL_EVENT_IDS.LIPSTADT_WAR_START,
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 110,
};

/**
 * 베스터란트 학살 이벤트 (선택지 있음)
 * 오베르슈타인의 계획: 귀족 연합의 잔학행위를 방치하여 여론전에서 승리
 */
export const WESTERLAND_MASSACRE_EVENT: ScenarioEvent = {
  id: IMPERIAL_EVENT_IDS.WESTERLAND_MASSACRE,
  name: '베스터란트 학살',
  description:
    '브라운슈바이크 공작이 반란을 진압하기 위해 베스터란트에 핵공격을 계획합니다.',

  trigger: {
    type: 'ON_TURN_RANGE',
    params: {
      turnMin: 5,
      turnMax: 15,
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'lipstadt_war_active' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'braunschweig' },
        },
        {
          checkType: 'CHARACTER_ALIVE',
          params: { characterId: 'oberstein' },
        },
      ],
    },
  ],

  actions: [
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'oberstein',
        speakerName: '파울 폰 오베르슈타인',
        text: '각하, 정보에 따르면 브라운슈바이크 공작이 베스터란트에 핵공격을 계획하고 있습니다.',
        portrait: 'oberstein_portrait',
        duration: 4000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'oberstein',
        speakerName: '파울 폰 오베르슈타인',
        text: '이를 방치한다면, 귀족 연합의 잔학성이 전 은하에 알려질 것입니다. 여론은 우리 편이 될 것입니다.',
        portrait: 'oberstein_portrait',
        duration: 5000,
      },
    },
    {
      type: 'SHOW_DIALOGUE',
      params: {
        speakerId: 'reinhard',
        speakerName: '라인하르트 폰 로엔그람',
        text: '200만 민간인의 생명을... 정치적 도구로 삼으라는 말인가?',
        portrait: 'reinhard_portrait',
        duration: 4000,
      },
    },
  ],

  choices: [
    {
      id: 'choice_accept_oberstein_plan',
      text: '오베르슈타인의 계획을 수용한다 (베스터란트 학살 방치)',
      conditions: [],
      actions: [
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'reinhard',
            speakerName: '라인하르트 폰 로엔그람',
            text: '...좋다. 하지만 이 결정의 무게는 평생 내가 짊어지겠다.',
            portrait: 'reinhard_portrait',
            duration: 4000,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'westerland_massacre_allowed',
            flagValue: true,
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FACTION',
            targetId: 'noble_alliance',
            resourceType: 'morale',
            amount: -50,
            operation: 'add',
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'FACTION',
            targetId: 'empire_reinhard',
            resourceType: 'publicSupport',
            amount: 30,
            operation: 'add',
          },
        },
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'narrator',
            speakerName: '나레이터',
            text: '베스터란트의 비극은 귀족 연합의 지지기반을 완전히 붕괴시켰습니다.',
            duration: 4000,
          },
        },
      ],
      consequences: '귀족 연합 사기 대폭 하락, 라인하르트 지지율 상승',
    },
    {
      id: 'choice_prevent_massacre',
      text: '학살을 저지한다 (함대를 보내 민간인 구출)',
      conditions: [],
      actions: [
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'reinhard',
            speakerName: '라인하르트 폰 로엔그람',
            text: '나는 민간인을 희생양으로 삼는 자가 되지 않겠다. 즉시 함대를 보내라!',
            portrait: 'reinhard_portrait',
            duration: 4000,
          },
        },
        {
          type: 'SET_FLAG',
          params: {
            flagName: 'westerland_saved',
            flagValue: true,
          },
        },
        {
          type: 'MODIFY_RESOURCE',
          params: {
            targetType: 'CHARACTER',
            targetId: 'reinhard_von_lohengramm',
            resourceType: 'honor',
            amount: 20,
            operation: 'add',
          },
        },
        {
          type: 'SHOW_DIALOGUE',
          params: {
            speakerId: 'narrator',
            speakerName: '나레이터',
            text: '라인하르트의 함대가 베스터란트 주민들을 구출했습니다. 전쟁은 길어지겠지만, 그의 명예는 지켜졌습니다.',
            duration: 4000,
          },
        },
      ],
      consequences: '라인하르트 명예 상승, 전쟁 장기화',
    },
  ],

  once: true,
  enabled: true,
  priority: 90,
};

/**
 * 가이에스부르크 공방전 이벤트
 * 귀족 연합 본거지 가이에스부르크 요새 공략전
 */
export const GEIERSBURG_BATTLE_EVENT: ScenarioEvent = {
  id: IMPERIAL_EVENT_IDS.GEIERSBURG_BATTLE,
  name: '가이에스부르크 공방전',
  description:
    '귀족 연합의 본거지인 가이에스부르크 요새를 공략하는 최종 결전입니다.',

  trigger: {
    type: 'ON_CONDITION_MET',
    params: {
      conditionId: 'noble_alliance_weakened',
    },
  },

  conditions: [
    {
      type: 'AND',
      checks: [
        {
          checkType: 'FLAG_SET',
          params: { flagName: 'lipstadt_war_active' },
        },
        {
          checkType: 'FACTION_CONTROLS',
          params: {
            factionId: 'noble_alliance',
            locationId: 'geiersburg_fortress',
          },
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
        text: '드디어 마지막이다. 가이에스부르크를 함락시키고 이 전쟁을 끝내겠다!',
        portrait: 'reinhard_portrait',
        duration: 4000,
      },
    },
    {
      type: 'CAMERA_FOCUS',
      params: {
        targetType: 'PLANET',
        targetId: 'geiersburg_fortress',
        customData: {
          zoom: 2.0,
          duration: 3000,
        },
      },
    },
    {
      type: 'START_BATTLE',
      params: {
        attackerFleetId: 'reinhard_main_fleet',
        defenderFleetId: 'noble_alliance_main_fleet',
        battleType: 'siege',
        specialRules: ['FORTRESS_SIEGE', 'NO_RETREAT_DEFENDER'],
      },
    },
    {
      type: 'SET_FLAG',
      params: {
        flagName: 'geiersburg_battle_started',
        flagValue: true,
      },
    },
  ],

  once: true,
  enabled: true,
  priority: 80,
};

// ============================================================================
// Event Collection Export
// ============================================================================

/**
 * 모든 제국 이벤트 목록
 */
export const IMPERIAL_EVENTS: ScenarioEvent[] = [
  LIPSTADT_WAR_START_EVENT,
  NOBLE_ALLIANCE_FORMATION_EVENT,
  WESTERLAND_MASSACRE_EVENT,
  GEIERSBURG_BATTLE_EVENT,
];

/**
 * 이벤트 ID로 이벤트 조회
 */
export function getImperialEventById(eventId: string): ScenarioEvent | undefined {
  return IMPERIAL_EVENTS.find((event) => event.id === eventId);
}

/**
 * 트리거 타입으로 이벤트 필터링
 */
export function getImperialEventsByTrigger(
  triggerType: EventTrigger['type']
): ScenarioEvent[] {
  return IMPERIAL_EVENTS.filter((event) => event.trigger.type === triggerType);
}

export default IMPERIAL_EVENTS;

