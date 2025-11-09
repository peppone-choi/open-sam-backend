#!/usr/bin/env node
/**
 * PHP → TypeScript 자동 변환 스크립트
 * OpenSAM 스킬 - 데몬 아키텍처 기반 범용 엔진
 */

const fs = require('fs');
const path = require('path');

// PHP 파일 목록
const phpFiles = [
  'hwe/func_command.php',
  'hwe/func_gamerule.php',
  'hwe/func_converter.php',
  'hwe/func_time_event.php',
  'hwe/func_history.php',
  'hwe/func_tournament.php',
  'hwe/func_auction.php',
  'hwe/func_map.php'
];

const phpBasePath = '/mnt/d/opensam/sammo-php';
const tsBasePath = '/mnt/d/opensam/open-sam-backend/src/engine';

// 변환 규칙
const conversionRules = {
  // PHP → TypeScript 타입 변환
  types: {
    'int': 'number',
    'float': 'number',
    'string': 'string',
    'bool': 'boolean',
    'array': 'any[]',
    'General': 'IGeneral',
    'Nation': 'INation',
    'City': 'ICity'
  },

  // 함수명 변환 (snake_case → camelCase)
  functionName: (name) => {
    return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  },

  // DB 쿼리 → Repository 패턴
  dbToRepository: {
    'DB::db()->query': 'await repository.find',
    'DB::db()->update': 'await repository.update',
    'DB::db()->insert': 'await repository.create',
    'DB::db()->delete': 'await repository.delete'
  }
};

/**
 * PHP 함수를 TypeScript로 변환
 */
