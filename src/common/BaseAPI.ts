/**
 * BaseAPI - 기본 API 클래스 (Express.js 통합)
 */

import { APICacheResult } from '../utils/WebUtil';
import { Session } from '../utils/Session';
import { DummySession } from '../utils/DummySession';

export abstract class BaseAPI {
  static readonly NO_SESSION = -1;
  static readonly NO_LOGIN = 0;
  static readonly REQ_LOGIN = 1;
  static readonly REQ_GAME_LOGIN = 2;
  static readonly REQ_READ_ONLY = 4;

  static sensitiveArgs: string[] = [];
  static allowExternalAPI: boolean = true;

  protected args: Record<string, any>;
  protected rootPath: string;

  constructor(rootPath: string, args: Record<string, any>) {
    this.rootPath = rootPath;
    this.args = args;
  }

  /**
   * 필터링된 인자 반환
   */
  getFilteredArgs(): Record<string, any> {
    const filteredArgs = { ...this.args };
    for (const argName of (this.constructor as typeof BaseAPI).sensitiveArgs) {
      if (argName in filteredArgs) {
        filteredArgs[argName] = '***';
      }
    }
    return filteredArgs;
  }

  /**
   * 필요한 세션 모드 반환
   */
  abstract getRequiredSessionMode(): number;

  /**
   * 인자 검증
   */
  abstract validateArgs(): string | null;

  /**
   * API 실행
   */
  abstract launch(
    session: Session | DummySession,
    modifiedSince?: Date | null,
    reqEtag?: string | null
  ): Promise<null | string | any[] | any> | (null | string | any[] | any);

  /**
   * 캐시 시도
   */
  tryCache(): APICacheResult | null {
    return null;
  }
}

