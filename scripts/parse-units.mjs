import fs from 'fs';
import path from 'path';

const T_CASTLE = 0;
const T_FOOTMAN = 1;
const T_ARCHER = 2;
const T_CAVALRY = 3;
const T_WIZARD = 4;
const T_SIEGE = 5;

const typeNames = {
  [T_CASTLE]: 'CASTLE',
  [T_FOOTMAN]: 'FOOTMAN',
  [T_ARCHER]: 'ARCHER',
  [T_CAVALRY]: 'CAVALRY',
  [T_WIZARD]: 'WIZARD',
  [T_SIEGE]: 'SIEGE',
};

const typeMap = {
  CASTLE: T_CASTLE,
  FOOTMAN: T_FOOTMAN,
  ARCHER: T_ARCHER,
  CAVALRY: T_CAVALRY,
  WIZARD: T_WIZARD,
  SIEGE: T_SIEGE,
};

const phpContent = fs.readFileSync('./sam/hwe/sammo/GameUnitConstBase.php', 'utf8');

// Collect all unit blocks by finding ones that start with 4-digit IDs
const unitRegex = /(\d{4}),\s*self::T_(\w+),\s*'([^']+)',\s*[\s\S]*?\],\s*null\]/g;

const units = [];

// More manual approach - split file into lines and collect blocks
const lines = phpContent.split('\n');
let currentUnit = null;
let currentLines = [];
let insideUnit = false;
let bracketDepth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Detect unit start
  const match = trimmed.match(/^(\d{4}),\s*self::T_(\w+),\s*'([^']+)',/);
  if (match) {
    // Save previous unit if any
    if (currentLines.length > 0) {
      parseUnit(currentLines.join('\n'));
    }
    
    // Start new unit
    currentUnit = {
      id: parseInt(match[1]),
      typeStr: match[2],
      name: match[3]
    };
    currentLines = [line];
    insideUnit = true;
    bracketDepth = 0;
    continue;
  }
  
  if (insideUnit) {
    currentLines.push(line);
    
    // Count brackets to know when unit ends
    for (const char of line) {
      if (char === '[') bracketDepth++;
      if (char === ']') bracketDepth--;
    }
    
    // Unit ends with "], null]" or similar
    if (trimmed === '],' || trimmed === ']') {
      // Check if this might be end of a unit (not just an inner array)
      if (trimmed === ']' || (trimmed === '],' && bracketDepth === 0)) {
        parseUnit(currentLines.join('\n'));
        currentLines = [];
        insideUnit = false;
        currentUnit = null;
      }
    }
  }
}

// Parse last unit if any
if (currentLines.length > 0) {
  parseUnit(currentLines.join('\n'));
}

function parseUnit(blockText) {
  const lines = blockText.split('\n');
  
  // Extract ID, type, name from first line
  const firstLine = lines[0].trim();
  const match = firstLine.match(/(\d{4}),\s*self::T_(\w+),\s*'([^']+)',/);
  if (!match) return;
  
  const id = parseInt(match[1]);
  const typeStr = match[2];
  const name = match[3];
  const type = typeNames[typeMap[typeStr]];
  
  // Find stats line (7 numbers)
  let stats = null;
  for (const line of lines) {
    const trimmed = line.trim();
    const numbers = trimmed.match(/^([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),?$/);
    if (numbers) {
      stats = numbers.slice(1).map(n => n.includes('.') ? parseFloat(n) : parseInt(n));
      break;
    }
  }
  
  if (!stats || stats.length !== 7) {
    console.log(`Warning: Could not parse stats for unit ${id}`);
    return;
  }
  
  const [gold, rice, tech, offense, magic, attackRange, defenseRange] = stats;
  
  // Parse constraints
  const constraints = [];
  const constraintMatches = blockText.matchAll(/new\s+(\w+)\((.*?)\)/g);
  for (const cm of constraintMatches) {
    const constraintType = cm[1];
    const args = cm[2].replace(/'/g, '').trim();
    if (constraintType === 'Impossible') {
      constraints.push({ type: 'impossible' });
    } else if (constraintType === 'ReqTech') {
      constraints.push({ type: 'reqTech', value: parseInt(args) });
    } else if (constraintType === 'ReqCities') {
      constraints.push({ type: 'reqCities', value: args });
    } else if (constraintType === 'ReqRegions') {
      constraints.push({ type: 'reqRegions', value: args });
    } else if (constraintType === 'ReqMinRelYear') {
      constraints.push({ type: 'reqMinRelYear', value: parseInt(args) });
    }
  }
  
  // Extract ALL arrays with their content
  const allArrays = [];
  let currentArray = '';
  let depth = 0;
  let inArray = false;
  let startPos = 0;
  
  for (let i = 0; i < blockText.length; i++) {
    const char = blockText[i];
    
    if (char === '[') {
      if (depth === 0) {
        inArray = true;
        currentArray = '';
        startPos = i;
      }
      depth++;
    }
    
    if (inArray && depth > 0) {
      currentArray += char;
    }
    
    if (char === ']') {
      depth--;
      if (depth === 0 && inArray) {
        allArrays.push(currentArray);
        inArray = false;
      }
    }
  }
  
  // Now identify which are attacks and defenses
  // The sequence after stats line is: [constraints], [attacks], [defenses], [description]
  // Constraints is the first array, attacks is second, defenses is third
  
  const attacks = {};
  const defenses = {};
  
  // Simple approach: just take the first 3 arrays
  // First is constraints, second is attacks, third is defenses
  if (allArrays.length >= 3) {
    // allArrays[0] is constraints
    // allArrays[1] is attacks
    // allArrays[2] is defenses
    const attacksArray = allArrays[1];
    const defensesArray = allArrays[2];
    
    const attackMatches = attacksArray.matchAll(/self::T_(\w+)\s*=>\s*([\d.]+)|(\d+)\s*=>\s*([\d.]+)/g);
    for (const am of attackMatches) {
      if (am[1]) {
        attacks[am[1]] = parseFloat(am[2]);
      } else if (am[3]) {
        attacks[`UNIT_${am[3]}`] = parseFloat(am[4]);
      }
    }
    
    const defenseMatches = defensesArray.matchAll(/self::T_(\w+)\s*=>\s*([\d.]+)|(\d+)\s*=>\s*([\d.]+)/g);
    for (const dm of defenseMatches) {
      if (dm[1]) {
        defenses[dm[1]] = parseFloat(dm[2]);
      } else if (dm[3]) {
        defenses[`UNIT_${dm[3]}`] = parseFloat(dm[4]);
      }
    }
  }
  
  // Extract description - strings in an array, excluding special ones
  const description = [];
  const stringArrays = allArrays.filter(a => a.includes("'") && !a.includes('new '));
  
  for (const arr of stringArrays) {
    const strings = arr.matchAll(/'([^']+)'/g);
    for (const sm of strings) {
      const str = sm[1];
      // Skip if it's a skill name or region name
      if (str.startsWith('che_') || str === name) continue;
      if (['중원', '오월', '남중', '저', '낙양', '성도', '동이', '서촉', '양양', '건업', '하북', '서북', '흉노', '강', '산월', '남만', '허창', '초', '오환', '왜', '장안', '업'].includes(str)) continue;
      description.push(str);
    }
  }
  
  units.push({
    id,
    type,
    name,
    cost: {
      gold,
      rice,
    },
    stats: {
      tech,
      offense,
      magic,
      attackRange,
      defenseRange,
    },
    attacks,
    defenses,
    description,
    constraints,
  });
}

