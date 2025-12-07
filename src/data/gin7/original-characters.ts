/**
 * Gin7 Original Characters
 * 은하영웅전설 오리지널 캐릭터 데이터
 */

import { OriginalCharacter, Gin7Stats } from '../../types/gin7/character.types';

export const ORIGINAL_CHARACTERS: OriginalCharacter[] = [
  // ============================================
  // 은하제국 (Galactic Empire)
  // ============================================
  
  // LEGENDARY 등급
  {
    id: 'reinhard',
    name: 'Reinhard von Lohengramm',
    nameKo: '라인하르트 폰 로엔그람',
    faction: 'empire',
    rank: '황제',
    stats: { leadership: 10, command: 10, operation: 8, intelligence: 9, piloting: 7, attack: 9, defense: 7, mobility: 8 },
    traits: ['golden_lion', 'genius', 'charismatic'],
    description: '금발의 패자. 은하제국을 통일하고 새 왕조를 연 전설적 영웅.',
    rarity: 'legendary',
    reputationCost: 10000
  },
  {
    id: 'kircheis',
    name: 'Siegfried Kircheis',
    nameKo: '지크프리트 키르히아이스',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 9, command: 9, operation: 8, intelligence: 8, piloting: 7, attack: 8, defense: 8, mobility: 7 },
    traits: ['genius', 'steadfast', 'charismatic'],
    description: '라인하르트의 붉은 그림자. 충성과 능력을 겸비한 이상적인 군인.',
    rarity: 'legendary',
    reputationCost: 9000
  },

  // EPIC 등급 - 제국군 제독단
  {
    id: 'mittermeyer',
    name: 'Wolfgang Mittermeyer',
    nameKo: '볼프강 미터마이어',
    faction: 'empire',
    rank: '원수',
    stats: { leadership: 9, command: 9, operation: 7, intelligence: 7, piloting: 8, attack: 9, defense: 6, mobility: 10 },
    traits: ['ace_pilot', 'brave', 'fleet_commander'],
    description: '질풍 볼프. 제국군 최고의 기동전 전문가.',
    rarity: 'epic',
    reputationCost: 5000
  },
  {
    id: 'reuenthal',
    name: 'Oskar von Reuenthal',
    nameKo: '오스카 폰 로이엔탈',
    faction: 'empire',
    rank: '원수',
    stats: { leadership: 9, command: 9, operation: 7, intelligence: 8, piloting: 7, attack: 8, defense: 7, mobility: 8 },
    traits: ['tactician', 'charismatic', 'arrogant'],
    description: '금은요안의 사나이. 미터마이어와 함께 제국 쌍벽.',
    rarity: 'epic',
    reputationCost: 5000
  },
  {
    id: 'oberstein',
    name: 'Paul von Oberstein',
    nameKo: '파울 폰 오베르슈타인',
    faction: 'empire',
    rank: '군무상서',
    stats: { leadership: 6, command: 5, operation: 9, intelligence: 10, piloting: 3, attack: 4, defense: 5, mobility: 4 },
    traits: ['strategist', 'intelligence_expert'],
    description: '냉혹한 책사. 목적을 위해 수단을 가리지 않는 참모.',
    rarity: 'epic',
    reputationCost: 4500
  },
  {
    id: 'mueller',
    name: 'Neidhart Müller',
    nameKo: '나이트하르트 뮐러',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 8, command: 8, operation: 7, intelligence: 7, piloting: 7, attack: 7, defense: 9, mobility: 7 },
    traits: ['steadfast', 'fortress_defender'],
    description: '철벽 뮐러. 뛰어난 방어전 능력의 소유자.',
    rarity: 'epic',
    reputationCost: 4000
  },
  {
    id: 'bittenfeld',
    name: 'Fritz Josef Bittenfeld',
    nameKo: '프리츠 요제프 비텐펠트',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 8, command: 7, operation: 5, intelligence: 5, piloting: 8, attack: 10, defense: 4, mobility: 9 },
    traits: ['brave', 'reckless', 'raider'],
    description: '흑색창기병. 무모할 정도로 공격적인 돌격 전술가.',
    rarity: 'epic',
    reputationCost: 4000
  },

  // RARE 등급 - 제국군
  {
    id: 'wahlen',
    name: 'August Samuel Wahlen',
    nameKo: '아우구스트 자무엘 발렌',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 7, command: 7, operation: 8, intelligence: 7, piloting: 6, attack: 7, defense: 7, mobility: 7 },
    traits: ['administrator', 'steadfast'],
    description: '의수의 명장. 균형 잡힌 능력의 유능한 제독.',
    rarity: 'rare',
    reputationCost: 2500
  },
  {
    id: 'lutz',
    name: 'Cornelius Lutz',
    nameKo: '코넬리우스 루츠',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 7, command: 7, operation: 7, intelligence: 6, piloting: 6, attack: 7, defense: 7, mobility: 6 },
    traits: ['tactician'],
    description: '신중하고 안정적인 제독.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'kempf',
    name: 'Karl Gustav Kempf',
    nameKo: '카를 구스타프 켐프',
    faction: 'empire',
    rank: '대장',
    stats: { leadership: 7, command: 7, operation: 6, intelligence: 6, piloting: 7, attack: 8, defense: 6, mobility: 7 },
    traits: ['brave'],
    description: '공격적인 전술을 선호하는 유능한 제독.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'steinmetz',
    name: 'Karl Robert Steinmetz',
    nameKo: '카를 로베르트 슈타인메츠',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 7, command: 7, operation: 7, intelligence: 6, piloting: 6, attack: 6, defense: 8, mobility: 6 },
    traits: ['steadfast'],
    description: '방어전에 능한 신뢰할 수 있는 제독.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'eisenach',
    name: 'Ernest Mecklinger',
    nameKo: '에르네스트 메클링거',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 7, command: 6, operation: 8, intelligence: 8, piloting: 5, attack: 5, defense: 6, mobility: 5 },
    traits: ['administrator', 'diplomat'],
    description: '예술가 제독. 내정과 문화에도 조예가 깊다.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'fahrenheit',
    name: 'Adalbert von Fahrenheit',
    nameKo: '아달베르트 폰 파렌하이트',
    faction: 'empire',
    rank: '중장',
    stats: { leadership: 7, command: 7, operation: 6, intelligence: 6, piloting: 8, attack: 8, defense: 5, mobility: 8 },
    traits: ['ace_pilot', 'brave'],
    description: '뛰어난 함대기동 능력을 가진 젊은 제독.',
    rarity: 'rare',
    reputationCost: 1800
  },

  // COMMON 등급 - 제국군
  {
    id: 'streit',
    name: 'Helmut Lennenkamp',
    nameKo: '헬무트 레넨캄프',
    faction: 'empire',
    rank: '대장',
    stats: { leadership: 6, command: 6, operation: 6, intelligence: 5, piloting: 6, attack: 7, defense: 6, mobility: 6 },
    traits: ['brave'],
    description: '용감하지만 평범한 능력의 제독.',
    rarity: 'common',
    reputationCost: 800
  },
  {
    id: 'flegel',
    name: 'Wilhelm von Littenheim',
    nameKo: '빌헬름 폰 리텐하임',
    faction: 'empire',
    rank: '대장',
    stats: { leadership: 5, command: 5, operation: 6, intelligence: 5, piloting: 5, attack: 5, defense: 5, mobility: 5 },
    traits: ['arrogant'],
    description: '귀족 출신의 평범한 제독.',
    rarity: 'common',
    reputationCost: 500
  },

  // ============================================
  // 자유행성동맹 (Free Planets Alliance)
  // ============================================

  // LEGENDARY 등급
  {
    id: 'yang',
    name: 'Yang Wen-li',
    nameKo: '양 웬리',
    faction: 'alliance',
    rank: '원수',
    stats: { leadership: 8, command: 10, operation: 6, intelligence: 10, piloting: 5, attack: 7, defense: 9, mobility: 6 },
    traits: ['miracle_yang', 'genius', 'strategist'],
    description: '불패의 마술사. 열세를 뒤집는 기적의 용병술.',
    rarity: 'legendary',
    reputationCost: 10000
  },

  // EPIC 등급 - 동맹군
  {
    id: 'julian',
    name: 'Julian Minci',
    nameKo: '율리안 민츠',
    faction: 'alliance',
    rank: '소장',
    stats: { leadership: 7, command: 8, operation: 7, intelligence: 9, piloting: 9, attack: 7, defense: 7, mobility: 8 },
    traits: ['genius', 'ace_pilot', 'tactician'],
    description: '양 웬리의 양자이자 후계자. 뛰어난 조종 실력.',
    rarity: 'epic',
    reputationCost: 5000
  },
  {
    id: 'bucock',
    name: 'Alexandre Bewcock',
    nameKo: '알렉산드르 뷰코크',
    faction: 'alliance',
    rank: '원수',
    stats: { leadership: 9, command: 8, operation: 7, intelligence: 7, piloting: 5, attack: 6, defense: 8, mobility: 5 },
    traits: ['steadfast', 'charismatic', 'fleet_commander'],
    description: '동맹군의 마지막 원수. 노련한 함대 지휘관.',
    rarity: 'epic',
    reputationCost: 4500
  },
  {
    id: 'merkatz',
    name: 'Willibald Joachim Merkatz',
    nameKo: '빌리발트 요아힘 메르카츠',
    faction: 'alliance',
    rank: '상급대장',
    stats: { leadership: 8, command: 8, operation: 7, intelligence: 7, piloting: 6, attack: 7, defense: 8, mobility: 6 },
    traits: ['tactician', 'steadfast'],
    description: '제국에서 망명한 노련한 명장.',
    rarity: 'epic',
    reputationCost: 4000
  },
  {
    id: 'attenborough',
    name: 'Dusty Attenborough',
    nameKo: '더스티 아텐보로',
    faction: 'alliance',
    rank: '소장',
    stats: { leadership: 7, command: 8, operation: 6, intelligence: 8, piloting: 7, attack: 8, defense: 6, mobility: 8 },
    traits: ['tactician', 'raider'],
    description: '양 함대의 참모. 기습전에 능한 전술가.',
    rarity: 'epic',
    reputationCost: 3500
  },

  // RARE 등급 - 동맹군
  {
    id: 'fischer',
    name: 'Edwin Fischer',
    nameKo: '에드윈 피셔',
    faction: 'alliance',
    rank: '소장',
    stats: { leadership: 7, command: 7, operation: 8, intelligence: 7, piloting: 8, attack: 6, defense: 6, mobility: 8 },
    traits: ['ace_pilot', 'logistics_master'],
    description: '양 함대의 항해장. 함대 기동의 달인.',
    rarity: 'rare',
    reputationCost: 2500
  },
  {
    id: 'murai',
    name: 'Murai',
    nameKo: '무라이',
    faction: 'alliance',
    rank: '준장',
    stats: { leadership: 6, command: 6, operation: 8, intelligence: 7, piloting: 5, attack: 5, defense: 7, mobility: 5 },
    traits: ['administrator', 'cautious'],
    description: '양 함대의 참모장. 신중하고 꼼꼼한 성격.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'poplin',
    name: 'Olivier Poplin',
    nameKo: '올리비에 포플란',
    faction: 'alliance',
    rank: '중령',
    stats: { leadership: 5, command: 5, operation: 4, intelligence: 6, piloting: 10, attack: 9, defense: 5, mobility: 9 },
    traits: ['ace_pilot', 'lucky'],
    description: '천재 파일럿. 스파르타니안 에이스.',
    rarity: 'rare',
    reputationCost: 2500
  },
  {
    id: 'konev',
    name: 'Ivan Konev',
    nameKo: '이반 코네프',
    faction: 'alliance',
    rank: '중령',
    stats: { leadership: 5, command: 5, operation: 4, intelligence: 6, piloting: 10, attack: 8, defense: 6, mobility: 9 },
    traits: ['ace_pilot'],
    description: '포플란의 라이벌. 뛰어난 전투기 조종사.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'schenkopp',
    name: 'Walter von Schönkopf',
    nameKo: '발터 폰 셴코프',
    faction: 'alliance',
    rank: '중장',
    stats: { leadership: 7, command: 7, operation: 5, intelligence: 7, piloting: 6, attack: 10, defense: 8, mobility: 7 },
    traits: ['ground_warfare', 'brave', 'raider'],
    description: '장미기사연대장. 최강의 백병전 전문가.',
    rarity: 'rare',
    reputationCost: 3000
  },
  {
    id: 'baghdash',
    name: 'Baghdash',
    nameKo: '바그다슈',
    faction: 'alliance',
    rank: '대령',
    stats: { leadership: 5, command: 6, operation: 7, intelligence: 9, piloting: 5, attack: 5, defense: 5, mobility: 6 },
    traits: ['intelligence_expert'],
    description: '정보부 요원. 뛰어난 첩보 능력.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'frederica',
    name: 'Frederica Greenhill',
    nameKo: '프레데리카 그린힐',
    faction: 'alliance',
    rank: '소령',
    stats: { leadership: 6, command: 6, operation: 8, intelligence: 8, piloting: 5, attack: 4, defense: 5, mobility: 5 },
    traits: ['administrator', 'diplomat'],
    description: '양 웬리의 부관이자 아내. 유능한 참모.',
    rarity: 'rare',
    reputationCost: 2500
  },

  // COMMON 등급 - 동맹군
  {
    id: 'paetta',
    name: 'Paetta',
    nameKo: '파에타',
    faction: 'alliance',
    rank: '중장',
    stats: { leadership: 6, command: 6, operation: 6, intelligence: 5, piloting: 5, attack: 6, defense: 6, mobility: 5 },
    traits: [],
    description: '아스타테 회전의 제4함대 사령관.',
    rarity: 'common',
    reputationCost: 800
  },
  {
    id: 'fork',
    name: 'Andrew Fork',
    nameKo: '앤드류 포크',
    faction: 'alliance',
    rank: '준장',
    stats: { leadership: 4, command: 5, operation: 6, intelligence: 6, piloting: 4, attack: 4, defense: 4, mobility: 4 },
    traits: ['arrogant', 'indecisive'],
    description: '제국 원정의 주창자. 무능한 참모.',
    rarity: 'common',
    reputationCost: 300
  },
  {
    id: 'lobos',
    name: 'Lasalle Lobos',
    nameKo: '라살 로보스',
    faction: 'alliance',
    rank: '원수',
    stats: { leadership: 6, command: 5, operation: 6, intelligence: 5, piloting: 4, attack: 5, defense: 5, mobility: 4 },
    traits: ['cautious'],
    description: '제국 원정군 총사령관. 무능한 지휘관.',
    rarity: 'common',
    reputationCost: 500
  },

  // ============================================
  // 페잔 자치령 (Phezzan Dominion)
  // ============================================

  // EPIC 등급
  {
    id: 'rubinsky',
    name: 'Adrian Rubinsky',
    nameKo: '아드리안 루빈스키',
    faction: 'phezzan',
    rank: '자치령주',
    stats: { leadership: 6, command: 4, operation: 9, intelligence: 10, piloting: 3, attack: 3, defense: 4, mobility: 4 },
    traits: ['strategist', 'intelligence_expert', 'greedy'],
    description: '페잔의 검은 여우. 은하를 조종하는 흑막.',
    rarity: 'epic',
    reputationCost: 4000
  },

  // RARE 등급
  {
    id: 'kesserling',
    name: 'Kesserling',
    nameKo: '케셀링',
    faction: 'phezzan',
    rank: '정보부장',
    stats: { leadership: 5, command: 4, operation: 7, intelligence: 9, piloting: 4, attack: 4, defense: 5, mobility: 5 },
    traits: ['intelligence_expert'],
    description: '루빈스키의 측근. 정보 수집의 달인.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'boltec',
    name: 'Nicholas Boltec',
    nameKo: '니콜라스 볼텍',
    faction: 'phezzan',
    rank: '고위관료',
    stats: { leadership: 5, command: 3, operation: 8, intelligence: 8, piloting: 3, attack: 3, defense: 4, mobility: 4 },
    traits: ['administrator'],
    description: '루빈스키의 후계자. 야심가.',
    rarity: 'rare',
    reputationCost: 1500
  },

  // ============================================
  // 지구교 및 기타 (Earth Cult & Others)
  // ============================================

  // EPIC 등급
  {
    id: 'devillier',
    name: 'De Villier',
    nameKo: '드 빌리에',
    faction: 'neutral',
    rank: '총대주교',
    stats: { leadership: 6, command: 3, operation: 8, intelligence: 9, piloting: 2, attack: 2, defense: 3, mobility: 3 },
    traits: ['strategist', 'intelligence_expert'],
    description: '지구교 수장. 암약하는 흑막.',
    rarity: 'epic',
    reputationCost: 3500
  },

  // ============================================
  // 추가 제국군 캐릭터
  // ============================================
  {
    id: 'annerose',
    name: 'Annerose von Grünewald',
    nameKo: '안네로제 폰 그뤼네발트',
    faction: 'empire',
    rank: '황비',
    stats: { leadership: 5, command: 3, operation: 6, intelligence: 7, piloting: 2, attack: 2, defense: 4, mobility: 3 },
    traits: ['charismatic', 'diplomat'],
    description: '라인하르트의 누나. 황제의 총애를 받았던 여인.',
    rarity: 'rare',
    reputationCost: 2500
  },
  {
    id: 'hildegard',
    name: 'Hildegard von Mariendorf',
    nameKo: '힐데가르트 폰 마린도르프',
    faction: 'empire',
    rank: '황후',
    stats: { leadership: 6, command: 4, operation: 9, intelligence: 9, piloting: 3, attack: 3, defense: 4, mobility: 4 },
    traits: ['strategist', 'administrator', 'diplomat'],
    description: '라인하르트의 황후. 뛰어난 정치적 감각.',
    rarity: 'epic',
    reputationCost: 4000
  },
  {
    id: 'emil',
    name: 'Emil von Selle',
    nameKo: '에밀 폰 젤레',
    faction: 'empire',
    rank: '소좌',
    stats: { leadership: 4, command: 4, operation: 6, intelligence: 5, piloting: 5, attack: 4, defense: 5, mobility: 5 },
    traits: [],
    description: '라인하르트의 시종무관. 충직한 부관.',
    rarity: 'common',
    reputationCost: 500
  },
  {
    id: 'kesler',
    name: 'Ulrich Kesler',
    nameKo: '울리히 케슬러',
    faction: 'empire',
    rank: '상급대장',
    stats: { leadership: 7, command: 6, operation: 8, intelligence: 8, piloting: 5, attack: 6, defense: 7, mobility: 6 },
    traits: ['administrator', 'intelligence_expert'],
    description: '헌병총감. 치안과 정보 업무의 전문가.',
    rarity: 'rare',
    reputationCost: 2500
  },

  // ============================================
  // 추가 동맹군 캐릭터
  // ============================================
  {
    id: 'greenhill_d',
    name: 'Dwight Greenhill',
    nameKo: '드와이트 그린힐',
    faction: 'alliance',
    rank: '대장',
    stats: { leadership: 7, command: 7, operation: 7, intelligence: 6, piloting: 5, attack: 6, defense: 7, mobility: 5 },
    traits: ['steadfast'],
    description: '프레데리카의 아버지. 쿠데타에 가담한 비운의 장군.',
    rarity: 'rare',
    reputationCost: 2000
  },
  {
    id: 'jessica',
    name: 'Jessica Edwards',
    nameKo: '제시카 에드워즈',
    faction: 'alliance',
    rank: '민간인',
    stats: { leadership: 6, command: 3, operation: 5, intelligence: 7, piloting: 2, attack: 2, defense: 3, mobility: 3 },
    traits: ['charismatic', 'diplomat'],
    description: '반전 운동가. 민주주의의 상징.',
    rarity: 'rare',
    reputationCost: 1500
  },
  {
    id: 'caselnes',
    name: 'Alex Caselnes',
    nameKo: '알렉스 카셀느',
    faction: 'alliance',
    rank: '소장',
    stats: { leadership: 6, command: 5, operation: 9, intelligence: 7, piloting: 4, attack: 4, defense: 5, mobility: 4 },
    traits: ['logistics_master', 'administrator'],
    description: '보급의 귀재. 양 웬리의 친구.',
    rarity: 'rare',
    reputationCost: 2500
  },
  {
    id: 'sithole',
    name: 'Job Trunicht',
    nameKo: '요브 트뤼니히트',
    faction: 'alliance',
    rank: '국가원수',
    stats: { leadership: 6, command: 3, operation: 7, intelligence: 8, piloting: 2, attack: 2, defense: 4, mobility: 3 },
    traits: ['charismatic', 'greedy', 'coward'],
    description: '동맹의 정치인. 교활하고 무책임한 선동가.',
    rarity: 'rare',
    reputationCost: 1500
  },

  // ============================================
  // 제국 귀족파
  // ============================================
  {
    id: 'braunschweig',
    name: 'Otto von Braunschweig',
    nameKo: '오토 폰 브라운슈바이크',
    faction: 'empire',
    rank: '공작',
    stats: { leadership: 5, command: 4, operation: 6, intelligence: 4, piloting: 3, attack: 5, defense: 5, mobility: 4 },
    traits: ['arrogant', 'greedy'],
    description: '귀족연합의 수장. 구체제의 상징.',
    rarity: 'rare',
    reputationCost: 1500
  },
  {
    id: 'littenheim',
    name: 'Wilhelm von Littenheim III',
    nameKo: '빌헬름 폰 리텐하임 3세',
    faction: 'empire',
    rank: '후작',
    stats: { leadership: 4, command: 4, operation: 5, intelligence: 4, piloting: 3, attack: 4, defense: 4, mobility: 4 },
    traits: ['arrogant'],
    description: '귀족연합의 일원. 무능한 귀족.',
    rarity: 'common',
    reputationCost: 500
  },
  {
    id: 'flegel_m',
    name: 'Flegel',
    nameKo: '플레겔',
    faction: 'empire',
    rank: '남작',
    stats: { leadership: 4, command: 4, operation: 4, intelligence: 3, piloting: 4, attack: 5, defense: 4, mobility: 4 },
    traits: ['reckless', 'arrogant'],
    description: '브라운슈바이크의 조카. 무모한 돌격가.',
    rarity: 'common',
    reputationCost: 400
  },
  {
    id: 'ansbach',
    name: 'Anton Fellner von Ansbach',
    nameKo: '안톤 펠너 폰 안스바흐',
    faction: 'empire',
    rank: '대령',
    stats: { leadership: 6, command: 6, operation: 5, intelligence: 7, piloting: 5, attack: 6, defense: 6, mobility: 6 },
    traits: ['brave'],
    description: '브라운슈바이크의 충신. 충성스러운 부관.',
    rarity: 'rare',
    reputationCost: 1500
  },

  // ============================================
  // 추가 캐릭터 (50+ 달성)
  // ============================================
  {
    id: 'ovlesser',
    name: 'Ovlesser',
    nameKo: '오프레서',
    faction: 'empire',
    rank: '대장',
    stats: { leadership: 6, command: 6, operation: 5, intelligence: 5, piloting: 7, attack: 7, defense: 5, mobility: 7 },
    traits: ['brave'],
    description: '귀족연합군의 장군.',
    rarity: 'common',
    reputationCost: 800
  },
  {
    id: 'ferner',
    name: 'Anton Ferner',
    nameKo: '안톤 페르너',
    faction: 'empire',
    rank: '준장',
    stats: { leadership: 5, command: 5, operation: 7, intelligence: 7, piloting: 4, attack: 4, defense: 5, mobility: 5 },
    traits: ['administrator'],
    description: '오베르슈타인의 부관.',
    rarity: 'common',
    reputationCost: 700
  },
  {
    id: 'bergengrun',
    name: 'Bergengrun',
    nameKo: '베르겐그륀',
    faction: 'empire',
    rank: '중장',
    stats: { leadership: 6, command: 6, operation: 6, intelligence: 5, piloting: 6, attack: 6, defense: 6, mobility: 6 },
    traits: [],
    description: '키르히아이스 휘하의 제독.',
    rarity: 'common',
    reputationCost: 700
  },
  {
    id: 'schneider',
    name: 'Schneider',
    nameKo: '슈나이더',
    faction: 'alliance',
    rank: '준장',
    stats: { leadership: 5, command: 6, operation: 6, intelligence: 6, piloting: 5, attack: 5, defense: 5, mobility: 5 },
    traits: [],
    description: '메르카츠의 부관.',
    rarity: 'common',
    reputationCost: 600
  },
  {
    id: 'linz',
    name: 'Linz',
    nameKo: '린츠',
    faction: 'alliance',
    rank: '중장',
    stats: { leadership: 6, command: 6, operation: 6, intelligence: 5, piloting: 6, attack: 6, defense: 6, mobility: 6 },
    traits: [],
    description: '양 함대의 분함대장.',
    rarity: 'common',
    reputationCost: 700
  },
  {
    id: 'mashengo',
    name: 'Mashengo',
    nameKo: '마솅고',
    faction: 'alliance',
    rank: '병장',
    stats: { leadership: 4, command: 4, operation: 4, intelligence: 5, piloting: 5, attack: 8, defense: 7, mobility: 6 },
    traits: ['brave'],
    description: '장미기사연대원. 백병전의 달인.',
    rarity: 'common',
    reputationCost: 600
  },
  {
    id: 'blumehart',
    name: 'Blumehart',
    nameKo: '블루메하르트',
    faction: 'alliance',
    rank: '소령',
    stats: { leadership: 5, command: 5, operation: 5, intelligence: 5, piloting: 6, attack: 6, defense: 5, mobility: 6 },
    traits: [],
    description: '장미기사연대의 부관.',
    rarity: 'common',
    reputationCost: 600
  },
  {
    id: 'patrichev',
    name: 'Patrichev',
    nameKo: '파트리체프',
    faction: 'alliance',
    rank: '중령',
    stats: { leadership: 5, command: 5, operation: 5, intelligence: 5, piloting: 5, attack: 5, defense: 5, mobility: 5 },
    traits: [],
    description: '양 함대의 참모.',
    rarity: 'common',
    reputationCost: 500
  }
];

