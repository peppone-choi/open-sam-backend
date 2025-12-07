# Agent 01: BattleTurnService 분리

## 📌 Context
`ProcessWar.ts` 파일이 너무 비대해져서 유지보수가 어렵습니다. 전투의 턴 순서 관리, 턴 진행 상태 체크 로직을 `BattleTurnService`로 분리해야 합니다.

## ✅ Checklist
- [ ] `ProcessWar.ts`에서 턴 관리 로직 식별 (턴 시작, 종료, 순서 결정)
- [ ] `src/services/battle/BattleTurnService.ts` 파일 생성
- [ ] 턴 관리 로직을 새 서비스로 이동 (순수 함수화 지향)
- [ ] 기존 `ProcessWar.ts`에서 `BattleTurnService`를 주입받아 사용하도록 수정 (충돌 주의)
- [ ] 단위 테스트 작성

## 💬 Communication
- **Status**: [Pending / In Progress / Done]
- **Current Issue**: 
- **Memo**: Agent 2, 3, 4와 동시에 작업 중입니다. `ProcessWar.ts`를 직접 수정할 때는 git merge conflict에 유의하세요. 가능하면 새 파일을 만들고 import만 추가하는 방식을 권장합니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 백엔드 리팩토링 전문가입니다.
현재 `open-sam-backend/src/services/ProcessWar.ts` 파일에서 **턴 관리(Turn Management)** 관련 로직만 추출하여 `BattleTurnService.ts`로 분리하는 임무를 맡았습니다.

1. 먼저 `ProcessWar.ts`를 읽고 턴 순서 결정, 턴 시작/종료 처리와 관련된 코드를 찾으세요.
2. `src/services/battle/BattleTurnService.ts`에 들어갈 클래스 구조와 메서드를 설계하세요.
3. 기존 로직을 최대한 그대로 유지하면서 이동 계획을 세워주세요.
```

### 이어지는 프롬프트
```markdown
설계한 대로 `BattleTurnService.ts` 파일을 실제로 생성하고 코드를 작성해주세요.
`ProcessWar.ts`에서는 해당 로직을 제거하고, `BattleTurnService`를 인스턴스화하여 호출하는 방식으로 변경해주세요.
단, 다른 에이전트가 다른 부분을 수정 중일 수 있으므로 `ProcessWar.ts` 수정은 최소화하고, import 문 추가와 호출부 변경에만 집중하세요.
```

