import { logger } from '../../common/logger';

/**
 * 커맨드 레지스트리
 * 
 * 모든 게임 커맨드를 중앙에서 관리합니다.
 * 커맨드 타입으로 커맨드 클래스를 찾을 수 있습니다.
 */
export class CommandRegistry {
  private static generalCommands: Map<string, any> = new Map();
  private static nationCommands: Map<string, any> = new Map();

  /**
   * General 커맨드 등록
   * @param type - 커맨드 타입 (예: 'TRAIN', 'RECRUIT')
   * @param commandClass - 커맨드 클래스
   */
  static registerGeneral(type: string, commandClass: any): void {
    this.generalCommands.set(type, commandClass);
    logger.debug('General 커맨드 등록', { type, className: commandClass.name });
  }

  /**
   * Nation 커맨드 등록
   * @param type - 커맨드 타입
   * @param commandClass - 커맨드 클래스
   */
  static registerNation(type: string, commandClass: any): void {
    this.nationCommands.set(type, commandClass);
    logger.debug('Nation 커맨드 등록', { type, className: commandClass.name });
  }

  /**
   * General 커맨드 조회
   * @param type - 커맨드 타입
   * @returns 커맨드 클래스 또는 null
   */
  static getGeneral(type: string): any {
    return this.generalCommands.get(type) || null;
  }

  /**
   * Nation 커맨드 조회
   * @param type - 커맨드 타입
   * @returns 커맨드 클래스 또는 null
   */
  static getNation(type: string): any {
    return this.nationCommands.get(type) || null;
  }

  /**
   * 모든 General 커맨드 타입 조회
   */
  static getAllGeneralTypes(): string[] {
    return Array.from(this.generalCommands.keys());
  }

  /**
   * 모든 Nation 커맨드 타입 조회
   */
  static getAllNationTypes(): string[] {
    return Array.from(this.nationCommands.keys());
  }

  /**
   * 전체 커맨드 수 조회
   */
  static getStats() {
    return {
      generalCount: this.generalCommands.size,
      nationCount: this.nationCommands.size,
      total: this.generalCommands.size + this.nationCommands.size
    };
  }

  /**
   * 모든 커맨드 등록 초기화
   */
  static async loadAll(): Promise<void> {
    logger.info('커맨드 레지스트리 초기화 시작...');

    // General Commands
    const generalCommands = await import('../../commands/general');
    
    // 자동 등록 (클래스명에서 타입 추출)
    Object.entries(generalCommands).forEach(([className, commandClass]) => {
      // TrainCommand → TRAIN
      const type = className
        .replace('Command', '')
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .substring(1);
      
      this.registerGeneral(type, commandClass);
    });

    // Nation Commands
    const nationCommands = await import('../../commands/nation');
    
    Object.entries(nationCommands).forEach(([className, commandClass]) => {
      const type = className
        .replace('Command', '')
        .replace(/([A-Z])/g, '_$1')
        .toUpperCase()
        .substring(1);
      
      this.registerNation(type, commandClass);
    });

    const stats = this.getStats();
    logger.info('커맨드 레지스트리 초기화 완료', stats);
  }
}
