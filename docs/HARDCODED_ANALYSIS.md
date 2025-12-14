# 하드코딩 분석 보고서

## 요약
게임 내 여러 시스템이 코드에 하드코딩되어 있으며, constants.json으로 이동이 필요합니다.

---

## ✅ 수정 완료

### 1. 도시 레벨 (City Level)
**파일**: `src/commands/nation/expand.ts`, `reduceForce.ts`
**상태**: ✅ 수정됨

**변경 내용**:
- 증축: `level > 5 and < 10` (소→중→대→특)
- 감축: `level > 0` (경→특→대→중→소→향→무)
- 특수 도시(수/진/관/이) 개별 체크 추가

---

## ⚠️ 하드코딩된 부분 (수정 필요)

### 2. 직위/계급 시스템 (Officer Level)

**문제**: 두 서비스에서 **서로 다른 직위 체계** 사용!

#### GetFrontInfo.service.ts (라인 477-484)
```typescript
const levels: Record<number, string> = {
  12: '군주', 11: '태사', 10: '대도독', 9: '도독',
  8: '대장군', 7: '장군', 6: '집금오', 5: '장수',
  4: '태수', 3: '도위', 2: '현령', 1: '백신'
};
```

#### GeneralList.service.ts (라인 184-202)
```typescript
if (officerLevel < 5) return '평민';
if (officerLevel < 10) return '하급관리';
if (officerLevel < 15) return '중급관리';
if (officerLevel < 20) return '상급관리';
if (officerLevel < 25) return '부장';
if (officerLevel < 30) return '장군';
if (officerLevel < 35) return '대장군';
if (officerLevel < 40) return '장상';
if (officerLevel < 45) return '원로';
// 국가 레벨 5 이상
if (officerLevel >= 50) return '재상';
if (officerLevel >= 45) return '삼공';
```

**특수 체크**:
- `officer_level === 12` → 군주 판정 (28회 사용)
- `officer_level >= 5` → 수뇌부 판정 (8회 사용)

**권장 수정**:
```json
// constants.json에 추가
"officerLevels": {
  "1": { "id": 1, "name": "백신", "role": "평민" },
  "2": { "id": 2, "name": "현령", "role": "평민" },
  "3": { "id": 3, "name": "도위", "role": "평민" },
  "4": { "id": 4, "name": "태수", "role": "평민" },
  "5": { "id": 5, "name": "장수", "role": "수뇌부", "chiefLevel": true },
  "6": { "id": 6, "name": "집금오", "role": "수뇌부" },
  "7": { "id": 7, "name": "장군", "role": "수뇌부" },
  "8": { "id": 8, "name": "대장군", "role": "수뇌부" },
  "9": { "id": 9, "name": "도독", "role": "수뇌부" },
  "10": { "id": 10, "name": "대도독", "role": "수뇌부" },
  "11": { "id": 11, "name": "태사", "role": "수뇌부" },
  "12": { "id": 12, "name": "군주", "role": "군주", "isKing": true }
}
```

---

### 3. 헌신도 등급 (Dedication Level)

**문제**: 두 서비스에서 **서로 다른 헌신도 체계** 사용!

#### GetFrontInfo.service.ts (라인 494-500)
```typescript
if (dedication >= 10000) return '충신';
if (dedication >= 5000) return '충복';
if (dedication >= 2000) return '충의';
if (dedication >= 1000) return '충성';
return '무명';
```

#### GeneralList.service.ts (라인 169-181)
```typescript
if (dedication < 100) return '하하';
if (dedication < 300) return '하중';
if (dedication < 600) return '하상';
if (dedication < 1000) return '중하';
if (dedication < 1500) return '중중';
if (dedication < 2100) return '중상';
if (dedication < 2800) return '상하';
if (dedication < 3600) return '상중';
if (dedication < 4500) return '상상';
if (dedication < 5500) return '특상';
return '최상';
```

**권장 수정**:
```json
// constants.json에 추가
"dedicationLevels": [
  { "min": 0, "max": 99, "shortName": "하하", "fullName": "무명" },
  { "min": 100, "max": 299, "shortName": "하중", "fullName": "무명" },
  { "min": 300, "max": 599, "shortName": "하상", "fullName": "무명" },
  { "min": 600, "max": 999, "shortName": "중하", "fullName": "무명" },
  { "min": 1000, "max": 1499, "shortName": "중중", "fullName": "충성" },
  { "min": 1500, "max": 2099, "shortName": "중상", "fullName": "충성" },
  { "min": 2000, "max": 2799, "shortName": "상하", "fullName": "충의" },
  { "min": 2800, "max": 3599, "shortName": "상중", "fullName": "충의" },
  { "min": 3600, "max": 4499, "shortName": "상상", "fullName": "충의" },
  { "min": 4500, "max": 5499, "shortName": "특상", "fullName": "충복" },
  { "min": 5500, "max": 9999, "shortName": "최상", "fullName": "충복" },
  { "min": 10000, "max": 999999, "shortName": "최상", "fullName": "충신" }
]
```

