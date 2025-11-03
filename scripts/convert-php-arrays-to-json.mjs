import fs from 'fs';

console.log('=== PHP 배열을 JSON으로 변환 ===\n');

const missingPath = './config/scenarios/sangokushi/data/all-missing-constants.json';
const missing = JSON.parse(fs.readFileSync(missingPath, 'utf-8'));

const converted = {};

// GameConstBase 변환
if (missing.missing.GameConstBase) {
  console.log('=== GameConstBase 변환 ===\n');
  
  const gameConst = missing.missing.GameConstBase;
  
  // banner는 이미 문자열
  if (gameConst.banner) {
    converted.banner = gameConst.banner;
    console.log('✓ banner');
  }
  
  // 배열들 (이미 파싱된 것들)
  if (gameConst.randGenFirstName) {
    converted.randGenFirstName = gameConst.randGenFirstName;
    console.log(`✓ randGenFirstName (${gameConst.randGenFirstName.length}개)`);
  }
  
  if (gameConst.randGenLastName) {
    converted.randGenLastName = gameConst.randGenLastName;
    console.log(`✓ randGenLastName (${gameConst.randGenLastName.length}개)`);
  }
  
  if (gameConst.availableNationType) {
    converted.availableNationType = gameConst.availableNationType;
    console.log(`✓ availableNationType (${gameConst.availableNationType.length}개)`);
  }
  
  if (gameConst.availableSpecialDomestic) {
    converted.availableSpecialDomestic = gameConst.availableSpecialDomestic;
    console.log(`✓ availableSpecialDomestic (${gameConst.availableSpecialDomestic.length}개)`);
  }
  
  if (gameConst.optionalSpecialDomestic) {
    converted.optionalSpecialDomestic = gameConst.optionalSpecialDomestic;
    console.log(`✓ optionalSpecialDomestic (${gameConst.optionalSpecialDomestic.length}개)`);
  }
  
  if (gameConst.availableSpecialWar) {
    converted.availableSpecialWar = gameConst.availableSpecialWar;
    console.log(`✓ availableSpecialWar (${gameConst.availableSpecialWar.length}개)`);
  }
  
  if (gameConst.optionalSpecialWar) {
    converted.optionalSpecialWar = gameConst.optionalSpecialWar;
    console.log(`✓ optionalSpecialWar (${gameConst.optionalSpecialWar.length}개)`);
  }
  
  if (gameConst.availablePersonality) {
    converted.availablePersonality = gameConst.availablePersonality;
    console.log(`✓ availablePersonality (${gameConst.availablePersonality.length}개)`);
  }
  
  // 파싱 에러가 난 것들 - 수동 변환
  console.log('\n=== 수동 변환 필요 ===');
  
  if (gameConst.allItems?.__raw) {
    converted.allItems = convertPHPAssocArray(gameConst.allItems.__raw);
    console.log('✓ allItems 변환 완료');
  }
  
  if (gameConst.availableGeneralCommand?.__raw) {
    converted.availableGeneralCommand = convertPHPAssocArray(gameConst.availableGeneralCommand.__raw);
    console.log('✓ availableGeneralCommand 변환 완료');
  }
  
  if (gameConst.availableChiefCommand?.__raw) {
    converted.availableChiefCommand = convertPHPAssocArray(gameConst.availableChiefCommand.__raw);
    console.log('✓ availableChiefCommand 변환 완료');
  }
  
  if (gameConst.defaultInstantAction?.__raw) {
    converted.defaultInstantAction = convertPHPAssocArray(gameConst.defaultInstantAction.__raw);
    console.log('✓ defaultInstantAction 변환 완료');
  }
  
  if (gameConst.availableInstantAction?.__raw) {
    converted.availableInstantAction = convertPHPAssocArray(gameConst.availableInstantAction.__raw);
    console.log('✓ availableInstantAction 변환 완료');
  }
}

