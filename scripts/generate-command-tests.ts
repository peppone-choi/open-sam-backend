/**
 * 커맨드 테스트 자동 생성 스크립트
 * 
 * 모든 커맨드에 대해 기본 테스트 케이스를 자동으로 생성합니다.
 * 
 * Usage: npx ts-node scripts/generate-command-tests.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface CommandInfo {
  fileName: string;
  className: string;
  commandType: 'general' | 'nation';
  hasArg: boolean;
}

const COMMANDS_DIR = path.join(__dirname, '../src/commands');

/**
 * 커맨드 파일에서 클래스명과 정보 추출
 */
function extractCommandInfo(filePath: string, commandType: 'general' | 'nation'): CommandInfo | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 클래스명 추출
  const classMatch = content.match(/export class (\w+Command) extends/);
  if (!classMatch) return null;
  
  const className = classMatch[1];
  const fileName = path.basename(filePath, '.ts');
  
  // reqArg 확인
  const hasArg = content.includes('static public $reqArg = true') ||
                 content.includes('static reqArg = true') ||
                 content.includes('protected argTest()');
  
  return {
    fileName,
    className,
    commandType,
    hasArg
  };
}

/**
 * 테스트 파일 생성
 */
function generateTestFile(info: CommandInfo): string {
  const { className, fileName, commandType, hasArg } = info;
  
  return `/**
 * ${className} 자동 생성 테스트
 * 
 * 이 파일은 scripts/generate-command-tests.ts에 의해 자동 생성되었습니다.
 * 필요에 따라 테스트 케이스를 추가하거나 수정하세요.
 */

import { ${className} } from '../${fileName}';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('${className}', () => {
  describe('기본 구조 테스트', () => {
    it('클래스가 정의되어 있어야 함', () => {
      expect(${className}).toBeDefined();
    });

    it('getName() 메서드가 있어야 함', () => {
      expect(typeof ${className}.getName).toBe('function');
      const name = ${className}.getName();
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe('인스턴스 생성 테스트', () => {
    it('유효한 인자로 인스턴스를 생성할 수 있어야 함', () => {
      const { command, general, city, nation, env } = CommandTestHelper.prepareCommand(
        ${className},
        {}, // general options
        {}, // city options
        {}, // nation options
        {}, // env options
        ${hasArg ? '{ /* TODO: 적절한 arg 추가 */ }' : 'null'}
      );

      expect(command).toBeDefined();
      expect(command instanceof ${className}).toBe(true);
    });
  });

  ${hasArg ? `describe('argTest 테스트', () => {
    it('유효한 인자를 검증해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        { /* TODO: 유효한 arg */ }
      );

      const result = command['argTest']();
      
      expect(typeof result).toBe('boolean');
    });

    it('잘못된 인자를 거부해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        null
      );

      const result = command['argTest']();
      expect(result).toBe(false);
    });
  });` : ''}

  describe('제약 조건 테스트', () => {
    it('minConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        ${hasArg ? '{ /* TODO */ }' : 'null'}
      );

      command['init']();
      
      const constraints = command['minConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });

    it('fullConditionConstraints가 정의되어 있어야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        ${hasArg ? '{ /* TODO */ }' : 'null'}
      );

      command['init']();
      ${hasArg ? "command['initWithArg']();" : ''}
      
      const constraints = command['fullConditionConstraints'];
      expect(Array.isArray(constraints)).toBe(true);
    });
  });

  describe('비용 계산 테스트', () => {
    it('getCost()가 [금, 쌀] 배열을 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        ${hasArg ? '{ /* TODO */ }' : 'null'}
      );

      command['init']();
      ${hasArg ? "command['initWithArg']();" : ''}

      const cost = command.getCost();
      expect(Array.isArray(cost)).toBe(true);
      expect(cost.length).toBe(2);
      expect(typeof cost[0]).toBe('number');
      expect(typeof cost[1]).toBe('number');
    });

    it('비용이 음수가 아니어야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        ${hasArg ? '{ /* TODO */ }' : 'null'}
      );

      command['init']();
      ${hasArg ? "command['initWithArg']();" : ''}

      const [gold, rice] = command.getCost();
      expect(gold).toBeGreaterThanOrEqual(0);
      expect(rice).toBeGreaterThanOrEqual(0);
    });
  });

  describe('턴 요구사항 테스트', () => {
    it('getPreReqTurn()이 숫자를 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        ${hasArg ? '{ /* TODO */ }' : 'null'}
      );

      const preTurn = command.getPreReqTurn();
      expect(typeof preTurn).toBe('number');
      expect(preTurn).toBeGreaterThanOrEqual(0);
    });

    it('getPostReqTurn()이 숫자를 반환해야 함', () => {
      const { command } = CommandTestHelper.prepareCommand(
        ${className},
        {}, {}, {}, {},
        ${hasArg ? '{ /* TODO */ }' : 'null'}
      );

      const postTurn = command.getPostReqTurn();
      expect(typeof postTurn).toBe('number');
      expect(postTurn).toBeGreaterThanOrEqual(0);
    });
  });

  
  // - 특정 제약 조건 테스트
  // - run() 메서드 실행 테스트
  // - 상태 변경 검증
  // - 로그 메시지 검증
});
`;
}

