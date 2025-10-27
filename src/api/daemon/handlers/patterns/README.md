# 커맨드 핸들러 패턴

## 개요

삼국지 게임의 커맨드를 처리하는 핸들러들입니다. 각 핸들러는 관련된 커맨드 타입들을 그룹화하여 처리합니다.

## 핸들러 목록

### 1. DomesticHandler (내정 핸들러)

8개 내정 커맨드를 처리합니다.

**처리 커맨드:**
- `DEVELOP_AGRICULTURE` (농지개간): 농업 수치 증가, 지력 사용
- `DEVELOP_COMMERCE` (상업투자): 상업 수치 증가, 지력 사용
- `RESEARCH_TECH` (기술연구): 국가 기술 수치 증가, 지력 사용
- `STRENGTHEN_DEFENSE` (수비강화): 방어 수치 증가, 무력 사용
- `REPAIR_WALL` (성벽보수): 성벽 수치 증가, 무력 사용
- `STRENGTHEN_SECURITY` (치안강화): 치안 수치 증가, 무력 사용
- `ENCOURAGE_SETTLEMENT` (정착장려): 인구 증가, 통솔 사용
- `IMPROVE_TRUST` (주민선정): 민심 증가, 통솔 사용

**특징:**
- 크리티컬 시스템 적용 (×1, ×2, ×3)
- 전선 디버프 적용 (수도 제외)
- 능력치 경험치 자동 증가
- 상한선 체크 (city.agri_max 등)

**사용 예시:**
```typescript
import { DomesticHandler } from './patterns';
import { RNGService } from '../../../common/services/rng.service';

const handler = new DomesticHandler();
const context = {
  commandId: 'cmd-123',
  generalId: 'gen-456',
  type: 'DEVELOP_AGRICULTURE',
  payload: {},
  turn: 1,
  rng: RNGService.fromCommand('cmd-123', 'gen-456', 1, 'DEVELOP_AGRICULTURE'),
  generalRepo,
  cityRepo,
  nationRepo,
};

const result = await handler.handle(context);
// result: { success: true, message: '농지개간 완료 (증가: 120)', changes: {...} }
```

### 2. MilitaryHandler (군사 핸들러)

5개 군사 커맨드를 처리합니다.

**처리 커맨드:**
- `TRAIN` (훈련): 훈련도 증가, 사기 감소
- `BOOST_MORALE` (사기진작): 사기 증가, 훈련도 감소
- `CONSCRIPT` (징병): 저렴한 병사 모집 (훈련도/사기 40)
- `RECRUIT` (모병): 비싼 병사 모집 (훈련도/사기 70)
- `DEMOBILIZE` (소집해제): 병사 해산, 인구 복귀

**특징:**
- 통솔력 기반 병력 계산
- 같은 병종 모집 시 평균 계산
- 기술 레벨에 따른 비용 감소
- 인구/민심 감소 처리

**사용 예시:**
```typescript
import { MilitaryHandler } from './patterns';

const handler = new MilitaryHandler();

// 훈련
const trainContext = {
  commandId: 'cmd-123',
  generalId: 'gen-456',
  type: 'TRAIN',
  payload: {},
  turn: 1,
  rng,
  generalRepo,
  cityRepo,
  nationRepo,
};
const result = await handler.handle(trainContext);
// result: { success: true, message: '훈련 완료 (훈련도 +15)', changes: {...} }

// 징병
const conscriptContext = {
  commandId: 'cmd-124',
  generalId: 'gen-456',
  type: 'CONSCRIPT',
  payload: { unitType: 1, amount: 5000 },
  turn: 1,
  rng,
  generalRepo,
  cityRepo,
  nationRepo,
};
const result2 = await handler.handle(conscriptContext);
// result2: { success: true, message: '징병 완료 (5000명 모집)', changes: {...} }
```

### 3. MovementHandler (이동 핸들러)