// CityConstBase 변환
if (missing.missing.CityConstBase) {
  console.log('\n=== CityConstBase 변환 ===\n');
  
  const cityConst = missing.missing.CityConstBase;
  
  if (cityConst.regionMap?.__raw) {
    converted.regionMap = convertPHPBidirectionalMap(cityConst.regionMap.__raw);
    console.log('✓ regionMap 변환 완료');
  }
  
  if (cityConst.levelMap?.__raw) {
    converted.levelMap = convertPHPBidirectionalMap(cityConst.levelMap.__raw);
    console.log('✓ levelMap 변환 완료');
  }
}

// AutorunNationPolicy 변환
if (missing.missing.AutorunNationPolicy) {
  console.log('\n=== AutorunNationPolicy 변환 ===\n');
  
  const policy = missing.missing.AutorunNationPolicy;
  
  if (policy.defaultPolicy?.__raw) {
    converted.defaultPolicy = convertPHPAssocArray(policy.defaultPolicy.__raw);
    console.log('✓ defaultPolicy 변환 완료');
  }
}

// 결과 저장
const outputPath = './config/scenarios/sangokushi/data/converted-constants.json';
fs.writeFileSync(outputPath, JSON.stringify(converted, null, 2), 'utf-8');
console.log(`\n✅ 변환된 상수 저장: ${outputPath}`);

// Helper functions
function convertPHPAssocArray(phpStr) {
  // PHP 연관 배열을 JSON 객체로 변환
  // 'key' => value 형태 처리
  
  // 공백/줄바꿈 정리
  let cleaned = phpStr
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  // 배열 제거
  cleaned = cleaned.replace(/^\s*public static \$\w+\s*=\s*\[\s*/, '');
  cleaned = cleaned.replace(/\s*\]\s*$/, '');
  
  // 'key' => value 형태 찾기
  const result = {};
  const regex = /'([^']+)'\s*=>\s*([^,]+(?:\s*,\s*[^,]+)*)/g;
  
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const key = match[1];
    const valueStr = match[2].trim();
    
    // 값 파싱
    if (valueStr === 'true') {
      result[key] = true;
    } else if (valueStr === 'false') {
      result[key] = false;
    } else if (valueStr === 'null') {
      result[key] = null;
    } else if (/^\d+$/.test(valueStr)) {
      result[key] = parseInt(valueStr);
    } else if (/^\d*\.\d+$/.test(valueStr)) {
      result[key] = parseFloat(valueStr);
    } else if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
      // 중첩 배열
      result[key] = parsePHPArrayValue(valueStr);
    } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
      result[key] = valueStr.slice(1, -1);
    } else {
      result[key] = valueStr;
    }
  }
  
  return result;
}

function convertPHPBidirectionalMap(phpStr) {
  // 양방향 매핑: 'key'=>value, value=>'key'
  let cleaned = phpStr
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
  
  cleaned = cleaned.replace(/^\s*public static \$\w+\s*=\s*\[\s*/, '');
  cleaned = cleaned.replace(/\s*\]\s*$/, '');
  
  const result = {};
  const pairs = cleaned.split(',');
  
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    
    // 'key'=>value 또는 value=>'key' 형태
    const match1 = trimmed.match(/'([^']+)'\s*=>\s*(\d+)/);
    const match2 = trimmed.match(/(\d+)\s*=>\s*'([^']+)'/);
    
    if (match1) {
      const [_, key, value] = match1;
      result[key] = parseInt(value);
    }
    if (match2) {
      const [_, value, key] = match2;
      result[parseInt(value)] = key;
    }
  }
  
  return result;
}

function parsePHPArrayValue(arrayStr) {
  // PHP 배열을 배열로 변환
  const cleaned = arrayStr.slice(1, -1).trim();
  if (!cleaned) return [];
  
  const items = [];
  const parts = cleaned.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      items.push(trimmed.slice(1, -1));
    } else if (/^\d+$/.test(trimmed)) {
      items.push(parseInt(trimmed));
    } else {
      items.push(trimmed);
    }
  }
  
  return items;
}

