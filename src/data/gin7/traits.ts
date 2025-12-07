/**
 * Gin7 Trait System
 * 은하영웅전설 캐릭터 특성 정의
 */

import { Gin7Trait, Gin7TraitCategory } from '../../types/gin7/character.types';

export const GIN7_TRAITS: Gin7Trait[] = [
  // ============================================
  // POSITIVE TRAITS (긍정적 트레잇)
  // ============================================
  {
    id: 'genius',
    name: 'Genius',
    nameKo: '천재',
    description: '타고난 재능으로 모든 분야에서 빠른 성장을 보인다.',
    category: 'positive',
    rarity: 0.05,
    pointCost: 5,
    effects: [
      { type: 'exp_bonus', value: 0.5, description: '경험치 획득 +50%' },
      { type: 'stat_bonus', target: 'all', value: 1, description: '모든 스탯 +1' }
    ],
    conflicts: ['slow_learner', 'mediocre']
  },
  {
    id: 'brave',
    name: 'Brave',
    nameKo: '용맹',
    description: '전장에서 두려움 없이 돌격하는 용사.',
    category: 'positive',
    rarity: 0.15,
    pointCost: 3,
    effects: [
      { type: 'morale_bonus', value: 0.3, description: '사기 감소 -30%' },
      { type: 'stat_bonus', target: 'attack', value: 1 }
    ],
    conflicts: ['coward', 'cautious']
  },
  {
    id: 'tactician',
    name: 'Tactician',
    nameKo: '전술가',
    description: '뛰어난 전술적 안목으로 전장을 지배한다.',
    category: 'positive',
    rarity: 0.10,
    pointCost: 4,
    effects: [
      { type: 'stat_bonus', target: 'command', value: 2 },
      { type: 'special_ability', value: 1, description: '기습 성공률 +20%' }
    ]
  },
  {
    id: 'strategist',
    name: 'Strategist',
    nameKo: '전략가',
    description: '거시적 관점에서 전쟁의 흐름을 읽는다.',
    category: 'positive',
    rarity: 0.08,
    pointCost: 4,
    effects: [
      { type: 'stat_bonus', target: 'intelligence', value: 2 },
      { type: 'stat_bonus', target: 'operation', value: 1 }
    ]
  },
  {
    id: 'charismatic',
    name: 'Charismatic',
    nameKo: '카리스마',
    description: '강한 존재감으로 부하들의 충성을 이끌어낸다.',
    category: 'positive',
    rarity: 0.12,
    pointCost: 3,
    effects: [
      { type: 'stat_bonus', target: 'leadership', value: 2 },
      { type: 'morale_bonus', value: 0.15, description: '부대 사기 +15%' }
    ]
  },
  {
    id: 'ace_pilot',
    name: 'Ace Pilot',
    nameKo: '에이스 파일럿',
    description: '뛰어난 조종 실력으로 함선을 자유자재로 다룬다.',
    category: 'positive',
    rarity: 0.10,
    pointCost: 3,
    effects: [
      { type: 'stat_bonus', target: 'piloting', value: 3 },
      { type: 'stat_bonus', target: 'mobility', value: 1 }
    ]
  },
  {
    id: 'administrator',
    name: 'Administrator',
    nameKo: '행정가',
    description: '효율적인 관리로 자원을 최대한 활용한다.',
    category: 'positive',
    rarity: 0.15,
    pointCost: 2,
    effects: [
      { type: 'stat_bonus', target: 'operation', value: 2 },
      { type: 'resource_bonus', value: 0.1, description: '자원 생산 +10%' }
    ]
  },
  {
    id: 'diplomat',
    name: 'Diplomat',
    nameKo: '외교관',
    description: '탁월한 협상력으로 외교적 성과를 이끌어낸다.',
    category: 'positive',
    rarity: 0.12,
    pointCost: 2,
    effects: [
      { type: 'diplomacy_bonus', value: 0.25, description: '외교 성공률 +25%' },
      { type: 'stat_bonus', target: 'intelligence', value: 1 }
    ]
  },
  {
    id: 'steadfast',
    name: 'Steadfast',
    nameKo: '불굴',
    description: '어떤 상황에서도 흔들리지 않는 강철 의지.',
    category: 'positive',
    rarity: 0.15,
    pointCost: 2,
    effects: [
      { type: 'stat_bonus', target: 'defense', value: 2 },
      { type: 'morale_bonus', value: 0.2, description: '패배 시 사기 감소 -20%' }
    ],
    conflicts: ['coward', 'indecisive']
  },
  {
    id: 'lucky',
    name: 'Lucky',
    nameKo: '행운아',
    description: '기묘하게도 위기를 빠져나가는 행운의 소유자.',
    category: 'positive',
    rarity: 0.10,
    pointCost: 2,
    effects: [
      { type: 'special_ability', value: 0.15, description: '치명적 피해 회피 +15%' }
    ]
  },

  // ============================================
  // NEGATIVE TRAITS (부정적 트레잇)
  // ============================================
  {
    id: 'coward',
    name: 'Coward',
    nameKo: '겁쟁이',
    description: '전투를 두려워하여 쉽게 물러선다.',
    category: 'negative',
    rarity: 0.15,
    pointCost: -3,
    effects: [
      { type: 'morale_bonus', value: -0.3, description: '사기 감소 +30%' },
      { type: 'stat_bonus', target: 'attack', value: -1 }
    ],
    conflicts: ['brave', 'steadfast']
  },
  {
    id: 'arrogant',
    name: 'Arrogant',
    nameKo: '오만',
    description: '자신의 능력을 과신하여 적을 얕본다.',
    category: 'negative',
    rarity: 0.12,
    pointCost: -2,
    effects: [
      { type: 'stat_bonus', target: 'intelligence', value: -1 },
      { type: 'special_ability', value: -0.1, description: '함정 탐지 -10%' }
    ]
  },
  {
    id: 'indecisive',
    name: 'Indecisive',
    nameKo: '우유부단',
    description: '결정을 내리지 못해 기회를 놓친다.',
    category: 'negative',
    rarity: 0.12,
    pointCost: -2,
    effects: [
      { type: 'stat_bonus', target: 'command', value: -2 },
      { type: 'stat_bonus', target: 'mobility', value: -1 }
    ],
    conflicts: ['steadfast']
  },
  {
    id: 'slow_learner',
    name: 'Slow Learner',
    nameKo: '둔재',
    description: '새로운 것을 배우는 데 시간이 오래 걸린다.',
    category: 'negative',
    rarity: 0.15,
    pointCost: -2,
    effects: [
      { type: 'exp_bonus', value: -0.25, description: '경험치 획득 -25%' }
    ],
    conflicts: ['genius']
  },
  {
    id: 'mediocre',
    name: 'Mediocre',
    nameKo: '평범',
    description: '특출난 재능이 없는 평범한 인물.',
    category: 'negative',
    rarity: 0.20,
    pointCost: -1,
    effects: [
      { type: 'stat_bonus', target: 'all', value: -1, description: '모든 스탯 -1 (최소 1)' }
    ],
    conflicts: ['genius']
  },
  {
    id: 'reckless',
    name: 'Reckless',
    nameKo: '무모',
    description: '상황을 고려하지 않고 무작정 돌진한다.',
    category: 'negative',
    rarity: 0.12,
    pointCost: -2,
    effects: [
      { type: 'stat_bonus', target: 'attack', value: 1 },
      { type: 'stat_bonus', target: 'defense', value: -2 }
    ]
  },
  {
    id: 'cautious',
    name: 'Overly Cautious',
    nameKo: '과신중',
    description: '지나친 신중함으로 공격 기회를 놓친다.',
    category: 'negative',
    rarity: 0.12,
    pointCost: -1,
    effects: [
      { type: 'stat_bonus', target: 'attack', value: -1 },
      { type: 'stat_bonus', target: 'defense', value: 1 }
    ],
    conflicts: ['brave', 'reckless']
  },
  {
    id: 'greedy',
    name: 'Greedy',
    nameKo: '탐욕',
    description: '개인의 이익을 위해 부대를 위험에 빠뜨린다.',
    category: 'negative',
    rarity: 0.10,
    pointCost: -2,
    effects: [
      { type: 'morale_bonus', value: -0.15, description: '부대 사기 -15%' },
      { type: 'resource_bonus', value: 0.1, description: '약탈 자원 +10%' }
    ]
  },

  // ============================================
  // SPECIAL TRAITS (특수 트레잇)
  // ============================================
  {
    id: 'fleet_commander',
    name: 'Fleet Commander',
    nameKo: '함대 사령관',
    description: '대규모 함대를 지휘하는 데 특화된 능력.',
    category: 'special',
    rarity: 0.05,
    pointCost: 4,
    effects: [
      { type: 'stat_bonus', target: 'leadership', value: 2 },
      { type: 'stat_bonus', target: 'command', value: 2 },
      { type: 'special_ability', value: 1, description: '함대 규모 +20%' }
    ]
  },
  {
    id: 'ground_warfare',
    name: 'Ground Warfare Expert',
    nameKo: '지상전 전문가',
    description: '행성 상륙 작전과 지상전에 특화.',
    category: 'special',
    rarity: 0.08,
    pointCost: 3,
    effects: [
      { type: 'stat_bonus', target: 'attack', value: 2 },
      { type: 'stat_bonus', target: 'defense', value: 1 },
      { type: 'special_ability', value: 1, description: '지상전 공격력 +30%' }
    ]
  },
  {
    id: 'logistics_master',
    name: 'Logistics Master',
    nameKo: '보급의 달인',
    description: '완벽한 보급 체계로 장기전을 가능케 한다.',
    category: 'special',
    rarity: 0.08,
    pointCost: 3,
    effects: [
      { type: 'stat_bonus', target: 'operation', value: 3 },
      { type: 'resource_bonus', value: 0.2, description: '보급 효율 +20%' }
    ]
  },
  {
    id: 'intelligence_expert',
    name: 'Intelligence Expert',
    nameKo: '정보전 전문가',
    description: '적의 움직임을 파악하는 데 탁월한 능력.',
    category: 'special',
    rarity: 0.08,
    pointCost: 3,
    effects: [
      { type: 'stat_bonus', target: 'intelligence', value: 3 },
      { type: 'special_ability', value: 1, description: '첩보 성공률 +30%' }
    ]
  },
  {
    id: 'raider',
    name: 'Raider',
    nameKo: '습격자',
    description: '게릴라전과 기습에 특화된 전술가.',
    category: 'special',
    rarity: 0.10,
    pointCost: 2,
    effects: [
      { type: 'stat_bonus', target: 'mobility', value: 2 },
      { type: 'stat_bonus', target: 'attack', value: 1 },
      { type: 'special_ability', value: 1, description: '기습 피해 +25%' }
    ]
  },
  {
    id: 'fortress_defender',
    name: 'Fortress Defender',
    nameKo: '요새 수비대',
    description: '방어전과 요새 방어에 특화.',
    category: 'special',
    rarity: 0.10,
    pointCost: 2,
    effects: [
      { type: 'stat_bonus', target: 'defense', value: 3 },
      { type: 'special_ability', value: 1, description: '요새 방어력 +30%' }
    ]
  },

  // ============================================
  // LEGENDARY TRAITS (전설 트레잇)
  // ============================================
  {
    id: 'undefeated',
    name: 'The Undefeated',
    nameKo: '상승의 영웅',
    description: '수많은 전투에서 패배를 모르는 전설적 명장.',
    category: 'legendary',
    rarity: 0.01,
    pointCost: 8,
    effects: [
      { type: 'stat_bonus', target: 'command', value: 3 },
      { type: 'stat_bonus', target: 'leadership', value: 2 },
      { type: 'morale_bonus', value: 0.5, description: '부대 사기 +50%' },
      { type: 'special_ability', value: 1, description: '역전 확률 +20%' }
    ],
    conflicts: ['coward', 'mediocre', 'slow_learner']
  },
  {
    id: 'miracle_yang',
    name: 'Miracle Worker',
    nameKo: '기적의 양',
    description: '불가능해 보이는 상황에서도 승리를 이끌어내는 천재.',
    category: 'legendary',
    rarity: 0.01,
    pointCost: 8,
    effects: [
      { type: 'stat_bonus', target: 'intelligence', value: 3 },
      { type: 'stat_bonus', target: 'command', value: 2 },
      { type: 'special_ability', value: 1, description: '열세 시 전투력 +40%' }
    ],
    conflicts: ['mediocre', 'slow_learner', 'reckless']
  },
  {
    id: 'golden_lion',
    name: 'Golden Lion',
    nameKo: '금발의 패자',
    description: '제국을 통일할 야망과 능력을 갖춘 영웅.',
    category: 'legendary',
    rarity: 0.01,
    pointCost: 10,
    effects: [
      { type: 'stat_bonus', target: 'leadership', value: 3 },
      { type: 'stat_bonus', target: 'command', value: 2 },
      { type: 'stat_bonus', target: 'attack', value: 2 },
      { type: 'exp_bonus', value: 0.3, description: '경험치 획득 +30%' },
      { type: 'special_ability', value: 1, description: '공격 시 사기 저하 면역' }
    ],
    conflicts: ['coward', 'mediocre', 'indecisive']
  }
];

