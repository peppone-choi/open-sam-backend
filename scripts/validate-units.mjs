import fs from 'fs';
import path from 'path';

console.log('=== 병종 데이터 검증 스크립트 ===\n');

// 1. 새 JSON 파일 로드
const newUnitsPath = './config/scenarios/sangokushi/data/units.json';
const newUnitsData = JSON.parse(fs.readFileSync(newUnitsPath, 'utf-8'));
const newUnits = newUnitsData.units || {};

console.log(`✅ 새 units.json 로드: ${Object.keys(newUnits).length}개 병종`);

// 2. 레거시 session-sangokushi.json 로드
const legacyPath = './config/session-sangokushi.json';
const legacyData = JSON.parse(fs.readFileSync(legacyPath, 'utf-8'));
const legacyUnits = legacyData.unit_types || {};

console.log(`✅ 레거시 session-sangokushi.json 로드: ${Object.keys(legacyUnits).length}개 병종\n`);

// 3. ID 목록 비교
const newIds = Object.keys(newUnits).map(id => parseInt(id)).sort((a, b) => a - b);
const legacyIds = Object.keys(legacyUnits).map(id => parseInt(id)).sort((a, b) => a - b);

console.log('=== ID 비교 ===');
console.log(`새 JSON 병종 ID: ${newIds.join(', ')}`);
console.log(`레거시 병종 ID: ${legacyIds.join(', ')}\n`);

const onlyInNew = newIds.filter(id => !legacyIds.includes(id));
const onlyInLegacy = legacyIds.filter(id => !newIds.includes(id));
const commonIds = newIds.filter(id => legacyIds.includes(id));

if (onlyInNew.length > 0) {
  console.log(`⚠️  새 JSON에만 있는 병종 ID: ${onlyInNew.join(', ')}`);
}
if (onlyInLegacy.length > 0) {
  console.log(`⚠️  레거시에만 있는 병종 ID: ${onlyInLegacy.join(', ')}`);
}
console.log(`✓ 공통 병종 ID: ${commonIds.length}개\n`);

// 4. 공통 ID의 이름과 타입 비교
console.log('=== 공통 병종 상세 비교 ===\n');
const mismatches = [];

for (const id of commonIds) {
  const newUnit = newUnits[id.toString()];
  const legacyUnit = legacyUnits[id.toString()];
  
  if (!newUnit || !legacyUnit) continue;
  
  const newName = newUnit.name;
  const legacyName = legacyUnit.name;
  const newType = newUnit.type || 'unknown';
  const legacyType = legacyUnit.type || 'unknown';
  
  if (newName !== legacyName || newType !== legacyType) {
    mismatches.push({
      id,
      newName,
      legacyName,
      newType,
      legacyType
    });
    
    console.log(`❌ ID ${id}:`);
    console.log(`   새 JSON: ${newName} (${newType})`);
    console.log(`   레거시: ${legacyName} (${legacyType})`);
    console.log('');
  }
}

if (mismatches.length === 0) {
  console.log('✓ 모든 공통 병종의 이름과 타입이 일치합니다.\n');
} else {
  console.log(`⚠️  ${mismatches.length}개 병종의 이름/타입이 일치하지 않습니다.\n`);
}

// 5. 새 JSON 병종 타입별 통계
console.log('=== 새 JSON 병종 타입별 통계 ===');
const typeCount = {};
for (const id in newUnits) {
  const type = newUnits[id].type || 'UNKNOWN';
  typeCount[type] = (typeCount[type] || 0) + 1;
}
for (const [type, count] of Object.entries(typeCount).sort()) {
  console.log(`  ${type}: ${count}개`);
}
console.log('');

// 6. 새 JSON 구조 검증
console.log('=== 새 JSON 구조 검증 ===');
const requiredFields = ['id', 'type', 'name', 'cost', 'stats'];
const optionalFields = ['attacks', 'defenses', 'description', 'constraints'];

