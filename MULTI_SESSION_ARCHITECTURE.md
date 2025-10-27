# 멀티 세션 아키텍처 설계

## 핵심 개념

**"한 테이블 = 하나의 데이터"** 관점에서 보면:

```
GameSession (게임 서버/시나리오)
  ├─ General[] (장수 목록)
  ├─ City[] (도시 목록)
  ├─ Nation[] (국가 목록)
  ├─ Command[] (명령 목록)
  └─ ... (기타 데이터)
```

- **General, City, Nation 등은 독립적인 엔티티가 아니라 GameSession의 하위 데이터**
- **여러 GameSession이 동시에 실행 가능**
- **각 세션의 데이터는 완전히 격리됨**

## 실제 사례

### scenario 폴더 구조
```
scenario/
├── scenario_0.json      → GameSession 1 템플릿
├── scenario_1.json      → GameSession 2 템플릿
├── scenario_2010.json   → GameSession 3 템플릿 (영웅 난무)
└── ...
```

각 시나리오 파일은 **하나의 게임 세션 템플릿**입니다.

### 실제 운영 시나리오

1. **서버 1**: "공백지 일반" (scenario_0)
   - General 800명
   - City 100개
   - Nation 30개

2. **서버 2**: "영웅 난무" (scenario_2010)
   - General 1500명
   - City 100개
   - Nation 50개

3. **서버 3**: "소형 맵" (scenario_1)
   - General 200명
   - City 30개
   - Nation 10개

**모든 서버가 동시에 실행되며, 각각의 데이터는 독립적입니다.**

## 데이터 모델 변경

### Before (단일 세션)
```typescript
interface IGeneral {
  id: string;
  name: string;
  nation: string;
  city: string;
  // ...
}
```

모든 장수가 하나의 컬렉션에 섞여 있음.

### After (멀티 세션)
```typescript
interface IGeneral {
  id: string;
  sessionId: string; // 🔑 핵심 추가!
  name: string;
  nation: string;
  city: string;
  // ...
}
```

`sessionId`로 데이터를 격리합니다.

## 쿼리 패턴

### 단일 세션 (Before)
```typescript
// 모든 장수 조회
await GeneralModel.find();

// 특정 국가의 장수 조회
await GeneralModel.find({ nation: nationId });
```

### 멀티 세션 (After)
```typescript
// 특정 세션의 모든 장수 조회
await GeneralModel.find({ sessionId: 'session-123' });

// 특정 세션의 특정 국가 장수 조회
await GeneralModel.find({ 
  sessionId: 'session-123',
  nation: nationId 
});
```

**모든 쿼리에 `sessionId` 필터가 필수입니다.**

## 인덱스 전략

```typescript
// 기존
GeneralSchema.index({ nation: 1, npc: 1 });
GeneralSchema.index({ city: 1 });

// 멀티 세션 (sessionId가 항상 첫 번째)
GeneralSchema.index({ sessionId: 1, nation: 1, npc: 1 });
GeneralSchema.index({ sessionId: 1, city: 1 });
GeneralSchema.index({ sessionId: 1, name: 1 });
```

## API 라우팅

### URL 구조
```
/api/sessions/:sessionId/generals
/api/sessions/:sessionId/cities
/api/sessions/:sessionId/nations
/api/sessions/:sessionId/commands
```

또는

```
/api/:sessionId/generals
/api/:sessionId/cities
/api/:sessionId/nations
/api/:sessionId/commands
```

### 예시
```typescript
// GET /api/sessions/scenario-2010/generals
router.get('/:sessionId/generals', async (req, res) => {
  const { sessionId } = req.params;
  const generals = await generalService.getAll(sessionId);
  res.json({ data: generals });
});

// POST /api/sessions/scenario-2010/commands
router.post('/:sessionId/commands', async (req, res) => {
  const { sessionId } = req.params;
  const command = await commandService.submit(sessionId, req.body);
  res.json({ data: command });
});
```

## Game Daemon 아키텍처

### 단일 세션 (Before)
```
Game Daemon (1개)
  └─ 모든 세션의 데이터 처리
```

### 멀티 세션 (After)

**옵션 1**: 세션별 독립 Daemon
```
Session 1 Daemon
  └─ Session 1 데이터만 처리

Session 2 Daemon
  └─ Session 2 데이터만 처리

Session 3 Daemon
  └─ Session 3 데이터만 처리
```

**옵션 2**: 단일 Daemon, 세션별 격리
```
Game Daemon (1개)
  ├─ Session 1 Worker
  ├─ Session 2 Worker
  └─ Session 3 Worker
```

**추천**: 옵션 2 (리소스 효율적)

