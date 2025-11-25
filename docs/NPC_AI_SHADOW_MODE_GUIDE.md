# NPC AI Shadow Mode Testing Guide

## Overview

NPC AI Shadow Mode는 PHP GeneralAI와 TypeScript AI의 결정을 비교하기 위한 테스트 모드입니다. AI가 실제로 명령을 실행하지 않고 로깅만 수행하여, 기존 PHP 로직과의 차이를 분석할 수 있습니다.

## AI 모드 설정

### GameConst.ts 설정

```typescript
// src/constants/GameConst.ts
export const GameConst = {
  // ... 기존 설정 ...
  
  NPC_AI_MODE: 'shadow',  // 'disabled' | 'shadow' | 'partial' | 'full'
};
```

### 모드 설명

| 모드 | 설명 | 사용 시나리오 |
|------|------|--------------|
| `disabled` | AI 비활성화 (기본값) | 프로덕션 환경 |
| `shadow` | 로깅만, 실행 안 함 | PHP와 비교 테스트 |
| `partial` | 명장급(npc>=3)만 실행 | 점진적 도입 |
| `full` | 모든 NPC 실행 | 완전 TypeScript AI |

## Shadow Mode 테스트 방법

### 1. 환경 설정

```bash
# 백엔드 서버 시작
cd open-sam-backend
npm run dev

# 로그 모니터링 (별도 터미널)
tail -f d_log/npc-ai-*.log
```

### 2. NPC AI 로그 확인

Shadow 모드에서는 `[NPC-AI]` 태그로 로그가 출력됩니다:

```
[NPC-AI] Shadow mode: General 조조(no=1) would execute:
  Command: che_징병
  Args: { amount: 1000 }
  Weight: 85
  Reason: 전쟁 준비 - 병력 부족
```

### 3. PHP와 비교

1. PHP GeneralAI 로그 확인: `core/d_log/generalAI_*.log`
2. TypeScript AI 로그 확인: `open-sam-backend/d_log/npc-ai-*.log`
3. 동일 NPC의 동일 턴에서 명령 비교

### 비교 체크리스트

- [ ] 같은 장수가 같은 명령을 선택하는가?
- [ ] 명령 파라미터가 동일한가?
- [ ] 가중치(weight)가 유사한가?
- [ ] 선택 이유(reason)가 논리적으로 일치하는가?

## 핵심 AI 모듈

### DiplomacyEngine

외교 상태(dipState) 계산:

```typescript
const engine = new DiplomacyEngine();
await engine.initialize(sessionId, nationID);
const result = await engine.calcDiplomacyState(yearMonth, protectionEndYearMonth);
// result.dipState: 0(평화) ~ 4(전쟁)
```

### DipStateActionSelector

dipState 기반 행동 선택:

```typescript
const selector = new DipStateActionSelector(
  general, city, nation, env, policy, dipState
);
const actions = selector.selectActions(develRate);
// actions: WeightedAction[]
```

### TroopDispatcher

부대 발령 결정:

```typescript
const dispatcher = new TroopDispatcher(nation, env, policy);
dispatcher.setCities(cities);
dispatcher.setGenerals(generals);
const frontResult = await dispatcher.dispatchToFront(dipState);
```

### ForceAssigner

전투/지원/내정 부대 배치:

```typescript
const assigner = new ForceAssigner(nationID, capital, sessionId, policy);
assigner.setCities(cities);
assigner.setGenerals(generals);
const result = await assigner.assign(dipState, warTargetNations);
```

### NationCommandsAI

국가 명령 (승진/포상/몰수/외교):

```typescript
const ai = new NationCommandsAI(sessionId, nationID, chiefGeneral, nation, policy);
const promotionCmd = await ai.generatePromotionCommand();
const rewardCmd = await ai.generateRewardCommand(isUrgent, isUserOnly);
const confiscateCmd = await ai.generateConfiscateCommand();
```

## 로그 분석 스크립트

```bash
# NPC AI 로그에서 특정 장수의 결정 추출
grep "General 조조" d_log/npc-ai-*.log | grep "would execute"

# 명령별 통계
grep "Command:" d_log/npc-ai-*.log | sort | uniq -c | sort -rn

# 가중치 분포 분석
grep "Weight:" d_log/npc-ai-*.log | awk -F': ' '{print $2}' | sort -n | uniq -c
```

## Troubleshooting

### AI가 전혀 동작하지 않음

1. `GameConst.NPC_AI_MODE`가 `disabled`가 아닌지 확인
2. 장수의 `npc` 값 확인 (npc >= 2 여야 AI 대상)
3. `ExecuteEngine.service.ts`에서 AI 호출 여부 확인

### PHP와 결정이 크게 다름

1. `dipState` 계산 결과 비교
2. `genType` (장수 타입) 계산 비교
3. 정책 값(`NationPolicyValues`) 비교
4. 도시 분류(`front`, `supply`) 비교

### 로그가 출력되지 않음

1. 로그 레벨 확인
2. 로그 파일 경로 확인
3. 콘솔 출력으로 임시 디버깅

## 점진적 마이그레이션 계획

### Phase 1: Shadow Mode (현재)
- PHP와 TypeScript AI 병행 운영
- 로그 비교로 동작 검증

### Phase 2: Partial Mode
- 명장급(npc >= 3) NPC만 TypeScript AI
- 일반 NPC는 기존 PHP

### Phase 3: Full Mode
- 모든 NPC를 TypeScript AI로 전환
- PHP GeneralAI 코드 제거

## 참고 파일

| 파일 | 설명 |
|------|------|
| `src/core/DiplomacyEngine.ts` | 외교 상태 계산 |
| `src/core/TroopDispatch.ts` | 부대 발령 |
| `src/core/DipStateActionSelector.ts` | 행동 선택 |
| `src/core/SimpleAI.ts` | 기본 AI 로직 |
| `src/core/ForceAssignment.ts` | 부대 배치 |
| `src/core/NationCommandsAI.ts` | 국가 명령 |
| `src/core/AutorunNationPolicy.ts` | 정책 설정 |
| `src/services/global/ExecuteEngine.service.ts` | AI 실행 엔진 |
