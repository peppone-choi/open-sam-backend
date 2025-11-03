import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== 모든 PHP 파일에서 하드코딩 상수 스캔 ===\n');

// core/hwe/sammo 디렉토리의 모든 PHP 파일 찾기
const phpDir = path.join(__dirname, '../../core/hwe/sammo');
const allFiles = [];

function findPhpFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findPhpFiles(fullPath);
    } else if (entry.name.endsWith('.php')) {
      allFiles.push(fullPath);
    }
  }
}

findPhpFiles(phpDir);

console.log(`✅ 발견된 PHP 파일: ${allFiles.length}개\n`);

// 패턴 정의: 하드코딩된 숫자, 임계값, 계수 등
const patterns = {
  // 비교 연산자와 함께 사용되는 숫자 (임계값)
  threshold: /\b(if|elseif|while|case|<=|>=|==|!=|<|>)\s*[\s\(]*(\d+(?:\.\d+)?)\b/g,
  
  // 나누기 연산자 (계수)
  divisor: /\/(\s*)?(\d+(?:\.\d+)?)\s*[\)\;\}]/g,
  
  // 곱하기 연산자 (배수)
  multiplier: /\*(\s*)?(\d+(?:\.\d+)?)\s*[\)\;\}]/g,
  
  // 배열 인덱스나 키
  arrayIndex: /\[(\d+(?:\.\d+)?)\]/g,
  
  // 함수 인자로 전달되는 숫자
  functionArg: /\(\s*(\d+(?:\.\d+)?)\s*[,\)]/g,
  
  // 할당 연산자 (설정값)
  assignment: /=\s*(\d+(?:\.\d+)?)\s*[;\}]/g,
};

const foundConstants = {
  thresholds: new Set(),
  divisors: new Set(),
  multipliers: new Set(),
  arrayIndices: new Set(),
  functionArgs: new Set(),
  assignments: new Set(),
  magicNumbers: new Set(),
};

const fileStats = {};

for (const filePath of allFiles) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(phpDir, filePath);
    const stats = {
      thresholds: new Set(),
      divisors: new Set(),
      multipliers: new Set(),
      arrayIndices: new Set(),
      functionArgs: new Set(),
      assignments: new Set(),
    };
    
    // 각 패턴 매칭
    for (const [patternName, pattern] of Object.entries(patterns)) {
      const matches = [...content.matchAll(pattern)];
      for (const match of matches) {
        const value = match[2] || match[1]; // 그룹 캡처
        if (value && !isNaN(value)) {
          const numValue = parseFloat(value);
          // 의미 있는 값만 저장 (너무 작거나 큰 값 제외)
          if (numValue >= 0 && numValue <= 1000000 && numValue !== 0 && numValue !== 1) {
            foundConstants[patternName === 'threshold' ? 'thresholds' : 
                          patternName === 'divisor' ? 'divisors' :
                          patternName === 'multiplier' ? 'multipliers' :
                          patternName === 'arrayIndex' ? 'arrayIndices' :
                          patternName === 'functionArg' ? 'functionArgs' : 'assignments'].add(value);
            stats[patternName === 'threshold' ? 'thresholds' : 
                  patternName === 'divisor' ? 'divisors' :
                  patternName === 'multiplier' ? 'multipliers' :
                  patternName === 'arrayIndex' ? 'arrayIndices' :
                  patternName === 'functionArg' ? 'functionArgs' : 'assignments'].add(value);
          }
        }
      }
    }
    
    // 특정 패턴의 매직 넘버 찾기
    // 0.01, 0.1, 0.5, 0.75 등 비율 값
    const ratioPattern = /\b(0\.\d+|\.\d+)\b/g;
    const ratioMatches = [...content.matchAll(ratioPattern)];
    for (const match of ratioMatches) {
      const value = parseFloat(match[1]);
      if (value > 0 && value < 1) {
        foundConstants.magicNumbers.add(match[1]);
      }
    }
    
    // 통계 기록
    const total = stats.thresholds.size + stats.divisors.size + stats.multipliers.size + 
                  stats.arrayIndices.size + stats.functionArgs.size + stats.assignments.size;
    if (total > 0) {
      fileStats[relativePath] = {
        thresholds: stats.thresholds.size,
        divisors: stats.divisors.size,
        multipliers: stats.multipliers.size,
        arrayIndices: stats.arrayIndices.size,
        functionArgs: stats.functionArgs.size,
        assignments: stats.assignments.size,
        total,
      };
    }
  } catch (error) {
    console.error(`⚠️  파일 읽기 오류: ${filePath} - ${error.message}`);
  }
}

