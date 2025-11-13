# 커맨드 테스트 가이드

## 개요

모든 게임 커맨드에 대한 자동화된 테스트 스위트입니다.

### 테스트 현황

- **General Commands**: 65개 테스트 파일
- **Nation Commands**: 9개 테스트 파일
- **통합 테스트**: 보급 제약 조건 통합 테스트
- **총 커버리지**: 74개 커맨드

## 테스트 실행 방법

### 전체 테스트 실행
```bash
npm test
```

### 특정 커맨드 테스트 실행
```bash
# 징병 커맨드 테스트
npm test -- conscript.test.ts

# 단련 커맨드 테스트
npm test -- train.test.ts
```

### 보급 제약 통합 테스트 실행
```bash
npm test -- supply-constraints.integration.test.ts
```

### 타입 체크만 실행
```bash
npm run typecheck
```

## 테스트 구조

### 1. 테스트 헬퍼 (`test-helpers.ts`)

모든 테스트에서 공통으로 사용하는 Mock 객체와 헬퍼 함수를 제공합니다.

#### MockObjects
- `createMockGeneral(options)`: 장수 Mock 객체 생성
- `createMockCity(options)`: 도시 Mock 객체 생성
- `createMockNation(options)`: 국가 Mock 객체 생성
- `createMockEnv(options)`: 환경 Mock 객체 생성
- `createMockRNG(options)`: RNG Mock 객체 생성

#### ConstraintTestHelper
- `hasConstraint(constraints, searchText)`: 제약 존재 확인
- `testConstraint(constraints, searchText, input, env)`: 제약 테스트
- `allConstraintsPassed(constraints, input, env)`: 모든 제약 통과 확인
- `findFailedConstraints(constraints, input, env)`: 실패한 제약 찾기

#### CommandTestHelper
- `prepareCommand(CommandClass, generalOptions, cityOptions, nationOptions, envOptions, arg)`: 커맨드 준비
- `validateCost(cost, expectedGold, expectedRice)`: 비용 검증
- `executeAndValidate(command, rng)`: 커맨드 실행 및 검증

### 2. 개별 커맨드 테스트

각 커맨드마다 다음 테스트 케이스를 포함합니다:

#### 기본 구조 테스트
- 클래스 정의 확인
- getName() 메서드 확인

#### 인스턴스 생성 테스트
- 유효한 인자로 인스턴스 생성

#### argTest 테스트 (해당하는 경우)
- 유효한 인자 검증
- 잘못된 인자 거부

#### 제약 조건 테스트
- minConditionConstraints 정의 확인
- fullConditionConstraints 정의 확인

#### 비용 계산 테스트
- getCost() 반환값 형식 확인
- 비용 음수 검증

#### 턴 요구사항 테스트
- getPreReqTurn() 반환값 확인
- getPostReqTurn() 반환값 확인

### 3. 통합 테스트

#### 보급 제약 조건 통합 테스트 (`supply-constraints.integration.test.ts`)

다음 내정 커맨드들에 대해 테스트합니다:
- 징병 (Conscript)
- 단련 (Train)
- 사기진작 (BoostMorale)
- 훈련 (TrainTroops)
- 상업투자 (InvestCommerce)
- 농지개간 (CultivateLand)
- 치안강화 (ReinforceSecurity)
- 성벽보수 (RepairWall)
- 수비강화 (ReinforceDefense)
- 민심 (GoodGovernance)
- 둔전 (EncourageSettlement)

**테스트 케이스:**
1. 보급이 끊긴 도시에서 실행 불가
2. 보급이 연결된 도시에서 실행 가능
3. 점령한 도시에서만 실행 가능
4. 적국 도시에서 실행 불가
5. 재야는 실행 불가
6. SuppliedCity 제약 존재 확인
7. OccupiedCity 제약 존재 확인

## 테스트 추가 방법

### 1. 자동 생성 (권장)

새로운 커맨드를 추가한 후:

```bash
npx ts-node scripts/generate-command-tests.ts
```

### 2. 수동 작성

기본 테스트 템플릿을 복사하여 수정:

