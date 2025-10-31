import { object, string, mixed } from 'yup';

/**
 * 세션 생성 DTO
 */
export const CreateSessionSchema = object({
  body: object({
    templateId: string().required('템플릿 ID는 필수입니다'),
    sessionId: string()
      .required('세션 ID는 필수입니다')
      .matches(/^[a-z0-9_-]+$/, '세션 ID는 소문자, 숫자, _, - 만 사용 가능합니다'),
    sessionName: string().required('세션 이름은 필수입니다'),
    autoInit: mixed().optional(),
  }),
});

/**
 * 세션 업데이트 DTO
 */
export const UpdateSessionSchema = object({
  params: object({
    sessionId: string().required(),
  }),
  body: object({
    name: string().optional(),
    game_mode: string().oneOf(['turn', 'realtime']).optional(),
    turn_config: mixed().optional(),
    realtime_config: mixed().optional(),
    resources: mixed().optional(),
    attributes: mixed().optional(),
    field_mappings: mixed().optional(),
    commands: mixed().optional(),
    game_constants: mixed().optional(),
    cities: mixed().optional(),
    status: string().oneOf(['waiting', 'running', 'finished']).optional(),
  }),
});

/**
 * 세션 조회 DTO
 */
export const GetSessionSchema = object({
  params: object({
    sessionId: string().required(),
  }),
});

/**
 * 세션 삭제 DTO
 */
export const DeleteSessionSchema = object({
  params: object({
    sessionId: string().required(),
  }),
});

/**
 * 세션 초기화 DTO
 */
export const ResetSessionSchema = object({
  params: object({
    sessionId: string().required(),
  }),
});
