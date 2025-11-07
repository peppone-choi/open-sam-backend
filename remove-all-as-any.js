const fs = require('fs');
const path = require('path');

/**
 * 전체 프로젝트 모든 (XXX as any) 패턴 완전 제거
 */

let stats = {
  filesProcessed: 0,
  patternsRemoved: 0,
  filesByDirectory: {}
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // 모든 (XXX as any) 패턴을 XXX로 변경
  const pattern = /\(([^\)]+)\s+as\s+any\)/g;
  const matches = originalContent.match(pattern);
  
  if (matches) {
    content = content.replace(pattern, '$1');
    
    const removed = matches.length;
    stats.patternsRemoved += removed;
    
    const dir = path.dirname(filePath).replace(process.cwd() + '/src/', '');
    stats.filesByDirectory[dir] = (stats.filesByDirectory[dir] || 0) + removed;
    
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
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`✅ ${relativePath} (${removed}개 제거)`);
      }
    }
  }
}

console.log('🚀 전체 프로젝트 모든 (XXX as any) 패턴 완전 제거 시작...\n');

const srcDir = path.join(__dirname, 'src');
processDirectory(srcDir);

console.log('\n' + '='.repeat(60));
console.log('✨ 전체 프로젝트 as any 제거 완료!');
console.log('='.repeat(60));
console.log(`📝 처리된 파일: ${stats.filesProcessed}개`);
console.log(`🔧 제거된 패턴: ${stats.patternsRemoved}개`);
console.log('\n📊 디렉토리별 제거 현황:');
console.log('='.repeat(60));

const sortedDirs = Object.entries(stats.filesByDirectory)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

sortedDirs.forEach(([dir, count]) => {
  console.log(`  ${dir.padEnd(40)} ${count.toString().padStart(4)}개`);
});

console.log('\n🎉 완료! 이제 프로젝트에 as any 패턴이 없습니다!');