let structureIssues = 0;
for (const id in newUnits) {
  const unit = newUnits[id];
  for (const field of requiredFields) {
    if (!(field in unit)) {
      console.log(`❌ ID ${id}: 필수 필드 '${field}' 누락`);
      structureIssues++;
    }
  }
  
  // cost 구조 확인
  if (unit.cost && typeof unit.cost === 'object') {
    if (!('gold' in unit.cost) || !('rice' in unit.cost)) {
      console.log(`⚠️  ID ${id}: cost 구조가 비정상 (gold, rice 필요)`);
      structureIssues++;
    }
  } else if (typeof unit.cost === 'number') {
    console.log(`⚠️  ID ${id}: cost가 숫자입니다 (객체여야 함)`);
    structureIssues++;
  }
  
  // stats 구조 확인
  if (unit.stats && typeof unit.stats === 'object') {
    const requiredStats = ['tech', 'offense', 'magic', 'attackRange', 'defenseRange'];
    for (const stat of requiredStats) {
      if (!(stat in unit.stats)) {
        console.log(`❌ ID ${id}: stats.${stat} 누락`);
        structureIssues++;
      }
    }
  }
}

if (structureIssues === 0) {
  console.log('✓ 모든 병종의 구조가 올바릅니다.\n');
} else {
  console.log(`⚠️  ${structureIssues}개의 구조 문제가 발견되었습니다.\n`);
}

// 7. DB 스키마와의 호환성 확인
console.log('=== DB 스키마 호환성 확인 ===');
const dbCompatibleTypes = ['FOOTMAN', 'ARCHER', 'CAVALRY', 'WIZARD', 'SIEGE', 'CASTLE', 'SPEARMAN', 'MIXED'];
const incompatibleTypes = [];

for (const id in newUnits) {
  const type = newUnits[id].type;
  if (type && !dbCompatibleTypes.includes(type)) {
    incompatibleTypes.push({ id, type });
  }
}

if (incompatibleTypes.length === 0) {
  console.log('✓ 모든 병종 타입이 DB 스키마와 호환됩니다.\n');
} else {
  console.log(`⚠️  호환되지 않는 타입:`);
  for (const { id, type } of incompatibleTypes) {
    console.log(`   ID ${id}: ${type}`);
  }
  console.log('');
}

// 8. GetConstService 호환성 확인
console.log('=== GetConstService 호환성 확인 ===');
const getConstPath = './src/services/global/GetConst.service.ts';
if (fs.existsSync(getConstPath)) {
  const getConstContent = fs.readFileSync(getConstPath, 'utf-8');
  
  // GetConstService가 어떤 경로를 사용하는지 확인
  if (getConstContent.includes('config/units.json')) {
    console.log('⚠️  GetConstService는 config/units.json을 참조합니다.');
    console.log('   하지만 실제 units.json은 config/scenarios/sangokushi/data/units.json에 있습니다.');
    console.log('   GetConstService를 업데이트해야 할 수 있습니다.\n');
  }
  
  if (getConstContent.includes('unit_types')) {
    console.log('⚠️  GetConstService는 unitsData.unit_types를 참조합니다.');
    console.log('   하지만 새 JSON은 unitsData.units를 사용합니다.');
    console.log('   GetConstService를 업데이트해야 합니다.\n');
  }
}

// 9. 요약
console.log('=== 검증 요약 ===');
console.log(`새 JSON 병종 수: ${Object.keys(newUnits).length}개`);
console.log(`레거시 병종 수: ${Object.keys(legacyUnits).length}개`);
console.log(`공통 병종 수: ${commonIds.length}개`);
console.log(`이름/타입 불일치: ${mismatches.length}개`);
console.log(`구조 문제: ${structureIssues}개`);
console.log(`호환성 문제: ${incompatibleTypes.length}개\n`);

if (mismatches.length === 0 && structureIssues === 0 && incompatibleTypes.length === 0) {
  console.log('✅ 모든 검증을 통과했습니다!');
  process.exit(0);
} else {
  console.log('⚠️  일부 문제가 발견되었습니다. 위의 내용을 확인하세요.');
  process.exit(1);
}

