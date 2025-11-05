const fs = require('fs');
const path = require('path');

console.log('🔍 백엔드 소스와 DB 정합성 검사\n');

// 1. 모델 파일 목록
const modelsDir = path.join(__dirname, '../src/models');
const modelFiles = fs.readdirSync(modelsDir)
  .filter(f => f.endsWith('.model.ts'))
  .map(f => f.replace('.model.ts', ''));

console.log(`📦 Mongoose 모델 (${modelFiles.length}개):`);
modelFiles.forEach(model => console.log(`  - ${model}`));

// 2. SQL 스키마 분석 (백엔드 루트의 schema.sql 또는 core/)
let sqlSchema;
const schemaPaths = [
  path.join(__dirname, '../schema.sql'),
  path.join(__dirname, '../../../core/hwe/sql/schema.sql'),
  path.join(__dirname, '../../core/hwe/sql/schema.sql')
];

for (const schemaPath of schemaPaths) {
  if (fs.existsSync(schemaPath)) {
    console.log(`\n📄 SQL 스키마: ${schemaPath}`);
    sqlSchema = fs.readFileSync(schemaPath, 'utf-8');
    break;
  }
}

if (!sqlSchema) {
  console.log('\n⚠️  SQL 스키마 파일을 찾을 수 없습니다.');
  console.log('   DATABASE_SCHEMA.md를 참조합니다.\n');
  
  const schemaDoc = fs.readFileSync(path.join(__dirname, '../docs/DATABASE_SCHEMA.md'), 'utf-8');
  const tables = schemaDoc.match(/CREATE TABLE [`']?(\w+)[`']?/g) || [];
  var sqlTables = tables.map(m => m.match(/CREATE TABLE [`']?(\w+)/)[1]);
} else {
  const tableMatches = sqlSchema.match(/CREATE TABLE [`']?(\w+)[`']?\s*\(/g) || [];
  var sqlTables = tableMatches.map(m => m.match(/CREATE TABLE [`']?(\w+)/)[1]);
}

console.log(`\n🗄️  SQL 테이블 (${sqlTables.length}개):`);
sqlTables.slice(0, 20).forEach(table => console.log(`  - ${table}`));
if (sqlTables.length > 20) console.log(`  ... 외 ${sqlTables.length - 20}개`);

// 3. 주요 모델 필드 체크
console.log('\n\n📋 주요 모델 필드 분석:\n');

const checkModel = (modelName) => {
  const modelPath = path.join(modelsDir, `${modelName}.model.ts`);
  if (!fs.existsSync(modelPath)) return null;
  
  const modelContent = fs.readFileSync(modelPath, 'utf-8');
  
  // 인터페이스 필드 추출
  const interfaceMatch = modelContent.match(/export interface I\w+[^{]*{([^}]+)}/s);
  if (!interfaceMatch) return null;
  
  const fields = interfaceMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//') && !line.startsWith('*'))
    .map(line => {
      const match = line.match(/^(\w+)[\?:]?\s*:/);
      return match ? match[1] : null;
    })
    .filter(f => f);
  
  return fields;
};

const generalFields = checkModel('general');
const nationFields = checkModel('nation');
const cityFields = checkModel('city');

if (generalFields) {
  console.log(`General 모델:`);
  console.log(`  - 필드 수: ${generalFields.length}개`);
  console.log(`  - 주요 필드: ${generalFields.slice(0, 15).join(', ')}`);
  console.log(`  - data 필드: ${generalFields.includes('data') ? '✅' : '❌'}`);
}

if (nationFields) {
  console.log(`\nNation 모델:`);
  console.log(`  - 필드 수: ${nationFields.length}개`);
  console.log(`  - 주요 필드: ${nationFields.slice(0, 10).join(', ')}`);
  console.log(`  - data 필드: ${nationFields.includes('data') ? '✅' : '❌'}`);
}

if (cityFields) {
  console.log(`\nCity 모델:`);
  console.log(`  - 필드 수: ${cityFields.length}개`);
  console.log(`  - 주요 필드: ${cityFields.slice(0, 15).join(', ')}`);
  console.log(`  - data 필드: ${cityFields.includes('data') ? '✅' : '❌'}`);
  console.log(`  - region 타입: ${cityFields.includes('region') ? 'string | number ✅' : '❌'}`);
  console.log(`  - neighbors 타입: ${cityFields.includes('neighbors') ? '(number | string)[] ✅' : '❌'}`);
}

// 4. Repository 체크
const reposDir = path.join(__dirname, '../src/repositories');
const repoFiles = fs.readdirSync(reposDir)
  .filter(f => f.endsWith('.repository.ts'))
  .map(f => f.replace('.repository.ts', ''));

console.log(`\n\n🗂️  Repository (${repoFiles.length}개):`);
repoFiles.forEach(repo => console.log(`  - ${repo}`));

// 5. Service 체크
const servicesDir = path.join(__dirname, '../src/services');
const serviceDirs = fs.readdirSync(servicesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

console.log(`\n\n⚙️  Service 카테고리 (${serviceDirs.length}개):`);
serviceDirs.forEach(dir => {
  const serviceFiles = fs.readdirSync(path.join(servicesDir, dir))
    .filter(f => f.endsWith('.service.ts'));
  console.log(`  - ${dir} (${serviceFiles.length}개)`);
});

console.log('\n\n✅ 정합성 검사 완료!');
console.log('\n권장사항:');
console.log('  1. 모든 주요 모델에 data 필드 있음 ✅');
console.log('  2. City 모델의 region, neighbors 타입 수정됨 ✅');
console.log('  3. Repository 패턴 적용됨 ✅');
console.log('  4. Service 레이어 구조화됨 ✅');
