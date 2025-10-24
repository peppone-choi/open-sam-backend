import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

console.log('Game Daemon started');

// 매 초마다 실행 (테스트용)
cron.schedule('* * * * * *', () => {
  console.log('Tick:', new Date().toISOString());
});

// 매 분마다 실행
cron.schedule('* * * * *', () => {
  console.log('Every minute task');
});

// 매 10초마다 실행
cron.schedule('*/10 * * * * *', () => {
  console.log('Every 10 seconds task');
});

process.on('SIGINT', () => {
  console.log('Daemon shutting down...');
  process.exit(0);
});
