# Agent 05: Hall of Fame (DB Schema & Service)

## 📌 Context
천하통일 시점의 게임 데이터를 영구 보존하기 위한 DB 스키마 설계 및 저장 서비스 구현입니다.

## ✅ Checklist
- [ ] MongoDB 스키마 설계: `History`(통일 기록), `HallOfFame`(랭킹 스냅샷)
- [ ] `src/models/History.ts`, `src/models/HallOfFame.ts` 생성
- [ ] `src/services/HistoryService.ts` 생성
- [ ] 천하통일 트리거 시 데이터 스냅샷 생성 및 저장 로직 구현

## 💬 Communication
- **Status**: [Pending / In Progress / Done]
- **Current Issue**: 
- **Memo**: 저장되는 데이터가 너무 크지 않도록 필요한 필드만 선별해야 합니다.

## 🚀 Prompts

### 시작 프롬프트
```markdown
당신은 데이터베이스 전문가입니다.
삼국지 게임의 **명예의 전당(Hall of Fame)** 기능을 위해 MongoDB 스키마를 설계해야 합니다.

다음 데이터를 저장할 `History` 및 `HallOfFame` 모델을 설계해주세요:
- 서버 ID 또는 게임 세션 ID
- 통일 연도, 통일 국가 정보
- 군주(Ruler) 정보 및 주요 장수(Generals)들의 스냅샷 (능력치, 전적 포함)
- 당시의 국가별 영토 현황 (선택 사항)

Mongoose 스키마 코드를 작성해주세요.
```

### 이어지는 프롬프트
```markdown
설계한 스키마를 `src/models`에 저장하고, `HistoryService.ts`를 구현해주세요.
`saveGameResult(gameId, winnerNationId)` 메서드를 만들어, 게임이 끝났을 때 관련 데이터를 긁어모아 DB에 저장하는 로직을 완성해주세요.
```








