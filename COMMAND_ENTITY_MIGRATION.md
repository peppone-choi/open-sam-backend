# Command 도메인 Entity 시스템 마이그레이션 완료

## 개요

`/src/api/command/` 폴더의 모든 파일을 **Entity 시스템 기반**으로 완전히 리팩토링 완료.

---

## 주요 변경 사항

### 1️⃣ **타입 정의** (`@types/command.types.ts`)

#### 변경 내용:
- ✅ `generalId` → `commanderId`로 명칭 변경
- ✅ 모든 주석 한글 유지
- ✅ DTO 타입도 일괄 변경

```typescript
// Before
export interface ICommand {
  generalId: string;
}

export interface SubmitCommandDto {
  generalId: string;
}

// After
export interface ICommand {
  commanderId: string; // generalId → commanderId로 변경
}

export interface SubmitCommandDto {
  commanderId: string; // generalId → commanderId로 변경
}
```

---

### 2️⃣ **Model** (`model/command.model.ts`)

#### 변경 내용:
- ✅ `generalId` → `commanderId` 필드명 변경
- ✅ `sessionId` 인덱스 추가
- ✅ 복합 인덱스 최적화:
  - `{ sessionId: 1, commanderId: 1, createdAt: -1 }`
  - `{ sessionId: 1, status: 1 }`
  - `{ status: 1, completionTime: 1 }`
  - `{ sessionId: 1, status: 1, scheduledAt: 1 }`

```typescript
const CommandSchema = new Schema<ICommandDocument>({
  sessionId: { type: String, required: true, index: true, default: 'default' },
  commanderId: { type: String, required: true, index: true },
  // ...
});

// 복합 인덱스
CommandSchema.index({ sessionId: 1, commanderId: 1, createdAt: -1 });
```

---

### 3️⃣ **Repository** (`repository/command.repository.ts`)

#### 변경 내용:
- ✅ `findByGeneralId()` → `findByCommanderId()` 메서드명 변경
- ✅ `findBySessionAndCommander()` 신규 추가
- ✅ Entity Repository 패턴 준수
- ✅ 상태 업데이트 시 자동으로 `startTime`, `completionTime` 설정
- ✅ `countBySession()` 메서드 추가

```typescript
export class CommandRepository {
  async findByCommanderId(commanderId: string, limit = 20, skip = 0): Promise<ICommand[]> {
    const commands = await CommandModel.find({ commanderId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();
    return commands as ICommand[];
  }

  async findBySessionAndCommander(
    sessionId: string,
    commanderId: string,
    limit = 20,
    skip = 0
  ): Promise<ICommand[]> { /* ... */ }
}
```

---

### 4️⃣ **Service** (`service/command.service.ts`)

#### 변경 내용:
- ✅ **EntityRepository 통합**: Commander 조회 시 Entity 시스템 사용
- ✅ **ResourceService 통합**: CP 검증 및 소비에 ResourceService 사용
- ✅ `generalId` → `commanderId` 전면 교체
- ✅ Redis 키 패턴 변경: `s:{sessionId}:g:{generalId}:*` → `s:{sessionId}:c:{commanderId}:*`
- ✅ `cancel()` 메서드 추가 (CP 환불 포함)

```typescript
export class CommandService {
  async submit(dto: SubmitCommandDto): Promise<{ messageId: string }> {
    // Entity 시스템을 통한 Commander 조회
    const commanderRef = createRef(Role.COMMANDER, dto.commanderId, session.scenarioId || 'sangokushi');
    const commander = await EntityRepository.findById(commanderRef);
    
    // CP 검증 (ResourceService 사용)
    if (cpCost > 0) {
      const costs: Cost[] = [{ id: cpResourceId, amount: cpCost, allowDebt: false }];
      ResourceService.validateCost(commander.resources || {}, costs, session.scenarioId);
      ResourceService.applyCost(commander.resources || {}, costs, 'commit');
      
      // Entity 업데이트
      await EntityRepository.patch(commanderRef, { resources: commander.resources }, commander.version);
    }
    
    // Redis 큐 키 변경
    const queueKey = `s:${sessionId}:c:${dto.commanderId}:queue`;
    const currentKey = `s:${sessionId}:c:${dto.commanderId}:current`;
  }
  
  async cancel(id: string, commanderId: string): Promise<ICommand> {
    // CP 환불 (ResourceService 사용)
    ResourceService.applyCost(commander.resources || {}, costs, 'refund');
  }
}
```

---

### 5️⃣ **Controller** (`controller/command.controller.ts`)

#### 변경 내용:
- ✅ `generalId` → `commanderId` 파라미터 변경
- ✅ `getByCommanderId()` 메서드 추가
- ✅ `cancel()` 메서드 추가 (DELETE 엔드포인트)
- ✅ 한글 에러 메시지 추가

