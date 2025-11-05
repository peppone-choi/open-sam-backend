# PHP 하드코딩 상수 추출 리포트

## 추출 날짜
2024-12-XX

## 요약

### 추출된 파일
- **GameConstBase.php**: 119개 상수 추출, 16개 누락
- **CityConstBase.php**: 2개 상수 추출, 2개 누락
- **AutorunNationPolicy.php**: 1개 상수 추출, 1개 누락

### 전체 통계
- **전체 추출**: 122개
- **전체 누락**: 19개

## 누락된 상수 상세

### GameConstBase.php (16개)

#### 1. 배열/객체 형태 (파싱 성공)
- ✅ `availableNationType` - 국가 타입 목록 (13개)
- ✅ `availableSpecialDomestic` - 내정 특기 목록 (8개)
- ✅ `optionalSpecialDomestic` - 선택 가능 내정 특기 (1개)
- ✅ `availableSpecialWar` - 전투 특기 목록 (20개)
- ✅ `optionalSpecialWar` - 선택 가능 전투 특기 (1개)
- ✅ `availablePersonality` - 성격 목록 (10개)
- ✅ `randGenFirstName` - 랜덤 장수 성 (80개)
- ✅ `randGenLastName` - 랜덤 장수 이름 (83개)

#### 2. 복잡한 PHP 배열 (수동 변환 필요)
- ⚠️ `banner` - 배너 HTML (문자열, 따옴표 처리 필요)
- ⚠️ `allItems` - 아이템 목록 (중첩 연관 배열, 3251자)
- ⚠️ `availableGeneralCommand` - 장수 명령 목록 (카테고리별 분류, 1293자)
- ⚠️ `availableChiefCommand` - 사령부 명령 목록 (카테고리별 분류, 774자)
- ⚠️ `defaultInstantAction` - 기본 즉시 액션 (83자)
- ⚠️ `availableInstantAction` - 사용 가능 즉시 액션 (83자)
- ⚠️ `defaultInitialEvents` - 기본 초기 이벤트 (146자, PHP 상수 포함)
- ⚠️ `defaultEvents` - 기본 이벤트 목록 (2620자, PHP 상수 포함)

### CityConstBase.php (2개)

- ⚠️ `regionMap` - 지역 매핑 (양방향 매핑, 213자)
- ⚠️ `levelMap` - 도시 레벨 매핑 (양방향 매핑, 199자)

### AutorunNationPolicy.php (1개)

- ⚠️ `defaultPolicy` - 기본 정책 설정 (837자)

## 다음 단계

### 1. 수동 변환 필요 항목
복잡한 PHP 배열들은 정확한 파싱 스크립트 또는 수동 변환이 필요합니다:

1. **allItems**: 중첩 연관 배열 구조
   ```php
   'horse' => ['che_명마_01_노기' => 0, ...],
   'weapon' => [...],
   'book' => [...],
   'item' => [...]
   ```

2. **availableGeneralCommand**: 카테고리별 명령 목록
   ```php
   '개인' => ['휴식', 'che_요양', ...],
   '내정' => ['che_농지개간', ...],
   ...
   ```

3. **defaultEvents**: PHP 상수 참조 포함
   ```php
   ActionLogger::EVENT_YEAR_MONTH
   ```

### 2. constants.json 통합
변환된 상수들을 `config/scenarios/sangokushi/data/constants.json`에 통합해야 합니다.

### 3. GetConstService 업데이트
새로 추가된 상수들을 GetConstService에서 반환하도록 업데이트해야 합니다.

## 파일 위치

- 추출 스크립트: `scripts/extract-all-php-constants.mjs`
- 누락 상수: `config/scenarios/sangokushi/data/all-missing-constants.json`
- 변환 시도: `config/scenarios/sangokushi/data/converted-constants.json` (일부 실패)

