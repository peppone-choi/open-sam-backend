# Agent 10: E2E War Test

## 📌 Context
전쟁 사이클(선전포고~전투~점령)이 정상적으로 동작하는지 검증하는 End-to-End 테스트를 작성합니다.

## ✅ Checklist
- [ ] 테스트 환경 설정 (Playwright 또는 Jest + Supertest)
- [ ] 시나리오 1: 선전포고 (API 호출)
- [ ] 시나리오 2: 부대 출병 및 이동 (턴 진행 시뮬레이션)
- [ ] 시나리오 3: 전투 조우 및 결과 처리 확인
- [ ] 시나리오 4: 영토 소유권 변경 확인

## 💬 Communication
- **Status**: [Pending / In Progress / Done]
- **Current Issue**: 
- **Memo**: 실제 DB를 쓰거나 인메모리 DB를 사용하여 테스트 격리가 필요할 수 있습니다. `npm run dev:turn` 프로세스와의 연동도 고려해야 합니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 QA/테스트 엔지니어입니다.
`open-sam-backend`의 핵심 기능인 **전쟁 사이클**을 검증하는 E2E 테스트 코드를 작성해주세요.

도구: Jest (API 테스트 위주)
시나리오:
1. User A가 User B의 도시를 공격 (선전포고/출병 API 호출)
2. 턴을 강제로 진행시킴 (Dev API 활용 등)
3. 전투가 발생했는지 DB나 로그로 확인
4. 전투 후 승리 시 도시 소유권이 변경되었는지 확인

테스트 코드의 뼈대를 잡아주세요.
```

### 이어지는 프롬프트
```markdown
작성한 테스트 시나리오를 구체적인 코드로 구현하세요.
API 요청을 보내는 헬퍼 함수(`createWar`, `passTurn` 등)를 먼저 정의하고, 이를 조합하여 테스트 케이스를 완성해주세요.
```






