export type GeneralBackgroundId =
  | 'noble_war_family'
  | 'border_commander'
  | 'volunteer_soldier'
  | 'bandit_leader'
  | 'yellow_turban'
  | 'noble_scholar'
  | 'court_scholar'
  | 'local_gentry'
  | 'recluse_scholar'
  | 'merchant'
  | 'healer_fangshi'
  | 'wandering_swordsman'
  | 'retired_official'
  | 'peasant'
  | 'artisan_engineer';

export interface GeneralBackground {
  id: GeneralBackgroundId;
  name: string;
  description: string;
  category: '무장' | '문관' | '특수' | '하층';
  /**
   * 능력치 델타. 배경에 따른 소규모 버프/너프를 표현한다.
   * 정의되지 않은 스탯은 0으로 간주.
   */
  statDelta?: {
    leadership?: number;
    strength?: number;
    intel?: number;
    politics?: number;
    charm?: number;
  };
}

export const GENERAL_BACKGROUNDS: GeneralBackground[] = [
  {
    id: 'noble_war_family',
    name: '명문 무장가 출신',
    category: '무장',
    description: '대대로 무예를 익힌 가문 출신으로, 기본적인 무력과 명성을 지녔습니다.',
    statDelta: { leadership: 3, strength: 4, politics: -2 },
  },
  {
    id: 'border_commander',
    name: '변방 장수',
    category: '무장',
    description: '변방에서 오랑캐와 싸우며 단련된 장수로, 실전 중심의 전술 감각을 지녔습니다.',
    statDelta: { leadership: 2, strength: 3, intel: -2 },
  },
  {
    id: 'volunteer_soldier',
    name: '의용군 출신',
    category: '무장',
    description: '의병으로 봉기하거나 황건적 토벌에 참여하며, 민심과 의리를 중시해 왔습니다.',
    statDelta: { leadership: 1, charm: 3, politics: -1 },
  },
  {
    id: 'bandit_leader',
    name: '도적/산적 출신',
    category: '무장',
    description: '산야와 강호를 떠돌며 살아남은 인물로, 기습과 비정규전에 능합니다.',
    statDelta: { strength: 3, leadership: 1, politics: -1 },
  },
  {
    id: 'yellow_turban',
    name: '황건적 출신',
    category: '무장',
    description: '민란과 혼란의 소용돌이를 겪은 출신으로, 민중 선동과 조직력에 강점을 보입니다.',
    statDelta: { leadership: 1, charm: 2, politics: -1 },
  },
  {
    id: 'noble_scholar',
    name: '명문 사족',
    category: '문관',
    description: '세가(勢家)에 속한 사족 출신으로, 유학 교육과 인맥을 바탕으로 한 권위를 지녔습니다.',
    statDelta: { intel: 3, politics: 3, strength: -3 },
  },
  {
    id: 'court_scholar',
    name: '한림학사',
    category: '문관',
    description: '중앙 조정에서 벼슬을 지낸 학사로, 행정과 외교에 능합니다.',
    statDelta: { intel: 4, politics: 2, leadership: -2 },
  },
  {
    id: 'local_gentry',
    name: '지방 호족',
    category: '문관',
    description: '향촌에서 세력을 쌓은 호족으로, 지역 기반과 경제력을 지니고 있습니다.',
    statDelta: { politics: 3, charm: 2, strength: -1 },
  },
  {
    id: 'recluse_scholar',
    name: '은둔 학자',
    category: '문관',
    description: '세상과 거리를 두고 학문을 닦아 온 인물로, 깊은 책략과 계책을 품고 있습니다.',
    statDelta: { intel: 4, leadership: -2, charm: -1 },
  },
  {
    id: 'merchant',
    name: '상인 출신',
    category: '특수',
    description: '장사를 통해 각지를 오가며 정보와 인맥을 넓힌 인물입니다.',
    statDelta: { politics: 2, charm: 2, strength: -2 },
  },
  {
    id: 'healer_fangshi',
    name: '의원/방사',
    category: '특수',
    description: '의술이나 방술에 능한 인물로, 사람과 기운을 살피는 데 능숙합니다.',
    statDelta: { intel: 2, charm: 1, leadership: -1 },
  },
  {
    id: 'wandering_swordsman',
    name: '유랑 협객',
    category: '특수',
    description: '강호를 떠도는 협객으로, 자유로운 행동과 은밀한 임무에 익숙합니다.',
    statDelta: { strength: 3, charm: 1, politics: -2 },
  },
  {
    id: 'retired_official',
    name: '낙향 관리',
    category: '특수',
    description: '관직에서 물러나 향리로 내려온 전직 관리로, 실무 경험이 풍부합니다.',
    statDelta: { politics: 3, intel: 2, strength: -1 },
  },
  {
    id: 'peasant',
    name: '농민 출신',
    category: '하층',
    description: '토지와 농사에 익숙한 평민 출신으로, 민심과 고단한 삶을 잘 이해합니다.',
    statDelta: { leadership: 1, politics: 1, intel: -1 },
  },
  {
    id: 'artisan_engineer',
    name: '장인/기술자',
    category: '하층',
    description: '성곽, 병기, 공작물 등에 능한 장인으로, 실무 기술에 강점을 지닙니다.',
    statDelta: { politics: 2, intel: 1, strength: -2 },
  },
];
