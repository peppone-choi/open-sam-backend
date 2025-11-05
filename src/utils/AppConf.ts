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
    // TODO: ServConfig::getServerList() 구현 필요
    return [];
  }

  /**
   * 루트 DB 객체 생성
   */
  static requireRootDB(): any {
    // TODO: RootDB::db() 구현 필요
    throw new Error('RootDB.php가 설정되지 않았습니다.');
  }

  /**
   * DB 객체 생성
   */
  static requireDB(): any {
    // TODO: DB::db() 구현 필요
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
    // TODO: ServConfig::$serverWebPath 구현 필요
    const serverWebPath = '/'; // 기본값
    const path = `${serverWebPath}/${AppConf.userIconPath}`;
    return filepath ? `${path}/${filepath}` : path;
  }
}