console.log(`\n✓ Parsed ${units.length} units`);

// Show parsed IDs
const parsedIds = units.map(u => u.id).sort((a, b) => a - b);
console.log('Parsed IDs:', parsedIds.join(', '));

const expectedIds = [
  1000, 1100, 1101, 1102, 1103, 1104, 1105, 1106,
  1200, 1201, 1202, 1203, 1204,
  1300, 1301, 1302, 1303, 1304, 1305, 1306, 1307,
  1400, 1401, 1402, 1403, 1404, 1405, 1406, 1407, 1408,
  1500, 1501, 1502, 1503
];

const missingIds = expectedIds.filter(id => !parsedIds.includes(id));
if (missingIds.length > 0) {
  console.log('Missing IDs:', missingIds.join(', '));
}

// Validation
console.log('\n=== VALIDATION ===');

if (units.length !== 34) {
  console.log(`✗ Expected 34 units, got ${units.length}`);
  process.exit(1);
} else {
  console.log(`✓ Total units: 34`);
}

const infantry = units.find(u => u.id === 1100);
if (!infantry) {
  console.log('✗ Unit 1100 (보병) not found');
  process.exit(1);
}

const expectedAttacks = { ARCHER: 1.2, CAVALRY: 0.8, SIEGE: 1.2 };
const expectedDefenses = { ARCHER: 0.8, CAVALRY: 1.2, SIEGE: 0.8 };

let infantryValid = true;
for (const [key, val] of Object.entries(expectedAttacks)) {
  if (infantry.attacks[key] !== val) {
    console.log(`✗ Infantry attacks.${key}: expected ${val}, got ${infantry.attacks[key]}`);
    infantryValid = false;
  }
}
for (const [key, val] of Object.entries(expectedDefenses)) {
  if (infantry.defenses[key] !== val) {
    console.log(`✗ Infantry defenses.${key}: expected ${val}, got ${infantry.defenses[key]}`);
    infantryValid = false;
  }
}
if (infantryValid) {
  console.log(`✓ Unit 1100 (보병) attacks/defenses correct`);
}

const unitsWithoutDefenses = units.filter(u => Object.keys(u.defenses).length === 0);
if (unitsWithoutDefenses.length > 0) {
  console.log(`✗ Found ${unitsWithoutDefenses.length} units without defenses:`);
  unitsWithoutDefenses.forEach(u => console.log(`  - ${u.id}: ${u.name}`));
  process.exit(1);
} else {
  console.log(`✓ All units have defenses`);
}

const outputPath = './config/scenarios/sangokushi/data/units.json';
const outputDir = path.dirname(outputPath);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(units, null, 2), 'utf8');

console.log(`\n✓ Saved to ${outputPath}`);
console.log('\n=== SUMMARY ===');
console.log(`Total units: ${units.length}`);
console.log(`Unit types: ${[...new Set(units.map(u => u.type))].join(', ')}`);
console.log('\nBreakdown by type:');
for (const typeName of Object.values(typeNames)) {
  const count = units.filter(u => u.type === typeName).length;
  if (count > 0) {
    console.log(`  ${typeName}: ${count}`);
  }
}
