/**
 * 동이 국가 및 이민족 인물 추가 스크립트
 * 
 * 사용법: node scripts/add-foreign-figures.js
 */

const fs = require('fs');
const path = require('path');

const SCENARIOS_DIR = path.join(__dirname, '../config/scenarios/sangokushi');

// 역사적 시나리오 목록 (1010~1110)
const HISTORICAL_SCENARIOS = [
  'scenario_1010.json', // 황건적의 난 (184년)
  'scenario_1020.json', // 반동탁연합 결성 (190년)
  'scenario_1021.json', // 반동탁연합 (190년 변형)
  'scenario_1030.json', // 군웅할거 (194년)
  'scenario_1031.json', // 군웅할거 (변형)
  'scenario_1040.json', // 관도대전 (200년)
  'scenario_1041.json', // 관도대전 (변형)
  'scenario_1050.json', // 삼고초려 (207년)
  'scenario_1060.json', // 적벽대전 (208년)
  'scenario_1070.json', // 한중쟁탈전 (217년)
  'scenario_1080.json', // 삼국정립 (221년)
  'scenario_1090.json', // 오장원 (234년)
  'scenario_1100.json', // 후삼국 (253년)
  'scenario_1110.json', // 진의 통일 (280년)
];

// ========================================
// 동이 국가 정의
// ========================================

// 부여 (夫餘) - 부여씨
const BUYEO_NATION = {
  name: '부여',
  color: '#E8E8E8', // 백색 계열 (백의민족, 부여의 흰색 이미지)
  gold: 5000,
  rice: 5000,
  rulerName: '부여왕',
  tech: 300,
  nationType: '부여',
  level: 4, // 주급
  cities: ['부여']
};

// 고구려 (高句麗) - 고씨
const GOGURYEO_NATION = {
  name: '고구려',
  color: '#DC143C', // 진홍색 (군기 붉은색)
  gold: 6000,
  rice: 6000,
  rulerName: '고구려왕',
  tech: 400,
  nationType: '고구려',
  level: 4, // 주급
  cities: ['졸본', '평양']
};

// 백제 (百濟) - 부여씨
const BAEKJE_NATION = {
  name: '백제',
  color: '#FFD700', // 황금색 (군기 황색)
  gold: 5500,
  rice: 5500,
  rulerName: '백제왕',
  tech: 350,
  nationType: '백제',
  level: 4, // 주급
  cities: ['위례', '사비']
};

// 신라 (新羅) - 박/석/김씨
const SILLA_NATION = {
  name: '신라',
  color: '#1E90FF', // 파란색 (국기 푸른색)
  gold: 5000,
  rice: 5000,
  rulerName: '신라왕',
  tech: 300,
  nationType: '신라',
  level: 3, // 군급
  cities: ['계림']
};

// 가야 (伽倻) - 김씨
const GAYA_NATION = {
  name: '가야',
  color: '#CD853F', // 황토색 (철기, 토기 이미지)
  gold: 4500,
  rice: 4500,
  rulerName: '가야왕',
  tech: 350,
  nationType: '가야',
  level: 3, // 군급
  cities: ['금관']
};

// ========================================
// 이민족 국가 정의
// ========================================

// 오환 (烏桓)
const WUHUAN_NATION = {
  name: '오환',
  color: '#8B4513',
  gold: 3000,
  rice: 3000,
  rulerName: '오환대인',
  tech: 200,
  nationType: '도적',
  level: 2, // 현급
  cities: ['오환']
};

// 선비 (鮮卑)
const XIANBEI_NATION = {
  name: '선비',
  color: '#6B8E23',
  gold: 3500,
  rice: 3500,
  rulerName: '선비대인',
  tech: 200,
  nationType: '도적',
  level: 2, // 현급
  cities: ['선비']
};

// 흉노 (匈奴)
const XIONGNU_NATION = {
  name: '흉노',
  color: '#A0522D',
  gold: 4000,
  rice: 4000,
  rulerName: '남흉노 선우',
  tech: 250,
  nationType: '도적',
  level: 3, // 군급
  cities: ['흉노']
};