/**
 * 메인 실행 함수
 */
function main() {
  console.log('🚀 커맨드 테스트 자동 생성 시작...\n');

  let generatedCount = 0;
  let skippedCount = 0;

  // General 커맨드 처리
  const generalCommandsDir = path.join(COMMANDS_DIR, 'general');
  const generalTestDir = path.join(generalCommandsDir, '__tests__');
  
  if (!fs.existsSync(generalTestDir)) {
    fs.mkdirSync(generalTestDir, { recursive: true });
  }

  const generalFiles = fs.readdirSync(generalCommandsDir)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'));

  for (const file of generalFiles) {
    const filePath = path.join(generalCommandsDir, file);
    const info = extractCommandInfo(filePath, 'general');
    
    if (!info) {
      console.log(`⚠️  스킵: ${file} (클래스명을 찾을 수 없음)`);
      skippedCount++;
      continue;
    }

    const testFileName = `${info.fileName}.test.ts`;
    const testFilePath = path.join(generalTestDir, testFileName);

    if (fs.existsSync(testFilePath)) {
      console.log(`⏭️  스킵: ${testFileName} (이미 존재함)`);
      skippedCount++;
      continue;
    }

    const testContent = generateTestFile(info);
    fs.writeFileSync(testFilePath, testContent);
    console.log(`✅ 생성: ${testFileName}`);
    generatedCount++;
  }

  // Nation 커맨드 처리
  const nationCommandsDir = path.join(COMMANDS_DIR, 'nation');
  const nationTestDir = path.join(nationCommandsDir, '__tests__');
  
  if (fs.existsSync(nationCommandsDir)) {
    if (!fs.existsSync(nationTestDir)) {
      fs.mkdirSync(nationTestDir, { recursive: true });
    }

    const nationFiles = fs.readdirSync(nationCommandsDir)
      .filter(f => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'));

    for (const file of nationFiles) {
      const filePath = path.join(nationCommandsDir, file);
      const info = extractCommandInfo(filePath, 'nation');
      
      if (!info) {
        console.log(`⚠️  스킵: ${file} (클래스명을 찾을 수 없음)`);
        skippedCount++;
        continue;
      }

      const testFileName = `${info.fileName}.test.ts`;
      const testFilePath = path.join(nationTestDir, testFileName);

      if (fs.existsSync(testFilePath)) {
        console.log(`⏭️  스킵: ${testFileName} (이미 존재함)`);
        skippedCount++;
        continue;
      }

      const testContent = generateTestFile(info);
      fs.writeFileSync(testFilePath, testContent);
      console.log(`✅ 생성: ${testFileName}`);
      generatedCount++;
    }
  }

  console.log(`\n✨ 완료!`);
  console.log(`   생성: ${generatedCount}개`);
  console.log(`   스킵: ${skippedCount}개`);
}

// 실행
main();
