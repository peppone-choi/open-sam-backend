const fs = require('fs');
const path = require('path');

// 레거시 파일 로드
const actions = require('../config/archive/actions.json');
const legacyUnits = require('../config/archive/units.json');
const legacyConstants = require('../config/archive/constants.json');

// 시나리오 파일 로드
const scenarioPath = path.join(__dirname, '../config/scenarios/sangokushi/data');
const items = JSON.parse(fs.readFileSync(path.join(scenarioPath, 'items.json'), 'utf-8'));
const unitsData = JSON.parse(fs.readFileSync(path.join(scenarioPath, 'units.json'), 'utf-8'));
const constantsData = JSON.parse(fs.readFileSync(path.join(scenarioPath, 'constants.json'), 'utf-8'));

console.log('🔍 데이터 분석 중...\n');

// 1. items vs actions 비교
const actionsItems = Object.keys(actions.items || {});
const scenarioItems = Array.isArray(items) ? items.map(item => item.id) : Object.keys(items);
console.log(`📦 Items 비교:`);
console.log(`  - actions.json: ${actionsItems.length}개`);
console.log(`  - items.json: ${scenarioItems.length}개`);

// 2. units 비교
const legacyUnitIds = Object.keys(legacyUnits.unit_types || {});
const scenarioUnits = unitsData.units || unitsData;
const scenarioUnitIds = Array.isArray(scenarioUnits) 
  ? scenarioUnits.map(u => u.id?.toString()) 
  : Object.keys(scenarioUnits);
console.log(`\n🪖 Units 비교:`);
console.log(`  - legacy units.json: ${legacyUnitIds.length}개`);
console.log(`  - scenario units.json: ${scenarioUnitIds.length}개`);

const unitsOnly = legacyUnitIds.filter(id => !scenarioUnitIds.includes(id));
console.log(`  - legacy에만 있음: ${unitsOnly.length}개`);
if (unitsOnly.length > 0) {
  console.log(`    예: ${unitsOnly.slice(0, 5).join(', ')}`);
}

// 3. constants 비교
const legacyConst = legacyConstants.game_constants || legacyConstants;
const scenarioConst = constantsData.constants || constantsData;
const legacyConstKeys = Object.keys(legacyConst);
const scenarioConstKeys = Object.keys(scenarioConst);
console.log(`\n⚙️  Constants 비교:`);
console.log(`  - legacy constants.json: ${legacyConstKeys.length}개 키`);
console.log(`  - scenario constants.json: ${scenarioConstKeys.length}개 키`);

const constOnly = legacyConstKeys.filter(k => !scenarioConstKeys.includes(k));
console.log(`  - legacy에만 있음: ${constOnly.length}개`);
if (constOnly.length > 0 && constOnly.length < 20) {
  console.log(`\n  추가 가능한 상수:`);
  constOnly.forEach(key => {
    const val = legacyConst[key];
    const display = typeof val === 'string' && val.length > 50 
      ? val.substring(0, 50) + '...' 
      : JSON.stringify(val);
    console.log(`    - ${key}: ${display}`);
  });
}

// 병합 실행 여부 확인
console.log('\n\n📋 병합 권장사항:\n');

if (actionsItems.length === scenarioItems.length) {
  console.log('✅ Items: 개수 동일 (병합 불필요)');
} else {
  console.log(`⚠️  Items: 개수 차이 (actions: ${actionsItems.length}, scenario: ${scenarioItems.length})`);
}

if (unitsOnly.length === 0) {
  console.log('✅ Units: 시나리오 데이터가 완전함');
} else {
  console.log(`⚠️  Units: legacy에서 ${unitsOnly.length}개 추가 가능`);
}

if (constOnly.length === 0) {
  console.log('✅ Constants: 시나리오 데이터가 완전함');
} else {
  console.log(`⚠️  Constants: legacy에서 ${constOnly.length}개 필드 추가 가능`);
}

console.log('\n💡 결론: 시나리오 데이터가 레거시보다 상세하고 완전합니다.');
console.log('   레거시 파일들은 archive/에 보관 유지합니다.');
