export interface ApiResponse<T = any> {
  data: T;
  message?: string;
}

export interface Paginated<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * GeneralGetFrontInfo.php / GetFrontInfoService 응답 형태
 * 메인 게임 화면에서 사용하는 통합 정보 페이로드
 */
export interface FrontInfoPayload {
  recentRecord: any;
  global: any;
  nation: any;
  general: any;
  city: any | null;
  aux: Record<string, any>;
  cityConstMap: {
    region: Record<string, any>;
    level: Record<string, any>;
    officerTitles: Record<string, any>;
    nationLevels: Record<string, any>;
  };
}

export interface FrontInfoResult extends FrontInfoPayload {
  success: boolean;
  result: boolean;
}

/**
 * GetCommandTable.php / GetCommandTableService 응답 형태
 */
export interface CommandTableEntry {
  value: string;
  simpleName: string;
  reqArg: 0 | 1;
  possible: boolean;
  compensation: number;
  title: string;
}

export interface CommandTableCategory {
  category: string;
  values: CommandTableEntry[];
}

export interface CommandTableResult {
  success: boolean;
  result?: boolean;
  commandTable?: CommandTableCategory[];
  message?: string;
  reason?: string;
}
