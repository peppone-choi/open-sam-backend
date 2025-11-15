/**
 * AppConf - 애플리케이션 설정
 * NOTE: 프로젝트 구조에 맞게 재설계 필요
 */

export class AppConf {
  /** 전용 아이콘 경로 */
  static userIconPath = 'd_pic';

  /**
   * 서버 설정 반환 (deprecated)
   */
  static getList(): any[] {
    // FUTURE: ServConfig::getServerList() 마이그레이션 (v2.0)
    return [];
  }

  /**
   * 루트 DB 객체 생성
   */
  static requireRootDB(): any {
    // FUTURE: RootDB::db() 마이그레이션 (v2.0)
    throw new Error('RootDB.php가 설정되지 않았습니다.');
  }

  /**
   * DB 객체 생성
   */
  static requireDB(): any {
    // FUTURE: DB::db() 마이그레이션 (v2.0)
    throw new Error('DB.php가 설정되지 않았습니다.');
  }

  /**
   * 파일 시스템 아이콘 경로
   */
  static getUserIconPathFS(filepath: string = ''): string {
    const root = process.cwd();
    const path = `${root}/${AppConf.userIconPath}`;
    return filepath ? `${path}/${filepath}` : path;
  }

  /**
   * 웹 아이콘 경로
   */
  static getUserIconPathWeb(filepath: string = ''): string {
    // FUTURE: ServConfig::$serverWebPath 마이그레이션 (v2.0)
    const serverWebPath = '/'; // 기본값
    const path = `${serverWebPath}/${AppConf.userIconPath}`;
    return filepath ? `${path}/${filepath}` : path;
  }
}



