#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { AutoBattleService } from '../src/services/battle/AutoBattle.service';
import type { BattleConfig } from '../src/battle/types';

function printUsage() {
  console.log('Usage: pnpm ts-node scripts/run-auto-battle.ts <config.json>');
}

async function main() {
  const [, , configPath] = process.argv;
  if (!configPath) {
    printUsage();
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error('Config file not found:', resolvedPath);
    process.exit(1);
  }

  const configRaw = fs.readFileSync(resolvedPath, 'utf-8');
  const config = JSON.parse(configRaw) as BattleConfig;

  const result = AutoBattleService.simulate(config);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
