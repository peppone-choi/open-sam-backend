# Turnterm (턴 간격) 유효성 검증

## 개요

세션마다 다른 턴 간격(turnterm)을 가질 수 있습니다 (예: 10분, 30분, 60분).
모든 턴 계산 로직은 각 세션의 `turnterm` 값을 참조하도록 구현되었습니다.

## Turnterm 저장 위치

```
sessions 컬렉션
└── data.turnterm (분 단위, 기본값: 60)
```

## 유효 범위

- **최소값**: 1분
- **최대값**: 1440분 (24시간)
- **기본값**: 60분
- **단위**: 분 (내부적으로 초로 변환하여 사용)

## 초기화 방식

### 1. 세션 생성 시 (init.service.ts)

```typescript
// 우선순위:
// 1. 기존 세션 데이터의 turnterm
// 2. 시나리오 메타데이터의 turnterm (scenario.json)
// 3. 기본값 60분

const scenarioTurnterm = scenarioMetadata?.gameSettings?.turnterm || scenarioMetadata?.turnterm;
session.data.turnterm = session.data.turnterm || scenarioTurnterm || 60;
```

### 2. 시나리오 파일 설정 예시

`config/scenarios/sangokushi/scenario.json`:

```json
{
  "id": "sangokushi",
  "name": "삼국지",
  "turnterm": 60,
  "gameSettings": {
    "turnterm": 60
  }
}
```

### 3. ExecuteEngine 실행 시 유효성 검증

```typescript
// turnterm 유효성 검사 (1분~1440분 사이만 허용)
if (sessionData.turnterm && (sessionData.turnterm < 1 || sessionData.turnterm > 1440)) {
  console.log(`Invalid turnterm: ${sessionData.turnterm}, resetting to 60`);
  sessionData.turnterm = 60;
  session.markModified('data');
  await session.save();
}

// turnterm이 없으면 기본값 설정
if (!sessionData.turnterm) {
  console.log(`Missing turnterm, setting default to 60 minutes`);
  sessionData.turnterm = 60;
  session.markModified('data');
  await session.save();
}
```

## Turnterm 사용 위치

모든 서비스에서 세션의 turnterm을 동적으로 참조합니다:

### 1. GetReservedCommand.service.ts
```typescript
const turnTermInMinutes = gameEnv.turnterm || sessionData.turnterm || 60;
```

### 2. ExecuteEngine.service.ts
```typescript
const turntermInMinutes = sessionData.turnterm || 60;
const turntermInSeconds = turntermInMinutes * 60;
```

### 3. Join.service.ts
```typescript
const turnterm = gameEnv.turnterm || 60;
const additionalSeconds = rng % Math.max(turnterm * 60 - 1, 1);
```

### 4. SelectNpc.service.ts
```typescript
aux.next_change = new Date(Date.now() + 12 * (sessionData.turnterm || 60) * 60000);
```

### 5. 기타 모든 턴 관련 서비스
- GetSelectPool.service.ts
- GetSelectNpcToken.service.ts
- SelectPickedGeneral.service.ts
- UpdatePickedGeneral.service.ts
- SetMySetting.service.ts
- ServerBasicInfo.service.ts

## 자동 복구 메커니즘

1. **누락된 turnterm**: 자동으로 60분으로 설정
2. **잘못된 범위**: 1분 미만 또는 1440분 초과 시 60분으로 재설정
3. **ExecuteEngine 실행 시 자동 검증**: 매 턴 실행마다 유효성 확인

## 테스트 방법

### MongoDB에서 turnterm 확인
```javascript
db.sessions.find({}, { session_id: 1, "data.turnterm": 1 })
```

### 특정 세션의 turnterm 변경
```javascript
db.sessions.updateOne(
  { session_id: "sangokushi_default" },
  { $set: { "data.turnterm": 30 } }  // 30분 턴으로 변경
)
```

### 로그 확인
```bash
# ExecuteEngine 로그에서 turnterm 관련 메시지 확인
tail -f logs/app.log | grep -E "turnterm|Turnterm"
```

## 주의사항

1. **단위**: 항상 **분(minute)** 단위로 저장됩니다
2. **변경 시점**: 게임 진행 중 turnterm을 변경하면 다음 턴부터 적용됩니다
3. **년/월 계산**: turnterm이 변경되어도 starttime 기준 경과 턴 수는 정확히 계산됩니다
4. **장수 turntime**: 개별 장수의 다음 턴 시간은 세션 turnterm과 무관하게 독립적으로 관리됩니다

## 관련 파일

- `src/services/init.service.ts` - 세션 초기화 및 turnterm 설정
- `src/services/global/ExecuteEngine.service.ts` - turnterm 유효성 검증
- `src/services/command/GetReservedCommand.service.ts` - 예약 명령 조회 시 turnterm 사용
- `config/scenarios/*/scenario.json` - 시나리오별 기본 turnterm 설정
