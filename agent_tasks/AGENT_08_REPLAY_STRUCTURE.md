# Agent 08: Battle Replay Structure & Logger

## 📌 Context
턴제 전투를 재현하기 위한 리플레이 데이터 구조 설계 및 로깅 시스템 구현입니다.

## ✅ Checklist
- [x] 리플레이 JSON 데이터 구조(Interface) 정의 (`ReplayData`, `TurnLog`, `ActionLog`)
- [x] `ReplayBuilder` 클래스 구현 (로그 수집기)
- [x] `ProcessWar.ts` (또는 분리된 서비스) 내 적절한 위치에 로깅 훅 삽입
- [x] 데이터 용량 최적화 (중복 데이터 최소화)

## 💬 Communication
- **Status**: [Done]
- **Current Issue**: 
- **Memo**: `ProcessWar.ts`의 `processWar_NG` 로직을 `processTurn` 함수로 추출하여 턴 단위 로깅을 수행하도록 리팩토링했습니다. `ReplayBuilder`는 `open-sam-backend/src/services/war/BattleReplay.ts`에 위치합니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 데이터 구조 설계 전문가입니다.
턴제 전략 게임의 **전투 리플레이 시스템**을 위해 JSON 데이터 구조를 정의해주세요.

요구사항:
- 전투 초기 상태(부대 위치, 병력, 장수 정보)
- 턴별 행동(이동, 공격, 스킬 사용) 및 결과(데미지, 병력 감소, 사기 저하)
- 데이터 크기 최소화 (모든 스냅샷 저장 지양)

TypeScript Interface로 정의해주세요.
```

### 이어지는 프롬프트
```markdown
정의한 구조를 바탕으로 `ReplayBuilder` 클래스를 구현하세요.
`addTurnLog()`, `addAction()` 같은 메서드를 제공하여 전투 로직 중간중간에 호출하여 로그를 쌓을 수 있게 해주세요.
그리고 `ProcessWar.ts`의 `processTurn` 메서드 내부에 이 로거를 심어주세요.
```
