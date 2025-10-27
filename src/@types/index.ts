/**
 * 타입 정의 중앙 export
 * 
 * 도메인 타입은 각 도메인의 @types 폴더에서 관리됩니다.
 * 여기서는 공통 타입만 export합니다.
 */

export * from './http';

// 도메인별 타입은 각 도메인에서 직접 import하세요
// import { IGeneral } from '@/api/general/@types/general.types';
// import { ICity } from '@/api/city/@types/city.types';
// import { ICommand, CommandType } from '@/api/command/@types/command.types';

// Re-export 주요 타입들 (하위 호환성)
export * from '../api/general/@types/general.types';
export * from '../api/city/@types/city.types';
export * from '../api/nation/@types/nation.types';
export * from '../api/command/@types/command.types';
export * from '../api/game-session/@types/game-session.types';
