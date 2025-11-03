import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cities.json 읽기
const jsonPath = path.join(__dirname, '../config/scenarios/sangokushi/data/cities.json');
const jsonCities = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const jsonCityNames = new Set(jsonCities.cities.map(c => c.name));

// CityConstBase.php 읽기
const basePath = path.join(__dirname, '../../core/hwe/sammo/CityConstBase.php');
const baseContent = fs.readFileSync(basePath, 'utf-8');

// 도시 추출
const cityRegex = /\[\s*(\d+),\s*'([^']+)',/g;
const baseCities = [];
let match;

while ((match = cityRegex.exec(baseContent)) !== null) {
  baseCities.push(match[2]);
}

// cities.json에만 있는 도시 찾기
const extra = Array.from(jsonCityNames).filter(name => !baseCities.includes(name));

console.log('📋 도시 비교 결과\n');
console.log(`CityConstBase.php 도시: ${baseCities.length}개`);
console.log(`cities.json 도시: ${jsonCityNames.size}개\n`);

if (extra.length > 0) {
  console.log(`⚠️  cities.json에만 있는 도시 (추가된 도시, ${extra.length}개):`);
  console.log('━'.repeat(60));
  extra.sort().forEach((name, i) => {
    const city = jsonCities.cities.find(c => c.name === name);
    console.log(`  ${(i+1).toString().padStart(2, ' ')}. ${name} (ID: ${city.id})`);
  });
  console.log('\n⚠️  이 도시들은 CityConstBase.php에 없어서 게임에서 사용되지 않을 수 있습니다.');
} else {
  console.log('✅ 추가된 도시 없음 - 모든 도시가 CityConstBase.php에 존재합니다.');
}