---

### 4. 명성 등급 (Honor/Experience Level)

**위치**: GetFrontInfo.service.ts (라인 486-492)

```typescript
if (experience >= 10000) return '명장';
if (experience >= 5000) return '용장';
if (experience >= 2000) return '맹장';
if (experience >= 1000) return '장수';
return '병졸';
```

**권장 수정**:
```json
// constants.json에 추가
"honorLevels": [
  { "min": 0, "max": 999, "name": "병졸" },
  { "min": 1000, "max": 1999, "name": "장수" },
  { "min": 2000, "max": 4999, "name": "맹장" },
  { "min": 5000, "max": 9999, "name": "용장" },
  { "min": 10000, "max": 999999, "name": "명장" }
]
```

---

### 5. 기술력 차이 표시 (Tech Difference)

**위치**: commands/general/spy.ts (라인 147-155)

```typescript
if (techDiff >= 1000) return '매우 높음';
if (techDiff >= 250) return '높음';
if (techDiff >= -250) return '비슷';
if (techDiff >= -1000) return '낮음';
return '매우 낮음';
```

**권장 수정**:
```json
// constants.json에 추가
"techDiffLevels": [
  { "min": 1000, "name": "매우 높음" },
  { "min": 250, "name": "높음" },
  { "min": -249, "name": "비슷" },
  { "min": -999, "name": "낮음" },
  { "min": -999999, "name": "매우 낮음" }
]
```

---

### 6. 국가 레벨 (Nation Level)

**현재 사용**:
- `level === 0` → 방랑/재야
- `level > 0` → 정식 국가

**위치**: 여러 파일 (이동, 강행군, 방랑 등)

**권장**: 
- constants.json에 `minNationLevel: 1` 추가
- 또는 nationLevels 정의 추가

---

## ✅ 이미 constants.json에 있는 것

### 7. 배신 횟수 제한
```json
"maxBetrayCnt": 9
```

### 8. 나이 제한
```json
"adultAge": 14,
"minPushHallAge": 40
```

### 9. 최대 레벨 제한
```json
"maxDedLevel": 30,
"maxTechLevel": 12,
"maxLevel": 255
```

### 10. 도시 레벨
```json
"cityLevels": { ... }
```

---

## 우선순위

### 높음 (즉시 수정 필요)
1. ✅ 도시 레벨 - **완료**
2. ⚠️ 직위/계급 시스템 - 두 곳에서 다른 체계 사용
3. ⚠️ 헌신도 등급 - 두 곳에서 다른 체계 사용

### 중간 (수정 권장)
4. 명성 등급
5. 기술력 차이 표시

### 낮음 (현재 상태 유지 가능)
6. 국가 레벨 (간단한 0/1 체크)

---

## 수정 방법

1. **constants.json에 데이터 추가**
2. **유틸리티 함수 생성** (config에서 읽기)
3. **하드코딩된 부분을 유틸리티 함수로 교체**
4. **두 서비스의 불일치 해결**


---

## 🚨 새로 발견: 국가 레벨과 직위 시스템 (매우 중요!)

### 국가 레벨 (Nation Level) 시스템

**발견 위치**: `sam/hwe/func_gamerule.php`, `func_converter.php`

국가가 보유한 **도시 수**에 따라 국가 레벨이 결정되고, 이에 따라:
1. 군주의 칭호가 변경됨
2. 부하들의 직위 명칭도 변경됨

#### 국가 레벨 정의 (getNationLevelList)
```php
[레벨, 칭호, 수뇌부수, 필요도시수]
0 => ['방랑군', 2, 0],   // 도시 0개
1 => ['호족', 2, 1],     // 도시 1개
2 => ['방백', 4, 2],     // 도시 2개
3 => ['주자사', 4, 5],   // 도시 5개
4 => ['주목', 6, 8],     // 도시 8개
5 => ['공', 6, 11],      // 도시 11개
6 => ['왕', 8, 16],      // 도시 16개
7 => ['황제', 8, 21],    // 도시 21개
```

### 직위 시스템 (Officer Level × Nation Level)

**핵심**: `직위코드 = 국가레벨 × 100 + 직위레벨`

예: 황제(nationLevel=7)의 태위(officerLevel=7) = 코드 707

#### 군주 (officerLevel = 12)
```
레벨 8: 군주 (특수, NPC 전용)
레벨 7: 황제 (도시 21개 이상)
레벨 6: 왕 (도시 16개 이상)
레벨 5: 공 (도시 11개 이상)
레벨 4: 주목 (도시 8개 이상)
레벨 3: 주자사 (도시 5개 이상)
레벨 2: 방백 (도시 2개 이상)
레벨 1: 영주 (도시 1개)
레벨 0: 두목 (방랑군)
```

