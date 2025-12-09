/**
 * GIN7 직위(Position) 정의 데이터베이스
 * 매뉴얼 2507행 ~ 4712행 (별표 조직구성표 및 직무권한해설) 100% 반영
 */

export type FactionType = 'empire' | 'alliance';

export interface IPositionDefinition {
  id: string;           // 직위 ID (코드용)
  name: string;         // 직위명 (표시용)
  faction: FactionType; // 소속 진영
  category: string;     // 조직 카테고리 (황궁, 내각, 통합본부 등)
  
  capacity: number;     // 정원 (-1: 무제한, 보통 1~10)
  
  minRank: number;      // 최소 계급 (제국: 0~19, 동맹: 0~18)
  maxRank: number;      // 최대 계급
  
  appointableBy: string[]; // 임명권자 직위 ID 목록
  
  description: string;  // 직무 권한 해설
  
  // 권한 플래그 (기능 구현용)
  authorities: {
    personnel?: boolean;      // 인사권 (일반)
    personnel_high?: boolean; // 고위 인사권 (장관/사령관급)
    military?: boolean;       // 군령권 (작전 입안)
    fleet?: boolean;          // 함대 지휘권
    finance?: boolean;        // 재정권 (세율/예산)
    intelligence?: boolean;   // 첩보/치안권 (체포/조사)
    admin?: boolean;          // 행정권 (내정)
    diplomacy?: boolean;      // 외교권
  };
}

// 계급 매핑 참고 (logh-rank-system.ts)
// Empire: 19(원수)~0(이등병)
// Alliance: 18(원수)~0(이등병)

