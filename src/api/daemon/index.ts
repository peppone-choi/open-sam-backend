import { CommandWorker } from './command-worker';
import { PersistenceDaemon } from './persistence-daemon';

/**
 * 게임 데몬 메인
 * 
 * 두 개의 워커를 동시에 실행:
 * 1. CommandWorker: 커맨드 처리
 * 2. PersistenceDaemon: Redis → MongoDB 영속화
 */
async function main() {
  console.log('🎮 게임 데몬 시작 중');

  // 커맨드 워커 시작
  const commandWorker = new CommandWorker();
  await commandWorker.start();

  // 영속화 데몬 시작
  const persistenceDaemon = new PersistenceDaemon();
  await persistenceDaemon.start();

  // Graceful Shutdown
  process.on('SIGTERM', async () => {
    console.log('⚠️ SIGTERM 신호 수신, 종료 작업 진행 중...');
    await commandWorker.stop();
    await persistenceDaemon.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('⚠️ SIGINT 신호 수신, 종료 작업 진행 중...');
    await commandWorker.stop();
    await persistenceDaemon.stop();
    process.exit(0);
  });

  console.log('✅ 게임 데몬 실행 완료');
}

// 에러 핸들링
main().catch((error) => {
  console.error('❌ 게임 데몬 시작 오류:', error);
  process.exit(1);
});