#### 최고 수뇌부 (officerLevel = 11)
```
레벨 8: 참모
레벨 7: 승상
레벨 6: 광록훈
레벨 5: 광록대부
레벨 4: 태사령
레벨 3: 주부
레벨 2: 참모
레벨 1: 참모
레벨 0: 부두목
```

#### 제1장군 (officerLevel = 10)
```
레벨 8: 제1장군
레벨 7: 표기장군
레벨 6: 좌장군
레벨 5: 안국장군
레벨 4: 아문장군
레벨 3: 편장군
레벨 2: 비장군
```

#### 제1모사 (officerLevel = 9)
```
레벨 8: 제1모사
레벨 7: 사공
레벨 6: 상서령
레벨 5: 집금오
레벨 4: 낭중
레벨 3: 간의대부
레벨 2: 부참모
```

#### 제2장군 (officerLevel = 8)
```
레벨 8: 제2장군
레벨 7: 거기장군
레벨 6: 우장군
레벨 5: 파로장군
레벨 4: 호군
```

#### 제2모사 (officerLevel = 7)
```
레벨 8: 제2모사
레벨 7: 태위
레벨 6: 중서령
레벨 5: 소부
레벨 4: 종사중랑
```

#### 제3장군 (officerLevel = 6)
```
레벨 8: 제3장군
레벨 7: 위장군
레벨 6: 전장군
```

#### 제3모사 (officerLevel = 5)
```
레벨 8: 제3모사
레벨 7: 사도
레벨 6: 비서령
```

#### 지방관 (officerLevel = 1~4, 국가 레벨 무관)
```
4: 태수
3: 군사
2: 종사
1: 일반
0: 재야
```

### 문제점

1. **PHP에만 존재**: TypeScript 백엔드에 이 시스템이 전혀 구현되지 않음
2. **하드코딩**: 직위 명칭이 코드에 하드코딩됨
3. **복잡한 매트릭스**: 8개 국가레벨 × 12개 직위레벨 = 96가지 조합
4. **불일치**: GetFrontInfo.service.ts의 간단한 12단계 시스템과 완전히 다름

### 권장 수정

constants.json에 추가:
```json
{
  "nationLevels": [
    { "level": 0, "name": "방랑군", "chiefCount": 2, "minCities": 0 },
    { "level": 1, "name": "호족", "chiefCount": 2, "minCities": 1 },
    { "level": 2, "name": "방백", "chiefCount": 4, "minCities": 2 },
    { "level": 3, "name": "주자사", "chiefCount": 4, "minCities": 5 },
    { "level": 4, "name": "주목", "chiefCount": 6, "minCities": 8 },
    { "level": 5, "name": "공", "chiefCount": 6, "minCities": 11 },
    { "level": 6, "name": "왕", "chiefCount": 8, "minCities": 16 },
    { "level": 7, "name": "황제", "chiefCount": 8, "minCities": 21 }
  ],
  "officerTitles": {
    "12": {
      "0": "두목", "1": "호족", "2": "방백", "3": "주자사",
      "4": "주목", "5": "공", "6": "왕", "7": "황제", "8": "군주"
    },
    "11": {
      "0": "부두목", "1": "참모", "2": "참모", "3": "주부",
      "4": "태사령", "5": "광록대부", "6": "광록훈", "7": "승상", "8": "참모"
    },
    "10": {
      "2": "비장군", "3": "편장군", "4": "아문장군", "5": "안국장군",
      "6": "좌장군", "7": "표기장군", "8": "제1장군"
    },
    "9": {
      "2": "부참모", "3": "간의대부", "4": "낭중", "5": "집금오",
      "6": "상서령", "7": "사공", "8": "제1모사"
    },
    "8": {
      "4": "호군", "5": "파로장군", "6": "우장군",
      "7": "거기장군", "8": "제2장군"
    },
    "7": {
      "4": "종사중랑", "5": "소부", "6": "중서령",
      "7": "태위", "8": "제2모사"
    },
    "6": {
      "6": "전장군", "7": "위장군", "8": "제3장군"
    },
    "5": {
      "6": "비서령", "7": "사도", "8": "제3모사"
    },
    "4": "태수",
    "3": "군사",
    "2": "종사",
    "1": "일반",
    "0": "재야"
  }
}
```

### 우선순위: 🔴 최우선

이 시스템이 구현되지 않으면:
- 도시를 많이 점령해도 군주 칭호가 변경되지 않음
- 부하들의 직위가 국가 규모에 맞지 않게 표시됨
- 게임의 핵심 진행감이 사라짐