```typescript
// daemon/game-loop.ts
class GameLoop {
  private sessions: Map<string, SessionWorker> = new Map();
  
  async start() {
    // 모든 활성 세션 로드
    const sessions = await GameSessionModel.find({ status: 'running' });
    
    for (const session of sessions) {
      const worker = new SessionWorker(session.id);
      this.sessions.set(session.id, worker);
      worker.start();
    }
  }
  
  // 100ms마다 실행
  tick() {
    for (const [sessionId, worker] of this.sessions) {
      worker.tick();
    }
  }
}

class SessionWorker {
  constructor(private sessionId: string) {}
  
  tick() {
    // 이 세션의 데이터만 처리
    this.processCommands(this.sessionId);
    this.updateTurns(this.sessionId);
    // ...
  }
  
  async processCommands(sessionId: string) {
    const commands = await CommandModel.find({
      sessionId,
      status: 'EXECUTING',
      completionTime: { $lte: new Date() }
    });
    
    for (const cmd of commands) {
      await this.handleCommand(cmd);
    }
  }
}
```

## Redis Streams 구조

### 단일 세션 (Before)
```
cmd:game (1개 스트림)
  └─ 모든 명령
```

### 멀티 세션 (After)
```
cmd:game:session-1
cmd:game:session-2
cmd:game:session-3
```

또는 메시지에 sessionId 포함:
```
cmd:game (1개 스트림)
  ├─ { sessionId: 'session-1', ... }
  ├─ { sessionId: 'session-2', ... }
  └─ { sessionId: 'session-3', ... }
```

**추천**: 세션별 독립 스트림 (격리가 명확)

```typescript
class CommandQueue {
  async publish(sessionId: string, command: any) {
    const streamName = `cmd:game:${sessionId}`;
    await this.redis.xadd(streamName, {
      generalId: command.generalId,
      type: command.type,
      payload: JSON.stringify(command.payload),
    });
  }
  
  async consume(sessionId: string, callback: Function) {
    const streamName = `cmd:game:${sessionId}`;
    // XREADGROUP으로 소비
  }
}
```

## 캐시 전략

### 캐시 키 패턴
```typescript
// Before
cache:general:${generalId}

// After
cache:${sessionId}:general:${generalId}
cache:${sessionId}:city:${cityId}
cache:${sessionId}:nation:${nationId}
```

### 무효화 채널
```typescript
// Before
channel:cache:invalidate

// After
channel:cache:invalidate:${sessionId}
```

## 구현 체크리스트

### Phase 1: 타입 추가
- [x] IGameSession 타입 정의
- [x] 모든 도메인에 sessionId 추가
- [ ] GameSession 스키마 생성

### Phase 2: 스키마 업데이트
- [ ] GeneralSchema에 sessionId 필드 추가
- [ ] CitySchema에 sessionId 필드 추가
- [ ] NationSchema에 sessionId 필드 추가
- [ ] CommandSchema에 sessionId 필드 추가
- [ ] 인덱스 재구성 (sessionId 우선)

### Phase 3: Service 레이어 수정
- [ ] 모든 Repository 메서드에 sessionId 파라미터 추가
- [ ] 모든 Service 메서드에 sessionId 파라미터 추가
- [ ] 쿼리에 sessionId 필터 추가

### Phase 4: API 라우팅
- [ ] URL 패턴 결정 (/api/:sessionId/* 또는 /api/sessions/:sessionId/*)
- [ ] sessionId 파라미터 추출 미들웨어
- [ ] 세션 존재 여부 검증 미들웨어

### Phase 5: Game Daemon
- [ ] SessionWorker 클래스 구현
- [ ] 세션별 Command Stream
- [ ] 세션별 게임 루프

### Phase 6: 시나리오 로더
- [ ] scenario/*.json 파싱
- [ ] GameSession 생성 API
- [ ] 초기 데이터 로드 (General, City, Nation)

## 예상 질문

### Q: 왜 sessionId를 모든 테이블에 넣어야 하나요?
A: 데이터 격리를 위해서입니다. 서버 1의 "관우"와 서버 2의 "관우"는 완전히 다른 데이터입니다.

### Q: sessionId를 외래 키로 설정해야 하나요?
A: MongoDB는 외래 키가 없지만, 애플리케이션 레벨에서 검증해야 합니다.

### Q: 세션이 끝나면 데이터를 삭제하나요?
A: 선택 사항입니다. 보관 (status='finished') 또는 아카이빙 후 삭제 가능합니다.

### Q: 세션 간 데이터 공유는?
A: 기본적으로 격리되지만, User 레벨 데이터 (user_record, ng_betting 등)는 공유 가능합니다.

## 다음 단계

1. **GameSession 도메인 완전 구현**
   - Schema, Repository, Service, Controller, Router

2. **기존 도메인에 sessionId 통합**
   - 모든 CRUD에 sessionId 필터 추가

3. **시나리오 로더 구현**
   - scenario/*.json → GameSession + 초기 데이터

4. **멀티 세션 Daemon 구현**
   - SessionWorker 기반 격리 처리

---

**중요**: 이 변경은 전체 아키텍처에 영향을 미치므로, 단계적으로 진행해야 합니다.
