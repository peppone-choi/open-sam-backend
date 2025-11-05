/**
 * FileTail - 파일의 끝 부분 읽기
 * PHP의 FileTail 클래스 변환
 */

import * as fs from 'fs';

export class FileTail {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * 파일의 끝 부분 읽기
   * @param lines 읽을 라인 수
   * @param maxBytes 최대 바이트 수
   * @param reverse 역순 여부
   */
  smart(lines: number, maxBytes: number, reverse: boolean = false): string[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const stats = fs.statSync(this.filePath);
    const fileSize = stats.size;
    
    if (fileSize === 0) {
      return [];
    }

    const bufferSize = Math.min(maxBytes, fileSize);
    const buffer = Buffer.allocUnsafe(bufferSize);
    
    const fd = fs.openSync(this.filePath, 'r');
    const startPos = Math.max(0, fileSize - bufferSize);
    
    fs.readSync(fd, buffer, 0, bufferSize, startPos);
    fs.closeSync(fd);

    const content = buffer.toString('utf8');
    const allLines = content.split('\n');
    
    // 끝 부분만 추출
    const result = allLines.slice(-lines);
    
    return reverse ? result.reverse() : result;
  }

  /**
   * 파일의 마지막 N 줄 읽기
   */
  tail(lines: number): string[] {
    return this.smart(lines, 1024 * 1024, false); // 1MB 제한
  }
}



