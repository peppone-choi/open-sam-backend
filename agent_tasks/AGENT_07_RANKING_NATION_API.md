# Agent 07: Nation Ranking & History API

## 📌 Context
역대 국가 랭킹 및 통일 역사 기록을 조회하는 API입니다.

## ✅ Checklist
- [x] `GET /api/ranking/nations` 엔드포인트 구현 (국력, 인구 등 기준)
- [x] `GET /api/history` 엔드포인트 구현 (역대 통일 기록 타임라인)
- [x] `RankingController`에 메서드 추가
- [x] 프론트엔드 연동을 위한 Swagger/OpenAPI 명세 업데이트 (주석 등)

## 💬 Communication
- **Status**: Done
- **Current Issue**: None
- **Memo**: 국가 랭킹은 단순 통일 횟수뿐만 아니라, 통일 당시의 국력 점수 등을 기준으로 할 수도 있습니다.

## 🚀 API Usage

### 1. 국가 랭킹 조회
현재 세션의 국가들을 국력(`rate`), 장수 수(`gennum`), 자금(`gold`) 순으로 정렬하여 반환합니다. 멸망한 국가나 공백지(`level <= 0`)는 제외됩니다.

**Request:**
```bash
curl -X GET "http://localhost:8080/api/ranking/nations?session_id=SESSION_ID"
```

**Response Example:**
```json
{
  "success": true,
  "nations": [
    {
      "_id": "64f1a2b3c...",
      "session_id": "samgukji_default",
      "nation": 1,
      "name": "위",
      "level": 7,
      "rate": 1500,
      "gennum": 50,
      "gold": 10000,
      ...
    },
    ...
  ]
}
```

### 2. 연혁(역사) 조회
현재 세션의 역사 기록을 최신순으로 반환합니다.

**Request:**
```bash
# 전체 연혁 조회
curl -X GET "http://localhost:8080/api/ranking/history?session_id=SESSION_ID"

# 특정 국가(nation_id=1)의 연혁 조회
curl -X GET "http://localhost:8080/api/ranking/history?session_id=SESSION_ID&nation_id=1"
```

**Response Example:**
```json
{
  "success": true,
  "history": [
    {
      "_id": "64f1a2b3d...",
      "session_id": "samgukji_default",
      "nation_id": 1,
      "year": 184,
      "month": 1,
      "text": "위나라가 건국되었습니다.",
      "created_at": "2023-09-01T12:00:00.000Z"
    },
    ...
  ]
}
```

## 📝 Implementation Details
- `RankingController` (`src/controllers/ranking.controller.ts`)
  - `getNationRanking`: `Nation` 모델 사용
  - `getHistory`: `WorldHistory` 모델 사용
- `ranking.routes.ts` (`src/routes/ranking.routes.ts`)
- `src/api/index.ts`에 `/api/ranking` 라우트 등록
