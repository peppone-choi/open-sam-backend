# 시나리오 리셋 외교 중복 오류 수정

## 문제

시나리오 리셋 실패:
```
MongoBulkWriteError: E11000 duplicate key error collection: opensam.diplomacy 
index: session_id_1_me_1_you_1 dup key: { session_id: "sangokushi_default", me: 2, you: 10 }
```

## 원인

### 1. 시나리오 데이터 중복
**scenario_1030.json**에 중복된 외교 관계 존재:
```json
{
  "diplomacy": [
    [1, 8, 1, 36],
    [9, 14, 1, 36],
    [2, 10, 1, 36],  // ← 중복 1
    [2, 10, 1, 36],  // ← 중복 2
    [16, 20, 1, 36],
    ...
  ]
}
```

### 2. ng_history 미삭제
`clearSessionData()`에서 `ng_history` 컬렉션을 삭제하지 않아서 이전 데이터 잔존 가능

## 해결 방법

### 1. 시나리오 데이터 수정
**scenario_1030.json**에서 중복 외교 관계 제거:
```bash
# 인덱스 3의 중복 항목 제거
[2, 10, 1, 36] 제거 완료
```

### 2. clearSessionData에 ng_history 삭제 추가
```typescript
// 4. ng_history 삭제 (연감 데이터)
// @ts-ignore - Mongoose model type issue
const ngHistoryResult = await NgHistory.deleteMany({ session_id: sessionId });
console.log(`[ScenarioReset] Deleted ${ngHistoryResult.deletedCount} ng_history records`);
```

### 3. createDiplomacy에 중복 제거 로직 추가
```typescript
// 중복 제거 (같은 me-you 쌍이 여러 번 나오는 경우 방지)
const seen = new Set<string>();
const uniqueDiplomacyData = [];
for (const diplo of diplomacyData) {
  const me = Array.isArray(diplo) ? diplo[0] : diplo.me;
  const you = Array.isArray(diplo) ? diplo[1] : diplo.you;
  const key = `${me}-${you}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueDiplomacyData.push(diplo);
  } else {
    console.warn(`[ScenarioReset] Skipping duplicate diplomacy: ${key}`);
  }
}
```

## MongoDB 인덱스 구조

**diplomacy 컬렉션의 unique index**:
```javascript
{ session_id: 1, me: 1, you: 1 }  // unique
```

- 같은 세션에서 같은 `(me, you)` 쌍은 하나만 존재 가능
- 중복 삽입 시 E11000 에러 발생

## 검증 결과

### 전체 시나리오 검증
```bash
cd open-sam-backend
node check-duplicate-diplomacy.js
```

결과: **모든 시나리오 중복 없음** ✅

## 수정 파일

1. **scenario_1030.json** - 중복 외교 관계 제거
2. **scenario-reset.service.ts**
   - `clearSessionData()`: ng_history 삭제 추가
   - `createDiplomacy()`: 중복 제거 로직 추가

## 테스트

### 1. 서버 재시작
```bash
cd open-sam-backend
npm run dev:api
```

### 2. 시나리오 리셋
관리자 페이지 → 게임 관리 → 시나리오 리셋

### 3. 확인
- ✅ 리셋 성공
- ✅ 외교 관계 정상 생성
- ✅ 중원 정세 표시
- ✅ 연감 조회 가능

## 방지 대책

### 1. 런타임 중복 제거
`createDiplomacy()`에서 자동으로 중복 필터링

### 2. 데이터 검증 스크립트
```bash
# 모든 시나리오의 외교 관계 중복 검사
node scripts/validate-diplomacy.js
```

### 3. 철저한 삭제
`clearSessionData()`에서 모든 관련 컬렉션 삭제:
- generals
- nations
- cities
- diplomacy ✅
- ng_history ✅ (NEW!)
- world_history
- commands, messages, battles, events...

## 다음 단계

- ✅ 완료: 외교 중복 오류 수정
- ✅ 완료: ng_history 삭제 추가
- ✅ 완료: 런타임 중복 방지
- 🔜 선택사항: 시나리오 데이터 검증 자동화

---

**작성일**: 2025-11-25  
**상태**: ✅ 완성
