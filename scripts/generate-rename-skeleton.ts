import * as fs from 'fs';
import * as path from 'path';

/**
 * 커맨드 파일 리네임 매핑 스켈레톤 생성 스크립트
 * 
 * che_/cr_ 접두사를 제거한 기본 매핑을 생성합니다.
 * 실제 영문 이름은 수동으로 검수하여 입력해야 합니다.
 */

const commandsDir = path.join(__dirname, '../src/commands/general');
const outputPath = path.join(__dirname, 'command-rename-map.json');

// 한글 → 영어 매핑 (일반적인 커맨드명)
const translationMap: Record<string, string> = {
  '단련': 'train',
  '등용': 'recruit',
  '등용수락': 'acceptRecruit',
  '모병': 'recruitSoldiers',
  '이동': 'move',
  '귀환': 'return',
  '요양': 'heal',
  '거병': 'raiseArmy',
  '건국': 'foundNation',
  '무작위건국': 'randomFoundNation',
  '견문': 'travel',
  '방랑': 'wander',
  '랜덤임관': 'randomJoinNation',
  '은퇴': 'retire',
  '농지개간': 'cultivateFarm',
  '상업투자': 'investCommerce',
  '기술연구': 'researchTech',
  '성벽보수': 'repairWall',
  '수비강화': 'reinforceDefense',
  '물자조달': 'procureSupply',
  '군량매매': 'tradeMilitary',
  '사기진작': 'boostMorale',
  '선동': 'incite',
  '선양': 'abdicate',
  '모반시도': 'attemptRebellion',
  '강행': 'forceMarch',
  '소집해제': 'dismiss',
  '숙련전환': 'convertExp',
  '내정특기초기화': 'resetAdminSkill',
  'NPC능동': 'npcAuto',
};

function generateMapping() {
  if (!fs.existsSync(commandsDir)) {
    console.error(`디렉토리를 찾을 수 없습니다: ${commandsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(commandsDir)
    .filter(f => f.endsWith('.ts') && (f.startsWith('che_') || f.startsWith('cr_')));

  const mapping: Record<string, string> = {};

  files.forEach(file => {
    // che_/cr_ 접두사 제거
    let baseName = file;
    if (baseName.startsWith('che_')) {
      baseName = baseName.slice(4);
    } else if (baseName.startsWith('cr_')) {
      baseName = baseName.slice(3);
    }

    // .ts 제거
    const nameWithoutExt = baseName.replace('.ts', '');

    // 매핑에서 영문명 찾기
    let englishName = translationMap[nameWithoutExt];
    
    if (!englishName) {
      // 매핑에 없으면 TODO로 표시
      englishName = `TODO_${nameWithoutExt}`;
      console.warn(`⚠️  수동 검수 필요: ${file} → ${englishName}.ts`);
    }

    mapping[file] = `${englishName}.ts`;
  });

  // JSON 파일로 저장
  fs.writeFileSync(
    outputPath,
    JSON.stringify(mapping, null, 2),
    'utf-8'
  );

  console.log(`\n✅ 매핑 파일 생성 완료: ${outputPath}`);
  console.log(`📊 총 ${Object.keys(mapping).length}개 파일`);
  console.log(`\n⚠️  'TODO_'로 시작하는 항목은 수동으로 영문명을 입력해주세요.\n`);
}

generateMapping();
