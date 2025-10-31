import { CommandRegistry } from './CommandRegistry';
import { logger } from '../../common/logger';
import { NotFoundError } from '../../common/errors/app-error';

/**
 * 커맨드 팩토리
 * 
 * 커맨드 타입과 데이터를 받아서 커맨드 인스턴스를 생성합니다.
 */
export class CommandFactory {
  /**
   * General 커맨드 생성
   * 
   * @param type - 커맨드 타입 (예: 'TRAIN', 'RECRUIT')
   * @param general - 장수 객체
   * @param env - 환경 데이터
   * @param arg - 커맨드 인자
   * @returns 커맨드 인스턴스
   */
  static createGeneral(type: string, general: any, env: any, arg?: any): any {
    const CommandClass = CommandRegistry.getGeneral(type);
    
    if (!CommandClass) {
      logger.error('알 수 없는 General 커맨드 타입', { type });
      throw new NotFoundError(`알 수 없는 커맨드 타입: ${type}`, { type, category: 'general' });
    }

    logger.debug('General 커맨드 생성', { type, className: CommandClass.name });
    
    return new CommandClass(general, env, arg);
  }

  /**
   * Nation 커맨드 생성
   * 
   * @param type - 커맨드 타입
   * @param general - 장수 객체
   * @param env - 환경 데이터
   * @param arg - 커맨드 인자
   * @returns 커맨드 인스턴스
   */
  static createNation(type: string, general: any, env: any, arg?: any): any {
    const CommandClass = CommandRegistry.getNation(type);
    
    if (!CommandClass) {
      logger.error('알 수 없는 Nation 커맨드 타입', { type });
      throw new NotFoundError(`알 수 없는 커맨드 타입: ${type}`, { type, category: 'nation' });
    }

    logger.debug('Nation 커맨드 생성', { type, className: CommandClass.name });
    
    return new CommandClass(general, env, arg);
  }

  /**
   * 커맨드 타입으로 자동 생성
   * 
   * @param category - 'general' 또는 'nation'
   * @param type - 커맨드 타입
   * @param general - 장수 객체
   * @param env - 환경 데이터
   * @param arg - 커맨드 인자
   * @returns 커맨드 인스턴스
   */
  static create(category: 'general' | 'nation', type: string, general: any, env: any, arg?: any): any {
    if (category === 'general') {
      return this.createGeneral(type, general, env, arg);
    } else if (category === 'nation') {
      return this.createNation(type, general, env, arg);
    } else {
      throw new Error(`잘못된 커맨드 카테고리: ${category}`);
    }
  }

  /**
   * 사용 가능한 모든 커맨드 타입 조회
   */
  static getAvailableTypes() {
    return {
      general: CommandRegistry.getAllGeneralTypes(),
      nation: CommandRegistry.getAllNationTypes(),
    };
  }
}
