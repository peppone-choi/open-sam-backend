import { object, string, number } from 'yup';

/**
 * 장수 단련 DTO
 */
export const TrainGeneralSchema = object({
  params: object({
    generalId: string().required('장수 ID는 필수입니다'),
  }),
  body: object({
    statType: string()
      .oneOf(['leadership', 'strength', 'intel', 'politics'], '잘못된 스탯 타입입니다')
      .required('스탯 타입은 필수입니다'),
    amount: number()
      .min(1, '최소 1 이상이어야 합니다')
      .max(100, '최대 100까지 가능합니다')
      .required('훈련량은 필수입니다'),
  }),
});

/**
 * 장수 등용 DTO
 */
export const RecruitGeneralSchema = object({
  params: object({
    cityId: string().required('도시 ID는 필수입니다'),
  }),
  body: object({
    targetGeneralId: string().required('대상 장수 ID는 필수입니다'),
    message: string().max(500, '메시지는 500자 이하여야 합니다').optional(),
  }),
});

/**
 * 장수 이동 DTO
 */
export const MoveGeneralSchema = object({
  params: object({
    generalId: string().required('장수 ID는 필수입니다'),
  }),
  body: object({
    targetCityId: string().required('목적지 도시 ID는 필수입니다'),
    moveType: string()
      .oneOf(['normal', 'forced', 'return'], '잘못된 이동 타입입니다')
      .default('normal'),
  }),
});

/**
 * 장수 조회 DTO
 */
export const GetGeneralSchema = object({
  params: object({
    generalId: string().required('장수 ID는 필수입니다'),
  }),
});

/**
 * 장수 목록 조회 DTO
 */
export const ListGeneralsSchema = object({
  query: object({
    nationId: string().optional(),
    cityId: string().optional(),
    page: number().min(1).default(1),
    limit: number().min(1).max(100).default(20),
    sortBy: string().oneOf(['name', 'leadership', 'strength', 'intel', 'politics']).default('name'),
    sortOrder: string().oneOf(['asc', 'desc']).default('asc'),
  }),
});

/**
 * 장비 장착 DTO
 */
export const EquipItemSchema = object({
  params: object({
    generalId: string().required('장수 ID는 필수입니다'),
  }),
  body: object({
    itemId: string().required('아이템 ID는 필수입니다'),
    slotType: string()
      .oneOf(['weapon', 'armor', 'accessory'], '잘못된 슬롯 타입입니다')
      .required('슬롯 타입은 필수입니다'),
  }),
});