```typescript
import { YourCommand } from '../yourCommand';
import { 
  MockObjects, 
  ConstraintTestHelper, 
  CommandTestHelper 
} from '../../__tests__/test-helpers';

describe('YourCommand', () => {
  it('should work correctly', () => {
    const { command, general, city, nation, env } = 
      CommandTestHelper.prepareCommand(
        YourCommand,
        { gold: 10000 },  // general options
        { supply: 1 },    // city options
        { tech: 100 },    // nation options
        {},               // env options
        null              // arg
      );

    // 테스트 로직
    expect(command).toBeDefined();
  });
});
```

### 3. 상세 테스트 추가

자동 생성된 테스트에 다음을 추가할 수 있습니다:

```typescript
describe('상세 시나리오 테스트', () => {
  it('특정 시나리오를 테스트', async () => {
    const { command, general } = CommandTestHelper.prepareCommand(
      YourCommand,
      { crew: 10000, train: 80, atmos: 80 },
      { pop: 100000, trust: 80 },
      { tech: 200 },
      { year: 200, month: 6 },
      { amount: 1000 }
    );

    command['init']();
    command['initWithArg']();

    const rng = MockObjects.createMockRNG({
      choice: 'success',
      nextRange: 1.1
    });

    const result = await command.run(rng);
    expect(result).toBe(true);

    // 상태 변경 검증
    expect(general._vars.get('crew')).toBeGreaterThan(10000);
  });
});
```

## 테스트 모범 사례

### 1. 제약 조건 테스트는 필수

모든 커맨드는 최소한 다음을 테스트해야 합니다:
- 재야 제약
- 점령 도시 제약
- 보급 제약 (내정 커맨드)
- 자금/군량 제약
- 병력 제약 (해당하는 경우)

### 2. Edge Case 테스트

- 0으로 나누기 방지
- 음수 값 처리
- null/undefined 처리
- 최대/최소 경계값

### 3. 상태 변경 검증

커맨드 실행 후:
- 장수 능력치 변경
- 도시 수치 변경
- 자금/군량 소모
- 경험치/공헌도 증가

### 4. 로그 메시지 검증

```typescript
expect(general.getLogger().pushGeneralActionLog)
  .toHaveBeenCalledWith(expect.stringContaining('징병'));
```

## 주의사항

### 1. 비동기 처리

커맨드 run() 메서드는 비동기이므로 async/await 사용:

```typescript
it('should execute command', async () => {
  const result = await command.run(rng);
  expect(result).toBe(true);
});
```

### 2. Mock 객체 재사용

각 테스트는 독립적이어야 하므로 beforeEach에서 Mock 재생성:

```typescript
beforeEach(() => {
  general = MockObjects.createMockGeneral();
  city = MockObjects.createMockCity();
  // ...
});
```

### 3. 데이터베이스 의존성

일부 커맨드는 데이터베이스 의존성이 있습니다. 이 경우:
- Mock 처리 또는
- 통합 테스트로 분리

## 문제 해결

### 테스트가 타임아웃되는 경우

```bash
# 타임아웃 증가
npm test -- --testTimeout=10000
```

### 특정 테스트만 실행하고 싶은 경우

```typescript
// .only 사용
it.only('this test only', () => {
  // ...
});

// .skip 사용
it.skip('skip this test', () => {
  // ...
});
```

### Mock 객체 디버깅

```typescript
console.log('General vars:', Array.from(general._vars.entries()));
console.log('Mock calls:', general.getVar.mock.calls);
```

## 기여 가이드

새로운 테스트를 추가하거나 기존 테스트를 개선할 때:

1. 테스트 이름은 명확하게
2. 각 테스트는 하나의 기능만 검증
3. Given-When-Then 패턴 사용
4. 주석으로 복잡한 로직 설명
5. 테스트 실행 후 PR 제출

## 참고 자료

- Jest 공식 문서: https://jestjs.io/
- TypeScript Jest: https://kulshekhar.github.io/ts-jest/
- 테스트 모범 사례: https://github.com/goldbergyoni/javascript-testing-best-practices
