# Agent 03: BattleSkillService 분리

## 📌 Context
장수의 스킬, 병종의 특수 능력, 책략(Stratagem) 발동 로직을 `BattleSkillService`로 분리합니다.

## ✅ Checklist
- [ ] `ProcessWar.ts`에서 스킬/책략 발동 조건 및 효과 처리 로직 식별
- [ ] `src/services/battle/BattleSkillService.ts` 파일 생성
- [ ] 스킬 데이터를 처리하는 로직 이관
- [ ] `ProcessWar.ts` 연결
- [ ] 스킬 발동 테스트 케이스 작성

## 💬 Communication
- **Status**: [Pending / In Progress / Done]
- **Current Issue**: 
- **Memo**: 스킬 로직은 `BattleCalculationService`를 사용할 가능성이 높습니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 게임 시스템 기획 및 구현 전문가입니다.
`ProcessWar.ts`에서 **스킬(Skill)과 책략(Stratagem)** 관련 로직을 분리하여 `BattleSkillService.ts`를 구현해야 합니다.

1. 스킬 발동 확률 체크, 스킬 효과 적용 로직을 찾으세요.
2. `BattleSkillService`가 가져야 할 메서드(예: `triggerSkill`, `applyStratagem`)를 정의하세요.
3. 분리 계획을 알려주세요.
```

### 이어지는 프롬프트
```markdown
`src/services/battle/BattleSkillService.ts`를 구현하세요.
스킬 발동 시 로그를 남기는 부분도 함께 이동해야 할 수 있습니다.
`ProcessWar.ts`의 `processTurn` 메서드 내부에서 스킬 관련 블록을 이 서비스 호출로 깔끔하게 교체해주세요.
```








