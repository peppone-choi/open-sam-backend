import * as fs from 'fs';
import * as path from 'path';

/**
 * 커맨드 클래스명 변경 스크립트
 * 
 * che_단련 → TrainCommand
 * che_등용 → RecruitCommand
 * 등의 형태로 클래스명을 영문화합니다.
 */

const classNameMap: Record<string, string> = {
  // 내정
  'che_농지개간': 'CultivateFarmCommand',
  'che_상업투자': 'InvestCommerceCommand',
  'che_기술연구': 'ResearchTechCommand',
  'che_성벽보수': 'RepairWallCommand',
  'che_수비강화': 'ReinforceDefenseCommand',
  'che_물자조달': 'ProcureSupplyCommand',
  'che_군량매매': 'TradeMilitaryCommand',
  'che_사기진작': 'BoostMoraleCommand',
  'che_치안강화': 'ReinforceSecurityCommand',
  'che_정착장려': 'EncourageSettlementCommand',
  'che_주민선정': 'SelectCitizenCommand',
  
  // 훈련
  'che_단련': 'TrainCommand',
  'che_훈련': 'TrainTroopsCommand',
  'cr_맹훈련': 'IntensiveTrainingCommand',
  'che_요양': 'HealCommand',
  'che_숙련전환': 'ConvertExpCommand',
  'che_내정특기초기화': 'ResetAdminSkillCommand',
  'che_전투특기초기화': 'ResetBattleSkillCommand',
  
  // 인사
  'che_등용': 'RecruitCommand',
  'che_등용수락': 'AcceptRecruitCommand',
  'che_인재탐색': 'SearchTalentCommand',
  'che_임관': 'JoinNationCommand',
  'che_랜덤임관': 'RandomJoinNationCommand',
  'che_장수대상임관': 'RecruitGeneralCommand',
  'che_은퇴': 'RetireCommand',
  
  // 이동
  'che_이동': 'MoveCommand',
  'che_귀환': 'ReturnCommand',
  'che_접경귀환': 'BorderReturnCommand',
  'che_견문': 'TravelCommand',
  'che_방랑': 'WanderCommand',
  
  // 군사
  'che_모병': 'RecruitSoldiersCommand',
  'che_징병': 'ConscriptCommand',
  'che_출병': 'DeployCommand',
  'che_소집해제': 'DismissCommand',
  'che_집합': 'GatherCommand',
  'che_해산': 'DisbandCommand',
  'che_전투태세': 'BattleStanceCommand',
  
  // 전투
  'che_거병': 'RaiseArmyCommand',
  'che_강행': 'ForceMarchCommand',
  'che_화계': 'FireAttackCommand',
  'che_파괴': 'DestroyCommand',
  'che_탈취': 'PlunderCommand',
  'che_첩보': 'SpyCommand',
  
  // 국가
  'che_건국': 'FoundNationCommand',
  'che_무작위건국': 'RandomFoundNationCommand',
  'cr_건국': 'CrFoundNationCommand',
  'che_선양': 'AbdicateCommand',
  'che_하야': 'StepDownCommand',
  'che_모반시도': 'AttemptRebellionCommand',
  'che_선동': 'InciteCommand',
  
  // 물자
  'che_증여': 'GrantCommand',
  'che_헌납': 'DonateCommand',
  'che_장비매매': 'TradeEquipmentCommand',
  
  // NPC
  'che_NPC능동': 'NpcAutoCommand',
  
  // 휴식
  '휴식': 'RestCommand',
};

function renameClassNames() {
  const srcDir = path.join(__dirname, '../src');
  
  console.log('🔄 클래스명 변경 시작...\n');
  
  let changedFiles = 0;
  let totalReplacements = 0;

  // src 디렉토리 전체 순회
  function processDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.includes('node_modules')) {
        processDirectory(filePath);
      } else if (file.endsWith('.ts')) {
        processFile(filePath);
      }
    }
  }

  function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;
    let fileChanged = false;
    let fileReplacements = 0;

    // 각 클래스명 변경
    for (const [oldName, newName] of Object.entries(classNameMap)) {
      // export class che_단련 → export class TrainCommand
      const classDefRegex = new RegExp(`export\\s+class\\s+${escapeRegex(oldName)}\\b`, 'g');
      if (classDefRegex.test(content)) {
        content = content.replace(classDefRegex, `export class ${newName}`);
        fileReplacements++;
        fileChanged = true;
      }

      // extends che_단련 → extends TrainCommand
      const extendsRegex = new RegExp(`extends\\s+${escapeRegex(oldName)}\\b`, 'g');
      if (extendsRegex.test(content)) {
        content = content.replace(extendsRegex, `extends ${newName}`);
        fileReplacements++;
        fileChanged = true;
      }

      // new che_단련() → new TrainCommand()
      const newRegex = new RegExp(`new\\s+${escapeRegex(oldName)}\\s*\\(`, 'g');
      if (newRegex.test(content)) {
        content = content.replace(newRegex, `new ${newName}(`);
        fileReplacements++;
        fileChanged = true;
      }

      // che_단련.staticMethod → TrainCommand.staticMethod
      const staticRegex = new RegExp(`${escapeRegex(oldName)}\\.`, 'g');
      if (staticRegex.test(content)) {
        content = content.replace(staticRegex, `${newName}.`);
        fileReplacements++;
        fileChanged = true;
      }
    }

    if (fileChanged) {
      fs.writeFileSync(filePath, content, 'utf-8');
      changedFiles++;
      totalReplacements += fileReplacements;
      console.log(`✅ ${path.relative(process.cwd(), filePath)} (${fileReplacements}개 변경)`);
    }
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  processDirectory(srcDir);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 클래스명 변경 결과:');
  console.log(`   ✅ 변경된 파일: ${changedFiles}개`);
  console.log(`   🔄 총 변경 횟수: ${totalReplacements}회`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

renameClassNames();