export const POSITION_DEFINITIONS: IPositionDefinition[] = [
  // ==========================================================================
  // [은하제국] Galactic Empire
  // ==========================================================================
  
  // --- 황궁 (Imperial Court) ---
  {
    id: 'empire_emperor',
    name: '황제',
    faction: 'empire',
    category: '皇宮',
    capacity: 1,
    minRank: 0, maxRank: 19,
    appointableBy: [], // 세습/추대
    description: '은하제국의 최고 권력자. 신성불가침. 친정 시 최고사령관/재상 겸직.',
    authorities: { personnel_high: true, military: true, finance: true, admin: true, intelligence: true, diplomacy: true }
  },
  {
    id: 'empire_supreme_commander',
    name: '제국군최고사령관',
    faction: 'empire',
    category: '皇宮',
    capacity: 1,
    minRank: 19, maxRank: 19, // 원수
    appointableBy: ['empire_emperor'],
    description: '제국군 최고위 사령관. 황제의 군사 권한 분여.',
    authorities: { personnel_high: true, military: true }
  },
  {
    id: 'empire_chief_of_staff',
    name: '막료총감',
    faction: 'empire',
    category: '皇宮',
    capacity: 1,
    minRank: 19, maxRank: 19, // 원수
    appointableBy: ['empire_supreme_commander'],
    description: '대본영 최고 책임자. 각 함대 참모장 임면권 보유.',
    authorities: { personnel: true } // 함대참모장 인사권
  },
  {
    id: 'empire_imperial_staff',
    name: '대본영참모',
    faction: 'empire',
    category: '皇宮',
    capacity: 10,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_chief_of_staff'],
    description: '황제의 대본영 소속 참모. 측근 및 연락장교.',
    authorities: {}
  },

  // --- 내각 (Cabinet) ---
  {
    id: 'empire_prime_minister',
    name: '제국재상',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 19, maxRank: 19, // 원수(또는 문관)
    appointableBy: ['empire_emperor'],
    description: '제국 최고 문관직. 국정 최고 책임자. 내각 조직 권한.',
    authorities: { personnel_high: true, admin: true, finance: true }
  },
  {
    id: 'empire_state_sec',
    name: '국무상서',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 18, maxRank: 19, // 상급대장~원수
    appointableBy: ['empire_prime_minister'],
    description: '실질적 통치자. 행성총독 임면권 보유.',
    authorities: { personnel: true, admin: true }
  },
  {
    id: 'empire_interior_sec',
    name: '내무상서',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_prime_minister'],
    description: '내무 행정 및 치안. 대좌 이하 군인 처단 권한.',
    authorities: { intelligence: true }
  },
  {
    id: 'empire_finance_sec',
    name: '재무상서',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_prime_minister'],
    description: '경제 활동 관장. 과세율 변경 권한.',
    authorities: { finance: true }
  },
  {
    id: 'empire_justice_sec',
    name: '사법상서',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_prime_minister'],
    description: '최고 사법 기관. 정치인 체포/처단 권한.',
    authorities: { intelligence: true }
  },
  {
    id: 'empire_court_sec',
    name: '궁내상서',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_prime_minister'],
    description: '황족 생활 및 재무 관장. 명예직.',
    authorities: {}
  },
  {
    id: 'empire_ritual_sec',
    name: '전례상서',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_prime_minister'],
    description: '궁정 행사 관장. 명예직.',
    authorities: {}
  },
  {
    id: 'empire_science_sec',
    name: '과학상서',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_prime_minister'],
    description: '과학 기술 관장. 명예직.',
    authorities: {}
  },
  {
    id: 'empire_cabinet_sec',
    name: '내각서기관장',
    faction: 'empire',
    category: '內閣',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_prime_minister'],
    description: '국무상서 보좌.',
    authorities: { admin: true }
  },

  // --- 대 페잔 외교 (Fezzan Diplomacy) ---
  {
    id: 'empire_fezzan_high_comm',
    name: '페잔주재고등판무관',
    faction: 'empire',
    category: '駐フェザーン',
    capacity: 1,
    minRank: 8, maxRank: 19, // 소위~원수
    appointableBy: ['empire_prime_minister'], // 재상 임명
    description: '페잔 외교 및 첩보. 외교적 특권 보유.',
    authorities: { diplomacy: true, intelligence: true }
  },
  {
    id: 'empire_fezzan_assist',
    name: '페잔주재보좌관',
    faction: 'empire',
    category: '駐フェザーン',
    capacity: 1,
    minRank: 8, maxRank: 19,
    appointableBy: ['empire_state_sec'], // 국무상서 임명
    description: '고등판무관 보좌.',
    authorities: { intelligence: true }
  },
  {
    id: 'empire_fezzan_attache',
    name: '페잔주재무관',
    faction: 'empire',
    category: '駐フェザーン',
    capacity: 1,
    minRank: 8, maxRank: 19,
    appointableBy: ['empire_personnel_dir'], // 인사국장 임명
    description: '군사 정보 수집.',
    authorities: { intelligence: true }
  },

  // --- 군무성 (Ministry of War) ---
  {
    id: 'empire_military_sec',
    name: '군무상서',
    faction: 'empire',
    category: '軍務省',
    capacity: 1,
    minRank: 19, maxRank: 19, // 원수
    appointableBy: ['empire_emperor'],
    description: '제국군 3장관. 군 인사 총괄.',
    authorities: { personnel_high: true, personnel: true }
  },
  {
    id: 'empire_military_vice',
    name: '군무성차관',
    faction: 'empire',
    category: '軍務省',
    capacity: 1,
    minRank: 18, maxRank: 19, // 상급대장~원수
    appointableBy: ['empire_military_sec'],
    description: '군무상서 보좌. 차관급.',
    authorities: { personnel: true }
  },
  {
    id: 'empire_personnel_dir',
    name: '군무성인사국장',
    faction: 'empire',
    category: '軍務省',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_military_sec'],
    description: '대좌 이하 실무급 인사 관장.',
    authorities: { personnel: true }
  },
  {
    id: 'empire_intel_dir',
    name: '군무성조사국장',
    faction: 'empire',
    category: '軍務省',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_military_sec'],
    description: '통합정찰국 관장. 첩보 활동 총괄.',
    authorities: { intelligence: true }
  },
  {
    id: 'empire_military_counselor',
    name: '군무성참사관',
    faction: 'empire',
    category: '軍務省',
    capacity: 10,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_military_vice'],
    description: '군무상서 스탭. 연락장교.',
    authorities: {}
  },
  {
    id: 'empire_intel_officer',
    name: '첩보관',
    faction: 'empire',
    category: '統合偵察局', // 군무성 산하
    capacity: 50,
    minRank: 8, maxRank: 13, // 소위~대좌
    appointableBy: ['empire_intel_dir'],
    description: '적국 잠입 및 첩보 활동.',
    authorities: { intelligence: true }
  },

  // --- 통수본부 (Imperial High Command) ---
  {
    id: 'empire_ops_chief',
    name: '통수본부총장',
    faction: 'empire',
    category: '統帥本部',
    capacity: 1,
    minRank: 19, maxRank: 19, // 원수
    appointableBy: ['empire_emperor'],
    description: '제국군 3장관. 작전 계획 수립 총괄.',
    authorities: { military: true }
  },
  {
    id: 'empire_ops_vice',
    name: '통수본부차장',
    faction: 'empire',
    category: '統帥本部',
    capacity: 1,
    minRank: 18, maxRank: 19, // 상급대장~원수
    appointableBy: ['empire_military_sec'], // *군무상서 임명* (매뉴얼 1268행)
    description: '총장 보좌. 사무방의 장.',
    authorities: { military: true }
  },
  {
    id: 'empire_ops_sec1',
    name: '통수본부작전1과장',
    faction: 'empire',
    category: '統帥本部',
    capacity: 1,
    minRank: 17, maxRank: 19, // 대장~원수
    appointableBy: ['empire_ops_chief'],
    description: '함대 작전 계획 입안.',
    authorities: { military: true }
  },
  {
    id: 'empire_ops_sec2',
    name: '통수본부작전2과장',
    faction: 'empire',
    category: '統帥本部',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_ops_chief'],
    description: '수송/순찰/지상부대 작전 계획 입안.',
    authorities: { military: true }
  },
  {
    id: 'empire_ops_sec3',
    name: '통수본부작전3과장',
    faction: 'empire',
    category: '統帥本部',
    capacity: 1,
    minRank: 15, maxRank: 19, // 소장~원수
    appointableBy: ['empire_ops_chief'],
    description: '독행함(플레이어) 작전 계획 입안.',
    authorities: { military: true }
  },
  {
    id: 'empire_ops_inspector',
    name: '통수본부감찰관',
    faction: 'empire',
    category: '統帥本部',
    capacity: 10,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_ops_vice'],
    description: '통수본부 참모 및 연락장교.',
    authorities: {}
  },

  // --- 우주함대사령부 (Space Fleet Command) ---
  {
    id: 'empire_fleet_admiral',
    name: '우주함대사령장관',
    faction: 'empire',
    category: '宇宙艦隊',
    capacity: 1,
    minRank: 19, maxRank: 19, // 원수
    appointableBy: ['empire_emperor'],
    description: '제국군 3장관. 함대 운용 및 실전 지휘.',
    authorities: { fleet: true, military: true }
  },
  {
    id: 'empire_fleet_vice_admiral',
    name: '우주함대부사령장관',
    faction: 'empire',
    category: '宇宙艦隊',
    capacity: 1,
    minRank: 19, maxRank: 19, // 원수
    appointableBy: ['empire_fleet_admiral'],
    description: '사령장관 보좌.',
    authorities: { fleet: true }
  },
  {
    id: 'empire_fleet_chief_staff',
    name: '우주함대총참모장',
    faction: 'empire',
    category: '宇宙艦隊',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_fleet_admiral'],
    description: '사령부 스탭 통솔. 우주함대참모 임명권.',
    authorities: { personnel: true }
  },
  {
    id: 'empire_fleet_hq_staff',
    name: '우주함대참모',
    faction: 'empire',
    category: '宇宙艦隊',
    capacity: 10,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_fleet_chief_staff'],
    description: '사령부 참모.',
    authorities: {}
  },

  // --- 헌병본부 (Military Police) ---
  {
    id: 'empire_mp_chief',
    name: '헌병총감',
    faction: 'empire',
    category: '憲兵本部',
    capacity: 1,
    minRank: 18, maxRank: 19, // 상급대장~원수
    appointableBy: ['empire_military_sec'],
    description: '군 기강 유지 및 치안 총괄.',
    authorities: { intelligence: true }
  },
  {
    id: 'empire_mp_vice',
    name: '헌병부총감',
    faction: 'empire',
    category: '憲兵本部',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_mp_chief'],
    description: '헌병총감 보좌 및 현장 지휘.',
    authorities: { intelligence: true }
  },

  // --- 장갑척탄병총감부 (Panzer Grenadiers) ---
  {
    id: 'empire_grenadier_chief',
    name: '장갑척탄병총감',
    faction: 'empire',
    category: '装甲擲弾兵',
    capacity: 1,
    minRank: 18, maxRank: 19, // 상급대장~원수
    appointableBy: ['empire_military_sec'],
    description: '육전부대 총괄. 실전 실력자.',
    authorities: { military: true }
  },
  {
    id: 'empire_grenadier_vice',
    name: '장갑척탄병부총감',
    faction: 'empire',
    category: '装甲擲弾兵',
    capacity: 1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_grenadier_chief'],
    description: '총감 보좌.',
    authorities: { military: true }
  },

  // --- 과학기술총감부 ---
  {
    id: 'empire_tech_chief',
    name: '과학기술총감',
    faction: 'empire',
    category: '科学技術',
    capacity: 1,
    minRank: 18, maxRank: 19, // 상급대장~원수
    appointableBy: ['empire_military_sec'],
    description: '군사 기술 관장. 명예직.',
    authorities: {}
  },

  // --- 사관학교 ---
  {
    id: 'empire_academy_chief',
    name: '사관학교장',
    faction: 'empire',
    category: '士官学校',
    capacity: 1,
    minRank: 17, maxRank: 19, // 대장~원수
    appointableBy: ['empire_military_sec'],
    description: '사관학교 최고 책임자.',
    authorities: { personnel: true }
  },
  {
    id: 'empire_academy_instructor',
    name: '사관학교교관',
    faction: 'empire',
    category: '士官学校',
    capacity: 10,
    minRank: 6, maxRank: 19, // 상사~원수
    appointableBy: ['empire_academy_chief'], // 명시 없으나 교장 임명 추정
    description: '교육 담당.',
    authorities: {}
  },

  // --- 각 함대 (Fleet) ---
  {
    id: 'empire_fleet_commander',
    name: '함대사령관',
    faction: 'empire',
    category: '艦隊',
    capacity: -1, // 다수
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_military_sec'], // 군무상서 임명
    description: '개별 함대(최대 18000척) 지휘.',
    authorities: { fleet: true }
  },
  {
    id: 'empire_fleet_vice',
    name: '함대부사령관',
    faction: 'empire',
    category: '艦隊',
    capacity: -1,
    minRank: 15, maxRank: 19, // 소장~원수
    appointableBy: ['empire_military_sec'], // 군무상서 임명
    description: '함대 차석 지휘관. 분함대 지휘.',
    authorities: { fleet: true }
  },
  {
    id: 'empire_fleet_staff_chief',
    name: '함대참모장',
    faction: 'empire',
    category: '艦隊',
    capacity: -1,
    minRank: 15, maxRank: 19, // 소장~원수
    appointableBy: ['empire_chief_of_staff'], // *막료총감* 임명 (매뉴얼 1269행)
    description: '함대 사령관 보좌. 독자 보고 권한.',
    authorities: {}
  },
  {
    id: 'empire_fleet_staff',
    name: '함대참모',
    faction: 'empire',
    category: '艦隊',
    capacity: 6, // 함대당 6명
    minRank: 10, maxRank: 19, // 대위~원수
    appointableBy: ['empire_fleet_commander'],
    description: '함대 사령관 보좌.',
    authorities: {}
  },
  {
    id: 'empire_fleet_adjutant',
    name: '함대사령관부관',
    faction: 'empire',
    category: '艦隊',
    capacity: 1,
    minRank: 9, maxRank: 19, // 중위~원수
    appointableBy: ['empire_fleet_commander'],
    description: '사령관 개인 막료.',
    authorities: {}
  },

  // --- 수송함대 ---
  {
    id: 'empire_transport_cmd',
    name: '수송함대사령관',
    faction: 'empire',
    category: '輸送',
    capacity: -1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_military_vice'], // *군무성차관* 임명
    description: '보급/수송 임무 총괄.',
    authorities: { fleet: true }
  },
  {
    id: 'empire_transport_vice',
    name: '수송함대부사령관',
    faction: 'empire',
    category: '輸送',
    capacity: -1,
    minRank: 15, maxRank: 19, // 소장~원수
    appointableBy: ['empire_military_vice'],
    description: '수송함대 차석.',
    authorities: { fleet: true }
  },
  {
    id: 'empire_transport_adjutant',
    name: '수송함대사령관부관',
    faction: 'empire',
    category: '輸送',
    capacity: 1,
    minRank: 9, maxRank: 19, // 중위~원수
    appointableBy: ['empire_transport_cmd'],
    description: '사령관 부관.',
    authorities: {}
  },

  // --- 순찰대 ---
  {
    id: 'empire_patrol_cmd',
    name: '순찰대사령',
    faction: 'empire',
    category: '巡察',
    capacity: -1,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_military_vice'], // *군무성차관* 임명
    description: '치안 유지 및 소규모 작전.',
    authorities: { fleet: true }
  },
  {
    id: 'empire_patrol_vice',
    name: '순찰대부사령',
    faction: 'empire',
    category: '巡察',
    capacity: -1,
    minRank: 14, maxRank: 19, // 준장~원수
    appointableBy: ['empire_military_vice'],
    description: '순찰대 차석. 경비대 지휘.',
    authorities: { fleet: true }
  },
  {
    id: 'empire_patrol_adjutant',
    name: '순찰대사령부관',
    faction: 'empire',
    category: '巡察',
    capacity: 1,
    minRank: 9, maxRank: 19, // 중위~원수
    appointableBy: ['empire_patrol_cmd'],
    description: '사령 부관.',
    authorities: {}
  },

  // --- 지상부대 ---
  {
    id: 'empire_ground_cmd',
    name: '지상부대지휘관',
    faction: 'empire',
    category: '地上',
    capacity: -1,
    minRank: 11, maxRank: 19, // 소좌~원수
    appointableBy: ['empire_grenadier_chief'], // 장갑척탄병총감 임명
    description: '지상전 주력 부대 지휘.',
    authorities: { military: true }
  },

  // --- 요새 ---
  {
    id: 'empire_fortress_cmd',
    name: '요새사령관',
    faction: 'empire',
    category: '要塞',
    capacity: -1,
    minRank: 16, maxRank: 19, // 중장~원수
    appointableBy: ['empire_military_sec'],
    description: '요새 지휘 및 방어.',
    authorities: { military: true }
  },
  {
    id: 'empire_fortress_def_cmd',
    name: '요새수비대지휘관',
    faction: 'empire',
    category: '要塞',
    capacity: -1,
    minRank: 11, maxRank: 19, // 소좌~원수
    appointableBy: ['empire_fortress_cmd'],
    description: '요새 주둔 육전대 통솔.',
    authorities: { military: true }
  },
  {
    id: 'empire_fortress_admin',
    name: '요새사무총감',
    faction: 'empire',
    category: '要塞',
    capacity: -1,
    minRank: 15, maxRank: 19, // 소장~원수
    appointableBy: ['empire_fortress_cmd'],
    description: '요새 경제 활동 및 생산 통솔.',
    authorities: { admin: true, finance: true }
  },

  // --- 행성 및 지역 ---
  {
    id: 'empire_planet_governor',
    name: '행성총독',
    faction: 'empire',
    category: '行政',
    capacity: -1,
    minRank: 14, maxRank: 19, // 준장~원수 (문관 가능)
    appointableBy: ['empire_state_sec'], // *국무상서* 임명
    description: '행성 통치 및 방위.',
    authorities: { admin: true, finance: true, military: true }
  },
  {
    id: 'empire_planet_def_cmd',
    name: '행성수비대지휘관',
    faction: 'empire',
    category: '行政',
    capacity: -1,
    minRank: 11, maxRank: 19, // 소좌~원수
    appointableBy: ['empire_planet_governor'],
    description: '행성 수비대 지휘.',
    authorities: { military: true }
  },
  {
    id: 'empire_capital_def_cmd',
    name: '제도방위사령관',
    faction: 'empire',
    category: '首都',
    capacity: 1,
    minRank: 17, maxRank: 19, // 대장~원수
    appointableBy: ['empire_supreme_commander'],
    description: '제도(수도) 경찰/경제/생산 통솔. 군사지휘권 없음.',
    authorities: { admin: true, finance: true }
  },
  {
    id: 'empire_guard_chief',
    name: '근위병총감',
    faction: 'empire',
    category: '首都',
    capacity: 1,
    minRank: 18, maxRank: 19, // 상급대장~원수
    appointableBy: ['empire_military_sec'],
    description: '제도 수비 및 근위병 통솔.',
    authorities: { military: true }
  },


  // ==========================================================================
  // [자유행성동맹] Free Planets Alliance
  // ==========================================================================

  // --- 최고평의회 (High Council) ---
  {
    id: 'alliance_council_chair',
    name: '최고평의회의장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18, // 선출직 (문관)
    appointableBy: [], // 선거
    description: '국가 원수. 국정 운영.',
    authorities: { personnel_high: true, admin: true, finance: true }
  },
  {
    id: 'alliance_council_vice',
    name: '부의장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '의장 부재 시 대행.',
    authorities: {}
  },
  {
    id: 'alliance_state_chair',
    name: '국무위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '내정 전반 및 지사 임명권.',
    authorities: { personnel: true, admin: true }
  },
  {
    id: 'alliance_defense_chair',
    name: '국방위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18, // 문관
    appointableBy: ['alliance_council_chair'],
    description: '국방 총괄. 군 통수권자. 군 수뇌부 임명권.',
    authorities: { personnel_high: true, military: true }
  },
  {
    id: 'alliance_finance_chair',
    name: '재정위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '재정 총괄. 과세율 변경.',
    authorities: { finance: true }
  },
  {
    id: 'alliance_law_chair',
    name: '법질서위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '최고 사법 기관. 정치인 체포/처단.',
    authorities: { intelligence: true }
  },
  {
    id: 'alliance_resource_chair',
    name: '천연자원위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '천연 자원 채굴 관장.',
    authorities: { admin: true }
  },
  {
    id: 'alliance_human_chair',
    name: '인적자원위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '인적 자원 동원 체제 관장.',
    authorities: { personnel: true }
  },
  {
    id: 'alliance_economy_chair',
    name: '경제개발위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '국내 경제 관장.',
    authorities: { admin: true }
  },
  {
    id: 'alliance_community_chair',
    name: '지역사회개발위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '지방 경제 관장.',
    authorities: { admin: true }
  },
  {
    id: 'alliance_info_chair',
    name: '정보교통위원장',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '정보 및 성계 간 교통 관장.',
    authorities: { admin: true }
  },
  {
    id: 'alliance_council_sec',
    name: '서기',
    faction: 'alliance',
    category: '評議会',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_council_chair'],
    description: '의장 보좌.',
    authorities: { admin: true }
  },

  // --- 대 페잔 ---
  {
    id: 'alliance_fezzan_comm',
    name: '페잔주재변무관',
    faction: 'alliance',
    category: '駐フェザーン',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_state_chair'], // 국무위원장 임명
    description: '페잔 외교 및 첩보.',
    authorities: { diplomacy: true, intelligence: true }
  },
  {
    id: 'alliance_fezzan_assist',
    name: '페잔주재보좌관',
    faction: 'alliance',
    category: '駐フェザーン',
    capacity: 1,
    minRank: 0, maxRank: 18,
    appointableBy: ['alliance_fezzan_comm'], // 변무관 임명 추정 (매뉴얼엔 명시 X, 문맥상)
    description: '변무관 보좌.',
    authorities: { intelligence: true }
  },
  {
    id: 'alliance_fezzan_attache',
    name: '페잔주재무관',
    faction: 'alliance',
    category: '駐フェザーン',
    capacity: 1,
    minRank: 8, maxRank: 18, // 소위~원수
    appointableBy: ['alliance_defense_chair'], // 국방위원장 임명
    description: '군사 정보 수집.',
    authorities: { intelligence: true }
  },

  // --- 통합작전본부 ---
  {
    id: 'alliance_joint_chief',
    name: '통합작전본부장',
    faction: 'alliance',
    category: '統合本部',
    capacity: 1,
    minRank: 18, maxRank: 18, // 원수
    appointableBy: ['alliance_defense_chair'],
    description: '군령권 총괄. 제복군인 최고위. 작전 계획 입안.',
    authorities: { military: true }
  },
  {
    id: 'alliance_joint_vice1',
    name: '통합작전본부제1차장',
    faction: 'alliance',
    category: '統合本部',
    capacity: 1,
    minRank: 17, maxRank: 18, // 대장~원수
    appointableBy: ['alliance_joint_chief'],
    description: '수송/순찰 작전 계획 입안.',
    authorities: { military: true }
  },
  {
    id: 'alliance_joint_vice2',
    name: '통합작전본부제2차장',
    faction: 'alliance',
    category: '統合本部',
    capacity: 1,
    minRank: 17, maxRank: 18, // 대장~원수
    appointableBy: ['alliance_joint_chief'],
    description: '독행함 작전 계획 입안.',
    authorities: { military: true }
  },
  {
    id: 'alliance_joint_vice3',
    name: '통합작전본부제3차장',
    faction: 'alliance',
    category: '統合本部',
    capacity: 1,
    minRank: 17, maxRank: 18, // 대장~원수
    appointableBy: ['alliance_joint_chief'],
    description: '전군 보충 계획 조정.',
    authorities: { military: true }
  },
  {
    id: 'alliance_joint_counselor',
    name: '통합작전본부참사관',
    faction: 'alliance',
    category: '統合本部',
    capacity: 10,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_joint_chief'],
    description: '본부장 보좌 및 연락장교.',
    authorities: {}
  },
  {
    id: 'alliance_land_chief',
    name: '육전총감부장',
    faction: 'alliance',
    category: '統合本部',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_joint_chief'],
    description: '육전대 인사 및 작전 관장.',
    authorities: { military: true, personnel: true }
  },

  // --- 우주함대사령부 ---
  {
    id: 'alliance_fleet_admiral',
    name: '우주함대사령장관',
    faction: 'alliance',
    category: '宇宙艦隊',
    capacity: 1,
    minRank: 18, maxRank: 18, // 원수
    appointableBy: ['alliance_defense_chair'],
    description: '함대 운용 총괄. *함대사령관 임명권* 보유 (제국과 다름).',
    authorities: { fleet: true, military: true, personnel: true }
  },
  {
    id: 'alliance_fleet_vice_admiral',
    name: '우주함대부사령장관',
    faction: 'alliance',
    category: '宇宙艦隊',
    capacity: 1,
    minRank: 17, maxRank: 18, // 대장~원수
    appointableBy: ['alliance_fleet_admiral'],
    description: '사령장관 보좌. 차석 지휘관.',
    authorities: { fleet: true }
  },
  {
    id: 'alliance_fleet_chief_staff',
    name: '우주함대총참모장',
    faction: 'alliance',
    category: '宇宙艦隊',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_fleet_admiral'],
    description: '참모진 통솔. 독행함 운용.',
    authorities: { personnel: true }
  },
  {
    id: 'alliance_fleet_hq_staff',
    name: '우주함대참모',
    faction: 'alliance',
    category: '宇宙艦隊',
    capacity: 1, // 매뉴얼상 1명? 보통 10명인데 표엔 1명. 10명으로 추정.
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_fleet_chief_staff'],
    description: '사령부 참모.',
    authorities: {}
  },

  // --- 후방근무본부 ---
  {
    id: 'alliance_logistics_chief',
    name: '후방근무본부장',
    faction: 'alliance',
    category: '後方',
    capacity: 1,
    minRank: 17, maxRank: 18, // 대장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '보급 및 치안 총괄.',
    authorities: { finance: true, intelligence: true }
  },
  {
    id: 'alliance_logistics_vice',
    name: '후방근무본부차장',
    faction: 'alliance',
    category: '後方',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_logistics_chief'], // 명시 없으나 본부장 임명 추정
    description: '본부장 보좌.',
    authorities: {}
  },
  {
    id: 'alliance_logistics_counselor',
    name: '후방근무본부참사관',
    faction: 'alliance',
    category: '後方',
    capacity: 10,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_logistics_chief'],
    description: '본부장 보좌.',
    authorities: {}
  },

  // --- 국방위원회 산하 국장 ---
  {
    id: 'alliance_tech_chief',
    name: '과학기술본부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '군사 기술 관장. 명예직.',
    authorities: {}
  },
  {
    id: 'alliance_mp_cmd',
    name: '헌병사령관',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_logistics_chief'], // *후방근무본부장* 임명 (매뉴얼 1402행)
    description: '군 헌병 지휘.',
    authorities: { intelligence: true }
  },
  {
    id: 'alliance_inspection_dir',
    name: '사열부장', // Inspection
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '군 내부 보안 수사.',
    authorities: { intelligence: true }
  },
  {
    id: 'alliance_strategy_dir',
    name: '전략부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '국방 정책 입안. 명예직.',
    authorities: {}
  },
  {
    id: 'alliance_personnel_dir',
    name: '인사부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '중좌 이하 군인 서훈 관장.',
    authorities: { personnel: true }
  },
  {
    id: 'alliance_defense_dir',
    name: '방위부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '동맹 영토 내 수비대 관할.',
    authorities: { military: true }
  },
  {
    id: 'alliance_info_dir',
    name: '정보부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 15, maxRank: 18, // 소장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '전략작전국 관할. 첩보 활동.',
    authorities: { intelligence: true }
  },
  {
    id: 'alliance_comm_dir',
    name: '통신부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 15, maxRank: 18, // 소장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '군 통신 인프라 관리. 명예직.',
    authorities: {}
  },
  {
    id: 'alliance_equip_dir',
    name: '장비부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 15, maxRank: 18, // 소장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '함대/부대 편성 권한.',
    authorities: { military: true }
  },
  {
    id: 'alliance_facility_dir',
    name: '시설부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 15, maxRank: 18, // 소장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '군 시설 인프라 관리. 명예직.',
    authorities: {}
  },
  {
    id: 'alliance_account_dir',
    name: '경리부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 15, maxRank: 18, // 소장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '군 재무 관리. 명예직.',
    authorities: {}
  },
  {
    id: 'alliance_education_dir',
    name: '교육부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 15, maxRank: 18, // 소장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '사관학교 관장.',
    authorities: { personnel: true }
  },
  {
    id: 'alliance_medical_dir',
    name: '위생부장',
    faction: 'alliance',
    category: '国防委',
    capacity: 1,
    minRank: 15, maxRank: 18, // 소장~원수
    appointableBy: ['alliance_defense_chair'],
    description: '야전/군 병원 관리. 명예직.',
    authorities: {}
  },

  // --- 사관학교 ---
  {
    id: 'alliance_academy_chief',
    name: '사관학교장',
    faction: 'alliance',
    category: '士官学校',
    capacity: 1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_education_dir'], // 교육부장 임명
    description: '사관학교 책임자.',
    authorities: { personnel: true }
  },
  {
    id: 'alliance_academy_instructor',
    name: '사관학교교관',
    faction: 'alliance',
    category: '士官学校',
    capacity: 10,
    minRank: 6, maxRank: 18, // 상사~원수
    appointableBy: ['alliance_academy_chief'],
    description: '교육 담당.',
    authorities: {}
  },

  // --- 각 함대 (Fleet) ---
  {
    id: 'alliance_fleet_commander',
    name: '함대사령관',
    faction: 'alliance',
    category: '艦隊',
    capacity: -1,
    minRank: 15, maxRank: 18, // 소장~원수 (제국보다 1계급 낮음)
    appointableBy: ['alliance_fleet_admiral'], // *우주함대사령장관* 임명
    description: '개별 함대 지휘.',
    authorities: { fleet: true }
  },
  {
    id: 'alliance_fleet_vice',
    name: '함대부사령관',
    faction: 'alliance',
    category: '艦隊',
    capacity: -1,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_fleet_admiral'],
    description: '함대 차석. 분함대 지휘.',
    authorities: { fleet: true }
  },
  {
    id: 'alliance_fleet_staff_chief',
    name: '함대참모장',
    faction: 'alliance',
    category: '艦隊',
    capacity: -1,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_fleet_chief_staff'], // *우주함대총참모장* 임명
    description: '함대 사령관 보좌.',
    authorities: {}
  },
  {
    id: 'alliance_fleet_staff',
    name: '함대참모',
    faction: 'alliance',
    category: '艦隊',
    capacity: 6,
    minRank: 10, maxRank: 18, // 대위~원수
    appointableBy: ['alliance_fleet_chief_staff'], // 총참모장 임명
    description: '함대 사령관 보좌.',
    authorities: {}
  },
  {
    id: 'alliance_fleet_adjutant',
    name: '함대사령관부관',
    faction: 'alliance',
    category: '艦隊',
    capacity: 1,
    minRank: 9, maxRank: 18, // 중위~원수
    appointableBy: ['alliance_fleet_commander'],
    description: '사령관 부관.',
    authorities: {}
  },

  // --- 수송함대 ---
  {
    id: 'alliance_transport_cmd',
    name: '수송함대사령관',
    faction: 'alliance',
    category: '輸送',
    capacity: -1,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_fleet_admiral'], // 사령장관 임명
    description: '보급/수송 총괄.',
    authorities: { fleet: true }
  },
  {
    id: 'alliance_transport_vice',
    name: '수송함대부사령관',
    faction: 'alliance',
    category: '輸送',
    capacity: -1,
    minRank: 13, maxRank: 18, // 대좌~원수
    appointableBy: ['alliance_fleet_admiral'],
    description: '수송함대 차석.',
    authorities: { fleet: true }
  },
  {
    id: 'alliance_transport_adjutant',
    name: '수송함대사령관부관',
    faction: 'alliance',
    category: '輸送',
    capacity: 1,
    minRank: 9, maxRank: 18, // 중위~원수
    appointableBy: ['alliance_transport_cmd'],
    description: '사령관 부관.',
    authorities: {}
  },

  // --- 순찰대 ---
  {
    id: 'alliance_patrol_cmd',
    name: '순찰대사령',
    faction: 'alliance',
    category: '巡察',
    capacity: -1,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_fleet_admiral'],
    description: '치안 유지 및 작전.',
    authorities: { fleet: true }
  },
  {
    id: 'alliance_patrol_vice',
    name: '순찰대부사령',
    faction: 'alliance',
    category: '巡察',
    capacity: -1,
    minRank: 14, maxRank: 18, // 준장~원수
    appointableBy: ['alliance_fleet_admiral'],
    description: '순찰대 차석.',
    authorities: { fleet: true }
  },
  {
    id: 'alliance_patrol_adjutant',
    name: '순찰대사령부관',
    faction: 'alliance',
    category: '巡察',
    capacity: 1,
    minRank: 9, maxRank: 18,
    appointableBy: ['alliance_patrol_cmd'],
    description: '사령 부관.',
    authorities: {}
  },

  // --- 지상부대 ---
  {
    id: 'alliance_ground_cmd',
    name: '지상부대지휘관',
    faction: 'alliance',
    category: '地上',
    capacity: -1,
    minRank: 11, maxRank: 18, // 소좌~원수
    appointableBy: ['alliance_land_chief'], // 육전총감부장 임명
    description: '지상전 부대 지휘.',
    authorities: { military: true }
  },

  // --- 요새 ---
  {
    id: 'alliance_fortress_cmd',
    name: '요새사령관',
    faction: 'alliance',
    category: '要塞',
    capacity: -1,
    minRank: 16, maxRank: 18, // 중장~원수
    appointableBy: ['alliance_facility_dir'], // 시설부장 임명
    description: '요새 지휘.',
    authorities: { military: true }
  },
  {
    id: 'alliance_fortress_def_cmd',
    name: '요새수비대지휘관',
    faction: 'alliance',
    category: '要塞',
    capacity: -1,
    minRank: 11, maxRank: 18, // 소좌~원수
    appointableBy: ['alliance_fortress_cmd'],
    description: '요새 육전대 통솔.',
    authorities: { military: true }
  },
  {
    id: 'alliance_fortress_admin',
    name: '요새사무총감',
    faction: 'alliance',
    category: '要塞',
    capacity: -1,
    minRank: 13, maxRank: 18, // 대좌~원수
    appointableBy: ['alliance_fortress_cmd'],
    description: '요새 경제/생산.',
    authorities: { admin: true, finance: true }
  },

  // --- 행성 및 지역 ---
  {
    id: 'alliance_planet_governor',
    name: '지사', // Governor
    faction: 'alliance',
    category: '行政',
    capacity: -1,
    minRank: 0, maxRank: 18, // 문관 (현역군인 불가 4256행)
    appointableBy: ['alliance_state_chair'], // *국무위원장* 임명
    description: '행성 행정 및 치안. 현역 군인 불가.',
    authorities: { admin: true, finance: true }
  },
  {
    id: 'alliance_planet_def_cmd',
    name: '행성수비대지휘관',
    faction: 'alliance',
    category: '行政',
    capacity: -1,
    minRank: 13, maxRank: 18, // 대좌~원수
    appointableBy: ['alliance_defense_dir'], // 방위부장 임명
    description: '행성 수비대 지휘.',
    authorities: { military: true }
  },
  {
    id: 'alliance_capital_admin',
    name: '수도사정관',
    faction: 'alliance',
    category: '首都',
    capacity: 1,
    minRank: 0, maxRank: 18, // 문관
    appointableBy: ['alliance_state_chair'],
    description: '수도 행정.',
    authorities: { admin: true, finance: true }
  },
  {
    id: 'alliance_capital_def_cmd',
    name: '수도방위지휘관',
    faction: 'alliance',
    category: '首都',
    capacity: 1,
    minRank: 13, maxRank: 18, // 대좌~원수
    appointableBy: ['alliance_defense_dir'], // 방위부장 임명
    description: '수도 수비대 지휘.',
    authorities: { military: true }
  },

  // --- 전략작전국 (첩보) ---
  {
    id: 'alliance_intel_officer',
    name: '첩보관',
    faction: 'alliance',
    category: '戦略作戦局',
    capacity: 50,
    minRank: 8, maxRank: 13, // 소위~대좌
    appointableBy: ['alliance_info_dir'], // 정보부장 임명
    description: '적국 잠입 및 첩보.',
    authorities: { intelligence: true }
  },
];
