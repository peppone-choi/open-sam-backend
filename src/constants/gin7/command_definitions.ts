/**
 * GIN7 전략 커맨드(Command) 정의 데이터베이스
 * 매뉴얼 4713행 ~ 5575행 (별표 전략 커맨드 일람표) 100% 반영
 */

export type CommandType = 'PCP' | 'MCP'; // Political CP / Military CP
export type CommandCategory = 
  | 'OPERATION' // 작전 (Operation)
  | 'TRAINING'  // 훈련 (Training)
  | 'SECURITY'  // 치안/경비 (Security)
  | 'TACTICAL'  // 전술진입 (Tactical Entry)
  | 'PERSONAL'  // 개인 (Personal)
  | 'COMMAND'   // 지휘 (Command)
  | 'LOGISTICS' // 병참 (Logistics)
  | 'PERSONNEL' // 인사 (Personnel)
  | 'POLITICS'  // 정치 (Politics)
  | 'INTELLIGENCE'; // 첩보 (Intelligence)

export interface ICommandDefinition {
  id: string;           // 커맨드 ID
  name: string;         // 커맨드명
  category: CommandCategory;
  
  cost: number;         // CP 소모량
  costType: CommandType; // CP 타입 (PCP/MCP)
  
  wait: number;         // 실행 대기 시간 (게임 시간 단위: 시간)
                        // 매뉴얼 '8' = 8시간 (게임시간) = 20분 (실제시간)
                        // 매뉴얼 333행: 실시간 1분 = 게임 24분
                        // 따라서 게임 1시간 = 실시간 2.5분
  
  duration: number;     // 실행 소요 시간 (게임 시간 단위: 시간)
  
  description: string;  // 설명
  
  // 실행 조건 (옵션)
  requiresPosition?: boolean; // 직책 필요 여부 (기본 true, 개인 커맨드는 false)
  requiresLocation?: string;  // 특정 장소 필요 ('academy', 'base', 'capital' 등)
}

