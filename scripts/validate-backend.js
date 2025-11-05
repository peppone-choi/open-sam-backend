const fs = require('fs');
const path = require('path');

console.log('🔍 백엔드 완전성 검증\n');

// 1. 필수 파일 체크
const checks = {
  '환경설정': [
    ['.env', fs.existsSync('.env')],
    ['package.json', fs.existsSync('package.json')],
    ['tsconfig.json', fs.existsSync('tsconfig.json')]
  ],
  '엔트리 포인트': [
    ['src/server.ts', fs.existsSync('src/server.ts')],
    ['src/daemon.ts', fs.existsSync('src/daemon.ts')]
  ],
  '핵심 서비스': [
    ['src/services/init.service.ts', fs.existsSync('src/services/init.service.ts')],
    ['src/services/session.service.ts', fs.existsSync('src/services/session.service.ts')]
  ],
  '시나리오 데이터': [
    ['config/scenarios/sangokushi/scenario.json', fs.existsSync('config/scenarios/sangokushi/scenario.json')],
    ['config/scenarios/sangokushi/data/cities.json', fs.existsSync('config/scenarios/sangokushi/data/cities.json')],
    ['config/scenarios/sangokushi/data/constants.json', fs.existsSync('config/scenarios/sangokushi/data/constants.json')],
    ['config/scenarios/sangokushi/data/units.json', fs.existsSync('config/scenarios/sangokushi/data/units.json')],
    ['config/scenarios/sangokushi/data/items.json', fs.existsSync('config/scenarios/sangokushi/data/items.json')]
  ]
};

for (const [category, files] of Object.entries(checks)) {
  console.log(`📁 ${category}:`);
  files.forEach(([file, exists]) => {
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
  });
  console.log();
}

// 2. 데이터 크기 체크
console.log('📊 시나리오 데이터 통계:\n');
const scenarioData = {
  'cities.json': 'config/scenarios/sangokushi/data/cities.json',
  'constants.json': 'config/scenarios/sangokushi/data/constants.json',
  'units.json': 'config/scenarios/sangokushi/data/units.json',
  'items.json': 'config/scenarios/sangokushi/data/items.json'
};

for (const [name, filepath] of Object.entries(scenarioData)) {
  if (fs.existsSync(filepath)) {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    let count = 0;
    
    if (name === 'cities.json') count = data.cities?.length || 0;
    else if (name === 'constants.json') count = Object.keys(data).length;
    else if (name === 'units.json') count = Object.keys(data.units || {}).length;
    else if (name === 'items.json') count = Array.isArray(data) ? data.length : 0;
    
    const size = (fs.statSync(filepath).size / 1024).toFixed(1);
    console.log(`  ${name}: ${count}개 항목 (${size}KB)`);
  }
}

// 3. InitService 로직 체크
console.log('\n\n🔧 InitService 검증:\n');
const initService = fs.readFileSync('src/services/init.service.ts', 'utf-8');

const checks2 = [
  ['loadScenarioData 메서드', initService.includes('loadScenarioData')],
  ['시나리오 경로 사용', initService.includes('scenarios/')],
  ['도시 데이터 로드', initService.includes('cities.json')],
  ['City.create 호출', initService.includes('City.create')],
  ['session_id 파라미터', initService.includes('session_id')]
];

checks2.forEach(([name, exists]) => {
  console.log(`  ${exists ? '✅' : '❌'} ${name}`);
});

console.log('\n\n✅ 백엔드 검증 완료!');
console.log('\n다음 단계: 서버 시작 테스트');
console.log('  npm run dev');
