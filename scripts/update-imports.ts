import { Project } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

/**
 * import 경로 자동 업데이트 스크립트
 * 
 * ts-morph를 사용하여 리네임된 커맨드 파일의 import 경로를 자동으로 수정합니다.
 */

const mapPath = path.join(__dirname, 'command-rename-map.json');

function updateImports() {
  // 매핑 파일 로드
  if (!fs.existsSync(mapPath)) {
    console.error(`❌ 매핑 파일을 찾을 수 없습니다: ${mapPath}`);
    process.exit(1);
  }

  const mapping: Record<string, string> = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

  // 파일명만 추출 (확장자 제거)
  const nameMapping: Record<string, string> = {};
  for (const [oldName, newName] of Object.entries(mapping)) {
    const oldBaseName = oldName.replace('.ts', '');
    const newBaseName = newName.replace('.ts', '');
    nameMapping[oldBaseName] = newBaseName;
  }

  console.log('🔄 Import 경로 업데이트 시작...\n');
  console.log(`📊 매핑된 파일: ${Object.keys(nameMapping).length}개\n`);

  // ts-morph 프로젝트 로드
  const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json')
  });

  let updatedCount = 0;
  let fileCount = 0;

  // 모든 소스 파일 순회
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    
    // node_modules, dist 제외
    if (filePath.includes('node_modules') || filePath.includes('/dist/')) {
      continue;
    }

    let fileUpdated = false;

    // ImportDeclaration 처리
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // 변경이 필요한지 확인
      let newSpecifier = moduleSpecifier;
      let updated = false;

      for (const [oldBaseName, newBaseName] of Object.entries(nameMapping)) {
        // che_단련, cr_등용 등의 패턴 매칭
        if (moduleSpecifier.includes(oldBaseName)) {
          newSpecifier = newSpecifier.replace(oldBaseName, newBaseName);
          updated = true;
        }
      }

      if (updated) {
        importDecl.setModuleSpecifier(newSpecifier);
        updatedCount++;
        fileUpdated = true;
        console.log(`  📝 ${path.relative(process.cwd(), filePath)}`);
        console.log(`     ${moduleSpecifier} → ${newSpecifier}`);
      }
    }

    // ExportDeclaration 처리
    for (const exportDecl of sourceFile.getExportDeclarations()) {
      const moduleSpecifier = exportDecl.getModuleSpecifierValue();
      if (!moduleSpecifier) continue;

      let newSpecifier = moduleSpecifier;
      let updated = false;

      for (const [oldBaseName, newBaseName] of Object.entries(nameMapping)) {
        if (moduleSpecifier.includes(oldBaseName)) {
          newSpecifier = newSpecifier.replace(oldBaseName, newBaseName);
          updated = true;
        }
      }

      if (updated) {
        exportDecl.setModuleSpecifier(newSpecifier);
        updatedCount++;
        fileUpdated = true;
        console.log(`  📝 ${path.relative(process.cwd(), filePath)}`);
        console.log(`     ${moduleSpecifier} → ${newSpecifier}`);
      }
    }

    if (fileUpdated) {
      fileCount++;
    }
  }

  // 변경사항 저장
  project.saveSync();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Import 업데이트 결과:');
  console.log(`   📝 수정된 파일: ${fileCount}개`);
  console.log(`   🔗 업데이트된 import/export: ${updatedCount}개`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (updatedCount > 0) {
    console.log('✅ 다음 단계: 빌드 및 검증');
    console.log('   npm run build');
    console.log('   npm run typecheck\n');
  }
}

updateImports();
