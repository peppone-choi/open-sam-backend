import fs from 'fs';
import path from 'path';

console.log('=== PHP 하드코딩 상수 추출 ===\n');

// 1. GameConstBase.php에서 상수 추출
const gameConstPath = './core/hwe/sammo/GameConstBase.php';
const gameConstContent = fs.readFileSync(gameConstPath, 'utf-8');

// constants.json 로드
const constantsPath = './config/scenarios/sangokushi/data/constants.json';
const constants = JSON.parse(fs.readFileSync(constantsPath, 'utf-8'));

console.log('✅ 파일 로드 완료\n');

// 누락된 상수 추출
const missingConstants = {
  // 메타데이터
  banner: extractStringConstant(gameConstContent, 'banner'),
  title: extractStringConstant(gameConstContent, 'title'),
  
  // 아이템 목록
  allItems: extractArrayConstant(gameConstContent, 'allItems'),
  
  // 명령 목록
  availableGeneralCommand: extractArrayConstant(gameConstContent, 'availableGeneralCommand'),
  availableChiefCommand: extractArrayConstant(gameConstContent, 'availableChiefCommand'),
  
  // 랜덤 장수 이름
  randGenFirstName: extractArrayConstant(gameConstContent, 'randGenFirstName'),
  randGenMiddleName: extractArrayConstant(gameConstContent, 'randGenMiddleName'),
  randGenLastName: extractArrayConstant(gameConstContent, 'randGenLastName'),
  
  // 즉시 액션
  defaultInstantAction: extractArrayConstant(gameConstContent, 'defaultInstantAction'),
  availableInstantAction: extractArrayConstant(gameConstContent, 'availableInstantAction'),
  
  // 이벤트 (복잡하므로 일단 플레이스홀더)
  defaultInitialEvents: extractArrayConstant(gameConstContent, 'defaultInitialEvents'),
  defaultEvents: extractArrayConstant(gameConstContent, 'defaultEvents'),
  
  // 이미 constants.json에 있는 것들 확인
  alreadyInJSON: {}
};

// constants.json에 이미 있는지 확인
const gameConstants = constants.gameConstants || {};
const gameBalance = constants.gameBalance || {};

console.log('=== 누락된 상수 확인 ===\n');

const missing = [];

// 각 상수 확인
for (const [key, value] of Object.entries(missingConstants)) {
  if (key === 'alreadyInJSON') continue;
  
  // 이미 있는지 확인
  const inGameConstants = gameConstants[key] !== undefined;
  const inGameBalance = gameBalance[key] !== undefined;
  const inRoot = constants[key] !== undefined;
  
  if (!inGameConstants && !inGameBalance && !inRoot && value !== null) {
    missing.push({ key, value, type: typeof value });
    console.log(`❌ 누락: ${key} (${typeof value})`);
  } else {
    console.log(`✓ 이미 있음: ${key}`);
  }
}

console.log(`\n=== 요약 ===`);
console.log(`누락된 상수: ${missing.length}개\n`);

// 누락된 상수들을 JSON으로 저장
if (missing.length > 0) {
  const missingData = {};
  for (const { key, value } of missing) {
    missingData[key] = value;
  }
  
  const outputPath = './config/scenarios/sangokushi/data/missing-constants.json';
  fs.writeFileSync(outputPath, JSON.stringify(missingData, null, 2), 'utf-8');
  console.log(`✅ 누락된 상수 저장: ${outputPath}\n`);
  
  console.log('=== 누락된 상수 상세 ===');
  for (const { key, value } of missing) {
    console.log(`\n${key}:`);
    if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(`  (객체, ${Object.keys(value).length}개 키)`);
      if (Object.keys(value).length <= 10) {
        console.log(`  ${JSON.stringify(value, null, 2).split('\n').slice(0, 20).join('\n')}`);
      }
    } else if (Array.isArray(value)) {
      console.log(`  (배열, ${value.length}개 항목)`);
      if (value.length <= 10) {
        console.log(`  ${JSON.stringify(value, null, 2).split('\n').slice(0, 20).join('\n')}`);
      }
    } else {
      console.log(`  ${JSON.stringify(value)}`);
    }
  }
}

// Helper functions
function extractStringConstant(content, name) {
  const regex = new RegExp(`public static \\$${name}\\s*=\\s*"([^"]+)"`, 's');
  const match = content.match(regex);
  return match ? match[1] : null;
}

function extractArrayConstant(content, name) {
  // 배열 추출 (간단한 패턴)
  const startPattern = `public static \\$${name}\\s*=\\s*\\[`;
  const startIndex = content.search(new RegExp(startPattern));
  
  if (startIndex === -1) return null;
  
  // 중괄호 깊이 추적
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let i = startIndex;
  
  // 시작 위치 찾기
  while (i < content.length && content[i] !== '[') i++;
  if (i >= content.length) return null;
  
  const start = i;
  i++;
  depth = 1;
  
  while (i < content.length && depth > 0) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';
    
    // 문자열 처리
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
  
  if (depth !== 0) return null;
  
  const arrayStr = content.substring(start, i);
  
  try {
    // PHP 배열을 JSON으로 변환 시도
    // 간단한 변환: '=>' -> ':', 싱글/더블 쿼트 정규화 등
    let jsonStr = arrayStr
      .replace(/public static \$\w+\s*=\s*/, '')
      .replace(/'/g, '"')  // PHP 싱글 쿼트를 더블 쿼트로
      .replace(/=>/g, ':')  // PHP => 를 : 로
      .replace(/(\w+):/g, '"$1":')  // 키를 쿼트로 감싸기
      .replace(/,\s*\]/g, ']')  // trailing comma 제거
      .replace(/,\s*\}/g, '}');
    
    // PHP 함수 호출 제거 (예: ActionLogger::EVENT_YEAR_MONTH)
    jsonStr = jsonStr.replace(/ActionLogger::\w+/g, 'null');
    
    return JSON.parse(jsonStr);
  } catch (e) {
    // 파싱 실패 시 원본 반환 (나중에 수동 처리)
    console.warn(`⚠️  ${name} 파싱 실패: ${e.message}`);
    return { __raw: arrayStr, __parseError: e.message };
  }
}

