import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== 모든 PHP 파일에서 하드코딩 상수 추출 ===\n');

// 추출 대상 PHP 파일들
const targetFiles = {
  'GameConstBase': '../core/hwe/sammo/GameConstBase.php',
  'CityConstBase': '../core/hwe/sammo/CityConstBase.php',
  'GameUnitConstBase': '../core/hwe/sammo/GameUnitConstBase.php',
  'AutorunNationPolicy': '../core/hwe/sammo/AutorunNationPolicy.php',
};

// constants.json 로드
const constantsPath = './config/scenarios/sangokushi/data/constants.json';
let constants = {};
try {
  constants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));
} catch (e) {
  console.log('⚠️  constants.json 없음, 새로 생성합니다.');
}

const allExtracted = {};
const allMissing = {};

// 각 PHP 파일 처리
for (const [name, filePath] of Object.entries(targetFiles)) {
  console.log(`\n=== ${name} 처리 중 ===`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  파일 없음: ${filePath}`);
    continue;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const extracted = extractConstantsFromPHP(content, name);
  const missing = checkMissing(extracted, constants, name);
  
  allExtracted[name] = extracted;
  if (missing.length > 0) {
    allMissing[name] = missing;
  }
  
  console.log(`  추출: ${Object.keys(extracted).length}개`);
  console.log(`  누락: ${missing.length}개`);
}

// 결과 요약
console.log('\n=== 전체 요약 ===');
const totalExtracted = Object.values(allExtracted).reduce((sum, obj) => sum + Object.keys(obj).length, 0);
const totalMissing = Object.values(allMissing).reduce((sum, arr) => sum + arr.length, 0);
console.log(`전체 추출: ${totalExtracted}개`);
console.log(`전체 누락: ${totalMissing}개\n`);

// 누락된 상수 저장
if (totalMissing > 0) {
  const missingData = {
    metadata: {
      extractedAt: new Date().toISOString(),
      sourceFiles: targetFiles
    },
    missing: {}
  };
  
  for (const [file, missing] of Object.entries(allMissing)) {
    missingData.missing[file] = {};
    for (const { key, value } of missing) {
      missingData.missing[file][key] = value;
    }
  }
  
  const outputPath = './config/scenarios/sangokushi/data/all-missing-constants.json';
  fs.writeFileSync(outputPath, JSON.stringify(missingData, null, 2), 'utf-8');
  console.log(`✅ 누락된 상수 저장: ${outputPath}\n`);
  
  // 상세 출력
  console.log('=== 누락된 상수 상세 ===\n');
  for (const [file, missing] of Object.entries(allMissing)) {
    if (missing.length === 0) continue;
    console.log(`\n[${file}]`);
    for (const { key, value, type } of missing) {
      console.log(`  ${key}: ${type}`);
      if (type.includes('parse error') && value.__raw) {
        console.log(`    (파싱 실패, 원본 길이: ${value.__raw.length})`);
      } else if (type.startsWith('array[')) {
        console.log(`    (배열 항목 수: ${value.length})`);
      } else if (type.startsWith('object[')) {
        console.log(`    (객체 키 수: ${Object.keys(value).length})`);
      } else {
        console.log(`    값: ${JSON.stringify(value).substring(0, 100)}...`);
      }
    }
  }
}

// Helper functions
function extractConstantsFromPHP(content, fileType) {
  const constants = {};
  
  // public static $변수명 = 값; 패턴 찾기
  const staticPattern = /public static \$\$?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;]+);/gs;
  let match;
  
  while ((match = staticPattern.exec(content)) !== null) {
    const varName = match[1];
    const valueStr = match[2].trim();
    
    // 값 파싱
    const value = parsePHPValue(valueStr, varName);
    if (value !== null) {
      constants[varName] = value;
    }
  }
  
  return constants;
}

function parsePHPValue(valueStr, varName) {
  valueStr = valueStr.trim();
  
  // 문자열 (따옴표)
  if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
    return valueStr.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
    return valueStr.slice(1, -1).replace(/\\'/g, "'").replace(/\\n/g, '\n');
  }
  
  // 숫자
  if (/^-?\d+$/.test(valueStr)) {
    return parseInt(valueStr);
  }
  if (/^-?\d*\.\d+$/.test(valueStr)) {
    return parseFloat(valueStr);
  }
  
  // boolean
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (valueStr === 'null') return null;
  
  // 배열 (간단한 형태)
  if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
    return parsePHPArray(valueStr);
  }
  
  // PHP 상수 (예: ActionLogger::EVENT_YEAR_MONTH)
  if (valueStr.includes('::')) {
    return { __phpConstant: valueStr, __note: 'PHP constant reference' };
  }
  
  return { __raw: valueStr, __note: 'Could not parse' };
}

function parsePHPArray(arrayStr) {
  try {
    // PHP 배열을 JSON으로 변환 시도
    // 'key' => value 형태 처리
    let jsonStr = arrayStr
      .replace(/\r\n/g, '\n')
      .replace(/\n\s*/g, ' ')
      .replace(/'([^']+)'\s*=>/g, '"$1":')  // PHP associative array
      .replace(/(\d+)\s*=>/g, '"$1":')  // 숫자 키
      .replace(/'/g, '"')  // 나머지 싱글 쿼트
      .replace(/,\s*]/g, ']')  // trailing comma
      .replace(/,\s*\}/g, '}');
    
    // 중첩 배열 처리
    jsonStr = jsonStr.replace(/\[/g, '[').replace(/\]/g, ']');
    
    return JSON.parse(jsonStr);
  } catch (e) {
    // 실패 시 원본 반환
    return {
      __raw: arrayStr,
      __parseError: e.message,
      __note: 'PHP array - needs manual conversion'
    };
  }
}

function checkMissing(extracted, constants, fileType) {
  const missing = [];
  const gameConstants = constants.gameConstants || {};
  const gameBalance = constants.gameBalance || {};
  const root = constants;
  
  for (const [key, value] of Object.entries(extracted)) {
    // 이미 있는지 확인
    const exists = 
      gameConstants[key] !== undefined ||
      gameBalance[key] !== undefined ||
      root[key] !== undefined ||
      constants.regions?.[key] !== undefined ||
      constants.cityLevels?.[key] !== undefined;
    
    if (!exists) {
      missing.push({
        key,
        value,
        type: getValueType(value)
      });
    }
  }
  
  return missing;
}

function getValueType(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && value[0].__parseError) {
      return 'parse error';
    }
    return `array[${value.length}]`;
  }
  if (typeof value === 'object') {
    if (value.__error || value.__parseError || value.__phpConstant) {
      return 'parse error';
    }
    return `object[${Object.keys(value).length} keys]`;
  }
  return typeof value;
}