/**
 * 트레잇 ID로 트레잇 조회
 */
export function getTraitById(id: string): Gin7Trait | null {
  return GIN7_TRAITS.find(t => t.id === id) || null;
}

/**
 * 카테고리별 트레잇 조회
 */
export function getTraitsByCategory(category: Gin7TraitCategory): Gin7Trait[] {
  return GIN7_TRAITS.filter(t => t.category === category);
}

/**
 * 사용 가능한 트레잇 필터링 (포인트 기준)
 */
export function getAffordableTraits(
  currentTraits: string[],
  availablePoints: number
): Gin7Trait[] {
  const currentTraitObjs = currentTraits.map(id => getTraitById(id)).filter(Boolean) as Gin7Trait[];
  
  return GIN7_TRAITS.filter(trait => {
    // 이미 가지고 있는 트레잇 제외
    if (currentTraits.includes(trait.id)) return false;
    
    // 포인트 부족
    if (trait.pointCost > availablePoints) return false;
    
    // 상충 트레잇 체크
    if (trait.conflicts?.some(conflictId => currentTraits.includes(conflictId))) {
      return false;
    }
    
    // 필수 트레잇 체크
    if (trait.requires && !trait.requires.every(reqId => currentTraits.includes(reqId))) {
      return false;
    }
    
    return true;
  });
}

