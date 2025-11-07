const fs = require('fs');
const path = require('path');

/**
 * Commands 폴더 완전 마이그레이션
 */

let stats = {
  filesProcessed: 0,
  generalFixed: 0,
  cityFixed: 0,
  nationFixed: 0,
  legacyFixed: 0
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;
  
  // 1. General 모델 마이그레이션
  
  // (General as any).findOne({ ... }) → generalRepository.findOneByFilter({ ... })
  if (content.includes('(General as any).findOne')) {
    content = content.replace(/\(General as any\)\.findOne\(/g, 'generalRepository.findOneByFilter(');
    stats.generalFixed++;
    modified = true;
  }
  
  // (General as any).find({ ... }) → generalRepository.findByFilter({ ... })
  if (content.includes('(General as any).find')) {
    content = content.replace(/\(General as any\)\.find\(/g, 'generalRepository.findByFilter(');
    stats.generalFixed++;
    modified = true;
  }
  
  // (General as any).updateOne → generalRepository.updateOneByFilter
  if (content.includes('(General as any).updateOne')) {
    content = content.replace(/\(General as any\)\.updateOne\(/g, 'generalRepository.updateOneByFilter(');
    stats.generalFixed++;
    modified = true;
  }
  
  // (General as any).updateMany → generalRepository.updateManyByFilter
  if (content.includes('(General as any).updateMany')) {
    content = content.replace(/\(General as any\)\.updateMany\(/g, 'generalRepository.updateManyByFilter(');
    stats.generalFixed++;
    modified = true;
  }
  
  // 2. City 모델 마이그레이션
  
  // (City as any).updateOne → cityRepository.updateOneByFilter
  if (content.includes('(City as any).updateOne')) {
    content = content.replace(/\(City as any\)\.updateOne\(/g, 'cityRepository.updateOneByFilter(');
    stats.cityFixed++;
    modified = true;
  }
  
  // (City as any).findOne → cityRepository.findOneByFilter
  if (content.includes('(City as any).findOne')) {
    content = content.replace(/\(City as any\)\.findOne\(/g, 'cityRepository.findOneByFilter(');
    stats.cityFixed++;
    modified = true;
  }
  
  // 3. Nation 모델 마이그레이션
  
  // (Nation as any).findOne → nationRepository.findOneByFilter
  if (content.includes('(Nation as any).findOne')) {
    content = content.replace(/\(Nation as any\)\.findOne\(/g, 'nationRepository.findOneByFilter(');
    stats.nationFixed++;
    modified = true;
  }
  
  // (Nation as any).updateOne → nationRepository.updateOneByFilter
  if (content.includes('(Nation as any).updateOne')) {
    content = content.replace(/\(Nation as any\)\.updateOne\(/g, 'nationRepository.updateOneByFilter(');
    stats.nationFixed++;
    modified = true;
  }
  
  // 4. 레거시 메서드 제거 (주석 처리)
  
  // createObjFromDB 사용을 주석 처리하고 findById로 교체
  if (content.includes('.createObjFromDB(')) {
    // 일단 주석으로 남겨두고 나중에 수동 수정
    content = content.replace(
      /(const\s+\w+\s*=\s*await\s+\(General as any\)\.createObjFromDB\([^)]+\);)/g,
      '// TODO: Legacy method - $1\n    // Use generalRepository.findById() instead'
    );
    stats.legacyFixed++;
    modified = true;
  }
  
  // createObjListFromDB
  if (content.includes('createObjListFromDB')) {
    content = content.replace(
      /(const\s+\w+\s*=\s*\(General as any\)\.createObjListFromDB;)/g,
      '// TODO: Legacy method - $1'
    );
    stats.legacyFixed++;
    modified = true;
  }
  
  // 5. import 추가 (필요한 경우)
  if (modified) {
    const needsGeneralRepo = content.includes('generalRepository');
    const needsCityRepo = content.includes('cityRepository');
    const needsNationRepo = content.includes('nationRepository');
    
    let imports = [];
    if (needsGeneralRepo && !content.includes("import { generalRepository }")) {
      imports.push("import { generalRepository } from '../../repositories/general.repository';");
    }
    if (needsCityRepo && !content.includes("import { cityRepository }")) {
      imports.push("import { cityRepository } from '../../repositories/city.repository';");
    }
    if (needsNationRepo && !content.includes("import { nationRepository }")) {
      imports.push("import { nationRepository } from '../../repositories/nation.repository';");
    }
    
    if (imports.length > 0) {
      // 첫 번째 import 뒤에 추가
      const firstImportIndex = content.indexOf('import ');
      if (firstImportIndex !== -1) {
        const endOfFirstImport = content.indexOf('\n', firstImportIndex) + 1;
        content = content.substring(0, endOfFirstImport) + 
                  imports.join('\n') + '\n' + 
                  content.substring(endOfFirstImport);
      }
    }
  }
  
  if (modified && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesProcessed++;
    return true;
  }
  
  return false;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const changed = processFile(filePath);
      if (changed) {
        console.log(`✅ ${path.relative(process.cwd(), filePath)}`);
      }
    }
  }
}

// Main execution
console.log('🚀 Commands 폴더 완전 마이그레이션 시작...\n');

const commandsDir = path.join(__dirname, 'src', 'commands');
processDirectory(commandsDir);

console.log('\n✨ Commands 마이그레이션 완료!');
console.log(`📝 처리된 파일: ${stats.filesProcessed}개`);
console.log(`🔧 General 수정: ${stats.generalFixed}개`);
console.log(`🔧 City 수정: ${stats.cityFixed}개`);
console.log(`🔧 Nation 수정: ${stats.nationFixed}개`);
console.log(`⚠️  Legacy 메서드 주석 처리: ${stats.legacyFixed}개`);
console.log('\n⚠️  주의: createObjFromDB 등 레거시 메서드는 수동 확인 필요');
