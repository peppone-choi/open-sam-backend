import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ITEMS_DIR = path.join(__dirname, '../sam/hwe/sammo/ActionItem');
const OUTPUT_FILE = path.join(__dirname, '../config/scenarios/sangokushi/data/items.json');

const STAT_TYPE_MAP = {
  '명마': 'leadership',
  '무기': 'strength',
  '서적': 'intel'
};

function parseItemFile(filename, content) {
  const item = {
    id: filename.replace('.php', ''),
    name: '',
    description: '',
    effects: {}
  };

  // Extract class name
  const classMatch = content.match(/class\s+(\S+)\s+extends/);
  if (!classMatch) return null;
  
  const className = classMatch[1];
  item.id = className;

  // Extract rawName
  const rawNameMatch = content.match(/protected\s+\$rawName\s*=\s*['"](.*?)['"]/);
  if (rawNameMatch) {
    item.name = rawNameMatch[1];
  }

  // Extract name (with effect description)
  const nameMatch = content.match(/protected\s+\$name\s*=\s*['"](.*?)['"]/);
  if (nameMatch) {
    item.name = nameMatch[1];
  }

  // Extract info
  const infoMatch = content.match(/protected\s+\$info\s*=\s*['"](.*?)['"]/s);
  if (infoMatch) {
    item.description = infoMatch[1].replace(/<br>/g, ' ').trim();
  }

  // Extract cost
  const costMatch = content.match(/protected\s+\$cost\s*=\s*(\d+)/);
  if (costMatch) {
    item.effects.cost = parseInt(costMatch[1]);
  }

  // Extract consumable
  const consumableMatch = content.match(/protected\s+\$consumable\s*=\s*(true|false)/);
  if (consumableMatch) {
    item.effects.consumable = consumableMatch[1] === 'true';
  }

  // Extract buyable
  const buyableMatch = content.match(/protected\s+\$buyable\s*=\s*(true|false)/);
  if (buyableMatch) {
    item.effects.buyable = buyableMatch[1] === 'true';
  }

  // Check if BaseStatItem
  if (content.includes('extends \\sammo\\BaseStatItem')) {
    // Parse filename: che_카테고리_레벨_이름.php
    const parts = filename.replace('.php', '').split('_');
    if (parts.length >= 4) {
      const category = parts[1];
      const level = parseInt(parts[2]);
      const itemName = parts[3];
      const statType = STAT_TYPE_MAP[category];
      
      if (statType && !isNaN(level)) {
        // Generate name and description like BaseStatItem constructor does
        const statNickMap = {
          'leadership': '통솔',
          'strength': '무력',
          'intel': '지력'
        };
        const statNick = statNickMap[statType];
        
        item.name = `${itemName}(+${level})`;
        item.description = `${statNick} +${level}`;
        item.effects.statBonus = {
          [statType]: level
        };
      }
    }
  }

  // Parse getWarPowerMultiplier
  const warPowerMatch = content.match(/public\s+function\s+getWarPowerMultiplier[^{]*\{([\s\S]*?)\n\s{4}\}/);
  if (warPowerMatch) {
    const body = warPowerMatch[1];
    
    // Check for skill activation based multiplier (격노 등) - FIRST to avoid being overshadowed
    const skillMatch = body.match(/->hasActivatedSkillOnLog\(['"]([^'"]+)['"]\)/);
    if (skillMatch) {
      const skillName = skillMatch[1];
      // Try to find the multiplier formula
      const altMatch = body.match(/return\s*\[\s*1\s*\+\s*(\d+(?:\.\d+)?)\s*\*\s*\$activatedCnt/);
      if (altMatch) {
        if (!item.effects.combat) item.effects.combat = {};
        item.effects.combat.stackingDamageBonus = {
          skill: skillName,
          perStack: parseFloat(altMatch[1])
        };
      }
    }
    
    // Check for WarUnitCity (castle targeting)
    if (body.includes('instanceof WarUnitCity')) {
      item.effects.condition = { target: 'CASTLE' };
      
      // Extract multiplier values
      const returnMatch = body.match(/return\s*\[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]/);
      if (returnMatch) {
        const attackMult = parseFloat(returnMatch[1]);
        const defenseMult = parseFloat(returnMatch[2]);
        
        if (!item.effects.combat) item.effects.combat = {};
        if (attackMult !== 1) item.effects.combat.attackMultiplier = attackMult;
        if (defenseMult !== 1) item.effects.combat.defenseMultiplier = defenseMult;
      }
    }
  }

  // Parse onCalcStat
  const calcStatMatch = content.match(/public\s+function\s+onCalcStat.*?\{([\s\S]*?)\n\s{4}\}/);
  if (calcStatMatch) {
    const body = calcStatMatch[1];
    
    // Check for specific stat modifications
    const statChecks = [
      ['strength', 'strength'],
      ['intel', 'intel'],
      ['leadership', 'leadership'],
      ['sabotageDefence', 'sabotageDefence']
    ];
    
    for (const [checkName, effectName] of statChecks) {
      if (body.includes(`'${checkName}'`)) {
        // Extract the bonus value
        const bonusMatch = body.match(/return\s+\$value\s*\+\s*(\d+(?:\.\d+)?)/);
        const yearBonusMatch = body.match(/\+\s*5\s*\+.*intdiv\(\$relYear,\s*4\)/);
        
        if (yearBonusMatch) {
          if (!item.effects.statBonus) item.effects.statBonus = {};
          item.effects.statBonus[effectName] = { base: 5, yearlyIncrement: { perYears: 4, amount: 1 } };
        } else if (bonusMatch) {
          if (!item.effects.statBonus) item.effects.statBonus = {};
          item.effects.statBonus[effectName] = parseFloat(bonusMatch[1]);
        }
      }
    }
  }

  // Parse onCalcOpposeStat
  const calcOpposeStatMatch = content.match(/public\s+function\s+onCalcOpposeStat.*?\{([\s\S]*?)\n\s{4}\}/);
  if (calcOpposeStatMatch) {
    const body = calcOpposeStatMatch[1];
    
    if (body.includes('warMagicTrialProb')) {
      const match = body.match(/return\s+\$value\s*-\s*(\d+(?:\.\d+)?)/);
      if (match) {
        if (!item.effects.combat) item.effects.combat = {};
        item.effects.combat.enemyMagicTrialReduction = parseFloat(match[1]);
      }
    }
    
    if (body.includes('warMagicSuccessProb')) {
      const match = body.match(/return\s+\$value\s*-\s*(\d+(?:\.\d+)?)/);
      if (match) {
        if (!item.effects.combat) item.effects.combat = {};
        item.effects.combat.enemyMagicSuccessReduction = parseFloat(match[1]);
      }
    }
  }

  // Parse onCalcDomestic
  const calcDomesticMatch = content.match(/public\s+function\s+onCalcDomestic.*?\{([\s\S]*?)\n\s{4}\}/);
  if (calcDomesticMatch) {
    const body = calcDomesticMatch[1];
    
    // General domestic bonus
    if (body.includes("in_array($turnType,")) {
      const arrayMatch = body.match(/in_array\(\$turnType,\s*\[(.*?)\]\)/);
      if (arrayMatch) {
        const successMatch = body.match(/if\(\$varType\s*==\s*'success'\)\s*return\s*\$value\s*\+\s*(\d+(?:\.\d+)?)/);
        if (successMatch) {
          if (!item.effects.domestic) item.effects.domestic = {};
          item.effects.domestic.generalSuccessBonus = parseFloat(successMatch[1]);
        }
      }
    }
    
    // Specific turn type bonuses (조달, 상업, 농업 등)
    const turnTypeMatch = body.match(/if\(\$turnType\s*===\s*['"](\w+)['"]\)/);
    if (turnTypeMatch) {
      const turnType = turnTypeMatch[1];
      const successMatch = body.match(/if\(\$varType\s*==\s*'success'\)\s*return\s*\$value\s*\+\s*(\d+(?:\.\d+)?)/);
      const scoreMultMatch = body.match(/if\(\$varType\s*==\s*'score'\)\s*return\s*\$value\s*\*\s*(\d+(?:\.\d+)?)/);
      const scoreAddMatch = body.match(/if\(\$varType\s*==\s*'score'\)\s*return\s*\$value\s*\+\s*(\d+(?:\.\d+)?)/);
      
      if (!item.effects.domestic) item.effects.domestic = {};
      
      if (successMatch) {
        item.effects.domestic[turnType + 'SuccessBonus'] = parseFloat(successMatch[1]);
      }
      if (scoreMultMatch) {
        item.effects.domestic[turnType + 'ScoreMultiplier'] = parseFloat(scoreMultMatch[1]);
      }
      if (scoreAddMatch) {
        item.effects.domestic[turnType + 'ScoreBonus'] = parseFloat(scoreAddMatch[1]);
      }
    }
  }

  // Parse onCalcCommerce, onCalcAgriculture, etc.
  const commerceMatch = content.match(/public\s+function\s+onCalcCommerce/);
  if (commerceMatch) {
    const funcMatch = content.match(/public\s+function\s+onCalcCommerce.*?\{([\s\S]*?)\n\s{4}\}/);
    if (funcMatch) {
      const multMatch = funcMatch[1].match(/return\s+\$value\s*\*\s*(\d+(?:\.\d+)?)/);
      if (multMatch) {
        if (!item.effects.domestic) item.effects.domestic = {};
        item.effects.domestic.commerceMultiplier = parseFloat(multMatch[1]);
      }
    }
  }

  const agricultureMatch = content.match(/public\s+function\s+onCalcAgriculture/);
  if (agricultureMatch) {
    const funcMatch = content.match(/public\s+function\s+onCalcAgriculture.*?\{([\s\S]*?)\n\s{4}\}/);
    if (funcMatch) {
      const multMatch = funcMatch[1].match(/return\s+\$value\s*\*\s*(\d+(?:\.\d+)?)/);
      if (multMatch) {
        if (!item.effects.domestic) item.effects.domestic = {};
        item.effects.domestic.agricultureMultiplier = parseFloat(multMatch[1]);
      }
    }
  }

  // Parse calcDefence
  const defenceMatch = content.match(/public\s+function\s+calcDefence/);
  if (defenceMatch) {
    if (!item.effects.combat) item.effects.combat = {};
    item.effects.combat.hasDefenseBonus = true;
  }

  // Parse trigger-based items
  if (content.includes('getBattleInitSkillTriggerList')) {
    if (!item.effects.combat) item.effects.combat = {};
    item.effects.combat.hasBattleInitTrigger = true;
    
    // Check for 사기 (morale) bonus
    if (content.includes("'atmos'")) {
      const atmosMatch = content.match(/,\s*'atmos',.*?,\s*(\d+)/);
      if (atmosMatch) {
        item.effects.combat.moraleBonus = parseInt(atmosMatch[1]);
      }
    }
  }

  if (content.includes('getBattlePhaseSkillTriggerList')) {
    if (!item.effects.combat) item.effects.combat = {};
    item.effects.combat.hasBattlePhaseTrigger = true;
  }

  if (content.includes('getPreTurnExecuteTriggerList')) {
    if (!item.effects.general) item.effects.general = {};
    item.effects.general.hasPreTurnTrigger = true;
    
    // Check for healing
    if (content.includes('che_아이템치료')) {
      item.effects.general.healing = true;
    }
  }

  // Only return items with meaningful data (skip None.php)
  if (item.name && Object.keys(item.effects).length > 0) {
    return item;
  }

  return null;
}

function parseAllItems() {
  const files = fs.readdirSync(ITEMS_DIR);
  const items = [];

  for (const file of files) {
    if (!file.endsWith('.php') || file === 'None.php') continue;

    const filePath = path.join(ITEMS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    const item = parseItemFile(file, content);
    if (item) {
      items.push(item);
      console.log(`✓ ${file} → ${item.name}`);
    } else {
      console.log(`✗ ${file} (skipped)`);
    }
  }

  return items;
}

// Main execution
console.log('Starting item parsing...\n');
const items = parseAllItems();

console.log(`\n총 ${items.length}개 아이템 파싱 완료`);

// Ensure output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write output
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), 'utf8');
console.log(`\n저장: ${OUTPUT_FILE}`);
