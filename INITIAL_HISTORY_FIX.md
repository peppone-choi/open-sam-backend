# 중원 정세 초기화 수정 완료

## 문제

시나리오 리셋 후 **중원 정세(연감)**에 아무런 기록이 없었음

## 원인 분석

### 데이터 흐름
```
1. scenario-reset.service.ts
   └─> world_history 컬렉션에 초기 히스토리 저장 ✅

2. GetHistory API
   └─> ng_history 컬렉션에서 조회 ❌ (데이터 없음)
```

### 문제
- `world_history`: 시나리오 초기화 시 생성 ✅
- `ng_history`: **턴 처리기가 매 턴마다 생성**하는 연감 스냅샷
- **초기 턴이 처리되기 전**에는 `ng_history`가 비어있음

## 해결 방법

### scenario-reset.service.ts 수정

10번 단계 추가: **초기 ng_history 생성**

```typescript
// 10. 초기 ng_history 생성 (연감 시스템용)
await this.createInitialNgHistory(sessionId, scenarioId, scenarioMetadata);
```

### createInitialNgHistory 메서드

```typescript
/**
 * 초기 ng_history 생성 (연감 시스템용)
 * world_history의 데이터를 ng_history에 복사하여 초기 연감 생성
 */
private static async createInitialNgHistory(
  sessionId: string,
  scenarioId: string,
  scenarioMetadata: any
): Promise<void> {
  const startYear = scenarioMetadata.startYear || 184;
  const startMonth = 1;
  const serverID = scenarioId.split('/')[0] || 'sangokushi';

  // 1. world_history에서 초기 기록 가져오기
  const worldHistory = await worldHistoryRepository.findByFilter({
    session_id: sessionId,
    year: startYear,
    month: startMonth
  });

  // 2. 국가 스냅샷 생성
  const nations = await nationRepository.findByFilter({ session_id: sessionId });
  const nationSnapshots = nations.map(nation => ({
    id: nation.nation,
    name: nation.name,
    color: nation.color,
    capital: nation.capital,
    gold: nation.gold,
    rice: nation.rice,
    level: nation.level
  }));

  // 3. 도시 맵 생성
  const cities = await cityRepository.findByFilter({ session_id: sessionId });
  const cityMap = {}; // city_id -> city_info

  // 4. global_history 포맷
  const globalHistoryArray = worldHistory.map(h => ({
    year: h.year,
    month: h.month,
    text: h.text
  }));

  // 5. ng_history 문서 생성
  const ngHistoryDoc = {
    server_id: serverID,
    year: startYear,
    month: startMonth,
    global_history: globalHistoryArray,
    global_action: [],  // 초기에는 비어있음
    nations: nationSnapshots,
    map: cityMap
  };

  // 6. 삽입 (기존 문서 있으면 삭제)
  await NgHistory.deleteMany({ server_id: serverID, year: startYear, month: startMonth });
  await NgHistory.create(ngHistoryDoc);
}
```

## 결과

### 초기화 시퀀스 (수정 후)
```
1. cities 초기화
2. nations 초기화
3. generals 초기화
4. diplomacy 초기화
5. world_history 초기화 ✅
6. ng_history 초기화 ✅ (새로 추가!)
```

### 중원 정세 표시
- ✅ 시나리오 시작 시 즉시 역사 기록 확인 가능
- ✅ 각 시나리오의 `history` 배열이 연감에 표시됨
- ✅ 턴이 진행되면 자동으로 업데이트됨

## 예시

### scenario_1030.json (군웅할거)
```json
{
  "history": [
    "<C>●</>194년 1월:<L><b>【역사모드3】</b></>군웅할거",
    "<C>●</>194년 1월:<L><b>【이벤트】</b></><G><b>연주</b></>의 <Y>조조</>가 부친의 복수를 빌미로 서주 토벌에 나섭니다.",
    "<C>●</>194년 1월:<L><b>【이벤트】</b></><G><b>평원</b></>의 <Y>유비</>가 원군에 나섭니다."
  ]
}
```

### 연감 화면
```
📅 194년 1월

중원 정세 (3건)
● 【역사모드3】군웅할거
● 【이벤트】연주의 조조가 부친의 복수를 빌미로 서주 토벌에 나섭니다.
● 【이벤트】평원의 유비가 원군에 나섭니다.

장수 동향 (0건)
(초기에는 비어있음)
```

## 수정 파일

- `src/services/admin/scenario-reset.service.ts`
  - `createInitialNgHistory()` 메서드 추가
  - `NgHistory` 모델 import 추가
  - 10번 단계 추가

## 테스트 방법

1. 서버 재시작
```bash
cd open-sam-backend
npm run dev:api
```

2. 시나리오 리셋 (관리자 페이지에서 실행)

3. 연감 확인
```
/[server]/history
```

## 다음 단계

- ✅ 완료: 초기 ng_history 생성
- ✅ 완료: world_history → ng_history 연동
- 🔜 선택사항: 더 많은 초기 역사 이벤트 추가

---

**작성일**: 2025-11-25  
**상태**: ✅ 완성