// 매뉴얼 데이터 기반 (4713행~)
export const COMMAND_DEFINITIONS: ICommandDefinition[] = [
  // ==========================================================================
  // 1. 작전 커맨드 (Operation) - MCP
  // ==========================================================================
  {
    id: 'WARP',
    name: '와프항행', // Warp Navigation
    category: 'OPERATION',
    cost: 40, costType: 'MCP',
    wait: 0, duration: 0, // 거리 비례 (로직에서 처리)
    description: '임의의 그리드로 이동. 연료 소모.',
  },
  {
    id: 'REFUEL',
    name: '연료보급', // Refuel
    category: 'OPERATION',
    cost: 160, costType: 'MCP',
    wait: 8, duration: 48, // 48~960 가변
    description: '와프 연료 보급.',
  },
  {
    id: 'MOVE_SYSTEM',
    name: '성계내항행', // Intra-system Navigation
    category: 'OPERATION',
    cost: 160, costType: 'MCP',
    wait: 8, duration: 0,
    description: '성계 그리드 내 행성 간 이동.',
  },

  // ==========================================================================
  // 2. 훈련 커맨드 (Training) - MCP
  // ==========================================================================
  {
    id: 'MAINTAIN_DISCIPLINE',
    name: '군기유지', // Maintain Discipline
    category: 'TRAINING',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '군기 유지도 증가. 혼란 발생률 저하.',
  },
  {
    id: 'TRAIN_FLEET',
    name: '항주훈련', // Navigation Training
    category: 'TRAINING',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '부대 훈련도 증가.',
  },
  {
    id: 'TRAIN_GROUND',
    name: '육전훈련', // Ground Combat Training
    category: 'TRAINING',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '육전 훈련도 증가.',
  },
  {
    id: 'TRAIN_AIR',
    name: '공전훈련', // Air Combat Training
    category: 'TRAINING',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '공전(함재기) 훈련도 증가.',
  },
  {
    id: 'TACTICS_GROUND',
    name: '육전전술훈련', // Ground Tactics Training
    category: 'TRAINING',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '육전 관련 전술 스킬 습득.',
  },
  {
    id: 'TACTICS_AIR',
    name: '공전전술훈련', // Air Tactics Training
    category: 'TRAINING',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '공전 관련 전술 스킬 습득.',
  },

  // ==========================================================================
  // 3. 치안/경비 (Security) - MCP
  // ==========================================================================
  {
    id: 'SECURITY_PATROL',
    name: '경계출동', // Security Patrol
    category: 'SECURITY',
    cost: 160, costType: 'MCP',
    wait: 24, duration: 0,
    description: '행성 치안 유지율 증가.',
  },
  {
    id: 'SUPPRESS_RIOT',
    name: '무력진압', // Armed Suppression
    category: 'SECURITY',
    cost: 160, costType: 'MCP',
    wait: 24, duration: 0,
    description: '치안 유지율 대폭 증가. 지지율 하락 가능성.',
  },
  {
    id: 'PARADE',
    name: '분열행진', // Parade
    category: 'SECURITY',
    cost: 160, costType: 'MCP',
    wait: 24, duration: 0,
    description: '행성 정부 지지율 증가.',
  },
  {
    id: 'REQUISITION',
    name: '징발', // Requisition
    category: 'SECURITY',
    cost: 160, costType: 'MCP',
    wait: 24, duration: 0,
    description: '점령지에서 군수 물자 징발.',
  },
  {
    id: 'SPECIAL_GUARD',
    name: '특별경비', // Special Guard
    category: 'SECURITY',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 24,
    description: '특정 경계 스팟의 경비 태세 강화.',
  },

  // ==========================================================================
  // 4. 전술 진입 (Tactical Entry) - MCP
  // ==========================================================================
  {
    id: 'LAND_TROOPS',
    name: '육전대출격', // Launch Ground Troops
    category: 'TACTICAL',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '행성/요새 전투를 위해 육전대 주둔.',
  },
  {
    id: 'RECOVER_TROOPS',
    name: '육전대철수', // Recover Ground Troops
    category: 'TACTICAL',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '출격한 육전대 회수.',
  },

  // ==========================================================================
  // 5. 개인 커맨드 (Personal) - PCP
  // ==========================================================================
  {
    id: 'MOVE_LONG',
    name: '원거리이동', // Long-distance Move
    category: 'PERSONAL',
    cost: 10, costType: 'PCP',
    wait: 0, duration: 0,
    description: '행성 내 시설 간 이동.',
  },
  {
    id: 'MOVE_SHORT',
    name: '근거리이동', // Short-distance Move
    category: 'PERSONAL',
    cost: 5, costType: 'PCP',
    wait: 0, duration: 0,
    description: '시설 내 스팟(방) 이동.',
  },
  {
    id: 'RETIRE',
    name: '퇴역', // Retire
    category: 'PERSONAL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '군인을 그만두고 정치인이 됨. 30일간 재임관 불가.',
  },
  {
    id: 'VOLUNTEER',
    name: '지원', // Volunteer (Re-enlist)
    category: 'PERSONAL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '정치인 은퇴 후 군인 복귀. 소좌/전함으로 시작.',
  },
  {
    id: 'DEFECTION',
    name: '망명', // Defection
    category: 'PERSONAL',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '타 세력으로 망명. 수도에 구금됨.',
  },
  {
    id: 'MEET',
    name: '회견', // Interview/Meeting
    category: 'PERSONAL',
    cost: 10, costType: 'PCP',
    wait: 0, duration: 0,
    description: '동일 스팟 인물과 회견. 우호도 증가.',
  },
  {
    id: 'ATTEND_LECTURE',
    name: '수강', // Attend Lecture
    category: 'PERSONAL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    requiresLocation: 'academy',
    description: '능력치 증가. 사관학교 전용.',
  },
  {
    id: 'WAR_GAME',
    name: '병기연습', // War Game
    category: 'PERSONAL',
    cost: 10, costType: 'PCP',
    wait: 0, duration: 0,
    requiresLocation: 'academy',
    description: '시뮬레이터 전술 훈련.',
  },
  {
    id: 'PLOT_REBELLION',
    name: '반의', // Plot Rebellion
    category: 'PERSONAL',
    cost: 640, costType: 'PCP',
    wait: 0, duration: 0,
    description: '쿠데타 수모자가 됨.',
  },
  {
    id: 'CONSPIRE',
    name: '모의', // Conspire
    category: 'PERSONAL',
    cost: 640, costType: 'PCP',
    wait: 0, duration: 0,
    description: '동일 스팟 인물에게 쿠데타 참가 교섭.',
  },
  {
    id: 'PERSUADE_TROOPS',
    name: '설득', // Persuade Troops
    category: 'PERSONAL',
    cost: 640, costType: 'PCP',
    wait: 0, duration: 0,
    description: '소속 부대 유닛의 반란 충성도 상승.',
  },
  {
    id: 'REBEL',
    name: '반란', // Rebel
    category: 'PERSONAL',
    cost: 640, costType: 'PCP',
    wait: 0, duration: 0,
    description: '쿠데타 실행.',
  },
  {
    id: 'JOIN_REBELLION',
    name: '참가', // Join Rebellion
    category: 'PERSONAL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '쿠데타 참가.',
  },
  {
    id: 'INVEST_FUNDS',
    name: '자금투입', // Invest Funds
    category: 'PERSONAL',
    cost: 80, costType: 'PCP',
    wait: 0, duration: 0,
    description: '사재 투입 (지역 지원, 신임/지지 박스).',
  },
  {
    id: 'BUY_FLAGSHIP',
    name: '기함구입', // Buy Flagship
    category: 'PERSONAL',
    cost: 80, costType: 'PCP',
    wait: 0, duration: 0,
    description: '평가 포인트를 소비하여 새 기함 구입.',
  },

  // ==========================================================================
  // 6. 지휘 커맨드 (Command) - MCP (일부 PCP)
  // ==========================================================================
  {
    id: 'PLAN_OP',
    name: '작전계획', // Plan Operation
    category: 'COMMAND',
    cost: 320, costType: 'MCP', // 10~1280 가변
    wait: 0, duration: 0,
    description: '전략 목표(점령/방어/소탕) 수립.',
  },
  {
    id: 'CANCEL_OP',
    name: '작전철회', // Cancel Operation
    category: 'COMMAND',
    cost: 80, costType: 'MCP', // 5~320 가변
    wait: 0, duration: 0,
    description: '계획된 작전 중지.',
  },
  {
    id: 'ORDER_OP',
    name: '발령', // Order Operation
    category: 'COMMAND',
    cost: 80, costType: 'MCP', // 1~320 가변
    wait: 0, duration: 0,
    description: '작전 실행 부대 할당.',
  },
  {
    id: 'FORM_UNIT',
    name: '부대결성', // Form Unit
    category: 'COMMAND',
    cost: 320, costType: 'MCP',
    wait: 0, duration: 0,
    description: '새로운 부대(Fleet) 편성.',
  },
  {
    id: 'DISBAND_UNIT',
    name: '부대해산', // Disband Unit
    category: 'COMMAND',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '부대 해체 (주둔 중인 부대만 가능).',
  },
  {
    id: 'GIVE_LECTURE',
    name: '강의', // Give Lecture
    category: 'COMMAND',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    requiresLocation: 'academy',
    description: '수강자 능력치 상승. 사관학교 교관 전용.',
  },
  {
    id: 'PLAN_TRANSPORT',
    name: '수송계획', // Transport Plan
    category: 'COMMAND',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '수송 패키지 작성.',
  },
  {
    id: 'CANCEL_TRANSPORT',
    name: '수송중지', // Cancel Transport
    category: 'COMMAND',
    cost: 80, costType: 'MCP',
    wait: 0, duration: 0,
    description: '수송 계획 중지.',
  },

  // ==========================================================================
  // 7. 병참 커맨드 (Logistics) - MCP
  // ==========================================================================
  {
    id: 'FULL_REPAIR',
    name: '완전수리', // Full Repair
    category: 'LOGISTICS',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '부대 보유 물자를 소모하여 전체 수리.',
  },
  {
    id: 'FULL_SUPPLY',
    name: '완전보급', // Full Supply
    category: 'LOGISTICS',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '임의의 부대에 군수 물자 보급.',
  },
  {
    id: 'REORGANIZE',
    name: '재편성', // Reorganize
    category: 'LOGISTICS',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '부대 내 유닛 편성 변경 (창고와 교환).',
  },
  {
    id: 'RESUPPLY',
    name: '보충', // Resupply
    category: 'LOGISTICS',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '소모된 함선/인원 보충. (동일 함종 필요)',
  },
  {
    id: 'TRANSFER_CARGO',
    name: '반출입', // Transfer Cargo (Load/Unload)
    category: 'LOGISTICS',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '수송 패키지 반출입.',
  },
  {
    id: 'ALLOCATE',
    name: '할당', // Allocate
    category: 'LOGISTICS',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '행성 창고 물자를 부대 창고로 할당.',
  },

  // ==========================================================================
  // 8. 인사 커맨드 (Personnel) - PCP
  // ==========================================================================
  {
    id: 'PROMOTE',
    name: '승진', // Promote
    category: 'PERSONNEL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '계급 래더 최상위자 승진.',
  },
  {
    id: 'PROMOTE_SPECIAL',
    name: '발탁', // Special Promotion
    category: 'PERSONNEL',
    cost: 640, costType: 'PCP',
    wait: 0, duration: 0,
    description: '래더 1위 외 인물 특별 승진.',
  },
  {
    id: 'DEMOTE',
    name: '강등', // Demote
    category: 'PERSONNEL',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '임의의 인물 1계급 강등.',
  },
  {
    id: 'CONFER_PEERAGE',
    name: '서작', // Confer Peerage
    category: 'PERSONNEL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '귀족 작위 수여 (제국).',
  },
  {
    id: 'CONFER_HONOR',
    name: '서훈', // Confer Honor
    category: 'PERSONNEL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '훈장 수여.',
  },
  {
    id: 'APPOINT',
    name: '임명', // Appoint
    category: 'PERSONNEL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '특정 인물에게 직무 권한 부여.',
  },
  {
    id: 'DISMISS',
    name: '파면', // Dismiss
    category: 'PERSONNEL',
    cost: 160, costType: 'PCP',
    wait: 0, duration: 0,
    description: '특정 인물 직무 해임.',
  },
  {
    id: 'RESIGN',
    name: '사임', // Resign
    category: 'PERSONNEL',
    cost: 80, costType: 'PCP',
    wait: 0, duration: 0,
    description: '스스로 직무 포기.',
  },
  {
    id: 'GRANT_FIEF',
    name: '봉토수여', // Grant Fief
    category: 'PERSONNEL',
    cost: 640, costType: 'PCP',
    wait: 0, duration: 0,
    description: '남작 이상 귀족에게 영지(행성) 수여.',
  },
  {
    id: 'REVOKE_FIEF',
    name: '봉토직할', // Revoke Fief
    category: 'PERSONNEL',
    cost: 640, costType: 'PCP',
    wait: 0, duration: 0,
    description: '영지 몰수 및 직할령 편입.',
  },

  // ==========================================================================
  // 9. 정치 커맨드 (Politics) - PCP
  // ==========================================================================
  {
    id: 'PARTY',
    name: '야회', // Evening Party
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '수도 저택에서 파티 개최. 영향력 변화.',
  },
  {
    id: 'HUNTING',
    name: '수렵', // Hunting
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '봉토(영지)에서 사냥 개최. 우호도/영향력 변화.',
  },
  {
    id: 'MEETING',
    name: '회담', // Meeting
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '호텔 객실에서 회담. 영향력 변화.',
  },
  {
    id: 'TALK',
    name: '담화', // Talk
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '호텔 객실에서 담화. 우호도/영향력 변화.',
  },
  {
    id: 'SPEECH',
    name: '연설', // Speech
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '광장 연설. 영향력 및 지지율 변화.',
  },
  {
    id: 'SET_GOAL',
    name: '국가목표', // National Goal
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '국가 전략 목표 수립.',
  },
  {
    id: 'TAX_RATE',
    name: '납입률변경', // Change Tax Rate
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '행성별 징세율 변경.',
  },
  {
    id: 'TARIFF_RATE',
    name: '관세율변경', // Change Tariff Rate
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '무역 관세율 변경.',
  },
  {
    id: 'BUDGET',
    name: '분배', // Distribute Budget
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '국가 예산으로 특정 행성/부서 지원.',
  },
  {
    id: 'JUDGMENT',
    name: '처단', // Judgment/Execution
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '구금된 인물 처분 결정.',
  },
  {
    id: 'DIPLOMACY',
    name: '외교', // Diplomacy
    category: 'POLITICS',
    cost: 320, costType: 'PCP',
    wait: 0, duration: 0,
    description: '페잔 자치령에 대한 외교 교섭.',
  },
  {
    id: 'GOV_GOAL',
    name: '통치목표', // Governance Goal
    category: 'POLITICS',
    cost: 80, costType: 'PCP',
    wait: 0, duration: 0,
    description: '특정 행성에 통치 목표 제시.',
  },

  // ==========================================================================
  // 10. 첩보 커맨드 (Intelligence) - MCP (일부 PCP)
  // ==========================================================================
  {
    id: 'SEARCH',
    name: '일제수색', // Mass Search
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '행성 내 특정 인물(스파이) 수색.',
  },
  {
    id: 'ARREST_PERMIT',
    name: '체포허가', // Arrest Permit
    category: 'INTELLIGENCE',
    cost: 800, costType: 'MCP',
    wait: 0, duration: 0,
    description: '특정 인물을 체포 리스트에 등록.',
  },
  {
    id: 'EXEC_ORDER',
    name: '집행명령', // Execution Order
    category: 'INTELLIGENCE',
    cost: 800, costType: 'MCP',
    wait: 0, duration: 0,
    description: '특정 인물에게 체포 권한 위임.',
  },
  {
    id: 'ARREST_ORDER',
    name: '체포명령', // Arrest Order
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '동일 스팟/부대 인물 체포 시도.',
  },
  {
    id: 'INSPECT',
    name: '사열', // Inspect
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '쿠데타 징후 감지.',
  },
  {
    id: 'RAID',
    name: '습격', // Raid
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '동일 스팟 타 세력 인물 습격.',
  },
  {
    id: 'SURVEILLANCE',
    name: '감시', // Surveillance
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '특정 인물 감시.',
  },
  {
    id: 'INFILTRATE',
    name: '잠입공작', // Infiltrate Operation
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '특정 시설/스팟 잠입.',
  },
  {
    id: 'ESCAPE',
    name: '탈출공작', // Escape Operation
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '잠입 스팟 탈출.',
  },
  {
    id: 'GATHER_INFO',
    name: '정보공작', // Intelligence Operation
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '시설 정보 획득 및 본국 송신.',
  },
  {
    id: 'SABOTAGE',
    name: '파괴공작', // Sabotage Operation
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '잠입 시설 폭파. 내구도 하락.',
  },
  {
    id: 'INCITE',
    name: '선동공작', // Incite Operation
    category: 'INTELLIGENCE',
    cost: 160, costType: 'MCP',
    wait: 0, duration: 0,
    description: '시민 선동. 지지율 하락.',
  },
  {
    id: 'INTRUDE',
    name: '침입공작', // Intrude Operation
    category: 'INTELLIGENCE',
    cost: 320, costType: 'MCP',
    wait: 0, duration: 0,
    description: '타 세력 행성/요새 침입.',
  },
  {
    id: 'RETURN',
    name: '귀환공작', // Return Operation
    category: 'INTELLIGENCE',
    cost: 320, costType: 'MCP',
    wait: 0, duration: 0,
    description: '침입지에서 자국으로 귀환.',
  },
];