// 남만 (南蠻) - 시나리오 1060 이후
const NANMAN_NATION = {
  name: '남만',
  color: '#2E8B57',
  gold: 3000,
  rice: 3000,
  rulerName: '남만왕',
  tech: 150,
  nationType: '도적',
  level: 2, // 현급
  cities: ['남만']
};

// 산월 (山越) - 시나리오 1020 이후
const SHANYUE_NATION = {
  name: '산월',
  color: '#708090',
  gold: 2500,
  rice: 2500,
  rulerName: '산월추장',
  tech: 150,
  nationType: '도적',
  level: 1, // 정급
  cities: ['산월']
};

// ========================================
// 시나리오별 왕 정보 (실명 사용)
// ========================================

const RULERS_BY_ERA = {
  // 황건적의 난 (181년) - 실제 시작연도 기준
  '1010': {
    buyeo: { name: '부여위구태', birth: 120, death: 190 }, // 위구태
    goguryeo: { name: '고남무', birth: 120, death: 197 }, // 고국천왕
    baekje: { name: '부여구', birth: 145, death: 214 }, // 초고왕
    silla: { name: '석벌휴', birth: 140, death: 196 }, // 벌휴 이사금
    gaya: { name: '김수로', birth: 42, death: 199 }, // 수로왕
    wuhuan: { name: '구력거', birth: 140, death: 193 },
    xianbei: { name: '탄석괴', birth: 140, death: 181 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
  },
  // 반동탁연합 결성 (187년)
  '1020': {
    buyeo: { name: '부여위구태', birth: 120, death: 190 },
    goguryeo: { name: '고남무', birth: 120, death: 197 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석벌휴', birth: 140, death: 196 },
    gaya: { name: '김수로', birth: 42, death: 199 },
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '화련', birth: 155, death: 210 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 반동탁연합 결성 정사 (187년)
  '1021': {
    buyeo: { name: '부여위구태', birth: 120, death: 190 },
    goguryeo: { name: '고남무', birth: 120, death: 197 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석벌휴', birth: 140, death: 196 },
    gaya: { name: '김수로', birth: 42, death: 199 },
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '화련', birth: 155, death: 210 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 군웅할거 (191년)
  '1030': {
    buyeo: { name: '부여위구태', birth: 120, death: 190 }, // 이미 사망했지만 후계자 부재로 유지
    goguryeo: { name: '고남무', birth: 120, death: 197 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석벌휴', birth: 140, death: 196 },
    gaya: { name: '김거질미', birth: 150, death: 259 }, // 거질미왕
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 군웅축록 (192년)
  '1031': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 }, // 간위거
    goguryeo: { name: '고남무', birth: 120, death: 197 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석벌휴', birth: 140, death: 196 },
    gaya: { name: '김거질미', birth: 150, death: 259 },
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 황제는 허도로 (193년)
  '1040': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 },
    goguryeo: { name: '고남무', birth: 120, death: 197 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석벌휴', birth: 140, death: 196 },
    gaya: { name: '김거질미', birth: 150, death: 259 },
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 황제 원술 (194년)
  '1041': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 },
    goguryeo: { name: '고남무', birth: 120, death: 197 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석벌휴', birth: 140, death: 196 },
    gaya: { name: '김거질미', birth: 150, death: 259 },
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 관도대전 (197년)
  '1050': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 },
    goguryeo: { name: '고남무', birth: 120, death: 197 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석내해', birth: 160, death: 230 }, // 내해 이사금 (196년 즉위)
    gaya: { name: '김거질미', birth: 150, death: 259 },
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '어부라', birth: 150, death: 195 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 원가의 분열 (199년)
  '1060': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 },
    goguryeo: { name: '고연우', birth: 170, death: 227 }, // 산상왕 (197년 즉위)
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석내해', birth: 160, death: 230 },
    gaya: { name: '김거질미', birth: 150, death: 259 },
    wuhuan: { name: '답돈', birth: 160, death: 207 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '호주천', birth: 170, death: 220 },
    shanyue: { name: '엄백호', birth: 150, death: 200 },
  },
  // 적벽대전 (204년)
  '1070': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 },
    goguryeo: { name: '고연우', birth: 170, death: 227 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석내해', birth: 160, death: 230 },
    gaya: { name: '김거질미', birth: 150, death: 259 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '호주천', birth: 170, death: 220 },
    shanyue: { name: '비잔', birth: 170, death: 230 },
  },
  // 익주 공방전 (210년)
  '1080': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 },
    goguryeo: { name: '고연우', birth: 170, death: 227 },
    baekje: { name: '부여구', birth: 145, death: 214 },
    silla: { name: '석내해', birth: 160, death: 230 },
    gaya: { name: '김거질미', birth: 150, death: 259 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '호주천', birth: 170, death: 220 },
    shanyue: { name: '비잔', birth: 170, death: 230 },
  },
  // 삼국정립 (216년)
  '1090': {
    buyeo: { name: '부여간위거', birth: 160, death: 220 },
    goguryeo: { name: '고연우', birth: 170, death: 227 },
    baekje: { name: '부여구수', birth: 180, death: 234 }, // 구수왕 (214년 즉위)
    silla: { name: '석내해', birth: 160, death: 230 },
    gaya: { name: '김거질미', birth: 150, death: 259 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '호주천', birth: 170, death: 220 },
    nanman: { name: '옹개', birth: 170, death: 225 },
  },
  // 칠종칠금 (222년)
  '1100': {
    buyeo: { name: '부여마여', birth: 195, death: 250 }, // 마여
    goguryeo: { name: '고위궁', birth: 205, death: 270 }, // 동천왕 (227년 즉위지만 태자로)
    baekje: { name: '부여구수', birth: 180, death: 234 },
    silla: { name: '석조분', birth: 190, death: 247 }, // 조분 이사금 (230년 즉위지만 왕자로)
    gaya: { name: '김거질미', birth: 150, death: 259 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '유표', birth: 190, death: 260 },
    nanman: { name: '맹획', birth: 185, death: 250 },
  },
  // 출사표 (225년)
  '1110': {
    buyeo: { name: '부여마여', birth: 195, death: 250 },
    goguryeo: { name: '고위궁', birth: 205, death: 270 }, // 동천왕 (227년 즉위)
    baekje: { name: '부여구수', birth: 180, death: 234 },
    silla: { name: '석조분', birth: 190, death: 247 }, // 조분 이사금 (230년 즉위)
    gaya: { name: '김거질미', birth: 150, death: 259 },
    xianbei: { name: '기비능', birth: 170, death: 235 },
    xiongnu: { name: '유표', birth: 190, death: 260 },
    nanman: { name: '맹획', birth: 185, death: 250 },
  },
};

// ========================================
// 시나리오별 추가 인물 (대신, 무장)
// ========================================

const ADDITIONAL_FIGURES = {
  // 부여 인물
  buyeo: [
    { name: '간위거', birth: 160, death: 220, leadership: 70, strength: 75, intel: 65, politics: 70, charm: 65, special: '돌격' },
    { name: '마여', birth: 195, death: 250, leadership: 65, strength: 70, intel: 60, politics: 65, charm: 60, special: '수비' },
    { name: '의라', birth: 200, death: 260, leadership: 60, strength: 65, intel: 55, politics: 60, charm: 55, special: '돌격' },
  ],
  
  // 고구려 인물
  goguryeo: [
    { name: '을파소', birth: 130, death: 203, leadership: 50, strength: 40, intel: 92, politics: 88, charm: 80, special: '간언' },
    { name: '명림답부', birth: 120, death: 179, leadership: 85, strength: 88, intel: 70, politics: 65, charm: 75, special: '돌격' },
    { name: '우태', birth: 170, death: 230, leadership: 70, strength: 75, intel: 60, politics: 65, charm: 65, special: '철벽' },
    { name: '고우루', birth: 180, death: 248, leadership: 75, strength: 78, intel: 62, politics: 58, charm: 68, special: '돌격' },
    { name: '밀우', birth: 190, death: 259, leadership: 78, strength: 82, intel: 65, politics: 60, charm: 70, special: '철벽' },
    { name: '유유', birth: 200, death: 260, leadership: 72, strength: 76, intel: 58, politics: 55, charm: 62, special: '돌격' },
  ],
  
  // 백제 인물
  baekje: [
    { name: '우복', birth: 140, death: 200, leadership: 65, strength: 70, intel: 75, politics: 78, charm: 72, special: '수비' },
    { name: '해루', birth: 150, death: 210, leadership: 70, strength: 73, intel: 68, politics: 70, charm: 68, special: '돌격' },
    { name: '진충', birth: 180, death: 240, leadership: 72, strength: 75, intel: 70, politics: 72, charm: 70, special: '철벽' },
    { name: '사두', birth: 190, death: 250, leadership: 68, strength: 71, intel: 65, politics: 68, charm: 65, special: '돌격' },
    { name: '진과', birth: 200, death: 260, leadership: 65, strength: 68, intel: 62, politics: 65, charm: 62, special: '수비' },
  ],
  
  // 신라 인물
  silla: [
    { name: '석우로', birth: 160, death: 253, leadership: 78, strength: 80, intel: 65, politics: 60, charm: 70, special: '돌격' },
    { name: '김알지', birth: 100, death: 180, leadership: 60, strength: 55, intel: 80, politics: 85, charm: 88, special: '은둔' },
    { name: '구도', birth: 170, death: 230, leadership: 70, strength: 72, intel: 68, politics: 70, charm: 68, special: '수비' },
    { name: '이음', birth: 180, death: 240, leadership: 68, strength: 70, intel: 65, politics: 68, charm: 65, special: '돌격' },
    { name: '흘해', birth: 200, death: 310, leadership: 72, strength: 74, intel: 70, politics: 75, charm: 72, special: '철벽' },
  ],
  
  // 가야 인물
  gaya: [
    { name: '김탈해', birth: 140, death: 200, leadership: 72, strength: 75, intel: 70, politics: 68, charm: 70, special: '수비' },
    { name: '김각간', birth: 170, death: 230, leadership: 68, strength: 72, intel: 65, politics: 70, charm: 65, special: '돌격' },
    { name: '김허황', birth: 150, death: 210, leadership: 55, strength: 50, intel: 78, politics: 82, charm: 85, special: '은둔' },
    { name: '수클옹', birth: 180, death: 240, leadership: 70, strength: 73, intel: 62, politics: 65, charm: 62, special: '돌격' },
  ],
  
  // 왜 인물 (재야로 배치)
  wa: [
    { name: '비미호', birth: 170, death: 248, leadership: 75, strength: 50, intel: 88, politics: 85, charm: 92, special: '은둔' }, // 히미코
    { name: '난생미', birth: 180, death: 250, leadership: 65, strength: 60, intel: 72, politics: 75, charm: 70, special: '수비' },
    { name: '이요', birth: 200, death: 260, leadership: 60, strength: 55, intel: 70, politics: 72, charm: 75, special: '은둔' }, // 히미코 후계자
    { name: '타소', birth: 150, death: 220, leadership: 70, strength: 72, intel: 65, politics: 60, charm: 65, special: '돌격' },
    { name: '이지마', birth: 180, death: 240, leadership: 65, strength: 68, intel: 62, politics: 65, charm: 62, special: '수비' },
  ],
  
  // 오환 인물
  wuhuan: [
    { name: '구력거', birth: 140, death: 193, leadership: 78, strength: 82, intel: 55, politics: 50, charm: 70, special: '돌격' },
    { name: '답돈', birth: 160, death: 207, leadership: 85, strength: 88, intel: 60, politics: 55, charm: 75, special: '철벽' },
    { name: '난루', birth: 155, death: 210, leadership: 72, strength: 76, intel: 52, politics: 48, charm: 65, special: '돌격' },
    { name: '소복연', birth: 160, death: 207, leadership: 70, strength: 74, intel: 50, politics: 45, charm: 62, special: '돌격' },
    { name: '오연', birth: 158, death: 215, leadership: 68, strength: 72, intel: 48, politics: 45, charm: 60, special: '돌격' },
    { name: '능조', birth: 155, death: 208, leadership: 65, strength: 70, intel: 45, politics: 42, charm: 58, special: '돌격' },
  ],
  
  // 선비 인물
  xianbei: [
    { name: '탄석괴', birth: 140, death: 181, leadership: 90, strength: 85, intel: 75, politics: 70, charm: 85, special: '돌격' },
    { name: '화련', birth: 155, death: 210, leadership: 72, strength: 75, intel: 55, politics: 50, charm: 65, special: '돌격' },
    { name: '기비능', birth: 170, death: 235, leadership: 85, strength: 82, intel: 70, politics: 65, charm: 78, special: '철벽' },
    { name: '보도근', birth: 175, death: 240, leadership: 75, strength: 78, intel: 55, politics: 50, charm: 68, special: '돌격' },
    { name: '부라한', birth: 175, death: 235, leadership: 72, strength: 75, intel: 52, politics: 48, charm: 65, special: '돌격' },
    { name: '비잔', birth: 180, death: 245, leadership: 70, strength: 72, intel: 50, politics: 45, charm: 62, special: '수비' },
  ],
  
  // 흉노 인물
  xiongnu: [
    { name: '어부라', birth: 150, death: 195, leadership: 80, strength: 85, intel: 60, politics: 55, charm: 72, special: '돌격' },
    { name: '호주천', birth: 170, death: 220, leadership: 78, strength: 82, intel: 55, politics: 50, charm: 70, special: '돌격' },
    { name: '거비', birth: 165, death: 215, leadership: 72, strength: 76, intel: 50, politics: 45, charm: 65, special: '돌격' },
    { name: '유표', birth: 190, death: 260, leadership: 75, strength: 78, intel: 65, politics: 60, charm: 68, special: '철벽' },
    { name: '유연', birth: 251, death: 310, leadership: 88, strength: 82, intel: 80, politics: 78, charm: 85, special: '돌격' },
  ],
  
  // 강족 인물 (재야 or 마등 세력)
  qiang: [
    { name: '북궁백옥', birth: 145, death: 190, leadership: 75, strength: 78, intel: 50, politics: 45, charm: 65, special: '돌격' },
    { name: '아귀', birth: 160, death: 215, leadership: 72, strength: 75, intel: 48, politics: 42, charm: 62, special: '돌격' },
    { name: '무도', birth: 170, death: 225, leadership: 70, strength: 73, intel: 45, politics: 40, charm: 60, special: '돌격' },
    { name: '굴건', birth: 165, death: 220, leadership: 68, strength: 72, intel: 42, politics: 38, charm: 58, special: '수비' },
    { name: '아하', birth: 175, death: 230, leadership: 65, strength: 70, intel: 40, politics: 35, charm: 55, special: '돌격' },
    { name: '소과', birth: 178, death: 235, leadership: 62, strength: 68, intel: 38, politics: 32, charm: 52, special: '돌격' },
  ],
  
  // 남만 인물
  nanman: [
    { name: '맹획', birth: 185, death: 250, leadership: 82, strength: 85, intel: 55, politics: 50, charm: 78, special: '돌격' },
    { name: '축융', birth: 190, death: 255, leadership: 78, strength: 80, intel: 60, politics: 55, charm: 82, special: '돌격' }, // 축융부인
    { name: '맹우', birth: 188, death: 252, leadership: 70, strength: 75, intel: 45, politics: 40, charm: 62, special: '돌격' },
    { name: '오과', birth: 180, death: 245, leadership: 85, strength: 92, intel: 30, politics: 25, charm: 65, special: '철벽' }, // 등갑병
    { name: '동도나', birth: 185, death: 250, leadership: 68, strength: 72, intel: 42, politics: 38, charm: 58, special: '돌격' },
    { name: '아회남', birth: 188, death: 255, leadership: 65, strength: 70, intel: 40, politics: 35, charm: 55, special: '수비' },
    { name: '금환삼결', birth: 182, death: 248, leadership: 72, strength: 78, intel: 38, politics: 32, charm: 60, special: '돌격' },
    { name: '타사대왕', birth: 175, death: 240, leadership: 75, strength: 80, intel: 52, politics: 48, charm: 68, special: '철벽' },
    { name: '목록대왕', birth: 180, death: 245, leadership: 78, strength: 82, intel: 45, politics: 40, charm: 65, special: '돌격' }, // 맹수 사용
    { name: '대래동주', birth: 178, death: 242, leadership: 62, strength: 68, intel: 35, politics: 30, charm: 52, special: '수비' },
    { name: '고정', birth: 175, death: 225, leadership: 70, strength: 72, intel: 62, politics: 58, charm: 65, special: '수비' },
    { name: '옹개', birth: 170, death: 225, leadership: 72, strength: 75, intel: 65, politics: 60, charm: 68, special: '돌격' },
    { name: '주포', birth: 172, death: 225, leadership: 68, strength: 70, intel: 58, politics: 55, charm: 60, special: '수비' },
  ],
  
  // 산월 인물
  shanyue: [
    { name: '엄백호', birth: 150, death: 200, leadership: 75, strength: 78, intel: 55, politics: 50, charm: 70, special: '돌격' },
    { name: '엄여', birth: 155, death: 197, leadership: 68, strength: 72, intel: 50, politics: 45, charm: 62, special: '돌격' },
    { name: '비잔', birth: 170, death: 230, leadership: 72, strength: 75, intel: 52, politics: 48, charm: 65, special: '수비' },
  ],
};

// ========================================
// 초상화 ID 범위 설정
// ========================================
let portraitIdCounter = 9000; // 동이/이민족 전용 초상화 ID 시작

function getNextPortraitId() {
  return portraitIdCounter++;
}

// ========================================
// 시나리오 업데이트 함수
// ========================================

function createNationArray(nation, ruler) {
  return [
    nation.name,
    nation.color,
    nation.gold,
    nation.rice,
    `${ruler.name}`,
    nation.tech,
    nation.nationType,
    nation.level,
    nation.cities
  ];
}

function createGeneralArray(nationId, figure, city, isRuler = false) {
  const birthYear = figure.birth || 150;
  const deathYear = figure.death || 250;
  
  // PHP 시나리오 형식:
  // [0:affinity, 1:name, 2:pic, 3:nation, 4:city, 5:LDR, 6:STR, 7:INT, 8:POL, 9:CHR, 10:Lv, 11:Birth, 12:Death, 13:Ego, 14:Special, 15:Text]
  return [
    nationId,                    // index 0 - affinity (국가 ID와 동일하게 설정)
    figure.name,                 // index 1 - name
    getNextPortraitId(),         // index 2 - portrait ID
    nationId,                    // index 3 - nation ID (중요!)
    city,                        // index 4 - city
    figure.leadership || 70,     // index 5 - leadership
    figure.strength || 70,       // index 6 - strength
    figure.intel || 60,          // index 7 - intel
    figure.politics || 60,       // index 8 - politics
    figure.charm || 60,          // index 9 - charm
    isRuler ? 12 : 0,            // index 10 - officer_level (12 = ruler, 0 = 일반)
    birthYear,                   // index 11 - birth year
    deathYear,                   // index 12 - death year
    figure.special || '돌격',     // index 13 - personality/ego
    null,                        // index 14 - special skill
    figure.message || null       // index 15 - text
  ];
}

function getScenarioYear(scenarioId) {
  const yearMap = {
    '1010': 181, // 황건적의 난
    '1020': 187, // 반동탁연합 결성
    '1021': 187, // 반동탁연합 결성 (정사)
    '1030': 191, // 군웅할거
    '1031': 192, // 군웅축록
    '1040': 193, // 황제는 허도로
    '1041': 194, // 황제 원술
    '1050': 197, // 관도대전
    '1060': 199, // 원가의 분열
    '1070': 204, // 적벽대전
    '1080': 210, // 익주 공방전
    '1090': 216, // 삼국정립
    '1100': 222, // 칠종칠금
    '1110': 225, // 출사표
  };
  return yearMap[scenarioId] || 190;
}

function shouldIncludeNation(scenarioId, nationKey) {
  const scenarioNum = parseInt(scenarioId);
  
  // 오환: 207년 조조에게 멸망, 1070(204년) 이후부터 제외
  if (nationKey === 'wuhuan' && scenarioNum >= 1070) return false;
  
  // 선비: 항상 포함 (탄석괴 181년 사망 후 화련, 기비능 등 계승)
  
  // 남만: 1090(216년, 삼국정립) 이후 포함 - 제갈량 남정 준비
  if (nationKey === 'nanman' && scenarioNum < 1090) return false;
  
  // 산월: 1020~1080 (손권이 토벌 진행 중)
  if (nationKey === 'shanyue' && (scenarioNum < 1020 || scenarioNum > 1080)) return false;
  
  return true;
}

function filterFiguresByYear(figures, scenarioYear) {
  return figures.filter(fig => {
    const birthYear = fig.birth || 150;
    const deathYear = fig.death || 250;
    // 시나리오 연도에 15세 이상이고 사망 전인 인물만
    return (scenarioYear - birthYear >= 15) && (scenarioYear <= deathYear);
  });
}

function updateScenario(filename) {
  const filepath = path.join(SCENARIOS_DIR, filename);
  const scenarioId = filename.replace('scenario_', '').replace('.json', '');
  const scenarioYear = getScenarioYear(scenarioId);
  
  console.log(`\n처리 중: ${filename} (${scenarioYear}년)`);
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const scenario = JSON.parse(content);
    
    // 현재 nation 개수 확인
    const existingNationCount = scenario.nation ? scenario.nation.length : 0;
    let nextNationId = existingNationCount + 1;
    
    const rulers = RULERS_BY_ERA[scenarioId];
    if (!rulers) {
      console.log(`  - ${scenarioId}에 대한 왕 정보 없음, 스킵`);
      return;
    }
    
    // 추가할 국가와 장수 목록
    const nationsToAdd = [];
    const generalsToAdd = [];
    
    // 1. 동이 국가 추가
    const eastAsianNations = [
      { key: 'buyeo', nation: BUYEO_NATION },
      { key: 'goguryeo', nation: GOGURYEO_NATION },
      { key: 'baekje', nation: BAEKJE_NATION },
      { key: 'silla', nation: SILLA_NATION },
      { key: 'gaya', nation: GAYA_NATION },
    ];
    
    for (const { key, nation } of eastAsianNations) {
      const ruler = rulers[key];
      if (!ruler) continue;
      
      // 이미 존재하는 국가인지 확인
      const exists = scenario.nation?.some(n => n[0] === nation.name);
      if (exists) {
        console.log(`  - ${nation.name} 이미 존재, 스킵`);
        continue;
      }
      
      const nationId = nextNationId++;
      nationsToAdd.push(createNationArray(nation, ruler));
      
      // 왕 추가
      generalsToAdd.push(createGeneralArray(nationId, ruler, nation.cities[0], true));
      
      // 추가 인물 추가
      const additionalFigures = filterFiguresByYear(ADDITIONAL_FIGURES[key] || [], scenarioYear);
      for (const fig of additionalFigures) {
        // 왕과 같은 이름이면 스킵
        if (fig.name === ruler.name) continue;
        generalsToAdd.push(createGeneralArray(nationId, fig, nation.cities[0], false));
      }
      
      console.log(`  + ${nation.name} 추가 (ID: ${nationId}, 왕: ${ruler.name}, 인물 ${additionalFigures.length + 1}명)`);
    }
    
    // 2. 이민족 국가 추가
    const foreignNations = [
      { key: 'wuhuan', nation: WUHUAN_NATION },
      { key: 'xianbei', nation: XIANBEI_NATION },
      { key: 'xiongnu', nation: XIONGNU_NATION },
      { key: 'nanman', nation: NANMAN_NATION },
      { key: 'shanyue', nation: SHANYUE_NATION },
    ];
    
    for (const { key, nation } of foreignNations) {
      if (!shouldIncludeNation(scenarioId, key)) continue;
      
      const ruler = rulers[key];
      if (!ruler) continue;
      
      // 이미 존재하는 국가인지 확인
      const exists = scenario.nation?.some(n => n[0] === nation.name);
      if (exists) {
        console.log(`  - ${nation.name} 이미 존재, 스킵`);
        continue;
      }
      
      const nationId = nextNationId++;
      nationsToAdd.push(createNationArray(nation, ruler));
      
      // 왕 추가
      generalsToAdd.push(createGeneralArray(nationId, ruler, nation.cities[0], true));
      
      // 추가 인물 추가
      const additionalFigures = filterFiguresByYear(ADDITIONAL_FIGURES[key] || [], scenarioYear);
      for (const fig of additionalFigures) {
        // 왕과 같은 이름이면 스킵
        if (fig.name === ruler.name) continue;
        generalsToAdd.push(createGeneralArray(nationId, fig, nation.cities[0], false));
      }
      
      console.log(`  + ${nation.name} 추가 (ID: ${nationId}, 수장: ${ruler.name}, 인물 ${additionalFigures.length + 1}명)`);
    }
    
    // 3. 왜 인물은 재야로 추가
    const waFigures = filterFiguresByYear(ADDITIONAL_FIGURES.wa || [], scenarioYear);
    for (const fig of waFigures) {
      // 이미 존재하는 인물인지 확인
      const exists = scenario.general?.some(g => g[1] === fig.name);
      if (exists) continue;
      
      generalsToAdd.push(createGeneralArray(999, fig, '왜', false));
    }
    if (waFigures.length > 0) {
      console.log(`  + 왜 재야 인물 ${waFigures.length}명 추가`);
    }
    
    // 4. 강족 인물은 재야로 추가 (서량 지역)
    const qiangFigures = filterFiguresByYear(ADDITIONAL_FIGURES.qiang || [], scenarioYear);
    for (const fig of qiangFigures) {
      // 이미 존재하는 인물인지 확인
      const exists = scenario.general?.some(g => g[1] === fig.name);
      if (exists) continue;
      
      generalsToAdd.push(createGeneralArray(999, fig, '서량', false));
    }
    if (qiangFigures.length > 0) {
      console.log(`  + 강족 재야 인물 ${qiangFigures.length}명 추가`);
    }
    
    // 시나리오 업데이트
    if (nationsToAdd.length > 0 || generalsToAdd.length > 0) {
      // 국가 추가
      scenario.nation = [...(scenario.nation || []), ...nationsToAdd];
      
      // 장수 추가
      scenario.general = [...(scenario.general || []), ...generalsToAdd];
      
      // 파일 저장
      fs.writeFileSync(filepath, JSON.stringify(scenario, null, 4), 'utf8');
      console.log(`  ✓ 저장 완료 (국가 ${nationsToAdd.length}개, 장수 ${generalsToAdd.length}명 추가)`);
    } else {
      console.log(`  - 추가할 내용 없음`);
    }
    
  } catch (error) {
    console.error(`  ✗ 오류: ${error.message}`);
  }
}

// ========================================
// 메인 실행
// ========================================

console.log('='.repeat(60));
console.log('동이 국가 및 이민족 인물 추가 스크립트');
console.log('='.repeat(60));

for (const filename of HISTORICAL_SCENARIOS) {
  const filepath = path.join(SCENARIOS_DIR, filename);
  if (fs.existsSync(filepath)) {
    updateScenario(filename);
  } else {
    console.log(`\n파일 없음: ${filename}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('완료!');
console.log('='.repeat(60));

