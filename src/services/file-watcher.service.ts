import * as fs from 'fs';
import * as path from 'path';
import { InitService } from './init.service';
import { Session } from '../models/session.model';

/**
 * JSON 파일 변경 감지 및 DB 자동 동기화 서비스
 * 개발 모드에서만 활성화
 */
export class FileWatcherService {
  private static watchers: Map<string, fs.FSWatcher> = new Map();
  private static isWatching = false;
  private static debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private static readonly DEBOUNCE_DELAY = 1000; // 1초 디바운스

  /**
   * 파일 감시 시작
   * @param scenarioId 시나리오 ID (예: 'sangokushi')
   * @param sessionId 세션 ID (기본값: 'sangokushi_default')
   */
  static startWatching(scenarioId: string = 'sangokushi', sessionId: string = 'sangokushi_default') {
    // 프로덕션 모드에서는 비활성화
    if (process.env.NODE_ENV === 'production') {
      console.log('📁 파일 감시: 프로덕션 모드에서는 비활성화됩니다');
      return;
    }

    if (this.isWatching) {
      console.log('📁 파일 감시: 이미 실행 중입니다');
      return;
    }

    const dataDir = path.join(
      __dirname,
      '../../config/scenarios',
      scenarioId,
      'data'
    );

    if (!fs.existsSync(dataDir)) {
      console.warn(`📁 파일 감시: 데이터 디렉토리를 찾을 수 없습니다: ${dataDir}`);
      return;
    }

    console.log(`📁 JSON 파일 감시 시작: ${dataDir}`);
    console.log(`   세션 ID: ${sessionId}`);
    console.log(`   자동 동기화: 활성화됨\n`);

    // 감시할 파일 목록
    const filesToWatch = [
      'cities.json',
      'constants.json',
      'units.json',
      'items.json',
      'specials.json',
      'personalities.json',
      'nation-types.json',
      'map.json'
    ];

    filesToWatch.forEach((filename) => {
      const filePath = path.join(dataDir, filename);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`   ⚠️  파일을 찾을 수 없습니다: ${filename}`);
        return;
      }

      try {
        const watcher = fs.watch(filePath, async (eventType) => {
          if (eventType === 'change') {
            this.handleFileChange(filePath, filename, sessionId);
          }
        });

        this.watchers.set(filePath, watcher);
        console.log(`   ✅ 감시 중: ${filename}`);
      } catch (error: any) {
        console.error(`   ❌ 파일 감시 실패: ${filename}`, error.message);
      }
    });

    this.isWatching = true;
  }

  /**
   * 파일 변경 처리
   */
  private static async handleFileChange(
    filePath: string,
    filename: string,
    sessionId: string
  ) {
    // 디바운스: 연속된 변경 이벤트를 하나로 합침
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      try {
        console.log(`\n📝 파일 변경 감지: ${filename}`);
        
        // 파일이 실제로 변경되었는지 확인 (파일 읽기 시도)
        try {
          fs.readFileSync(filePath, 'utf-8');
        } catch (error: any) {
          console.warn(`   ⚠️  파일을 읽을 수 없습니다: ${error.message}`);
          return;
        }

        // 파일 타입에 따라 적절한 동기화 수행
        if (filename === 'cities.json') {
          console.log(`   🔄 도시 데이터 동기화 중...`);
          await InitService.initializeSession(sessionId);
          console.log(`   ✅ 도시 데이터 동기화 완료\n`);
        } else {
          console.log(`   ℹ️  ${filename} 변경됨 (수동 동기화 필요할 수 있음)`);
          console.log(`   💡 세션을 재시작하거나 수동으로 동기화를 실행하세요\n`);
        }
      } catch (error: any) {
        console.error(`   ❌ 파일 동기화 실패: ${error.message}\n`);
      }

      this.debounceTimers.delete(filePath);
    }, this.DEBOUNCE_DELAY);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * 파일 감시 중지
   */
  static stopWatching() {
    this.watchers.forEach((watcher, filePath) => {
      watcher.close();
    });
    this.watchers.clear();

    this.debounceTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.debounceTimers.clear();

    this.isWatching = false;
    console.log('📁 파일 감시 중지됨');
  }

  /**
   * 특정 세션의 도시 데이터 수동 동기화
   */
  static async syncCities(sessionId: string) {
    try {
      console.log(`🔄 수동 동기화 시작: ${sessionId}`);
      await InitService.initializeSession(sessionId);
      console.log(`✅ 수동 동기화 완료\n`);
    } catch (error: any) {
      console.error(`❌ 동기화 실패: ${error.message}\n`);
      throw error;
    }
  }
}
