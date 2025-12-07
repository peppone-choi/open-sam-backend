# Agent 09: Replay Storage & API

## 📌 Context
수집된 리플레이 데이터를 저장하고, 클라이언트가 요청 시 제공하는 API를 구현합니다.

## ✅ Checklist
- [x] MongoDB `BattleLog` 스키마 설계
- [x] 전투 종료 시 `ReplayBuilder`의 데이터를 DB에 저장하는 로직
- [x] `GET /api/battle/replay/:battleId` API 구현
- [x] 데이터 압축 저장 고려 (예: JSON stringify 후 gzip 등, 혹은 몽고DB 내부 기능) - *Note: 기본 JSON 저장으로 구현, 필요 시 Mongo compression 사용*

## 💬 Communication
- **Status**: Done
- **Current Issue**: 
- **Memo**: 리플레이 데이터는 `BattleLog` 컬렉션에 저장됩니다. `Battle` 컬렉션의 `turnHistory`와 초기 유닛/맵 정보를 복사하여 보관합니다. `ReplayBuilder` 대신 `ReplayService`가 `Battle` 데이터를 기반으로 로그를 생성합니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 백엔드 개발자입니다.
전투 리플레이 데이터(JSON)를 MongoDB에 저장하고 조회하는 기능을 구현해야 합니다.

1. `BattleLog` 모델을 만드세요. (전투 ID, 참여 국가, 승자, 리플레이 데이터 본문)
2. 리플레이 데이터가 클 수 있으므로, 조회 시 성능을 고려한 설계를 해주세요.
3. `GET /api/battle/replay/:battleId` 컨트롤러를 구현해주세요.
```

### 이어지는 프롬프트
```markdown
전투가 끝나는 시점(`ProcessWar`의 전투 종료 처리 부분)에서 이 `BattleLog`를 저장하는 코드를 연결해주세요.
`ReplayBuilder`에서 생성된 JSON 객체를 받아서 DB에 insert하면 됩니다.
```
