import fs from 'fs';
import path from 'path';

console.log('=== PHP 하드코딩 상수 전체 추출 ===\n');

// 파일 로드
const gameConstPath = '../core/hwe/sammo/GameConstBase.php';
const gameConstContent = fs.readFileSync(gameConstPath, 'utf-8');
const constantsPath = './config/scenarios/sangokushi/data/constants.json';
const constants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));

console.log('✅ 파일 로드 완료\n');

// 추출할 상수 목록
const constantsToExtract = {
  // 메타데이터
  banner: null,
  title: null,
  
  // 아이템
  allItems: null,
  
  // 명령
  availableGeneralCommand: null,
  availableChiefCommand: null,
  
  // 랜덤 이름
  randGenFirstName: null,
  randGenMiddleName: null,
  randGenLastName: null,
  
  // 즉시 액션
  defaultInstantAction: null,
  availableInstantAction: null,
  
  // 이벤트 (복잡하므로 원본 텍스트 저장)
  defaultInitialEvents: null,
  defaultEvents: null,
  staticEventHandlers: null,
  
  // 기타 (이미 JSON에 있을 수 있지만 확인)
  resourceActionAmountGuide: null,
};

// PHP 상수 추출
for (const key of Object.keys(constantsToExtract)) {
  const value = extractConstant(gameConstContent, key);
  constantsToExtract[key] = value;
}

// constants.json과 비교
console.log('=== 누락된 상수 확인 ===\n');
const missing = [];
const gameConstants = constants.gameConstants || {};
const gameBalance = constants.gameBalance || {};

for (const [key, value] of Object.entries(constantsToExtract)) {
  if (value === null) {
    console.log(`⚠️  추출 실패: ${key}`);
    continue;
  }
  
  // 이미 있는지 확인
  const exists = 
    gameConstants[key] !== undefined ||
    gameBalance[key] !== undefined ||
    constants[key] !== undefined;
  
  if (!exists) {
    missing.push({ key, value, size: JSON.stringify(value).length });
    console.log(`❌ 누락: ${key} (${getValueType(value)})`);
  } else {
    console.log(`✓ 이미 있음: ${key}`);
  }
}

console.log(`\n=== 요약 ===`);
console.log(`추출한 상수: ${Object.keys(constantsToExtract).length}개`);
console.log(`누락된 상수: ${missing.length}개\n`);

// 누락된 상수 저장
if (missing.length > 0) {
  const missingData = {
    metadata: {
      extractedAt: new Date().toISOString(),
      sourceFile: '../core/hwe/sammo/GameConstBase.php'
    },
    constants: {}
  };
  
  for (const { key, value } of missing) {
    missingData.constants[key] = value;
  }
  
  const outputPath = './config/scenarios/sangokushi/data/missing-constants.json';
  fs.writeFileSync(outputPath, JSON.stringify(missingData, null, 2), 'utf-8');
  console.log(`✅ 누락된 상수 저장: ${outputPath}\n`);
  
  // constants.json에 추가할 형식으로 출력
  console.log('=== constants.json에 추가할 항목 ===\n');
  console.log(JSON.stringify(missingData.constants, null, 2));
}

// Helper functions
function extractConstant(content, name) {
  // 문자열 상수
  if (name === 'banner' || name === 'title') {
    const regex = new RegExp(`public static \\$${name}\\s*=\\s*"([^"]+)"`, 's');
    const match = content.match(regex);
    if (match) return match[1];
  }
  
  // 배열 상수 (간단한 형태)
  if (name === 'randGenFirstName' || name === 'randGenMiddleName' || name === 'randGenLastName' || name === 'resourceActionAmountGuide') {
    const regex = new RegExp(`public static \\$${name}\\s*=\\s*\\[(.*?)\\];`, 's');
    const match = content.match(regex);
    if (match) {
      try {
        // PHP 배열을 JSON으로 변환
        const phpArray = match[1];
        const jsonStr = phpArray
          .replace(/'/g, '"')
          .replace(/,\s*$/, '');
        return JSON.parse(`[${jsonStr}]`);
      } catch (e) {
        return { __error: e.message, __raw: match[1] };
      }
    }
  }
  
  // 복잡한 배열 (allItems, commands 등)
  if (name.includes('Command') || name === 'allItems' || name === 'defaultInstantAction' || name === 'availableInstantAction') {
    return extractComplexArray(content, name);
  }
  
  // 이벤트 (특별 처리)
  if (name.includes('Event')) {
    return extractEventArray(content, name);
  }
  
  return null;
}

function extractComplexArray(content, name) {
  const startPattern = `public static \\$${name}\\s*=\\s*\\[`;
  const startMatch = content.match(new RegExp(startPattern));
  if (!startMatch) return null;
  
  const startIndex = content.indexOf(startMatch[0]);
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let i = startIndex;
  
  // 시작 '[' 찾기
  while (i < content.length && content[i] !== '[') i++;
  if (i >= content.length) return null;
  
  const start = i;
  i++;
  depth = 1;
  
  // 끝 찾기
  while (i < content.length && depth > 0) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';
    
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    
    if (!inString) {
      if (char === '[') depth++;
      else if (char === ']') depth--;
    }
    
    i++;
  }
  
  if (depth !== 0) return { __error: 'Unclosed array' };
  
  const arrayStr = content.substring(start, i);
  
  // 수동 파싱 시도
  try {
    // 기본적인 변환
    let converted = arrayStr
      .replace(/public static \$\w+\s*=\s*/, '')
      .replace(/'/g, '"')
      .replace(/=>/g, ':')
      .replace(/(\w+):/g, '"$1":')
      .replace(/,\s*\]/g, ']')
      .replace(/,\s*\}/g, '}')
      .replace(/ActionLogger::\w+/g, 'null');
    
    return JSON.parse(converted);
  } catch (e) {
    // 실패 시 원본 저장
    return { __raw: arrayStr, __parseError: e.message };
  }
}

function extractEventArray(content, name) {
  // 이벤트 배열은 복잡하므로 원본 텍스트만 추출
  const startPattern = `public static \\$${name}\\s*=\\s*\\[`;
  const match = content.match(new RegExp(startPattern));
  if (!match) return null;
  
  const startIndex = content.indexOf(match[0]);
  let depth = 0;
  let i = startIndex;
  
  while (i < content.length && content[i] !== '[') i++;
  if (i >= content.length) return null;
  
  depth = 1;
  i++;
  
  while (i < content.length && depth > 0) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') depth--;
    i++;
  }
  
  if (depth !== 0) return { __error: 'Unclosed array' };
  
  return {
    __note: 'Complex event array - needs manual conversion',
    __raw: content.substring(startIndex, i)
  };
}

function getValueType(value) {
  if (Array.isArray(value)) {
    return `array[${value.length}]`;
  }
  if (typeof value === 'object' && value !== null) {
    if (value.__error || value.__raw) {
      return 'parse error';
    }
    return `object[${Object.keys(value).length} keys]`;
  }
  return typeof value;
}