/**
 * 트레잇 효과 합산
 */
export function calculateTraitEffects(traitIds: string[]): {
  statBonuses: Partial<Record<string, number>>;
  expBonus: number;
  moraleBonus: number;
  resourceBonus: number;
  diplomacyBonus: number;
  specialAbilities: string[];
} {
  const result = {
    statBonuses: {} as Record<string, number>,
    expBonus: 0,
    moraleBonus: 0,
    resourceBonus: 0,
    diplomacyBonus: 0,
    specialAbilities: [] as string[]
  };

  for (const traitId of traitIds) {
    const trait = getTraitById(traitId);
    if (!trait) continue;

    for (const effect of trait.effects) {
      switch (effect.type) {
        case 'stat_bonus':
        case 'stat_multiplier':
          if (effect.target) {
            result.statBonuses[effect.target] = 
              (result.statBonuses[effect.target] || 0) + effect.value;
          }
          break;
        case 'exp_bonus':
          result.expBonus += effect.value;
          break;
        case 'morale_bonus':
          result.moraleBonus += effect.value;
          break;
        case 'resource_bonus':
          result.resourceBonus += effect.value;
          break;
        case 'diplomacy_bonus':
          result.diplomacyBonus += effect.value;
          break;
        case 'special_ability':
          if (effect.description) {
            result.specialAbilities.push(effect.description);
          }
          break;
      }
    }
  }

  return result;
}

export default {
  GIN7_TRAITS,
  getTraitById,
  getTraitsByCategory,
  getAffordableTraits,
  calculateTraitEffects
};

