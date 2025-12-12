# Agent 02: BattleCalculationService 분리

## 📌 Context
전투 중 발생하는 데미지 계산, 확률 계산, 각종 보정치 적용 로직을 `BattleCalculationService`로 분리하여 독립적으로 테스트 가능하게 만듭니다.

## ✅ Checklist
- [ ] `ProcessWar.ts`에서 데미지/확률 계산 함수 식별
- [ ] `src/services/battle/BattleCalculationService.ts` 파일 생성
- [ ] 계산 로직을 순수 함수(Stateless) 형태로 이관
- [ ] `ProcessWar.ts`에서 해당 함수들을 호출하도록 변경
- [ ] 주요 계산 공식에 대한 단위 테스트 작성

## 💬 Communication
- **Status**: [Pending / In Progress / Done]
- **Current Issue**: 
- **Memo**: 계산 로직은 다른 서비스(스킬 등)에서 참조할 수도 있습니다. 의존성 순환이 생기지 않도록 주의하세요.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 게임 알고리즘 전문가입니다.
`ProcessWar.ts`에 섞여 있는 **전투 수치 계산(데미지, 명중률, 사기 저하 등)** 로직을 `BattleCalculationService.ts`로 분리해야 합니다.

1. 파일 내에서 계산 공식이 포함된 메서드나 함수를 모두 찾으세요.
2. 이들을 상태(State)에 의존하지 않는 순수 함수로 만들 수 있는지 분석하세요.
3. `BattleCalculationService`의 인터페이스를 정의하세요.
```

### 이어지는 프롬프트
```markdown
`src/services/battle/BattleCalculationService.ts`를 생성하고 로직을 옮겨주세요.
필요한 경우 `General`(장수)이나 `Troop`(부대) 타입을 인자로 받도록 수정하세요.
작업 후 `ProcessWar.ts`에서 기존 계산 코드를 이 서비스 호출로 대체하세요.
```








