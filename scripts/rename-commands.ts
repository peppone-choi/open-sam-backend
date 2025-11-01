import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * 커맨드 파일 일괄 리네임 스크립트
 * 
 * git mv를 사용하여 파일 히스토리를 보존하면서 이름을 변경합니다.
 */

const commandsDir = path.join(__dirname, '../src/commands/general');
const mapPath = path.join(__dirname, 'command-rename-map.json');

interface RenameResult {
  success: string[];
  failed: { file: string; error: string }[];
  skipped: string[];
}

function renameCommands(): RenameResult {
  // 매핑 파일 로드
  if (!fs.existsSync(mapPath)) {
    console.error(`❌ 매핑 파일을 찾을 수 없습니다: ${mapPath}`);
    process.exit(1);
  }

  const mapping = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

  const result: RenameResult = {
    success: [],
    failed: [],
    skipped: []
  };

  console.log('🔄 커맨드 파일 리네임 시작...\n');

  // 충돌 검사
  const targetFiles = new Set<string>();
  for (const [oldName, newName] of Object.entries(mapping)) {
    if (targetFiles.has(newName as string)) {
      console.error(`❌ 중복된 타겟 파일명: ${newName}`);
      process.exit(1);
    }
    targetFiles.add(newName as string);
  }

  // 파일 리네임 실행
  for (const [oldName, newName] of Object.entries(mapping)) {
    const oldPath = path.join(commandsDir, oldName);
    const newPath = path.join(commandsDir, newName as string);

    // 파일 존재 확인
    if (!fs.existsSync(oldPath)) {
      result.skipped.push(oldName);
      console.log(`⏭️  ${oldName} - 파일이 존재하지 않음`);
      continue;
    }

    // 이미 새 이름으로 존재하는 경우
    if (fs.existsSync(newPath) && oldPath !== newPath) {
      result.failed.push({ 
        file: oldName, 
        error: `타겟 파일이 이미 존재함: ${newName}` 
      });
      console.log(`❌ ${oldName} - 타겟 파일이 이미 존재함`);
      continue;
    }

    // 동일한 이름이면 스킵
    if (oldName === newName) {
      result.skipped.push(oldName);
      console.log(`⏭️  ${oldName} - 이미 올바른 이름`);
      continue;
    }

    try {
      // git mv 실행 (히스토리 보존)
      execSync(`git mv "${oldPath}" "${newPath}"`, {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      result.success.push(`${oldName} → ${newName}`);
      console.log(`✅ ${oldName} → ${newName}`);
    } catch (error: any) {
      // git mv 실패 시 일반 rename 시도
      try {
        fs.renameSync(oldPath, newPath);
        result.success.push(`${oldName} → ${newName} (without git)`);
        console.log(`⚠️  ${oldName} → ${newName} (git 없이 이동)`);
      } catch (renameError: any) {
        result.failed.push({ 
          file: oldName, 
          error: renameError.message 
        });
        console.log(`❌ ${oldName} - 실패: ${renameError.message}`);
      }
    }
  }

  return result;
}

// 실행
const result = renameCommands();

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 리네임 결과:');
console.log(`   ✅ 성공: ${result.success.length}개`);
console.log(`   ❌ 실패: ${result.failed.length}개`);
console.log(`   ⏭️  스킵: ${result.skipped.length}개`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (result.failed.length > 0) {
  console.log('❌ 실패한 파일:');
  result.failed.forEach(({ file, error }) => {
    console.log(`   - ${file}: ${error}`);
  });
  console.log('');
}

if (result.success.length > 0) {
  console.log('✅ 다음 단계: import 경로 업데이트');
  console.log('   npx ts-node scripts/update-imports.ts\n');
}
