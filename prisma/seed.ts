import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ===== 1. CommandType 시드 =====
  await seedCommandTypes();

  // ===== 2. ItemType 시드 =====
  await seedItemTypes();

  // ===== 3. CrewType 시드 =====
  await seedCrewTypes();

  // ===== 4. SpecialAbilityType 시드 =====
  await seedSpecialAbilityTypes();

  console.log('✅ Seeding completed!');
}

async function seedCommandTypes() {
  const commandTypes = [
    {
      id: 'MOVE',
      name: '이동',
      description: '다른 도시로 이동',
      payloadSchema: {
        type: 'object',
        properties: {
          fromCityId: { type: 'string' },
          toCityId: { type: 'string' },
          troops: { type: 'number', minimum: 0 },
        },
        required: ['fromCityId', 'toCityId', 'troops'],
      },
      cooldownSec: 60,
      effectParams: {},
    },
    {
      id: 'RECRUIT',
      name: '징병',
      description: '병력 모집',
      payloadSchema: {
        type: 'object',
        properties: {
          cityId: { type: 'string' },
          crewTypeId: { type: 'string' },
          amount: { type: 'number', minimum: 1 },
        },
        required: ['cityId', 'crewTypeId', 'amount'],
      },
      cooldownSec: 300,
      costFormulaRef: 'RECRUIT_COST',
      effectParams: {},
    },
    {
      id: 'BUILD',
      name: '건설',
      description: '건물 건설',
      payloadSchema: {
        type: 'object',
        properties: {
          cityId: { type: 'string' },
          buildingType: { type: 'string' },
        },
        required: ['cityId', 'buildingType'],
      },
      cooldownSec: 600,
      effectParams: {},
    },
    {
      id: 'TRAIN',
      name: '훈련',
      description: '능력치 훈련',
      payloadSchema: {
        type: 'object',
        properties: {
          generalId: { type: 'string' },
          statType: { type: 'string', enum: ['leadership', 'strength', 'intel', 'politics'] },
          amount: { type: 'number', minimum: 1, maximum: 10 },
        },
        required: ['generalId', 'statType', 'amount'],
      },
      cooldownSec: 120,
      preconditions: { training: { min: 100 } },
      effectParams: {},
    },
  ];

  for (const type of commandTypes) {
    await prisma.commandType.upsert({
      where: { id: type.id },
      update: type,
      create: type,
    });
  }

  console.log(`✓ Seeded ${commandTypes.length} CommandTypes`);
}

async function seedItemTypes() {
  // TODO: PHP 파일에서 추출한 데이터
  // 예시: 명마 (노기~적토)
  const itemTypes = [
    {
      id: 'che_명마_01_노기',
      name: '노기(+1)',
      category: '명마',
      rarity: 'COMMON',
      slot: 'HORSE',
      statType: 'leadership',
      statValue: 1,
      cost: 1000,
      buyable: true,
      consumable: false,
      reqSecu: 1000,
      effectCode: 'ADD_STAT',
      effectParams: {},
      balanceVersion: 1,
      legacyKey: 'che_명마_01_노기',
    },
    {
      id: 'che_명마_10_적토',
      name: '적토(+10)',
      category: '명마',
      rarity: 'LEGENDARY',
      slot: 'HORSE',
      statType: 'leadership',
      statValue: 10,
      cost: 10000,
      buyable: true,
      consumable: false,
      reqSecu: 10000,
      effectCode: 'ADD_STAT',
      effectParams: {},
      balanceVersion: 1,
      legacyKey: 'che_명마_10_적토',
    },
    // TODO: 나머지 161개 아이템 추가
  ];

  for (const type of itemTypes) {
    await prisma.itemType.upsert({
      where: { id: type.id },
      update: type,
      create: type,
    });
  }

  console.log(`✓ Seeded ${itemTypes.length} ItemTypes`);
}

async function seedCrewTypes() {
  const crewTypes = [
    {
      id: 'che_보병',
      name: '보병',
      atk: 10,
      def: 15,
      speed: 5,
      costGold: 10,
      costRice: 5,
      terrainMods: { mountain: 1.2, plain: 1.0, forest: 1.1 },
      counters: { cavalry: 0.8 },
      balanceVersion: 1,
      legacyKey: 'che_보병',
    },
    {
      id: 'che_궁병',
      name: '궁병',
      atk: 15,
      def: 8,
      speed: 7,
      costGold: 12,
      costRice: 6,
      terrainMods: { mountain: 0.9, plain: 1.2, forest: 1.0 },
      counters: { infantry: 1.2 },
      balanceVersion: 1,
      legacyKey: 'che_궁병',
    },
    {
      id: 'che_기병',
      name: '기병',
      atk: 20,
      def: 10,
      speed: 15,
      costGold: 20,
      costRice: 10,
      terrainMods: { mountain: 0.7, plain: 1.5, forest: 0.8 },
      counters: { archer: 1.3 },
      balanceVersion: 1,
      legacyKey: 'che_기병',
    },
    // TODO: 나머지 병종 추가
  ];

  for (const type of crewTypes) {
    await prisma.crewType.upsert({
      where: { id: type.id },
      update: type,
      create: type,
    });
  }

  console.log(`✓ Seeded ${crewTypes.length} CrewTypes`);
}

async function seedSpecialAbilityTypes() {
  const abilityTypes = [
    {
      id: 'che_계략_삼략',
      name: '삼략',
      description: '계략 능력 향상',
      category: 'PASSIVE',
      effectCode: 'BOOST_INTEL',
      effectParams: { intelBoost: 5, strategyBonus: 1.2 },
      tags: ['strategy', 'intel'],
      balanceVersion: 1,
      legacyKey: 'che_계략_삼략',
    },
    {
      id: 'che_공성_묵자',
      name: '묵자',
      description: '공성 능력 향상',
      category: 'ACTIVE',
      effectCode: 'SIEGE_BOOST',
      effectParams: { siegeDamage: 1.5 },
      tags: ['siege', 'attack'],
      balanceVersion: 1,
      legacyKey: 'che_공성_묵자',
    },
    // TODO: 나머지 특수능력 추가
  ];

  for (const type of abilityTypes) {
    await prisma.specialAbilityType.upsert({
      where: { id: type.id },
      update: type,
      create: type,
    });
  }

  console.log(`✓ Seeded ${abilityTypes.length} SpecialAbilityTypes`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
