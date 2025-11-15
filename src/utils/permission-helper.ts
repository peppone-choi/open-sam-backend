/**
 * 권한 체크 헬퍼
 * PHP func.php의 checkSecretPermission 함수 참고
 */

export interface PermissionResult {
  level: number;       // -1: 접근불가, 0: 벌칙, 1: 일반, 2: 수뇌부, 3: 감찰관, 4: 군주/외교관
  canAccessBoard: boolean;      // 회의실 접근 가능
  canAccessSecret: boolean;     // 기밀실 접근 가능
  canAccessNation: boolean;     // 국가 기능 접근 가능
  message?: string;             // 접근 불가 시 메시지
}

/**
 * 장수의 권한 레벨 체크
 * 
 * @param general 장수 객체
 * @returns 권한 정보
 */
export function checkPermission(general: any): PermissionResult {
  const nationId = general.data?.nation || general.nation || 0;
  const officerLevel = general.data?.officer_level || general.officer_level || 0;
  const permission = general.data?.permission || general.permission || '';
  const penalty = general.data?.penalty || general.penalty || {};

  // 재야는 접근 불가
  if (!nationId || nationId === 0) {
    return {
      level: -1,
      canAccessBoard: false,
      canAccessSecret: false,
      canAccessNation: false,
      message: '국가에 소속되어있지 않습니다.'
    };
  }

  // 관직이 없으면 접근 불가 (PHP func.php:402-404)
  if (officerLevel === 0) {
    return {
      level: -1,
      canAccessBoard: false,
      canAccessSecret: false,
      canAccessNation: false,
      message: '관직이 없습니다. 국가에 정식으로 소속되어야 합니다.'
    };
  }

  // 수뇌부 벌칙이 있으면 권한 0 (PHP func.php:407-409)
  if (penalty.NoChief || penalty.no_chief) {
    return {
      level: 0,
      canAccessBoard: true,   // 일반 회의실은 가능
      canAccessSecret: false,
      canAccessNation: false,
      message: '수뇌부 벌칙으로 권한이 제한되었습니다.'
    };
  }

  // 권한 레벨 계산 (PHP func.php:411-431)
  let level = 0;

  if (officerLevel === 12) {
    // 군주 (PHP func.php:415-416)
    level = 4;
  } else if (permission === 'ambassador') {
    // 외교관 (PHP func.php:417-418)
    level = 4;
  } else if (permission === 'auditor') {
    // 감찰관 (PHP func.php:419-420)
    level = 3;
  } else if (officerLevel >= 5) {
    // 수뇌부 (PHP func.php:421-422)
    level = 2;
  } else if (officerLevel > 1) {
    // 일반 관직자 (PHP func.php:423-424)
    level = 1;
  } else {
    // officer_level = 1 (최하급 관직)
    // secretlimit 체크 필요 (PHP func.php:425-431)
    // FUTURE: belong >= secretlimit 체크 구현 (v2.0)
    level = 1;
  }

  return {
    level,
    canAccessBoard: level >= 1,
    canAccessSecret: level >= 2,
    canAccessNation: level >= 2,
    message: undefined
  };
}

/**
 * Express 미들웨어: 회의실 접근 권한 체크
 */
export function requireBoardAccess(req: any, res: any, next: any) {
  const general = req.general;
  if (!general) {
    return res.status(401).json({ result: false, reason: '장수 정보가 없습니다.' });
  }

  const perm = checkPermission(general);
  if (!perm.canAccessBoard) {
    return res.status(403).json({ result: false, reason: perm.message });
  }

  req.permission = perm;
  next();
}

/**
 * Express 미들웨어: 기밀실 접근 권한 체크
 */
export function requireSecretAccess(req: any, res: any, next: any) {
  const general = req.general;
  if (!general) {
    return res.status(401).json({ result: false, reason: '장수 정보가 없습니다.' });
  }

  const perm = checkPermission(general);
  if (!perm.canAccessSecret) {
    return res.status(403).json({ 
      result: false, 
      reason: perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.' 
    });
  }

  req.permission = perm;
  next();
}

/**
 * Express 미들웨어: 국가 기능 접근 권한 체크
 */
export function requireNationAccess(req: any, res: any, next: any) {
  const general = req.general;
  if (!general) {
    return res.status(401).json({ result: false, reason: '장수 정보가 없습니다.' });
  }

  const perm = checkPermission(general);
  if (!perm.canAccessNation) {
    return res.status(403).json({ 
      result: false, 
      reason: perm.message || '권한이 부족합니다. 수뇌부가 아닙니다.' 
    });
  }

  req.permission = perm;
  next();
}