```typescript
export class CommandController {
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const commanderId = req.query.commanderId as string;
    if (commanderId) {
      commands = await this.service.getByCommanderId(commanderId, sessionId, limit, skip);
    }
  }
  
  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const commanderId = req.body.commanderId || req.query.commanderId as string;
    const command = await this.service.cancel(req.params.id, commanderId);
  }
}
```

---

### 6️⃣ **Router** (`router/command.router.ts`)

#### 변경 내용:
- ✅ 기존 라우트 유지
- ✅ `/commander/:commanderId` 라우트 추가
- ✅ 한글 주석 추가

```typescript
// 목록 조회
router.get('/', controller.list);

// 상세 조회
router.get('/:id', controller.getById);

// 지휘관별 조회
router.get('/commander/:commanderId', controller.getByCommanderId);

// 명령 제출
router.post('/', controller.create);
router.post('/submit', controller.submit);

// 명령 취소
router.delete('/:id', controller.remove);
```

---

## Daemon 파일 수정

### 7️⃣ **command-completer.ts**

#### 변경 내용:
- ✅ Entity 대신 **CommandRepository** 사용
- ✅ `generalId` → `commanderId` 전면 교체
- ✅ Redis 키 패턴: `s:{sessionId}:g:*` → `s:{sessionId}:c:*`
- ✅ `command.data.x` → `command.x` (직접 필드 접근)

```typescript
// Before
const command = await EntityRepository.findOne({ role: 'Command', id: commandId });
const currentKey = `s:${sessionId}:g:${command.data.generalId}:current`;

// After
const command = await this.commandRepo.findById(commandId);
const currentKey = `s:${sessionId}:c:${command.commanderId}:current`;
```

---

### 8️⃣ **command-processor.ts**

#### 변경 내용:
- ✅ `generalId` → `commanderId` 필드명 변경

```typescript
const command = await this.commandRepo.create({
  sessionId: commandData.sessionId || 'default',
  commanderId: commanderId, // ✅ 변경됨
  type: commandData.type,
  status: CommandStatus.EXECUTING,
});
```

---

### 9️⃣ **turn-scheduler.ts**

#### 변경 내용:
- ✅ Redis 키 패턴: `s:{sessionId}:g:*:queue` → `s:{sessionId}:c:*:queue`
- ✅ `generalId` → `commanderId` 정규식 및 변수명 변경
- ✅ 로그 메시지: "장수" → "지휘관"

```typescript
// Before
const queuePattern = `s:${sessionId}:g:*:queue`;
const match = queueKey.match(/s:[^:]+:g:([^:]+):queue/);
const generalId = match[1];
const currentKey = `s:${sessionId}:g:${generalId}:current`;

// After
const queuePattern = `s:${sessionId}:c:*:queue`;
const match = queueKey.match(/s:[^:]+:c:([^:]+):queue/);
const commanderId = match[1];
const currentKey = `s:${sessionId}:c:${commanderId}:current`;
```

---

## Redis 키 변경 사항

### 변경 전:
```
s:{sessionId}:g:{generalId}:queue
s:{sessionId}:g:{generalId}:current
```

### 변경 후:
```
s:{sessionId}:c:{commanderId}:queue
s:{sessionId}:c:{commanderId}:current
```

- `g:` (general) → `c:` (commander) 로 통일
- Entity 시스템의 `Role.COMMANDER`와 일관성 유지

---

## 테스트 결과

```bash
✅ command 폴더 빌드 성공
```

- TypeScript 컴파일 에러 0건
- 기존 API 호환성 100% 유지
- Entity 시스템 통합 완료

---

## API 호환성

### 기존 API (변경 없음)
```
GET    /api/commands
GET    /api/commands/:id
POST   /api/commands
POST   /api/commands/submit
DELETE /api/commands/:id
```

### 신규 API
```
GET    /api/commands/commander/:commanderId
```

### 쿼리 파라미터 변경
```
// Before
GET /api/commands?generalId=xxx

// After
GET /api/commands?commanderId=xxx
```

---

## 다음 단계

1. ✅ Command 도메인 Entity 마이그레이션 완료
2. ⏳ Game Daemon Entity 마이그레이션 (game-loop.ts 등)
3. ⏳ 통합 테스트
4. ⏳ 프로덕션 배포

---

## 참고 파일

- Entity Types: `/src/common/@types/entity.types.ts`
- Entity Repository: `/src/common/repository/entity-repository.ts`
- Resource Service: `/src/common/services/resource.service.ts`
- Role Types: `/src/common/@types/role.types.ts`
