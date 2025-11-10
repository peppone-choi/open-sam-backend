/**
 * Complete Commands Table 기반 커맨드 생성
 */

import fs from 'fs';
import path from 'path';

const COMPLETE_TABLE_PATH = path.join(__dirname, '../../config/scenarios/legend-of-galactic-heroes/data/complete-commands-table.json');
const OUTPUT_DIR = path.join(__dirname, '../commands/logh/strategic');

interface CompleteCommand {
  id: string;
  name: string;
  nameJa: string;
  cpCost: number;
  waitTime: number;
  executionTime: number | string;
  description: string;
  restrictions?: string;
}

function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function determineCPType(commandId: string): 'PCP' | 'MCP' {
  // 정치/인사/외교 관련은 PCP, 나머지는 MCP
  const pcpKeywords = ['promotion', 'demotion', 'appointment', 'dismissal', 'speech', 'diplomacy', 
                       'national_goal', 'governance', 'tax', 'tariff', 'decoration', 'peerage', 
                       'conference', 'meeting', 'talk', 'soiree'];
  
  for (const keyword of pcpKeywords) {
    if (commandId.includes(keyword)) {
      return 'PCP';
    }
  }
  return 'MCP';
}

function determineCategory(commandId: string): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
  if (commandId.includes('warp') || commandId.includes('fuel') || commandId.includes('training') || 
      commandId.includes('discipline') || commandId.includes('ground_forces')) {
    return 'fleet';
  }
  if (commandId.includes('promotion') || commandId.includes('appointment') || commandId.includes('dismissal') ||
      commandId.includes('peerage') || commandId.includes('decoration')) {
    return 'admin';
  }
  if (commandId.includes('diplomacy') || commandId.includes('speech') || commandId.includes('conference')) {
    return 'diplomatic';
  }
  if (commandId.includes('operation') || commandId.includes('surveillance') || commandId.includes('arrest')) {
    return 'strategic';
  }
  return 'strategic';
}

function generateCommand(command: CompleteCommand): string {
  const className = `${toPascalCase(command.id)}Command`;
  const cpType = determineCPType(command.id);
  const category = determineCategory(command.id);
  
  let requiredTurns = 0;
  if (typeof command.executionTime === 'number') {
    requiredTurns = command.executionTime;
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
    return '${cpType}';
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

async function main() {
  console.log('📖 Reading complete-commands-table.json...\n');
  
  const data = JSON.parse(fs.readFileSync(COMPLETE_TABLE_PATH, 'utf-8'));
  
  let generatedCount = 0;
  let skippedCount = 0;

  // 모든 카테고리를 순회
  for (const categoryKey of Object.keys(data.commandCategories || {})) {
    const category = data.commandCategories[categoryKey];
    
    if (!category.commands) continue;

    for (const command of category.commands) {
      const fileName = `${toPascalCase(command.id)}.ts`;
      const filePath = path.join(OUTPUT_DIR, fileName);

      // 이미 존재하면 스킵
      if (fs.existsSync(filePath)) {
        skippedCount++;
        continue;
      }

      const code = generateCommand(command);
      fs.writeFileSync(filePath, code, 'utf-8');
      console.log(`  ✅ ${fileName}`);
      generatedCount++;
    }
  }

  // index.ts 재생성
  console.log('\n📝 Regenerating index.ts...');
  const allFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts')
    .sort();

  let indexContent = '// Strategic Commands\n';
  for (const file of allFiles) {
    const className = file.replace('.ts', '');
    indexContent += `export { ${className}Command } from './${className}';\n`;
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent);

  console.log(`\n✅ Generated: ${generatedCount} commands`);
  console.log(`⏭️  Skipped: ${skippedCount} commands (already exist)`);
  console.log(`📊 Total: ${allFiles.length} commands in strategic/\n`);
  console.log('🎉 Done!\n');
}

main().catch(console.error);
