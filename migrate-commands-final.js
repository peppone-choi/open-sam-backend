const fs = require('fs');
const path = require('path');

/**
 * Commands 최종 완전 제거 - 모든 (XXX as any) 패턴
 */

let stats = {
  filesProcessed: 0,
  patternsRemoved: 0
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // 모든 (XXX as any) 패턴을 그냥 XXX로 변경
  // 타입 체크를 무시하는 것이므로 제거해도 동작은 동일
  const pattern = /\((\w+) as any\)/g;
  content = content.replace(pattern, '$1');
  
  if (content !== originalContent) {
    const removed = (originalContent.match(pattern) || []).length;
    stats.patternsRemoved += removed;
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesProcessed++;
    return removed;
  }
  
  return 0;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      const removed = processFile(filePath);
      if (removed > 0) {
        console.log(`✅ ${path.relative(process.cwd(), filePath)} (${removed}개 제거)`);
      }
    }
  }
}

console.log('🚀 Commands 최종 정리: 모든 (XXX as any) 패턴 제거...\n');

const commandsDir = path.join(__dirname, 'src', 'commands');
processDirectory(commandsDir);

console.log('\n✨ 최종 정리 완료!');
console.log(`📝 처리된 파일: ${stats.filesProcessed}개`);
console.log(`🔧 제거된 패턴: ${stats.patternsRemoved}개`);
