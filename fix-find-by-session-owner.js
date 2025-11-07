const fs = require('fs');
const path = require('path');

/**
 * Fix findBySessionAndOwner calls to use proper parameters
 */

const files = [
  'src/services/chief/GetChiefCenter.service.ts',
  'src/services/game/GetMyBossInfo.service.ts',
  'src/services/game/ServerBasicInfo.service.ts',
  'src/services/game/SetGeneralPermission.service.ts',
  'src/services/game/SetMySetting.service.ts',
  'src/services/game/Vacation.service.ts',
  'src/services/general/GetFrontInfo.service.ts',
  'src/services/general/GetJoinInfo.service.ts',
  'src/services/general/GetSelectNpcToken.service.ts',
  'src/services/general/GetSelectPool.service.ts',
  'src/services/general/Join.service.ts',
  'src/services/general/SelectPickedGeneral.service.ts',
  'src/services/general/UpdatePickedGeneral.service.ts',
  'src/services/global/GetDiplomacy.service.ts',
  'src/services/info/GetGeneralInfo.service.ts',
  'src/services/info/GetOfficerInfo.service.ts',
  'src/services/npc/GetNPCControl.service.ts',
  'src/services/npc/SetNPCControl.service.ts',
  'src/services/processing/GetProcessingCommand.service.ts'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Pattern: findBySessionAndOwner({\n  session_id: sessionId,\n  owner: ...,\n  ...additionalFilters\n})
  // Replace with: findBySessionAndOwner(sessionId, ..., {...additionalFilters})
  
  // Match the pattern with additional filters
  const regex1 = /generalRepository\.findBySessionAndOwner\(\{\s*session_id:\s*(\w+),\s*owner:\s*([^,\n]+),\s*([^}]+)\}\)/gs;
  content = content.replace(regex1, (match, sessionId, owner, additionalFilters) => {
    const cleanedFilters = additionalFilters.trim().replace(/,\s*$/, '');
    return `generalRepository.findBySessionAndOwner(${sessionId}, ${owner}, { ${cleanedFilters} })`;
  });
  
  // Match the pattern without additional filters
  const regex2 = /generalRepository\.findBySessionAndOwner\(\{\s*session_id:\s*(\w+),\s*owner:\s*([^\}]+)\s*\}\)/gs;
  content = content.replace(regex2, (match, sessionId, owner) => {
    const cleanedOwner = owner.trim().replace(/,?\s*$/, '');
    return `generalRepository.findBySessionAndOwner(${sessionId}, ${cleanedOwner})`;
  });
  
  fs.writeFileSync(file, content);
  console.log(`✅ Fixed ${file}`);
});

console.log('\n✨ All findBySessionAndOwner calls fixed!');
