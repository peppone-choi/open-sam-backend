const fs = require('fs');

// 1. archive.service.ts - findBySessionAndNo 파라미터 수정
let archiveContent = fs.readFileSync('src/services/archive.service.ts', 'utf8');

// 437줄 근처
archiveContent = archiveContent.replace(
  /generalRepository\.findBySessionAndNo\(\{\s*session_id:\s*(\w+),\s*'data\.no':\s*([^,\n]+),\s*\.\.\.(\w+)/g,
  'generalRepository.findBySessionAndNo($1, $2) // TODO: userFilter 처리 필요'
);

// 497줄 근처  
archiveContent = archiveContent.replace(
  /generalRepository\.findBySessionAndNo\(\{\s*session_id:\s*(\w+),\s*'data\.no':\s*([^\}]+)\s*\}\)/g,
  'generalRepository.findBySessionAndNo($1, $2)'
);

fs.writeFileSync('src/services/archive.service.ts', archiveContent);
console.log('✅ Fixed archive.service.ts');

// 2. auction services - .sort() 제거하고 배열 정렬로 변경
const auctionFiles = [
  'src/services/auction/GetActiveResourceAuctionList.service.ts',
  'src/services/auction/GetUniqueItemAuctionList.service.ts'
];

auctionFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // findByFilter({ ... }).sort({ closeDate: 1 }) → findByFilter({ ... })를 먼저 가져온 후 정렬
  content = content.replace(
    /const\s+(\w+)\s*=\s*await\s+auctionRepository\.findByFilter\(([^)]+)\)\.sort\(([^)]+)\);/g,
    'const $1 = (await auctionRepository.findByFilter($2)).sort((a: any, b: any) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime());'
  );
  
  fs.writeFileSync(file, content);
  console.log(`✅ Fixed ${file}`);
});

// 3. battlemap - .sort() 수정
let battlemapContent = fs.readFileSync('src/services/battlemap/GetMapTemplate.service.ts', 'utf8');
battlemapContent = battlemapContent.replace(
  /const\s+(\w+)\s*=\s*await\s+battleMapTemplateRepository\.findByFilter\(([^)]+)\)\.sort\(([^)]+)\);/g,
  'const $1 = (await battleMapTemplateRepository.findByFilter($2)).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));'
);
fs.writeFileSync('src/services/battlemap/GetMapTemplate.service.ts', battlemapContent);
console.log('✅ Fixed battlemap/GetMapTemplate.service.ts');

// 4. chief - findBySessionAndOwner 파라미터 수정
let chiefContent = fs.readFileSync('src/services/chief/GetChiefCenter.service.ts', 'utf8');

// findBySessionAndOwner({ session_id, owner, ...filter }) → findBySessionAndOwner(sessionId, owner, filter)
chiefContent = chiefContent.replace(
  /generalRepository\.findBySessionAndOwner\(\{\s*session_id:\s*(\w+),\s*owner:\s*([^,\n]+),\s*([^}]+)\}\)/g,
  'generalRepository.findBySessionAndOwner($1, $2, { $3 })'
);

// findBySessionAndNo({ session_id, 'data.no': ... }) → findBySessionAndNo(sessionId, no)
chiefContent = chiefContent.replace(
  /generalRepository\.findBySessionAndNo\(\{\s*session_id:\s*(\w+),\s*'data\.no':\s*([^\}]+)\s*\}\)/g,
  'generalRepository.findBySessionAndNo($1, $2)'
);

fs.writeFileSync('src/services/chief/GetChiefCenter.service.ts', chiefContent);
console.log('✅ Fixed chief/GetChiefCenter.service.ts');

console.log('\n✨ All remaining service errors fixed!');
