# PHP → TypeScript 마이그레이션 요약

## 마이그레이션 일자
2024년 (현재 날짜)

## 분석 대상
- 원본 PHP 프로젝트: `../sammo-php/src/sammo/`
- 대상 TypeScript 프로젝트: `src/utils/`

## 마이그레이션된 파일

### 1. TimeUtil.ts (신규 생성)
**원본**: `sammo-php/src/sammo/TimeUtil.php`

**마이그레이션된 기능**:
- `today()` - 오늘 날짜 반환
- `now()` - 현재 시간 반환
- `nowAddDays()`, `nowAddHours()`, `nowAddMinutes()`, `nowAddSeconds()` - 시간 연산
- `secondsToDateTime()`, `dateTimeToSeconds()` - 초 ↔ Date 변환
- `nowDateTime()` - 현재 Date 객체 반환
- `format()` - Date 포맷팅
- `isRangeMonth()` - 월 범위 확인
- `parseDateTime()`, `diffInSeconds()`, `diffInDays()` - 날짜 유틸리티

### 2. string-util.ts (보완)
**원본**: `sammo-php/src/sammo/StringUtil.php`

**추가된 기능**:
- `subStringForWidth()` - 전각/반각 길이 기준 substr
- `cutStringForWidth()` - 지정 너비로 자르기
- `splitString()` - 문자 단위 분할
- `padString()`, `padStringAlignRight()`, `padStringAlignLeft()`, `padStringAlignCenter()` - 패딩
- `uniord()`, `unichr()` - 유니코드 변환
- `escapeTag()` - HTML 태그 이스케이프
- `textStrip()` - 텍스트 정제

### 3. Util.ts (보완)
**원본**: `sammo-php/src/sammo/Util.php`

**추가된 기능**:
- `hashPassword()` - 비밀번호 해시 생성 (SHA512)
- `randomStr()` - 랜덤 문자열 생성
- `mapWithKey()` - 딕셔너리 맵핑
- `convertArrayToSetLike()` - 배열을 Set-like 객체로 변환
- `eraseNullValue()` - null 값 제거 (재귀)
- `toIntSafe()` - 안전한 int 변환

### 4. Json.ts (개선)
**원본**: `sammo-php/src/sammo/Json.php`

**개선 사항**:
- 플래그 시스템 추가:
  - `PRETTY` - 예쁘게 출력
  - `DELETE_NULL` - null 값 제거
  - `NO_CACHE` - 캐시 비활성화 (웹 환경용)
  - `PASS_THROUGH` - 통과 모드
  - `EMPTY_ARRAY_IS_DICT` - 빈 배열을 객체로 변환
- `decodeObj()` - 객체로 디코딩
- `eraseNullValue()` - null 값 제거 지원

## 이미 존재하던 파일 (확인 완료)

### 1. JosaUtil.ts
- 한글 조사 처리 기능 이미 구현됨
- PHP 버전과 비교하여 기능적으로 동일

### 2. RandUtil.ts
- 랜덤 유틸리티 기능 이미 구현됨
- PHP 버전보다 더 많은 기능 제공

## 마이그레이션 통계

- **신규 생성 파일**: 1개 (TimeUtil.ts)
- **보완된 파일**: 3개 (string-util.ts, Util.ts, Json.ts)
- **확인 완료 파일**: 2개 (JosaUtil.ts, RandUtil.ts)
- **총 마이그레이션 기능**: 약 20개 메서드

## 주의사항

1. **crypto 모듈**: `Util.hashPassword()`와 `Util.randomStr()`은 Node.js의 `crypto` 모듈을 사용합니다.

2. **문자열 처리**: JavaScript의 문자열 처리 방식이 PHP와 다르므로, UTF-8 처리 로직을 JavaScript에 맞게 조정했습니다.

3. **Date 객체**: PHP의 DateTime과 JavaScript의 Date 객체는 다르므로, 필요시 추가 변환 로직이 필요할 수 있습니다.

## 다음 단계

1. 실제 사용처에서 테스트 진행
2. PHP 원본과 동작 비교 검증
3. 필요시 추가 최적화 및 버그 수정



