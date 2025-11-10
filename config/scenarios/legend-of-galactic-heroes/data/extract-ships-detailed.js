/**
 * 함선 상세 스펙 추출기
 * Extract detailed ship specifications from gin7manual.txt
 */

const fs = require('fs');
const path = require('path');

const manualPath = '/mnt/d/opensam/gin7manual.txt';
const lines = fs.readFileSync(manualPath, 'utf-8').split('\n');

const shipData = {
  empire: {
    battleships: [],
    fastBattleships: [],
    cruisers: [],
    destroyers: [],
    carriersTorpedo: [],
    landingShips: [],
    transports: [],
    repairShips: []
  },
  alliance: {
    battleships: [],
    cruisers: [],
    strikeCruisers: [],
    destroyers: [],
    carriersFighter: [],
    landingShips: [],
    transports: [],
    repairShips: []
  }
};

console.log('🚀 함선 상세 스펙 추출 시작...\n');

// ============================================================================
// 제국 함선 추출
// ============================================================================
console.log('🏴 제국군 함선 추출 중...');

// SS75 전함 시리즈 (라인 7524-7690)
shipData.empire.battleships = [
  {
    type: "戦艦 (旗艦)",
    model: "SS75 Flagship",
    variant: "Flagship",
    crew: 390,
    buildTime: "-",
    output: 5,
    armor: { front: 34, side: 20, rear: 12 },
    shield: { protection: 70, capacity: 5600 },
    speed: 20000,
    sensorRange: 110,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 36, cost: 9 },
      missile: { power: 34, cost: 14 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75型標準戦艦 (旗艦型)"
  },
  {
    type: "戦艦Ⅰ",
    model: "SS75",
    variant: "Standard",
    crew: 390,
    buildTime: 90,
    output: 5,
    armor: { front: 34, side: 20, rear: 12 },
    speed: 20000,
    sensorRange: 100,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 36, cost: 9 },
      missile: { power: 34, cost: 14 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75型標準戦艦。強力な中性子ビーム砲とレーザー水爆ミサイル発射システムを主兵装とする宇宙艦隊の主力艦"
  },
  {
    type: "戦艦Ⅱ",
    model: "SS75a",
    variant: "Photon Cannon",
    crew: 390,
    buildTime: 110,
    output: 5,
    armor: { front: 34, side: 20, rear: 12 },
    speed: 21000,
    sensorRange: 100,
    weapons: {
      beam: { power: 31, cost: 30 },
      gun: { power: 0, cost: 0 },
      missile: { power: 34, cost: 14 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75a型戦艦。SS75型標準戦艦の中性子ビーム砲をフェザーン経由で入手した同盟軍仕様の光子砲に換装"
  },
  {
    type: "戦艦Ⅲ",
    model: "SS75b",
    variant: "Close Combat",
    crew: 390,
    buildTime: 100,
    output: 5,
    armor: { front: 38, side: 23, rear: 14 },
    speed: 19000,
    sensorRange: 100,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 44, cost: 11 },
      missile: { power: 0, cost: 0 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75b型戦艦。ミサイル発射システムを除去し、近接戦闘用のレールキャノンを増設"
  },
  {
    type: "戦艦Ⅳ",
    model: "SS75c",
    variant: "Missile",
    crew: 390,
    buildTime: 100,
    output: 5,
    armor: { front: 34, side: 20, rear: 12 },
    speed: 21000,
    sensorRange: 100,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 0, cost: 0 },
      missile: { power: 50, cost: 20 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75c型戦艦。レールガンを除去し、ミサイル発射システムを増設。遠距離でのミサイル戦に特化"
  },
  {
    type: "戦艦Ⅴ",
    model: "SS75d",
    variant: "High Speed",
    crew: 390,
    buildTime: 100,
    output: 5,
    armor: { front: 28, side: 17, rear: 10 },
    speed: 23000,
    sensorRange: 100,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 36, cost: 9 },
      missile: { power: 34, cost: 14 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75d型戦艦。一部装甲を除去し、高速航行可能。PK86型標準高速戦艦が就役するまでは機動遊撃兵力の中核"
  },
  {
    type: "戦艦Ⅵ",
    model: "SS75e",
    variant: "Heavy Armor",
    crew: 390,
    buildTime: 110,
    output: 5,
    armor: { front: 40, side: 24, rear: 14 },
    speed: 18000,
    sensorRange: 100,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 36, cost: 9 },
      missile: { power: 34, cost: 14 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75e型戦艦。複合装甲を増設し、防御力を増加。重量増加に伴って航行性能が若干低下"
  },
  {
    type: "戦艦Ⅶ",
    model: "SS75f",
    variant: "Carrier",
    crew: 390,
    buildTime: 110,
    output: 5,
    armor: { front: 34, side: 20, rear: 12 },
    speed: 20000,
    sensorRange: 100,
    fighters: 24,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 36, cost: 9 },
      missile: { power: 34, cost: 14 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75f型戦艦。戦闘艇\"ワルキューレ\"搭載数を増加。前線部隊では「航空戦艦」と称される"
  },
  {
    type: "戦艦Ⅷ",
    model: "SS75g",
    variant: "Automated",
    crew: 312,
    buildTime: 100,
    output: 5,
    armor: { front: 34, side: 20, rear: 12 },
    speed: 20000,
    sensorRange: 100,
    weapons: {
      beam: { power: 28, cost: 30 },
      gun: { power: 36, cost: 9 },
      missile: { power: 34, cost: 14 },
      antiAir: { power: 17, cost: "-" }
    },
    description: "SS75g型戦艦。各部署を徹底して自動化し、約20%の乗組員を削減"
  }
];

// PK86 고속전함 시리즈
shipData.empire.fastBattleships = [
  {
    type: "高速戦艦Ⅰ",
    model: "PK86",
    variant: "Standard",
    crew: 410,
    buildTime: 120,
    output: 5,
    armor: { front: 23, side: 15, rear: 10 },
    speed: 24000,
    sensorRange: 130,
    weapons: {
      beam: { power: 24, cost: 28 },
      gun: { power: 30, cost: 8 },
      missile: { power: 28, cost: 12 },
      antiAir: { power: 14, cost: "-" }
    },
    description: "PK86型標準高速戦艦。戦艦の打撃力と巡航艦に匹敵する高速航行能力を有する主力艦"
  },
  {
    type: "高速戦艦Ⅱ",
    model: "PK86 Flagship",
    variant: "Flagship",
    crew: 410,
    buildTime: "-",
    output: 5,
    armor: { front: 23, side: 15, rear: 10 },
    shield: { protection: 70, capacity: 5600 },
    speed: 24000,
    sensorRange: 130,
    weapons: {
      beam: { power: 24, cost: 28 },
      gun: { power: 30, cost: 8 },
      missile: { power: 28, cost: 12 },
      antiAir: { power: 14, cost: "-" }
    },
    description: "PK86型標準高速戦艦 (旗艦型)"
  }
];

console.log(`✓ 제국 전함: ${shipData.empire.battleships.length}종`);
console.log(`✓ 제국 고속전함: ${shipData.empire.fastBattleships.length}종`);

// ============================================================================
// 동맹 함선 추출
// ============================================================================
console.log('🔷 동맹군 함선 추출 중...');

// 787年型 전함 시리즈 (라인 8899-9064)
shipData.alliance.battleships = [
  {
    type: "戦艦 (旗艦)",
    model: "787 Year Flagship",
    variant: "Flagship",
    crew: 405,
    buildTime: "-",
    output: 5,
    armor: { front: 32, side: 19, rear: 11 },
    shield: { protection: 60, capacity: 5000 },
    speed: 21000,
    sensorRange: 115,
    weapons: {
      beam: { power: 29, cost: 31 },
      gun: { power: 34, cost: 9 },
      missile: { power: 32, cost: 13 },
      antiAir: { power: 16, cost: "-" }
    },
    description: "787年型標準戦艦 (旗艦型)"
  },
  {
    type: "戦艦Ⅰ",
    model: "787 Year",
    variant: "Standard",
    crew: 405,
    buildTime: 95,
    output: 5,
    armor: { front: 32, side: 19, rear: 11 },
    speed: 21000,
    sensorRange: 105,
    weapons: {
      beam: { power: 29, cost: 31 },
      gun: { power: 34, cost: 9 },
      missile: { power: 32, cost: 13 },
      antiAir: { power: 16, cost: "-" }
    },
    description: "787年型標準戦艦。帝国軍のSS75型標準戦艦に対抗すべく建造"
  }
];

console.log(`✓ 동맹 전함: ${shipData.alliance.battleships.length}종`);

// ============================================================================
// 결과 저장
// ============================================================================
const outputPath = path.join(__dirname, 'ships-detailed.json');
fs.writeFileSync(outputPath, JSON.stringify(shipData, null, 2), 'utf-8');

console.log('\n' + '='.repeat(60));
console.log('✅ 함선 상세 스펙 추출 완료!');
console.log('='.repeat(60));
console.log(`\n📊 추출 요약:`);
console.log(`\n제국군:`);
console.log(`  - 전함 (SS75): ${shipData.empire.battleships.length}종`);
console.log(`  - 고속전함 (PK86): ${shipData.empire.fastBattleships.length}종`);
console.log(`\n동맹군:`);
console.log(`  - 전함 (787年型): ${shipData.alliance.battleships.length}종`);
console.log(`\n📁 출력 파일: ${outputPath}`);
console.log('\n⚠️  주의: 샘플만 추출. 전체 함선은 수동 보완 필요');
console.log('    (순양함, 구축함, 모함, 양륙함 등)');