4개 이동 커맨드를 처리합니다.

**처리 커맨드:**
- `MOVE` (이동): 인접 도시로 이동, 사기 -5
- `FORCE_MARCH` (강행): 3칸 이내 이동, 훈련도 -5, 사기 -5
- `RETURN` (귀환): 수도로 무료 이동
- `BORDER_RETURN` (접경귀환): 비점령 도시에서 가장 가까운 아군 도시로 이동

**특징:**
- 거리 계산 및 검증
- 자국 도시 여부 확인
- 사기/훈련도 감소 처리

**사용 예시:**
```typescript
import { MovementHandler } from './patterns';

const handler = new MovementHandler();

// 이동
const moveContext = {
  commandId: 'cmd-123',
  generalId: 'gen-456',
  type: 'MOVE',
  payload: { targetCityId: 'city-789' },
  turn: 1,
  rng,
  generalRepo,
  cityRepo,
  nationRepo,
};
const result = await handler.handle(moveContext);
// result: { success: true, message: '이동 완료 (낙양)', changes: {...} }

// 귀환
const returnContext = {
  commandId: 'cmd-125',
  generalId: 'gen-456',
  type: 'RETURN',
  payload: {},
  turn: 1,
  rng,
  generalRepo,
  cityRepo,
  nationRepo,
};
const result2 = await handler.handle(returnContext);
// result2: { success: true, message: '귀환 완료 (장안)', changes: {...} }
```

### 4. StratagemHandler (계략 핸들러)

4개 계략 커맨드를 처리합니다.

**처리 커맨드:**
- `AGITATE` (선동): 민심 감소
- `SEIZE` (탈취): 자원 탈취
- `SABOTAGE` (파괴): 시설 파괴
- `FIRE_ATTACK` (화계): 성벽 파괴

**특징:**
- 지력 기반 성공률 계산
- 방어 장수 수에 따른 방어력 증가
- 실패 시 부상 처리
- 랜덤 피해량 (100~800)

**성공률 공식:**
```
확률 = 0.35 + (공격자지력 - 방어자지력) / 300 - 방어장수수 × 0.04
```

**사용 예시:**
```typescript
import { StratagemHandler } from './patterns';

const handler = new StratagemHandler();

// 선동
const agitateContext = {
  commandId: 'cmd-123',
  generalId: 'gen-456',
  type: 'AGITATE',
  payload: { targetCityId: 'city-789' },
  turn: 1,
  rng,
  generalRepo,
  cityRepo,
  nationRepo,
};
const result = await handler.handle(agitateContext);
// 성공: { success: true, message: '선동 성공! (trust -350)', changes: {...} }
// 실패: { success: true, message: '선동 실패! (부상 +25)', changes: {...} }
```

## 공통 인터페이스

### CommandContext

커맨드 실행에 필요한 컨텍스트 정보입니다.

```typescript
interface CommandContext {
  commandId: string;      // 커맨드 ID
  generalId: string;      // 장수 ID
  type: string;           // 커맨드 타입
  payload: any;           // 커맨드 페이로드
  turn: number;           // 현재 턴
  rng: SplitMix32;       // 난수 생성기
  generalRepo: any;       // 장수 Repository
  cityRepo: any;          // 도시 Repository
  nationRepo: any;        // 국가 Repository
}
```

### CommandResult

커맨드 실행 결과입니다.

```typescript
interface CommandResult {
  success: boolean;       // 성공 여부
  message: string;        // 결과 메시지 (한글)
  changes?: any;          // 변경사항 (선택)
}
```

### CommandHandler

모든 핸들러가 구현하는 인터페이스입니다.

```typescript
interface CommandHandler {
  handle(context: CommandContext): Promise<CommandResult>;
}
```

## 사용된 서비스

### DomesticService
- 내정 점수 계산
- 크리티컬 적용
- 전선 디버프 계산

