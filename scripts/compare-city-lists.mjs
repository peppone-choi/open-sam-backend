import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PHP 맵 파일 읽기
const phpMapPath = path.join(__dirname, '../../../core/hwe/scenario/map/cr.php');
const phpContent = fs.readFileSync(phpMapPath, 'utf-8');

// 도시 추출: [id, 'name', ...]
const cityRegex = /\[\s*(\d+),\s*'([^']+)',/g;
const phpCities = [];
let match;

while ((match = cityRegex.exec(phpContent)) !== null) {
  phpCities.push({
    id: parseInt(match[1]),
    name: match[2]
  });
}

// cities.json 읽기
const citiesJsonPath = path.join(__dirname, '../config/scenarios/sangokushi/data/cities.json');
const citiesJson = JSON.parse(fs.readFileSync(citiesJsonPath, 'utf-8'));
const jsonCityMap = new Map();
citiesJson.cities.forEach(c => {
  jsonCityMap.set(c.name, c.id);
});

console.log('📋 도시 목록 비교\n');
console.log(`PHP 맵 파일: ${phpCities.length}개`);
console.log(`cities.json: ${jsonCityMap.size}개\n`);

// PHP에는 있지만 JSON에 없는 도시
const missingInJson = phpCities.filter(c => !jsonCityMap.has(c.name));

// JSON에는 있지만 PHP에 없는 도시
const phpCityNames = new Set(phpCities.map(c => c.name));
const extraInJson = Array.from(jsonCityMap.keys()).filter(name => !phpCityNames.has(name));

console.log('━'.repeat(60));

if (missingInJson.length > 0) {
  console.log(`\n❌ cities.json에 누락된 도시 (${missingInJson.length}개):`);
  missingInJson.forEach(c => {
    console.log(`  ID ${c.id.toString().padStart(3, ' ')}: ${c.name}`);
  });
} else {
  console.log('\n✅ cities.json에 모든 PHP 도시가 포함되어 있습니다.');
}

if (extraInJson.length > 0) {
  console.log(`\n⚠️  cities.json에만 있는 도시 (${extraInJson.length}개):`);
  extraInJson.forEach(name => {
    const id = jsonCityMap.get(name);
    console.log(`  ID ${id.toString().padStart(3, ' ')}: ${name}`);
  });
} else {
  console.log('\n✅ 추가 도시 없음 (PHP 맵과 일치)');
}

// ID 순서 비교
console.log('\n━'.repeat(60));
const phpIdSet = new Set(phpCities.map(c => c.id));
const jsonIdSet = new Set(citiesJson.cities.map(c => c.id));
const missingIds = Array.from(phpIdSet).filter(id => !jsonIdSet.has(id));
const extraIds = Array.from(jsonIdSet).filter(id => !phpIdSet.has(id));

if (missingIds.length > 0) {
  console.log(`\n⚠️  PHP에는 있지만 JSON에 없는 ID: ${missingIds.join(', ')}`);
}
if (extraIds.length > 0) {
  console.log(`⚠️  JSON에만 있는 ID: ${extraIds.join(', ')}`);
}

