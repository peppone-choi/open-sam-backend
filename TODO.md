# 백엔드 TODO 목록

## 🔴 긴급 (Critical)

### 1. 핵심 백엔드 기능 미구현

#### ✅ 완료된 기능
- ✅ `ConstraintHelper` - 커맨드 제약 조건 체크 (기본 구현 완료)
- ✅ `StaticEventHandler` - 정적 이벤트 처리 (구현 완료)
- ✅ `ActionLogger` - 액션 로깅 (구현 완료)
- ✅ `refreshNationStaticInfo` - 국가 정적 정보 갱신 (구현 완료)

#### ⚠️ 미완성 기능
- ⚠️ `tryUniqueItemLottery` - 유니크 아이템 추첨 (복잡한 함수, 전체 구현 필요)
  - PHP: `core/hwe/func.php:1611` 참고
  - 유니크 아이템 확률 계산 및 지급 로직 구현 필요
  - `giveRandomUniqueItem` 함수도 함께 구현 필요

### 2. 백엔드 서비스 TODO

#### `Join.service.ts`
- rank_data 테이블 연동
- 유산 포인트 로깅
- 이미지 정보 처리

#### `GetFrontInfo.service.ts`
- 접속자 정보 추가
- 세션 상태 확인 강화

#### `AuctionBasicResource.ts`
- 경매 이전 확인 로직
- `AuctionInfo` 생성 및 관리

#### `supply-line.ts`
- `CityConst` 경로 정보 활용
- 인접 도시 계산 로직

#### `GetMap.service.ts`
- User grade 체크 추가
- 권한별 지도 정보 필터링

## 🟡 중요 (High Priority)

### 3. 커맨드 클래스 TODO

#### `BaseCommand.ts`
- city/nation lookup 강화
- constraint testing 개선

#### `conscript.ts`
- 기술력 계산 로직 검증
- 비용 계산 정확도 확인

#### `train.ts`
- `StaticEventHandler` 연동 확인
- `tryUniqueItemLottery` 연동 필요

#### `tradeRice.ts`
- `ConstraintHelper` 사용 확인
- `StaticEventHandler` 연동 확인

#### 기타 커맨드들
- `ConstraintHelper` 사용 확인
- `StaticEventHandler` 연동 확인

### 4. Route/API TODO

#### `diplomacy.routes.ts`
- `NgDiplomacy` 모델 확인
- 외교 상태 처리 로직 검증

#### `admin.routes.ts`
- 실제 로그 파일 읽기 구현
- 로그 분석 기능

#### `gateway.routes.ts`
- `member_log` 테이블 로그 기록
- 접속 로그 관리

#### `oauth.routes.ts`
- 상태 토큰 검증 강화
- 보안 개선

### 5. 데이터 모델 TODO

#### 세션 관리
- 세션 타임아웃 처리
- 세션 데이터 동기화

#### 캐싱
- Redis 캐싱 전략 개선
- 캐시 무효화 로직

## 🟢 낮은 우선순위 (Low Priority)

### 6. 기타 백엔드 TODO

#### `KakaoUtil.ts`
- 카카오 API SDK 연동
- OAuth 처리

#### `FileDB.ts`
- SQLite 라이브러리 사용
- 파일 기반 DB 관리

#### `Session.ts`
- `UniqueConst` 구현
- 세션 상수 관리

#### `AppConf.ts`
- `ServConfig` 구현
- `RootDB` 구현

#### `TournamentEngine.service.ts`
- 토너먼트 로직 구현
- 대진표 생성

#### `DiplomaticMessage.ts`
- 외교 메시지 처리 완성
- 메시지 큐 관리

#### `Message.ts`
- 메시지 DB 쿼리 구현
- 메시지 필터링

### 7. 성능 최적화
- DB 쿼리 최적화
- 인덱스 추가
- 배치 처리 개선
- 메모리 사용량 최적화

### 8. 테스트
- 단위 테스트 작성
- 통합 테스트 작성
- E2E 테스트 작성
- 부하 테스트

## 📊 통계

- **핵심 기능 미구현**: 1개 (`tryUniqueItemLottery`)
- **서비스 TODO**: 5개
- **커맨드 클래스 TODO**: 다수
- **Route/API TODO**: 4개
- **기타**: 성능, 보안, 테스트

## 우선순위 추천

1. **1순위**: `tryUniqueItemLottery` 구현 (게임 핵심 기능)
2. **2순위**: 백엔드 서비스 TODO 완성 (Join, GetFrontInfo 등)
3. **3순위**: 커맨드 클래스 TODO (ConstraintHelper, StaticEventHandler 연동)
4. **4순위**: Route/API TODO (보안, 로깅)
5. **5순위**: 성능 최적화 및 테스트

## 참고 사항

- `GetProcessingCommand.service.ts`의 모든 TODO는 완료됨
- `refreshNationStaticInfo` 구현 완료
- `ConstraintHelper`, `StaticEventHandler`, `ActionLogger`는 기본 구현 완료, 추가 연동 필요

