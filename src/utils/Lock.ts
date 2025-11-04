/**
 * Lock - 파일 기반 락 시스템
 */

import * as fs from 'fs';
import * as path from 'path';

export class Lock {
  private static lockPath = path.join(process.cwd(), 'd_log', 'lock.txt');

  /**
   * 락이 걸려있는지 확인
   */
  static Busy(): boolean {
    try {
      if (!fs.existsSync(Lock.lockPath)) {
        return false;
      }
      const content = fs.readFileSync(Lock.lockPath, 'utf8');
      return content.trim() === '1';
    } catch {
      return false;
    }
  }

  /**
   * 락 걸기
   */
  static Lock(): boolean {
    try {
      // 락 파일이 이미 존재하고 1이면 실패
      if (fs.existsSync(Lock.lockPath)) {
        const content = fs.readFileSync(Lock.lockPath, 'utf8');
        if (content.trim() === '1') {
          return false;
        }
      }

      // 디렉토리 생성
      const dir = path.dirname(Lock.lockPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 파일 잠금 시도
      const fd = fs.openSync(Lock.lockPath, 'w');
      try {
        fs.writeFileSync(fd, '1', 'utf8');
        fs.closeSync(fd);
        return true;
      } catch {
        fs.closeSync(fd);
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * 락 풀기
   */
  static Unlock(): boolean {
    try {
      if (!fs.existsSync(Lock.lockPath)) {
        return false;
      }

      const content = fs.readFileSync(Lock.lockPath, 'utf8');
      if (content.trim() === '0') {
        return false;
      }

      const fd = fs.openSync(Lock.lockPath, 'w');
      try {
        fs.writeFileSync(fd, '0', 'utf8');
        fs.closeSync(fd);
        return true;
      } catch {
        fs.closeSync(fd);
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * 락 파일 경로 설정
   */
  static setLockPath(filePath: string): void {
    Lock.lockPath = filePath;
  }
}
