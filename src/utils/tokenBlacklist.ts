/**
 * Token Blacklist
 * 로그아웃된 토큰을 관리하는 간단한 메모리 기반 블랙리스트
 * 프로덕션에서는 Redis를 사용하는 것을 권장합니다.
 */

interface BlacklistEntry {
  token: string;
  expiresAt: number; // timestamp
}

class TokenBlacklist {
  private blacklist: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 주기적으로 만료된 토큰 정리 (1시간마다)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * 토큰을 블랙리스트에 추가
   * @param token JWT 토큰
   * @param expiresIn 토큰 만료 시간 (초 단위, 기본 7일)
   */
  add(token: string, expiresIn: number = 7 * 24 * 60 * 60): void {
    const expiresAt = Date.now() + (expiresIn * 1000);
    this.blacklist.set(token, expiresAt);
  }

  /**
   * 토큰이 블랙리스트에 있는지 확인
   * @param token JWT 토큰
   * @returns 블랙리스트에 있으면 true
   */
  has(token: string): boolean {
    const expiresAt = this.blacklist.get(token);
    if (!expiresAt) {
      return false;
    }

    // 만료된 토큰은 제거
    if (expiresAt < Date.now()) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  /**
   * 토큰을 블랙리스트에서 제거
   * @param token JWT 토큰
   */
  remove(token: string): void {
    this.blacklist.delete(token);
  }

  /**
   * 만료된 토큰들을 정리
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [token, expiresAt] of this.blacklist.entries()) {
      if (expiresAt < now) {
        this.blacklist.delete(token);
      }
    }
  }

  /**
   * 전체 블랙리스트 초기화
   */
  clear(): void {
    this.blacklist.clear();
  }

  /**
   * 정리 작업 중지
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 싱글톤 인스턴스
export const tokenBlacklist = new TokenBlacklist();


