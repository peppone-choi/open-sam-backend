/**
 * Training 커맨드 일괄 생성
 */

import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(__dirname, '../commands/logh/strategic');

const trainingCommands = [
  {
    id: 'space_training',
    name: '항주 훈련',
    nameJa: '航宙訓練',
    description: '부대 항주 훈련도 증가',
    field: 'space',
  },
  {
    id: 'ground_training',
    name: '육전 훈련',
    nameJa: '陸戦訓練',
    description: '육전 훈련도 증가',
    field: 'ground',
  },
  {
    id: 'air_training',
    name: '공전 훈련',
    nameJa: '空戦訓練',
    description: '공전 훈련도 증가',
    field: 'air',
  },
];

function toPascalCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function generateTrainingCommand(cmd: any): string {
  const className = `${toPascalCase(cmd.id)}Command`;

  return `/**
 * ${cmd.name} (${cmd.nameJa})
 * ${cmd.description}
 */

import { BaseLoghCommand, ILoghCommandContext } from '../BaseLoghCommand';
import { IConstraint, ConstraintHelper } from '../../../constraints/ConstraintHelper';
import { Fleet } from '../../../models/logh/Fleet.model';

export class ${className} extends BaseLoghCommand {
  getName(): string {
    return '${cmd.id}';
  }

  getDisplayName(): string {
    return '${cmd.name}';
  }

  getDescription(): string {
    return '${cmd.description}';
  }

  getCategory(): 'fleet' | 'tactical' | 'strategic' | 'diplomatic' | 'admin' {
    return 'fleet';
  }

  getRequiredCommandPoints(): number {
    return 80;
  }

  getRequiredTurns(): number {
    return 0; // 즉시 실행
  }

  getCPType(): 'PCP' | 'MCP' {
    return 'MCP';
  }

  getConstraints(): IConstraint[] {
    return [
      ConstraintHelper.Custom(
        (input: ILoghCommandContext) => input.commander.getFleetId() !== null,
        '함대를 보유하지 않았습니다.'
      ),
    ];
  }

  async execute(context: ILoghCommandContext): Promise<{
    success: boolean;
    message: string;
    effects?: any[];
  }> {
    const { commander } = context;

    const fleetId = commander.getFleetId();
    if (!fleetId) {
      return {
        success: false,
        message: '함대를 보유하지 않았습니다.',
      };
    }

    const fleet = await Fleet.findOne({
      session_id: commander.session_id,
      fleetId,
    });

    if (!fleet) {
      return {
        success: false,
        message: '함대를 찾을 수 없습니다.',
      };
    }

    // 이미 최대치인지 확인
    if (fleet.training.${cmd.field} >= 100) {
      return {
        success: false,
        message: '${cmd.name}도가 이미 최대치입니다.',
      };
    }

    // CP 소모
    commander.consumeCommandPoints(this.getRequiredCommandPoints());

    // 훈련도 증가 (5~10 랜덤)
    const increase = Math.floor(Math.random() * 6) + 5;
    const beforeTraining = fleet.training.${cmd.field};
    fleet.training.${cmd.field} = Math.min(100, fleet.training.${cmd.field} + increase);

    fleet.markModified('training');
    await fleet.save();
    await commander.save();

    return {
      success: true,
      message: \`${cmd.name}을 실시했습니다. ${cmd.name}도 \${beforeTraining} → \${fleet.training.${cmd.field}}\`,
      effects: [
        {
          type: 'training_improved',
          trainingType: '${cmd.field}',
          before: beforeTraining,
          after: fleet.training.${cmd.field},
          increase,
        },
      ],
    };
  }
}
`;
}

async function main() {
  console.log('📖 Generating training commands...\n');

  for (const cmd of trainingCommands) {
    const fileName = `${toPascalCase(cmd.id)}.ts`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    const code = generateTrainingCommand(cmd);
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log(`  ✅ ${fileName}`);
  }

  console.log(`\n✅ Generated ${trainingCommands.length} training commands\n`);
}

main().catch(console.error);
