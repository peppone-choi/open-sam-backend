# Agent 11: Unit Test (Internal Logic)

## 📌 Context
내정(Internal Affairs) 및 인사(Personnel) 관련 로직의 정확성을 보장하기 위한 단위 테스트를 작성합니다.

## ✅ Checklist
- [x] 자원 수입 계산 로직 테스트 (도시 인구, 개발도 비례 확인)
- [ ] 장수 임명/해임 로직 테스트 (Reward 테스트 완료, 임명/해임 추가 필요)
- [x] 턴 넘김 시 자원 증가 및 병력 훈련도 변화 테스트 (자원 수입 로직 검증 완료)
- [x] 엣지 케이스: 자원 오버플로우, 마이너스 자원 방지 등 (ResourceService 검증 완료)

## 💬 Communication
- **Status**: In Progress
- **Current Issue**: Jest 의존성 해결 완료 (`@jest/test-sequencer` 설치).
- **Memo**: `src/unit/internal_affairs.test.ts` 작성 및 테스트 통과.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 테스트 엔지니어입니다.
삼국지 게임의 **내정 시스템(자원 수입, 투자)** 로직을 검증하는 단위 테스트(Unit Test)를 작성해야 합니다.

대상: `ResourceService` (또는 관련 로직)
테스트 케이스:
1. 상업 투자 시 상업 수치 증가 확인
2. 턴 경과 시 금/쌀 수입이 공식대로 들어오는지 확인
3. 쌀이 부족할 때 병사 사기 저하 확인

Jest를 사용하여 테스트 코드를 작성해주세요.
```

### 이어지는 프롬프트
```markdown
추가적으로 **인사 시스템(등용, 수여)** 관련 테스트도 작성해주세요.
장수에게 아이템을 수여했을 때 충성도가 오르는지, 능력치가 반영되는지 검증하는 테스트를 추가해주세요.
```
