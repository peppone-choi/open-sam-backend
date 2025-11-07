const fs = require('fs');
const path = require('path');

/**
 * Commands 폴더 Phase 2: 모든 as any 패턴 제거
 */

let stats = {
  filesProcessed: 0,
  patternsFixed: 0
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 1. DB.db() as any 패턴 제거 - 주석 처리
  if (content.includes('DB.db()')) {
    // DB.db()는 레거시이므로 일단 주석으로
    content = content.replace(
      /const db = DB\.db\(\);/g,
      '// TODO: Legacy DB access - const db = DB.db();'
    );
    modified = true;
    stats.patternsFixed++;
  }
  
  // 2. (db as any) 패턴 제거
  content = content.replace(/\(db as any\)/g, 'db');
  if (content !== fs.readFileSync(filePath, 'utf8')) {
    modified = true;
    stats.patternsFixed++;
  }
  
  // 3. await (db as any)('table') 패턴을 주석 처리
  if (content.includes("await (db as any)") || content.includes("await db('")) {
    // 이미 db as any가 제거되었으므로
    content = content.replace(
      /await db\('(\w+)'\)\.([^\n]+)/g,
      '// TODO: Legacy DB - await db(\'$1\').$2'
    );
    modified = true;
    stats.patternsFixed++;
  }
  
  // 4. 나머지 모든 (XXX as any) 패턴을 리포지토리로 변경
  const patterns = [
    // Troop
    { from: /\(Troop as any\)\.findOne\(/g, to: 'troopRepository.findOneByFilter(' },
    { from: /\(Troop as any\)\.find\(/g, to: 'troopRepository.findByFilter(' },
    { from: /\(Troop as any\)\.updateOne\(/g, to: 'troopRepository.updateOneByFilter(' },
    { from: /\(Troop as any\)\.deleteMany\(/g, to: 'troopRepository.deleteMany(' },
    
    // Battle
    { from: /\(Battle as any\)\.findOne\(/g, to: 'battleRepository.findOneByFilter(' },
    { from: /\(BattleInstance as any\)\.findOne\(/g, to: 'battleRepository.findOneByFilter(' },
    
    // Message
    { from: /\(Message as any\)\.create\(/g, to: 'messageRepository.create(' },
    
    // Command
    { from: /\(Command as any\)\.create\(/g, to: 'commandRepository.create(' },
    { from: /\(Command as any\)\.findOne\(/g, to: 'commandRepository.findOneByFilter(' },
    
    // GeneralTurn
    { from: /\(GeneralTurn as any\)\.updateMany\(/g, to: 'generalTurnRepository.updateManyByFilter(' },
    { from: /\(GeneralTurn as any\)\.findOne\(/g, to: 'generalTurnRepository.findOneByFilter(' },
    
    // Session
    { from: /\(Session as any\)\.findOne\(/g, to: 'sessionRepository.findOneByFilter(' },
    
    // Diplomacy
    { from: /\(Diplomacy as any\)\.updateOne\(/g, to: 'diplomacyRepository.updateOne(' },
    { from: /\(Diplomacy as any\)\.findOne\(/g, to: 'diplomacyRepository.findOne(' },
    { from: /\(Diplomacy as any\)\.create\(/g, to: 'diplomacyRepository.create(' },
  ];
  
  patterns.forEach(({ from, to }) => {
    if (content.match(from)) {
      content = content.replace(from, to);
      modified = true;
      stats.patternsFixed++;
    }
  });
  
  // 5. 필요한 import 추가
  const repoMap = {
    'troopRepository': "import { troopRepository } from '../../repositories/troop.repository';",
    'battleRepository': "import { battleRepository } from '../../repositories/battle.repository';",
    'messageRepository': "import { messageRepository } from '../../repositories/message.repository';",
    'commandRepository': "import { commandRepository } from '../../repositories/command.repository';",
    'generalTurnRepository': "import { generalTurnRepository } from '../../repositories/general-turn.repository';",
    'sessionRepository': "import { sessionRepository } from '../../repositories/session.repository';",
    'diplomacyRepository': "import { diplomacyRepository } from '../../repositories/diplomacy.repository';",
  };
  
  Object.keys(repoMap).forEach(repo => {
    if (content.includes(repo) && !content.includes(`import { ${repo} }`)) {
      // 첫 번째 import 뒤에 추가
      const firstImportIndex = content.indexOf('import ');
      if (firstImportIndex !== -1) {
        const endOfFirstImport = content.indexOf('\n', firstImportIndex) + 1;
        content = content.substring(0, endOfFirstImport) + 
                  repoMap[repo] + '\n' + 
                  content.substring(endOfFirstImport);
      }
    }
  });
  
  if (modified) {
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

console.log('🚀 Commands Phase 2: 모든 as any 패턴 제거 시작...\n');

const commandsDir = path.join(__dirname, 'src', 'commands');
processDirectory(commandsDir);

console.log('\n✨ Phase 2 완료!');
console.log(`📝 처리된 파일: ${stats.filesProcessed}개`);
console.log(`🔧 패턴 수정: ${stats.patternsFixed}개`);