function convertPhpFunction(phpCode) {
  // function getXxx(type $param): returnType
  const functionRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*{/g;

  let tsCode = phpCode;

  // 1. 함수 선언 변환
  tsCode = tsCode.replace(functionRegex, (match, funcName, params, returnType) => {
    const tsFuncName = conversionRules.functionName(funcName);
    const tsParams = convertParams(params);
    const tsReturnType = returnType ? conversionRules.types[returnType] || returnType : 'any';

    return `export async function ${tsFuncName}(${tsParams}): Promise<${tsReturnType}> {`;
  });

  // 2. 타입 힌트 변환
  Object.entries(conversionRules.types).forEach(([phpType, tsType]) => {
    const regex = new RegExp(`\\b${phpType}\\s+\\$`, 'g');
    tsCode = tsCode.replace(regex, `${tsType} `);
  });

  // 3. DB 쿼리 → Repository
  Object.entries(conversionRules.dbToRepository).forEach(([phpDb, tsRepo]) => {
    tsCode = tsCode.replace(new RegExp(phpDb, 'g'), tsRepo);
  });

  // 4. PHP 변수 ($var) → TypeScript (var)
  tsCode = tsCode.replace(/\$(\w+)/g, '$1');

  // 5. PHP 배열 → TypeScript 객체
  tsCode = tsCode.replace(/\[\s*'(\w+)'\s*=>\s*/g, '{ $1: ');

  return tsCode;
}

/**
 * 파라미터 변환
 */
function convertParams(phpParams) {
  if (!phpParams.trim()) return '';

  return phpParams.split(',').map(param => {
    const match = param.trim().match(/(\w+)\s+\$(\w+)(?:\s*=\s*(.+))?/);
    if (!match) return param;

    const [, phpType, paramName, defaultValue] = match;
    const tsType = conversionRules.types[phpType] || phpType;
    const optionalMark = defaultValue ? '?' : '';
    const defaultPart = defaultValue ? ` = ${defaultValue}` : '';

    return `${paramName}${optionalMark}: ${tsType}${defaultPart}`;
  }).join(', ');
}

/**
 * 범용 엔진 구조로 변환
 */
function convertToUniversalEngine(tsCode, fileName) {
  // 파일명 기반 카테고리 분류
  const category = categorizeFile(fileName);

  // 삼국지 전용 → 범용 설계
  const universalCode = `
/**
 * ${category} Engine Module
 *
 * 범용 게임 엔진 - 삼국지/은하영웅전설 지원
 * 데몬 아키텍처: 게임 플레이는 캐시만, DB는 영속성/로그만
 */

import { WorldType } from '../types/world.types';
import { IEntity } from '../types/entity.types';
import { CacheService } from '../cache/cache.service';
import { logger } from '../common/logger';

// ===== 범용 인터페이스 =====

interface GameContext {
  worldType: WorldType; // 'sangokushi' | 'logh'
  sessionId: string;
  entity: IEntity; // 범용 엔티티 (장수/사령관/영웅)
}

interface ActionResult {
  success: boolean;
  message: string;
  changes: Record<string, any>;
}

// ===== 엔진 함수 =====

${tsCode}

// ===== 캐시 전용 래퍼 (데몬 아키텍처) =====

/**
 * ⚠️ CRITICAL: API에서 절대 DB 직접 조회 금지!
 * 게임 플레이는 L1/L2 캐시만 사용
 * DB는 크론 저장용 (5초마다)
 */
export class ${category}Engine {
  constructor(
    private cacheService: CacheService
  ) {}

  /**
   * 캐시 우선 데이터 로드
   */
  async loadFromCache<T>(key: string): Promise<T | null> {
    // L1 (메모리) 체크
    const l1 = this.cacheService.l1.get<T>(key);
    if (l1) return l1;

    // L2 (Redis) 체크
    const l2 = await this.cacheService.l2.get<T>(key);
    if (l2) {
      this.cacheService.l1.set(key, l2);
      return l2;
    }

    // 캐시 미스 (에러 로깅, DB 조회 금지!)
    logger.warn('Cache miss', { key });
    return null;
  }

  /**
   * 캐시 업데이트 + Dirty 마킹
   */
  async updateCache<T>(key: string, data: T): Promise<void> {
    // L1 업데이트
    this.cacheService.l1.set(key, data);

    // L2 업데이트
    await this.cacheService.l2.set(key, data);

    // Dirty 마킹 (크론에서 DB 저장)
    await this.cacheService.markDirty(key);
  }
}
`;

  return universalCode;
}

/**
 * 파일명으로 카테고리 분류
 */
function categorizeFile(fileName) {
  const categoryMap = {
    'func_command': 'Command',
    'func_gamerule': 'GameRule',
    'func_converter': 'Converter',
    'func_time_event': 'TimeEvent',
    'func_history': 'History',
    'func_tournament': 'Tournament',
    'func_auction': 'Auction',
    'func_map': 'Map'
  };

  const baseName = path.basename(fileName, '.php');
  return categoryMap[baseName] || 'Unknown';
}

/**
 * 메인 변환 함수
 */
async function convertAll() {
  console.log('🚀 PHP → TypeScript 자동 변환 시작\n');

  // 출력 디렉토리 생성
  if (!fs.existsSync(tsBasePath)) {
    fs.mkdirSync(tsBasePath, { recursive: true });
  }

  const results = {
    success: [],
    failed: [],
    total: phpFiles.length
  };

  for (const phpFile of phpFiles) {
    try {
      const phpPath = path.join(phpBasePath, phpFile);
      const phpCode = fs.readFileSync(phpPath, 'utf-8');

      console.log(`📝 변환 중: ${phpFile}`);

      // 1. PHP → TypeScript 기본 변환
      const basicTs = convertPhpFunction(phpCode);

      // 2. 범용 엔진 구조로 변환
      const universalTs = convertToUniversalEngine(basicTs, phpFile);

      // 3. 파일 저장
      const category = categorizeFile(phpFile);
      const tsFileName = `${category.toLowerCase()}.engine.ts`;
      const tsPath = path.join(tsBasePath, tsFileName);

      fs.writeFileSync(tsPath, universalTs);

      console.log(`✅ 저장 완료: ${tsFileName}\n`);
      results.success.push(phpFile);

    } catch (error) {
      console.error(`❌ 변환 실패: ${phpFile}`, error.message);
      results.failed.push({ file: phpFile, error: error.message });
    }
  }

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('📊 변환 결과 요약');
  console.log('='.repeat(60));
  console.log(`총 파일: ${results.total}`);
  console.log(`성공: ${results.success.length} ✅`);
  console.log(`실패: ${results.failed.length} ❌`);

  if (results.failed.length > 0) {
    console.log('\n실패 목록:');
    results.failed.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }

  console.log('\n✨ 변환 완료!');
  console.log('다음 단계: 타입 에러 수정 및 리팩토링');
}

// 실행
convertAll().catch(console.error);
