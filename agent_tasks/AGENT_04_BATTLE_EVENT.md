# Agent 04: BattleEventHookService 분리 및 개선

## 📌 Context
1000줄이 넘는 `BattleEventHook.service.ts`를 정리하고, 이벤트 트리거 방식을 표준화(Event Emitter 패턴 등)해야 합니다.

## ✅ Checklist
- [ ] `BattleEventHook.service.ts` 분석 및 리팩토링 포인트 파악
- [ ] Node.js `EventEmitter` 또는 커스텀 Pub/Sub 패턴 도입 검토
- [ ] 이벤트 핸들러들을 별도 파일로 분리 (예: `handlers/onGeneralDeath.ts`)
- [ ] 메인 로직에서 직접 호출하던 훅을 이벤트 발행(`emit`)으로 변경

## 💬 Communication
- **Status**: [Pending / In Progress / Done]
- **Current Issue**: 
- **Memo**: 기존 코드가 너무 얽혀있다면, 한 번에 모두 바꾸기보다 점진적으로 도입하는 것을 권장합니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 백엔드 아키텍트입니다.
현재 `BattleEventHook.service.ts`가 너무 비대하고 복잡합니다. 이를 **Event-Driven 아키텍처**로 리팩토링하려 합니다.

1. 현재 훅 시스템이 어떻게 동작하는지 분석하세요.
2. Node.js `EventEmitter`를 활용하여 이벤트를 발행하고 구독하는 구조로 변경할 설계를 제안하세요.
3. 파일 분리 전략을 세워주세요.
```

### 이어지는 프롬프트
```markdown
제안한 설계에 따라 `BattleEventManager`(가칭)를 구현하고, 가장 자주 쓰이는 이벤트(예: 장수 사망, 전투 승리)부터 새로운 이벤트 시스템으로 포팅해주세요.
기존 하드코딩된 호출 부분을 `emit('EVENT_NAME', data)` 형태로 변경해주세요.
```