// 결과 정리
const result = {
  summary: {
    totalFiles: allFiles.length,
    filesWithConstants: Object.keys(fileStats).length,
    totalUniqueConstants: {
      thresholds: foundConstants.thresholds.size,
      divisors: foundConstants.divisors.size,
      multipliers: foundConstants.multipliers.size,
      arrayIndices: foundConstants.arrayIndices.size,
      functionArgs: foundConstants.functionArgs.size,
      assignments: foundConstants.assignments.size,
      magicNumbers: foundConstants.magicNumbers.size,
    },
  },
  constants: {
    thresholds: Array.from(foundConstants.thresholds).sort((a, b) => parseFloat(a) - parseFloat(b)),
    divisors: Array.from(foundConstants.divisors).sort((a, b) => parseFloat(a) - parseFloat(b)),
    multipliers: Array.from(foundConstants.multipliers).sort((a, b) => parseFloat(a) - parseFloat(b)),
    arrayIndices: Array.from(foundConstants.arrayIndices).sort((a, b) => parseFloat(a) - parseFloat(b)),
    functionArgs: Array.from(foundConstants.functionArgs).sort((a, b) => parseFloat(a) - parseFloat(b)),
    assignments: Array.from(foundConstants.assignments).sort((a, b) => parseFloat(a) - parseFloat(b)),
    magicNumbers: Array.from(foundConstants.magicNumbers).sort((a, b) => parseFloat(a) - parseFloat(b)),
  },
  fileStats: Object.fromEntries(
    Object.entries(fileStats).sort((a, b) => b[1].total - a[1].total).slice(0, 50)
  ),
};

// 결과 저장
const outputPath = './config/scenarios/sangokushi/data/php-constants-scan.json';
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

console.log('=== 스캔 결과 요약 ===');
console.log(`전체 PHP 파일: ${result.summary.totalFiles}개`);
console.log(`상수 포함 파일: ${result.summary.filesWithConstants}개`);
console.log('\n발견된 고유 상수:');
console.log(`  - 임계값: ${result.summary.totalUniqueConstants.thresholds}개`);
console.log(`  - 나누기 계수: ${result.summary.totalUniqueConstants.divisors}개`);
console.log(`  - 곱하기 배수: ${result.summary.totalUniqueConstants.multipliers}개`);
console.log(`  - 배열 인덱스: ${result.summary.totalUniqueConstants.arrayIndices}개`);
console.log(`  - 함수 인자: ${result.summary.totalUniqueConstants.functionArgs}개`);
console.log(`  - 할당값: ${result.summary.totalUniqueConstants.assignments}개`);
console.log(`  - 매직 넘버: ${result.summary.totalUniqueConstants.magicNumbers}개`);
console.log(`\n✅ 결과 저장: ${outputPath}`);
console.log(`\n상위 10개 파일 (상수 많은 순):`);
const topFiles = Object.entries(fileStats).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
for (const [file, stats] of topFiles) {
  console.log(`  ${file}: ${stats.total}개 (임계값 ${stats.thresholds}, 계수 ${stats.divisors + stats.multipliers}, 할당 ${stats.assignments})`);
}

