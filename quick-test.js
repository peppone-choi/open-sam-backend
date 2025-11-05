// Quick server test
const http = require('http');

console.log('🧪 백엔드 서버 빠른 테스트');
console.log('==========================\n');

// Health check
function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      console.log(`${description.padEnd(40)} ✅ ${res.statusCode}`);
      resolve();
    });
    
    req.on('error', (err) => {
      console.log(`${description.padEnd(40)} ❌ ${err.message}`);
      resolve();
    });
    
    req.setTimeout(2000, () => {
      req.destroy();
      console.log(`${description.padEnd(40)} ⏱️ Timeout`);
      resolve();
    });
  });
}

setTimeout(async () => {
  console.log('P0: Critical Routes');
  console.log('-------------------');
  await testEndpoint('/health', 'Health Check');
  await testEndpoint('/api/auth/health', 'Auth Health');
  await testEndpoint('/api/command/health', 'Command Health');
  await testEndpoint('/api/nation/list', 'Nation List');
  
  console.log('\nP1: High Priority Routes');
  console.log('------------------------');
  await testEndpoint('/api/session/list', 'Session List');
  await testEndpoint('/api/general/get-front-info', 'General Front Info');
  await testEndpoint('/api/game/info', 'Game Info');
  
  console.log('\n✨ 테스트 완료!');
  process.exit(0);
}, 1000);
