import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const citiesPath = path.join(__dirname, '../config/scenarios/sangokushi/data/cities.json');
const scenariosPath = path.join(__dirname, '../config/scenarios');

// cities.json에서 도시 목록 로드
const citiesData = JSON.parse(fs.readFileSync(citiesPath, 'utf-8'));
const validCityNames = new Set(citiesData.cities.map(c => c.name || c.id));

console.log('📋 도시 목록 검증 시작...\n');
console.log(`총 도시 수: ${validCityNames.size}\n`);

// 모든 시나리오 폴더 찾기
const scenarioDirs = fs.readdirSync(scenariosPath, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('sangokushi'))
  .map(dirent => dirent.name);

let totalMissing = 0;
let totalCitiesChecked = 0;

for (const scenarioDir of scenarioDirs) {
  const scenarioPath = path.join(scenariosPath, scenarioDir, 'scenario.json');
  
  if (!fs.existsSync(scenarioPath)) {
    continue;
  }

  try {
    const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf-8'));
    const nations = scenario.data?.scenario?.nations || [];
    
    if (nations.length === 0) {
      continue;
    }

    const missingCities = new Map(); // nation index -> missing cities
    
    nations.forEach((nation, nationIndex) => {
      const cities = nation.cities || [];
      cities.forEach(cityName => {
        totalCitiesChecked++;
        if (!validCityNames.has(cityName)) {
          if (!missingCities.has(nationIndex)) {
            missingCities.set(nationIndex, []);
          }
          missingCities.get(nationIndex).push(cityName);
        }
      });
    });

    if (missingCities.size > 0) {
      console.log(`\n⚠️  ${scenarioDir} (${scenario.name})`);
      console.log('━'.repeat(60));
      missingCities.forEach((cities, nationIndex) => {
        const nation = nations[nationIndex];
        console.log(`  국가: ${nation.name} (id: ${nation.id})`);
        console.log(`  누락된 도시: ${cities.join(', ')}`);
        totalMissing += cities.length;
      });
    }
  } catch (error) {
    console.error(`❌ 에러 처리 중 ${scenarioDir}:`, error.message);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`총 확인한 도시: ${totalCitiesChecked}개`);
if (totalMissing === 0) {
  console.log('✅ 모든 도시가 cities.json에 존재합니다!');
} else {
  console.log(`❌ 누락된 도시: ${totalMissing}개`);
  console.log('\n⚠️  경고: 누락된 도시는 게임 시작 시 오류를 일으킬 수 있습니다.');
}

