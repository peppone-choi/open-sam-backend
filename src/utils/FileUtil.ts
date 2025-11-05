/**
 * FileUtil - PHP FileUtil 클래스 변환
 * 파일 시스템 유틸리티
 */

import * as fs from 'fs';
import * as path from 'path';

export class FileUtil {
  /**
   * 디렉토리 내 모든 파일 삭제
   */
  static delInDir(dir: string): boolean {
    try {
      if (!fs.existsSync(dir)) {
        return true;
      }

      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item === '.' || item === '..') {
          continue;
        }
        if (item.startsWith('.')) {
          continue;
        }

        const filepath = path.join(dir, item);
        const stat = fs.statSync(filepath);
        
        if (stat.isDirectory()) {
          this.delInDir(filepath); // recursive
        } else {
          try {
            fs.unlinkSync(filepath);
          } catch (error) {
            // 무시
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 만료된 파일 삭제
   */
  static delExpiredInDir(dir: string, t: number): void {
    try {
      if (!fs.existsSync(dir)) {
        return;
      }

      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item === '.' || item === '..') {
          continue;
        }

        const filepath = path.join(dir, item);
        const stat = fs.statSync(filepath);
        
        if (stat.isDirectory()) {
          this.delExpiredInDir(filepath, t); // recursive
        } else {
          const mt = stat.mtimeMs / 1000; // Unix timestamp
          if (mt < t) {
            try {
              fs.unlinkSync(filepath);
            } catch (error) {
              // 무시
            }
          }
        }
      }
    } catch (error) {
      // 에러 무시
    }
  }

  /**
   * 파일 존재 확인
   */
  static exists(filepath: string): boolean {
    return fs.existsSync(filepath);
  }

  /**
   * 디렉토리 생성 (재귀적)
   */
  static mkdir(dir: string, recursive: boolean = true): boolean {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 파일 읽기
   */
  static readFile(filepath: string): string | null {
    try {
      return fs.readFileSync(filepath, 'utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * 파일 쓰기
   */
  static writeFile(filepath: string, content: string): boolean {
    try {
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filepath, content, 'utf8');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 파일 삭제
   */
  static deleteFile(filepath: string): boolean {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 파일 수정 시간 가져오기
   */
  static getMTime(filepath: string): number | null {
    try {
      const stat = fs.statSync(filepath);
      return Math.floor(stat.mtimeMs / 1000); // Unix timestamp
    } catch (error) {
      return null;
    }
  }
}



