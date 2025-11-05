import fs from 'fs';
import path from 'path';

/**
 * 레거시 형식 병종을 새 형식으로 변환
 * 1100, 1200, 1300, 1500을 새 구조에 맞게 변환
 */

const unitsPath = './config/scenarios/sangokushi/data/units.json';
const unitsData = JSON.parse(fs.readFileSync(unitsPath, 'utf-8'));
const units = unitsData.units || {};

console.log('=== 레거시 형식 병종 변환 ===\n');

// 레거시 형식 병종 변환 규칙
const legacyConversions = {
  // 1100: 보병 (기본 보병)
  1100: {
    type: 'FOOTMAN',
    cost: { gold: 100, rice: 150 },
    stats: {
      tech: 9,
      offense: 15,
      magic: 0,
      attackRange: 9,
      defenseRange: 9
    },
    attacks: {
      ARCHER: 1.2,
      CAVALRY: 0.8,
      SIEGE: 1
    },
    defenses: {
      ARCHER: 0.8,
      CAVALRY: 1.2,
      SIEGE: 0.8
    },
    description: [
      '기본적인 보병 병종입니다. 전열을 유지하고 적의 공격을 막아냅니다.',
      '균형 잡힌 능력치를 가지고 있습니다.'
    ],
    constraints: []
  },
  
  // 1200: 궁병 (기본 궁병)
  1200: {
    type: 'ARCHER',
    cost: { gold: 100, rice: 100 },
    stats: {
      tech: 10,
      offense: 10,
      magic: 0,
      attackRange: 150,
      defenseRange: 7
    },
    attacks: {
      FOOTMAN: 1.2,
      CAVALRY: 1,
      SIEGE: 0.6
    },
    defenses: {
      FOOTMAN: 1.1,
      CAVALRY: 1,
      SIEGE: 1.4
    },
    description: [
      '기본적인 궁병 병종입니다. 원거리에서 적을 공격합니다.',
      '근접전에는 취약하므로 보호가 필요합니다.'
    ],
    constraints: []
  },
  
  // 1300: 기병 (기본 기병)
  1300: {
    type: 'CAVALRY',
    cost: { gold: 150, rice: 100 },
    stats: {
      tech: 11,
      offense: 10,
      magic: 0,
      attackRange: 7,
      defenseRange: 8
    },
    attacks: {
      ARCHER: 1.5,
      SIEGE: 1.3,
      FOOTMAN: 1.1,
      SPEARMAN: 0.5
    },
    defenses: {
      ARCHER: 0.8,
      SIEGE: 0.9,
      FOOTMAN: 0.9,
      SPEARMAN: 2
    },
    description: [
      '기본적인 기병 병종입니다. 빠른 기동력과 강력한 돌격력을 가집니다.',
      '창병에게 돌격 피해를 반사당하므로 주의가 필요합니다.'
    ],
    constraints: []
  },
  
  // 1500: 정란 (공성 병기)
  1500: {
    type: 'SIEGE',
    cost: { gold: 100, rice: 100 },
    stats: {
      tech: 14,
      offense: 20,
      magic: 0,
      attackRange: 200,
      defenseRange: 5
    },
    attacks: {
      CASTLE: 2,
      FOOTMAN: 1.5,
      ARCHER: 1.5,
      CAVALRY: 0.5
    },
    defenses: {
      CASTLE: 0.5,
      FOOTMAN: 0.8,
      ARCHER: 0.8,
      CAVALRY: 2
    },
    description: [
      '기본적인 공성 병기입니다. 멀리서 성벽과 적 부대를 공격합니다.',
      '매우 느리고 근접전에 취약하며 기병에게 쉽게 무력화됩니다.'
    ],
    constraints: []
  }
};

let fixedCount = 0;

for (const [id, unit] of Object.entries(units)) {
  const unitId = parseInt(id);
  
  // 레거시 형식 감지: cost가 숫자이거나 stats가 없음
  const conversion = legacyConversions[unitId];
  if (conversion) {
    console.log(`변환 중: ID ${id} (${unit.name})`);
    
    // 기존 데이터 보존 (가능한 경우)
    const existingName = unit.name || conversion.name;
    const existingDescription = Array.isArray(unit.description) ? unit.description : conversion.description;
    
    // 새 형식으로 변환
    units[id] = {
      id: unitId,
      type: conversion.type,
      name: existingName,
      cost: conversion.cost,
      stats: conversion.stats,
      attacks: conversion.attacks,
      defenses: conversion.defenses,
      description: existingDescription,
      constraints: conversion.constraints
    };
    
    fixedCount++;
  }
}

// 결과 저장
unitsData.units = units;
fs.writeFileSync(unitsPath, JSON.stringify(unitsData, null, 2), 'utf-8');

console.log(`\n✅ ${fixedCount}개 병종 변환 완료`);
console.log(`📁 저장 위치: ${unitsPath}\n`);

// 검증
console.log('=== 변환 후 검증 ===');
const requiredFields = ['id', 'type', 'name', 'cost', 'stats'];
let validationErrors = 0;

for (const [id, unit] of Object.entries(units)) {
  for (const field of requiredFields) {
    if (!(field in unit)) {
      console.log(`❌ ID ${id}: 필수 필드 '${field}' 누락`);
      validationErrors++;
    }
  }
  
  if (unit.cost && typeof unit.cost === 'number') {
    console.log(`❌ ID ${id}: cost가 아직 숫자입니다`);
    validationErrors++;
  }
  
  if (!unit.stats) {
    console.log(`❌ ID ${id}: stats 누락`);
    validationErrors++;
  }
}

if (validationErrors === 0) {
  console.log('✅ 모든 병종이 올바른 형식입니다.\n');
} else {
  console.log(`⚠️  ${validationErrors}개의 문제가 남아있습니다.\n`);
}