/**
 * ID로 오리지널 캐릭터 조회
 */
export function getOriginalCharacterById(id: string): OriginalCharacter | null {
  return ORIGINAL_CHARACTERS.find(c => c.id === id) || null;
}

/**
 * 진영별 오리지널 캐릭터 조회
 */
export function getOriginalCharactersByFaction(faction: string): OriginalCharacter[] {
  return ORIGINAL_CHARACTERS.filter(c => c.faction === faction);
}

/**
 * 희귀도별 오리지널 캐릭터 조회
 */
export function getOriginalCharactersByRarity(rarity: string): OriginalCharacter[] {
  return ORIGINAL_CHARACTERS.filter(c => c.rarity === rarity);
}

/**
 * 추첨 가능한 캐릭터 목록 (서버에서 이미 선택된 캐릭터 제외)
 */
export function getAvailableForLottery(takenIds: string[]): OriginalCharacter[] {
  return ORIGINAL_CHARACTERS.filter(c => !takenIds.includes(c.id));
}

/**
 * 명성 포인트로 신청 가능한 캐릭터 조회
 */
export function getAffordableCharacters(reputationPoints: number): OriginalCharacter[] {
  return ORIGINAL_CHARACTERS.filter(c => c.reputationCost <= reputationPoints);
}

/**
 * 캐릭터 스탯 총합 계산
 */
export function calculateTotalStats(stats: Gin7Stats): number {
  return Object.values(stats).reduce((sum, val) => sum + val, 0);
}

export default {
  ORIGINAL_CHARACTERS,
  getOriginalCharacterById,
  getOriginalCharactersByFaction,
  getOriginalCharactersByRarity,
  getAvailableForLottery,
  getAffordableCharacters,
  calculateTotalStats
};

