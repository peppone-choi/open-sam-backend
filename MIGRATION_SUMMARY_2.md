# PHP to TypeScript 마이그레이션 요약 (2차)

## 추가로 마이그레이션된 파일들

### 1. Validator.ts
- **위치**: `src/utils/Validator.ts`
- **PHP 원본**: `sammo-php/src/sammo/Validator.php`
- **기능**:
  - yup 기반 유효성 검사 시스템
  - 정수 배열 검증 (`validateIntegerArray`)
  - 문자열 배열 검증 (`validateStringArray`)
  - 정수/실수 검증 (`validateInt`, `validateFloat`)
  - 문자열 너비 검증 (`validateStringWidthMax`, `validateStringWidthMin`, `validateStringWidthBetween`)
  - 키 존재 검증 (`validateKeyExists`)
  - 에러 메시지 처리 (`errorStr`, `errors`)

### 2. WebUtil.ts
- **위치**: `src/utils/WebUtil.ts`
- **PHP 원본**: `sammo-php/src/sammo/WebUtil.php`
- **기능**:
  - IPv4 이스케이프 (`escapeIPv4`)
  - 상대 경로 해석 (`resolveRelativePath`)
  - 캐시 헤더 관리 (`setHeaderNoCache`, `setCacheHeader`, `parseETag`, `parseLastModified`, `dieWithNotModified`)
  - AJAX 요청 처리 (`isAJAX`, `requireAJAX`, `parseJsonPost`)
  - 정적 값 출력 (`printStaticValues`)
  - HTML 정제 (`htmlPurify`)
  - 에러 백 메시지 (`errorBackMsg`)
  - 메뉴 렌더링 (`drawMenu`)
  - 도메인 교체 (`replaceDomain`)
  - APICacheResult 클래스

### 3. FileUtil.ts
- **위치**: `src/utils/FileUtil.ts`
- **PHP 원본**: `sammo-php/src/sammo/FileUtil.php`
- **기능**:
  - 디렉토리 내 파일 삭제 (`delInDir`)
  - 만료된 파일 삭제 (`delExpiredInDir`)
  - 파일 존재 확인 (`exists`)
  - 디렉토리 생성 (`mkdir`)
  - 파일 읽기/쓰기 (`readFile`, `writeFile`)
  - 파일 삭제 (`deleteFile`)
  - 파일 수정 시간 가져오기 (`getMTime`)

### 4. Util.ts 확장
- **추가된 기능**:
  - `convertPairArrayToDict`: 페어 배열을 딕셔너리로 변환
  - `convertTupleArrayToDict`: 튜플 배열을 딕셔너리로 변환
  - `convertDictToArray`: 딕셔너리를 배열로 변환
  - `squeezeFromArray`: 배열에서 특정 키 추출
  - `isDict`: 딕셔너리인지 확인
  - `shuffleAssoc`: 키-값 쌍을 보존한 섞기
  - `convPercentStrToFloat`: 퍼센트 문자열을 float으로 변환
  - `choiceRandomUsingWeight`: 가중치를 사용한 랜덤 선택
  - `getKeyOfMaxValue`: 최대값을 가진 키 반환
  - `getClassName`: 클래스 경로에서 클래스 이름 추출
  - `getClassNameFromObj`: 객체에서 클래스 이름 추출
  - `testArrayValues`: 배열의 모든 원소가 조건을 만족하는지 확인
  - `formatListOfBackticks`: 백틱 리스트 포맷팅
  - `arrayCompare`: 배열 비교
  - `isPowerOfTwo`: 2의 거듭제곱인지 확인
  - `valueFromEnum`: Enum 값 추출
  - `valuesFromEnumArray`: Enum 배열에서 값 추출
  - `simpleSerialize`: 간단한 직렬화
  - `arraySum`: 배열 합계 (키 지정 가능)
  - `arraySumWithKey`: 배열에서 특정 키의 합계
  - `arrayGroupBy`: 배열 그룹화
  - `arrayGroupByPreserveKey`: 배열 그룹화 (키 보존 옵션)
  - `joinYearMonth`: 년월을 정수로 결합
  - `parseYearMonth`: 년월 정수 파싱

## 주요 변경 사항

1. **Express.js 환경에 맞게 조정**
   - `WebUtil`의 헤더 설정이 Express의 `Response` 객체를 사용하도록 변경
   - `parseJsonPost`는 Express의 `body-parser` 미들웨어를 가정

2. **TypeScript 타입 시스템 활용**
   - 제네릭을 사용한 타입 안전성 향상
   - 타입 가드 및 타입 단언 사용

3. **Node.js 파일 시스템 API 사용**
   - `FileUtil`은 Node.js의 `fs` 모듈 사용

4. **유효성 검사 시스템**
   - PHP의 Valitron 기반 `Validator`를 TypeScript의 yup 기반으로 변환

## 마이그레이션 상태

- ✅ TimeUtil.ts
- ✅ string-util.ts (확장)
- ✅ Util.ts (확장)
- ✅ Json.ts (확장)
- ✅ Validator.ts (신규)
- ✅ WebUtil.ts (신규)
- ✅ FileUtil.ts (신규)

## 다음 단계

추가로 확인이 필요한 PHP 파일들:
- `Session.php`: 세션 관리 (Node.js 환경에 맞게 재설계 필요)
- `APICacheResult.php`: 이미 WebUtil에 포함됨
- 기타 도메인별 유틸리티 클래스들



