import { object, string, mixed, number } from 'yup';

/**
 * 커맨드 제출 DTO
 */
export const SubmitCommandSchema = object({
  body: object({
    sessionId: string().required('세션 ID는 필수입니다'),
    generalId: string().required('장수 ID는 필수입니다'),
    type: string()
      .oneOf([
        // 내정
        'CULTIVATE_FARM',
        'INVEST_COMMERCE',
        'RESEARCH_TECH',
        'REPAIR_WALL',
        'REINFORCE_DEFENSE',
        'PROCURE_SUPPLY',
        'TRADE_MILITARY',
        'BOOST_MORALE',
        'REINFORCE_SECURITY',
        
        // 훈련
        'TRAIN',
        'TRAIN_TROOPS',
        'INTENSIVE_TRAINING',
        'HEAL',
        'CONVERT_EXP',
        
        // 인사
        'RECRUIT',
        'ACCEPT_RECRUIT',
        'SEARCH_TALENT',
        'JOIN_NATION',
        'RANDOM_JOIN_NATION',
        'RECRUIT_GENERAL',
        'RETIRE',
        
        // 이동
        'MOVE',
        'RETURN',
        'BORDER_RETURN',
        'TRAVEL',
        'WANDER',
        
        // 군사
        'RECRUIT_SOLDIERS',
        'CONSCRIPT',
        'DEPLOY',
        'DISMISS',
        'GATHER',
        'DISBAND',
        'BATTLE_STANCE',
        
        // 전투
        'RAISE_ARMY',
        'FORCE_MARCH',
        'FIRE_ATTACK',
        'DESTROY',
        'PLUNDER',
        'SPY',
        
        // 국가
        'FOUND_NATION',
        'RANDOM_FOUND_NATION',
        'ABDICATE',
        'STEP_DOWN',
        'ATTEMPT_REBELLION',
        'INCITE',
        
        // 물자
        'GRANT',
        'DONATE',
        'TRADE_EQUIPMENT',
      ], '잘못된 커맨드 타입입니다')
      .required('커맨드 타입은 필수입니다'),
    payload: mixed().required('커맨드 페이로드는 필수입니다'),
    priority: number().min(0).max(10).default(5).optional(),
  }),
});

/**
 * 커맨드 취소 DTO
 */
export const CancelCommandSchema = object({
  params: object({
    commandId: string().required('커맨드 ID는 필수입니다'),
  }),
});

/**
 * 커맨드 조회 DTO
 */
export const GetCommandSchema = object({
  params: object({
    commandId: string().required('커맨드 ID는 필수입니다'),
  }),
});

/**
 * 커맨드 목록 조회 DTO
 */
export const ListCommandsSchema = object({
  query: object({
    sessionId: string().optional(),
    generalId: string().optional(),
    status: string().oneOf(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
    type: string().optional(),
    page: number().min(1).default(1),
    limit: number().min(1).max(100).default(20),
  }),
});
