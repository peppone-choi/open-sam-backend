export type GeneralTraitId =
  | 'chivalry'
  | 'loyalty'
  | 'bravery'
  | 'strategist'
  | 'erudite'
  | 'frugal'
  | 'generous'
  | 'charismatic'
  | 'cautious'
  | 'incorruptible'
  | 'greedy'
  | 'arrogant'
  | 'cruel'
  | 'timid'
  | 'jealous'
  | 'lustful'
  | 'indecisive'
  | 'bigoted'
  | 'suspicious'
  | 'lazy'
  | 'marksman'
  | 'master_strategist'
  | 'warlord'
  | 'naval_expert'
  | 'siege_expert'
  | 'cavalry_tactician'
  | 'administrator'
  | 'diplomat'
  | 'healer'
  | 'occultist';

export type GeneralTraitCategory = '성격+' | '성격-' | '특수';

export interface GeneralTrait {
  id: GeneralTraitId;
  name: string;
  description: string;
  category: GeneralTraitCategory;
  /**
   * 포인트 비용. 양수면 포인트를 소모하고, 음수면 포인트를 환급한다.
   * 예) +3: 강한 좋은 트레잇, -2: 강한 나쁜 트레잇
   */
  pointCost: number;
}

export const GENERAL_TRAITS: GeneralTrait[] = [
  // 성격 – 긍정 트레잇
  {
    id: 'chivalry',
    name: '의협심',
    category: '성격+',
    pointCost: 2,
    description: '의리와 협객 정신을 중시하여 민심과 동료의 신뢰를 얻기 쉽지만, 비열한 계책에는 서투를 수 있습니다.',
  },
  {
    id: 'loyalty',
    name: '충성심',
    category: '성격+',
    pointCost: 3,
    description: '주군과 세력에 대한 충성이 강하여 배신 가능성이 크게 줄어드는 대신, 변절이나 변신 전략에는 매우 비협조적입니다.',
  },
  {
    id: 'bravery',
    name: '용맹',
    category: '성격+',
    pointCost: 3,
    description: '전투에서 앞장서 싸우는 것을 두려워하지 않으며 사기 면에서 우위를 점하기 쉽지만, 무모한 선택을 할 위험도 존재합니다.',
  },
  {
    id: 'strategist',
    name: '지략가',
    category: '성격+',
    pointCost: 3,
    description: '계책과 책략에 뛰어난 감각을 지녀 기습과 함정 운용에 유리하지만, 정면승부에서는 과신으로 인한 실수가 있을 수 있습니다.',
  },
  {
    id: 'erudite',
    name: '박학다식',
    category: '성격+',
    pointCost: 2,
    description: '학문과 기록에 밝아 연구와 교육에서 두각을 나타내지만, 현장 경험이 부족할 수 있습니다.',
  },
  {
    id: 'frugal',
    name: '검소',
    category: '성격+',
    pointCost: 2,
    description: '사치와 낭비를 멀리하여 국고를 튼튼하게 유지하지만, 화려한 대접을 기대하는 인물과는 잘 맞지 않을 수 있습니다.',
  },
  {
    id: 'generous',
    name: '관대함',
    category: '성격+',
    pointCost: 2,
    description: '포로와 부하를 너그럽게 대하여 회유와 귀순에 유리하지만, 필요할 때 단호한 처벌을 망설일 수 있습니다.',
  },
  {
    id: 'charismatic',
    name: '카리스마',
    category: '성격+',
    pointCost: 3,
    description: '강한 존재감과 설득력으로 외교와 인재 등용에 유리하지만, 주변의 질투를 사기도 쉽습니다.',
  },
  {
    id: 'cautious',
    name: '신중함',
    category: '성격+',
    pointCost: 2,
    description: '위험을 세심히 따져 함정을 피하는 데 능하지만, 과도한 신중함이 기회를 놓치게 만들 수 있습니다.',
  },
  {
    id: 'incorruptible',
    name: '청렴',
    category: '성격+',
    pointCost: 2,
    description: '부정부패를 멀리하여 명성이 오르지만, 단기적인 이익을 위해 타협하는 데에는 어울리지 않습니다.',
  },

  // 성격 – 부정 트레잇
  {
    id: 'greedy',
    name: '탐욕',
    category: '성격-',
    pointCost: -2,
    description: '재물을 밝히는 기질로 각종 이익을 챙기는 데는 능하지만, 민심과 평판이 나빠지기 쉽습니다.',
  },
  {
    id: 'arrogant',
    name: '오만',
    category: '성격-',
    pointCost: -1,
    description: '스스로를 과신하여 상대를 깔보는 경향이 있어 외교와 부하 관리에 악영향을 줄 수 있습니다.',
  },
  {
    id: 'cruel',
    name: '잔혹함',
    category: '성격-',
    pointCost: -2,
    description: '적에게 공포를 심어주지만, 민심과 명성이 급격히 떨어지고 반발을 부르는 경우가 많습니다.',
  },
  {
    id: 'timid',
    name: '소심함',
    category: '성격-',
    pointCost: -1,
    description: '위험을 두려워하여 공격적인 행동을 꺼리며, 전투와 모험적 결정에서 불리하게 작용합니다.',
  },
  {
    id: 'jealous',
    name: '질투심',
    category: '성격-',
    pointCost: -1,
    description: '다른 이의 공이나 명성을 시기하여 동료와의 갈등을 부를 수 있습니다.',
  },
  {
    id: 'lustful',
    name: '호색',
    category: '성격-',
    pointCost: -1,
    description: '색을 밝히는 기질로 재정 낭비와 스캔들을 일으키기 쉬우며, 명성에 악영향을 줍니다.',
  },
  {
    id: 'indecisive',
    name: '우유부단',
    category: '성격-',
    pointCost: -2,
    description: '결정을 미루는 경향이 강해 기회를 놓치거나 대응이 늦어질 수 있습니다.',
  },
  {
    id: 'bigoted',
    name: '편협함',
    category: '성격-',
    pointCost: -2,
    description: '자신이 선호하지 않는 출신과 배경을 배척하여 인재 풀이 좁아지고 내분을 초래할 수 있습니다.',
  },
  {
    id: 'suspicious',
    name: '의심 많음',
    category: '성격-',
    pointCost: -1,
    description: '모든 일을 의심하여 첩보와 감시에는 유리하지만, 부하와 동맹의 신뢰를 떨어뜨립니다.',
  },
  {
    id: 'lazy',
    name: '게으름',
    category: '성격-',
    pointCost: -2,
    description: '노력을 아끼는 탓에 내정과 업무 처리 속도가 느려지고 효율이 떨어집니다.',
  },

  // 특수 능력 트레잇
  {
    id: 'marksman',
    name: '명궁',
    category: '특수',
    pointCost: 3,
    description: '궁병 운용과 원거리 전투에 뛰어난 실력을 보입니다.',
  },
  {
    id: 'master_strategist',
    name: '책사',
    category: '특수',
    pointCost: 3,
    description: '전략과 책략을 설계하는 데 특화되어 정보전과 계략에서 강점을 보입니다.',
  },
  {
    id: 'warlord',
    name: '맹장',
    category: '특수',
    pointCost: 3,
    description: '일기토와 돌격전에서 두각을 나타내는 호전적인 장수입니다.',
  },
  {
    id: 'naval_expert',
    name: '수군 전문가',
    category: '특수',
    pointCost: 2,
    description: '수전에서 탁월한 지휘 능력을 발휘하며 강과 바다에서 큰 활약을 합니다.',
  },
  {
    id: 'siege_expert',
    name: '공성 전문가',
    category: '특수',
    pointCost: 2,
    description: '공성전과 성곽 돌파에 특화된 전술을 지니고 있습니다.',
  },
  {
    id: 'cavalry_tactician',
    name: '기병 전술가',
    category: '특수',
    pointCost: 2,
    description: '기병 운용과 기동전을 중심으로 한 전술에 능합니다.',
  },
  {
    id: 'administrator',
    name: '내정가',
    category: '특수',
    pointCost: 3,
    description: '농업, 상업, 치안 등 내정 전반을 효율적으로 관리하는 데 뛰어납니다.',
  },
  {
    id: 'diplomat',
    name: '외교관',
    category: '특수',
    pointCost: 3,
    description: '동맹과 협상, 조약 체결에서 유리한 입지를 확보합니다.',
  },
  {
    id: 'healer',
    name: '의술',
    category: '특수',
    pointCost: 2,
    description: '부상자 치료와 역병 대응에 능하여 병력 유지에 도움을 줍니다.',
  },
  {
    id: 'occultist',
    name: '도술/기문',
    category: '특수',
    pointCost: 2,
    description: '도술과 기문진 같은 특수 전술에 밝아 사기전과 심리전에 강점을 보입니다.',
  },
];

export function getTraitById(id: string | null | undefined): GeneralTrait | null {
  if (!id) return null;
  const trait = GENERAL_TRAITS.find((t) => t.id === id);
  return trait || null;
}