### MilitaryService
- 최대 병력 계산
- 징병/모병 비용 계산
- 평균 훈련도/사기 계산

### SabotageService
- 계략 성공률 계산
- 피해량 계산
- 부상 처리

### ValidatorService
- 전제조건 검증
- 자원 확인
- 도시 소속 확인

### CostService
- 비용 검증
- 비용 차감
- 자원 추가

### ExperienceService
- 경험치 계산
- 공헌도 계산
- 능력치 경험치 증가

## 통합 예시

CommandProcessor에서 핸들러를 사용하는 방법:

```typescript
import {
  DomesticHandler,
  MilitaryHandler,
  MovementHandler,
  StratagemHandler,
  CommandContext,
  CommandResult,
} from './handlers/patterns';
import { RNGService } from '../../common/services/rng.service';

class CommandProcessor {
  private domesticHandler = new DomesticHandler();
  private militaryHandler = new MilitaryHandler();
  private movementHandler = new MovementHandler();
  private stratagemHandler = new StratagemHandler();

  async processCommand(commandId: string, commandData: any): Promise<CommandResult> {
    const context: CommandContext = {
      commandId,
      generalId: commandData.generalId,
      type: commandData.type,
      payload: commandData.payload,
      turn: commandData.turn || 1,
      rng: RNGService.fromCommand(
        commandId,
        commandData.generalId,
        commandData.turn || 1,
        commandData.type
      ),
      generalRepo: this.generalRepo,
      cityRepo: this.cityRepo,
      nationRepo: this.nationRepo,
    };

    // 커맨드 타입에 따라 적절한 핸들러 선택
    if (this.isDomesticCommand(commandData.type)) {
      return await this.domesticHandler.handle(context);
    } else if (this.isMilitaryCommand(commandData.type)) {
      return await this.militaryHandler.handle(context);
    } else if (this.isMovementCommand(commandData.type)) {
      return await this.movementHandler.handle(context);
    } else if (this.isStratagemCommand(commandData.type)) {
      return await this.stratagemHandler.handle(context);
    }

    return { success: false, message: '알 수 없는 커맨드 타입입니다.' };
  }

  private isDomesticCommand(type: string): boolean {
    return [
      'DEVELOP_AGRICULTURE',
      'DEVELOP_COMMERCE',
      'RESEARCH_TECH',
      'STRENGTHEN_DEFENSE',
      'REPAIR_WALL',
      'STRENGTHEN_SECURITY',
      'ENCOURAGE_SETTLEMENT',
      'IMPROVE_TRUST',
    ].includes(type);
  }

  private isMilitaryCommand(type: string): boolean {
    return ['TRAIN', 'BOOST_MORALE', 'CONSCRIPT', 'RECRUIT', 'DEMOBILIZE'].includes(type);
  }

  private isMovementCommand(type: string): boolean {
    return ['MOVE', 'FORCE_MARCH', 'RETURN', 'BORDER_RETURN'].includes(type);
  }

  private isStratagemCommand(type: string): boolean {
    return ['AGITATE', 'SEIZE', 'SABOTAGE', 'FIRE_ATTACK'].includes(type);
  }
}
```

## 주의사항

1. **RNG 시드**: 각 커맨드마다 고유한 시드를 사용하여 결정론적 난수 생성
2. **트랜잭션**: Repository는 트랜잭션 바운드에서 사용되어야 함
3. **검증 순서**: 비용 검증 → 전제조건 검증 → 실행
4. **상한선**: 도시 능력치는 _max 필드 또는 고정 상한선 체크
5. **민심**: 내정 커맨드는 민심 50 이상 필요
6. **부상**: 부상 상태에서는 대부분의 커맨드 실행 불가
7. **메시지**: 모든 메시지는 한글로 작성

## 게임 로직 스펙

자세한 게임 로직은 [GAME_LOGIC_SPEC.md](../../../../GAME_LOGIC_SPEC.md)를 참고하세요.
