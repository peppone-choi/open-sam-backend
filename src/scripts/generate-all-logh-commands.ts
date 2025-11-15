/**
 * LOGH 전체 커맨드 자동 생성 스크립트
 * 전략 커맨드 + 전술 커맨드 모두 생성
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../../config/scenarios/legend-of-galactic-heroes/data');
const STRATEGIC_OUTPUT_DIR = path.join(__dirname, '../commands/logh/strategic');
const TACTICAL_OUTPUT_DIR = path.join(__dirname, '../commands/logh/tactical');

// 디렉토리 생성
if (!fs.existsSync(STRATEGIC_OUTPUT_DIR)) {
  fs.mkdirSync(STRATEGIC_OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(TACTICAL_OUTPUT_DIR)) {
  fs.mkdirSync(TACTICAL_OUTPUT_DIR, { recursive: true });
}

interface StrategicCommand {
  id: string;
  name: string;
  nameEn?: string;
  nameJa: string;
  cpType: 'PCP' | 'MCP';
  cpCost: number;
  description: string;
  executionDelay: number | string;
  executionDuration: number | string;
  restrictions?: string;
}

interface TacticalCommand {
  id: string;
  name: string;
  nameJa: string;
  shortcut?: string;
  executionDelay: number;
  executionDuration: number;
  description: string;
  speedPenalty?: number;
  affectedBy?: string;
  requirements?: string[];
}

// 파스칼 케이스 변환
function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// 전략 커맨드 클래스 생성
function generateStrategicCommand(command: StrategicCommand, category: string): string {
  const className = `${toPascalCase(command.id)}Command`;
  
  let requiredTurns = 0;
  if (typeof command.executionDuration === 'number') {
    requiredTurns = command.executionDuration;
  }

  return `/**
 * ${command.name} (${command.nameJa})
 * ${command.description}
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint } from '../../../constraints/ConstraintHelper';

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
    return [];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander } = context;

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());
    await commander.save();

    return {
      success: true,
      message: \`\${this.getDisplayName()}을(를) 실행했습니다.\`,
      effects: [],
    };
  }
}
`;
}

// 전술 커맨드 클래스 생성
function generateTacticalCommand(command: TacticalCommand): string {
  const className = `${toPascalCase(command.id)}TacticalCommand`;

  return `/**
 * [전술] ${command.name} (${command.nameJa})
 * ${command.description}
 */

export class ${className} {
  getName(): string {
    return '${command.id}';
  }

  getDisplayName(): string {
    return '${command.name}';
  }

  getDescription(): string {
    return '${command.description}';
  }

  ${command.shortcut ? `getShortcut(): string {
    return '${command.shortcut}';
  }` : ''}

  getExecutionDelay(): number {
    return ${command.executionDelay};
  }

  getExecutionDuration(): number {
    return ${command.executionDuration};
  }

  ${command.speedPenalty ? `getSpeedPenalty(): number {
    return ${command.speedPenalty};
  }` : ''}

  /**
   * 전술 커맨드 실행 (실시간)
   */
  async execute(fleetId: string, params: any): Promise<{
    success: boolean;
    message: string;
  }> {
    // FUTURE: 전술 커맨드 구현
    return {
      success: true,
      message: \`\${this.getDisplayName()}을(를) 실행했습니다.\`,
    };
  }
}
`;
}

async function main() {
  let strategicTotal = 0;
  let tacticalTotal = 0;

  // 1. 전략 커맨드 생성 (commands.json)
  console.log('📖 Processing strategic commands (commands.json)...\n');
  
  const commandsPath = path.join(DATA_DIR, 'commands.json');
  const commandsData = JSON.parse(fs.readFileSync(commandsPath, 'utf-8'));

  const categoryMap: Record<string, any> = {
    operation: 'fleet',
    personal: 'admin',
    command: 'strategic',
    logistics: 'fleet',
    personnel: 'admin',
    political: 'diplomatic',
    intelligence: 'strategic',
  };

  for (const group of commandsData.commandGroups) {
    const category = categoryMap[group.id] || 'strategic';
    
    for (const command of group.commands) {
      const fileName = `${toPascalCase(command.id)}.ts`;
      const filePath = path.join(STRATEGIC_OUTPUT_DIR, fileName);

      if (fs.existsSync(filePath)) {
        continue;
      }

      const classCode = generateStrategicCommand(command, category);
      fs.writeFileSync(filePath, classCode, 'utf-8');
      console.log(`  ✅ Strategic: ${fileName}`);
      strategicTotal++;
    }
  }

  // 2. 전술 커맨드 생성 (tactical-commands.json)
  console.log('\n📖 Processing tactical commands (tactical-commands.json)...\n');
  
  const tacticalPath = path.join(DATA_DIR, 'tactical-commands.json');
  const tacticalData = JSON.parse(fs.readFileSync(tacticalPath, 'utf-8'));

  // 함선 커맨드
  if (tacticalData.tacticalCommands?.vesselCommands) {
    for (const command of tacticalData.tacticalCommands.vesselCommands) {
      const fileName = `${toPascalCase(command.id)}.ts`;
      const filePath = path.join(TACTICAL_OUTPUT_DIR, fileName);

      if (fs.existsSync(filePath)) {
        continue;
      }

      const classCode = generateTacticalCommand(command);
      fs.writeFileSync(filePath, classCode, 'utf-8');
      console.log(`  ✅ Tactical (Vessel): ${fileName}`);
      tacticalTotal++;
    }
  }

  // 행성/요새 커맨드
  if (tacticalData.tacticalCommands?.planetCommands) {
    for (const command of tacticalData.tacticalCommands.planetCommands) {
      const fileName = `${toPascalCase(command.id)}Planet.ts`;
      const filePath = path.join(TACTICAL_OUTPUT_DIR, fileName);

      if (fs.existsSync(filePath)) {
        continue;
      }

      const classCode = generateTacticalCommand(command);
      fs.writeFileSync(filePath, classCode, 'utf-8');
      console.log(`  ✅ Tactical (Planet): ${fileName}`);
      tacticalTotal++;
    }
  }

  // index.ts 생성
  console.log('\n📝 Generating index files...');

  // Strategic index
  const strategicFiles = fs.readdirSync(STRATEGIC_OUTPUT_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  let strategicIndex = '// Strategic Commands\n';
  for (const file of strategicFiles) {
    const className = file.replace('.ts', '');
    strategicIndex += `export { ${className}Command } from './${className}';\n`;
  }
  fs.writeFileSync(path.join(STRATEGIC_OUTPUT_DIR, 'index.ts'), strategicIndex);

  // Tactical index
  const tacticalFiles = fs.readdirSync(TACTICAL_OUTPUT_DIR).filter(f => f.endsWith('.ts') && f !== 'index.ts');
  let tacticalIndex = '// Tactical Commands\n';
  for (const file of tacticalFiles) {
    const className = file.replace('.ts', '');
    tacticalIndex += `export { ${className} } from './${className}';\n`;
  }
  fs.writeFileSync(path.join(TACTICAL_OUTPUT_DIR, 'index.ts'), tacticalIndex);

  console.log(`\n✅ Generated ${strategicTotal} strategic commands`);
  console.log(`✅ Generated ${tacticalTotal} tactical commands`);
  console.log(`📊 Total: ${strategicTotal + tacticalTotal} commands\n`);
  console.log('🎉 Done!\n');
}

main().catch(console.error);
