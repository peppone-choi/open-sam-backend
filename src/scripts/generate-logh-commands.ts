/**
 * LOGH 커맨드 자동 생성 스크립트
 * commands.json을 읽어서 모든 커맨드 클래스를 생성합니다.
 */

import fs from 'fs';
import path from 'path';

const COMMANDS_JSON_PATH = path.join(__dirname, '../../config/scenarios/legend-of-galactic-heroes/data/commands.json');
const OUTPUT_DIR = path.join(__dirname, '../commands/logh');

interface Command {
  id: string;
  name: string;
  nameEn: string;
  nameJa: string;
  cpType: 'PCP' | 'MCP';
  cpCost: number;
  description: string;
  descriptionJa?: string;
  executionDelay: number | string;
  executionDuration: number | string;
  restrictions?: string;
}

interface CommandGroup {
  id: string;
  name: string;
  nameEn: string;
  commands: Command[];
}

interface CommandsData {
  commandGroups: CommandGroup[];
}

// 카테고리 매핑
const categoryMap: Record<string, 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin'> = {
  operation: 'fleet',
  personal: 'admin',
  command: 'strategic',
  logistics: 'fleet',
  personnel: 'admin',
  political: 'diplomatic',
  intelligence: 'strategic',
};

// 파스칼 케이스 변환
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// 커맨드 클래스 템플릿 생성
function generateCommandClass(command: Command, groupId: string): string {
  const className = `${toPascalCase(command.id)}Command`;
  const category = categoryMap[groupId] || 'strategic';
  
  // executionDuration을 밀리초로 변환 (게임시간 → 실시간)
  // 1 게임시간 = 실시간 2.5초 (24배속)
  let durationMs = 0;
  if (typeof command.executionDuration === 'number') {
    durationMs = command.executionDuration * 2500; // 게임시간 → 밀리초
  }

  const requiredTurns = typeof command.executionDuration === 'number' ? command.executionDuration : 0;

  return `/**
 * ${command.name} (${command.nameEn})
 * ${command.description}
 */

import { BaseLoghCommand, ILoghCommandContext } from './BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../constraints/ConstraintHelper';

export class ${className} extends BaseLoghCommand {
  getName(): string {
    return '${command.id}';
  }

  getDisplayName(): string {
    return '${command.name}';
  }

  getDescription(): string {
    return '${command.description}';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return '${category}';
  }

  getRequiredCommandPoints(): number {
    return ${command.cpCost};
  }

  getRequiredTurns(): number {
    return ${requiredTurns};
  }

  getCPType(): 'PCP' | 'MCP' {
    return '${command.cpType}';
  }

  getConstraints(): IConstraint[] {
    const constraints: IConstraint[] = [];

    ${command.restrictions ? `
    // 제약 조건: ${command.restrictions}
    constraints.push(
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => {
          // FUTURE: 구체적인 제약 조건 구현
          return true;
        },
        '${command.restrictions}'
      )
    );
    ` : '// 추가 제약 조건 없음'}

    return constraints;
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander, env } = context;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // FUTURE: 커맨드별 구체적인 실행 로직 구현
    // 현재는 기본 구현만 제공

    await commander.save();

    return {
      success: true,
      message: \`\${this.getDisplayName()}을(를) 실행했습니다.\`,
      effects: [
        {
          type: 'command_executed',
          commandType: this.getName(),
          cpCost: this.getRequiredCommandPoints(),
        },
      ],
    };
  }

  async onTurnEnd(context: ILoghCommandContext): Promise<void> {
    // FUTURE: 턴 종료 시 처리 로직 (필요한 경우)
  }
}
`;
}

async function main() {
  console.log('📖 Reading commands.json...');
  
  const commandsData: CommandsData = JSON.parse(
    fs.readFileSync(COMMANDS_JSON_PATH, 'utf-8')
  );

  let totalCommands = 0;
  const generatedFiles: string[] = [];

  for (const group of commandsData.commandGroups) {
    console.log(`\n📂 Processing group: ${group.name} (${group.commands.length} commands)`);

    for (const command of group.commands) {
      const className = `${toPascalCase(command.id)}Command`;
      const fileName = `${toPascalCase(command.id)}.ts`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      // 이미 존재하는 파일은 건너뛰기 (수동 구현된 커맨드 보호)
      if (fs.existsSync(filePath)) {
        console.log(`  ⏭️  Skipped (already exists): ${fileName}`);
        continue;
      }

      const classCode = generateCommandClass(command, group.id);
      fs.writeFileSync(filePath, classCode, 'utf-8');

      console.log(`  ✅ Generated: ${fileName}`);
      generatedFiles.push(fileName);
      totalCommands++;
    }
  }

  // index.ts 업데이트
  console.log('\n📝 Updating index.ts...');
  const indexPath = path.join(OUTPUT_DIR, 'index.ts');
  
  let indexContent = `/**
 * LOGH Commands Export
 * Auto-generated file - DO NOT EDIT MANUALLY
 */

export { BaseLoghCommand, ILoghCommandContext, ILoghCommandExecutor } from './BaseLoghCommand';
`;

  // 모든 .ts 파일 찾기
  const allFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'BaseLoghCommand.ts')
    .sort();

  for (const file of allFiles) {
    const className = file.replace('.ts', '');
    indexContent += `export { ${className}Command } from './${className}';\n`;
  }

  fs.writeFileSync(indexPath, indexContent, 'utf-8');

  console.log(`\n✅ Generated ${totalCommands} new commands!`);
  console.log(`📄 Total commands in index.ts: ${allFiles.length}`);
  console.log('\n🎉 Done!\n');
}

main().catch(console.error);
