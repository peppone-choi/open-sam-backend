# API 데이터 형식 불일치 점검 리포트

## 점검 결과

### ✅ 완료된 수정 사항

1. **GetFrontInfo**
   - ✅ `permission` 필드 추가 (general 객체 내)
   - ✅ `reservedCommand` 필드 추가 (general 객체 내)
   - ✅ `recentRecord` 필드 존재 확인

2. **GeneralList**
   - ✅ `generals` 필드 추가 (list와 동일한 값)
   - ✅ `result` 필드 타입 수정 (`'true'` -> `true`)

3. **GetMap**
   - ✅ 실패 시 `result: false` 추가

4. **ReserveCommand**
   - ✅ `brief` 필드 존재 확인

5. **GetReservedCommand**
   - ✅ `turnTime`, `turnTerm`, `year`, `month` 필드 존재 확인

### 📋 API별 상세 사항

#### 1. General/GetFrontInfo
**백엔드 응답:**
```typescript
{
  success: true,
  result: true,
  global: GlobalInfo,
  general: General & { permission: number, reservedCommand: TurnObj[] | null },
  nation: Nation | null,
  city: City | null,
  recentRecord: { history, global, general }
}
```

**프론트엔드 기대:**
```typescript
GetFrontInfoResponse {
  result?: true,
  success?: boolean,
  global: GlobalInfo,
  general: General & { permission: number, reservedCommand: TurnObj[] | null },
  nation?: Nation | null,
  city?: City | null,
  recentRecord: { history, global, general }
}
```
**상태:** ✅ 일치

#### 2. Global/GetMap
**백엔드 응답:**
```typescript
{
  success: true,
  result: true,
  cityList: number[][],
  nationList: Array<[number, string, string, number]>,
  myCity: number | null,
  myNation: number | null,
  spyList: Record<number, number>,
  startYear, year, month, version
}
```

**프론트엔드 기대:**
```typescript
MapDataResponse {
  result: boolean,
  cityList?: number[][],
  nationList?: Array<[number, string, string, number]>,
  myCity?: number,
  myNation?: number
}
```
**상태:** ✅ 일치 (추가 필드는 문제 없음)

#### 3. Command/ReserveCommand
**백엔드 응답:**
```typescript
{
  success: true,
  result: true,
  brief: string,
  reason: string
}
```

**프론트엔드 기대:**
```typescript
ReserveCommandResponse {
  result: true,
  brief: string
}
```
**상태:** ✅ 일치

#### 4. Command/GetReservedCommand
**백엔드 응답:**
```typescript
{
  success: true,
  result: true,
  turnTime: Date,
  turnTerm: number,
  year: number,
  month: number,
  date: Date,
  turn: TurnObj[],
  autorun_limit: number | null
}
```

**프론트엔드 기대:**
```typescript
GetReservedCommandResponse {
  result: true,
  turnTime: string,
  turnTerm: number,
  year: number,
  month: number,
  date: string,
  turn: TurnObj[],
  autorun_limit: null | number
}
```
**상태:** ⚠️ 타입 차이 (Date vs string) - 런타임에서 변환 필요

#### 5. Global/GeneralList
**백엔드 응답:**
```typescript
{
  success: true,
  result: true,
  column: string[],
  list: General[],
  generals: General[]  // 추가됨
}
```

**프론트엔드 기대:**
```typescript
GetGeneralListResponse {
  result: true,
  generals: General[]
}
```
**상태:** ✅ 일치

#### 6. General/GetCommandTable
**백엔드 응답:**
```typescript
{
  success: true,
  result: true,
  commandTable: CommandTableItem[]
}
```

**프론트엔드 기대:**
```typescript
{
  result: boolean,
  commandTable: CommandTableItem[]
}
```
**상태:** ✅ 일치

### 🔍 주요 발견 사항

1. **타입 변환 필요**
   - `GetReservedCommand`: `turnTime`과 `date`가 `Date` 객체로 반환되지만, 프론트엔드는 `string`을 기대
   - 해결: Express의 JSON 직렬화에서 자동 변환되거나, ISO 문자열로 명시적 변환 필요

2. **추가 필드 허용**
   - 대부분의 API에서 백엔드가 추가 필드(`success`, `message` 등)를 반환
   - 프론트엔드 타입 정의가 옵셔널이므로 문제 없음

3. **result 필드**
   - 대부분 `result: true` (리터럴)로 반환
   - 프론트엔드는 `result?: true` 또는 `result: boolean`으로 정의
   - 타입 호환성 문제 없음

### ✅ 최종 상태

- **총 점검 API**: 6개
- **완전 일치**: 5개
- **타입 차이 (런타임 해결)**: 1개 (GetReservedCommand)
- **수정 완료**: 모든 필드 누락 문제 해결

**결론:** 모든 API의 필수 필드가 일치하며, 타입 차이는 JSON 직렬화 과정에서 자동 해결됩니다.




