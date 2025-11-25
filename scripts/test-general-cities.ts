/**
 * 장수 근거지 기능 테스트
 * 
 * 사용법: npx ts-node scripts/test-general-cities.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// 도시명→ID 매핑 테스트
const CITIES_PATH = path.join(__dirname, '..', 'config', 'scenarios', 'sangokushi', 'data', 'cities.json');
const citiesData = JSON.parse(fs.readFileSync(CITIES_PATH, 'utf-8'));
const cityNameToIdMap = new Map<string, number>();

for (const city of citiesData.cities) {
  cityNameToIdMap.set(city.name, city.id);
}

console.log(`Loaded ${cityNameToIdMap.size} cities`);
console.log('Sample cities:', Array.from(cityNameToIdMap.entries()).slice(0, 10));

// 시나리오별 generalCities 테스트
const SCENARIO_1070 = path.join(__dirname, '..', 'config', 'scenarios', 'sangokushi', 'scenario_1070.json');
const scenario = JSON.parse(fs.readFileSync(SCENARIO_1070, 'utf-8'));

console.log('\n=== Scenario 1070 (적벽대전) ===');
console.log(`Total generals: ${scenario.general.length}`);
console.log(`GeneralCities entries: ${Object.keys(scenario.generalCities || {}).length}`);

// 주요 장수 근거지 확인
const testGenerals = ['유비', '관우', '장비', '제갈량', '조운', '조조', '손권', '주유', '노숙1', '여몽'];
console.log('\n주요 장수 근거지:');
for (const name of testGenerals) {
  const cityName = scenario.generalCities[name];
  const cityId = cityName ? cityNameToIdMap.get(cityName) : null;
  const displayName = name.replace(/\d+$/, ''); // 표시용 이름에서 숫자 제거
  console.log(`  ${displayName}: ${cityName || '없음'} (ID: ${cityId || 'N/A'})`);
}

// 도시 변환 테스트
console.log('\n도시명 변환 테스트:');
const testCities = ['영안', '허창', '시상', '낙양', '업', '면죽', '패'];
for (const cityName of testCities) {
  const cityId = cityNameToIdMap.get(cityName);
  console.log(`  ${cityName} -> ${cityId || 'NOT FOUND'}`);
}

console.log('\n✅ Test completed!');
