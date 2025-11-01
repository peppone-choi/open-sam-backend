# Nation Commands 변환 진행 상황

PHP → TypeScript 변환 상태

## 완료 (7/38)
- ✅ che_감축.ts
- ✅ che_국기변경.ts
- ✅ che_국호변경.ts
- ✅ che_선전포고.ts
- ✅ che_증축.ts
- ✅ che_천도.ts
- ✅ 휴식.ts

## 작업 필요 (31/38)
### 국가 전략 커맨드 (che_*)
- ⏳ che_급습.ts - 전략 커맨드 (strategic command)
- ⏳ che_몰수.ts - 장수 자원 몰수
- ⏳ che_무작위수도이전.ts
- ⏳ che_물자원조.ts - 국가간 자원 지원
- ⏳ che_발령.ts - 장수 도시 이동 명령
- ⏳ che_백성동원.ts - 전략 커맨드
- ⏳ che_부대탈퇴지시.ts - 부대 관리
- ⏳ che_불가침수락.ts - 외교
- ⏳ che_불가침제의.ts - 외교
- ⏳ che_불가침파기수락.ts - 외교
- ⏳ che_불가침파기제의.ts - 외교
- ⏳ che_수몰.ts - 도시 파괴
- ⏳ che_의병모집.ts
- ⏳ che_이호경식.ts
- ⏳ che_종전수락.ts - 외교
- ⏳ che_종전제의.ts - 외교
- ⏳ che_초토화.ts - 도시 파괴
- ⏳ che_포상.ts - 장수 자원 지급
- ⏳ che_피장파장.ts
- ⏳ che_필사즉생.ts
- ⏳ che_허보.ts

### 기타 (cr_*, event_*)
- ⏳ cr_인구이동.ts
- ⏳ event_극병연구.ts - 특수병과 연구
- ⏳ event_대검병연구.ts
- ⏳ event_무희연구.ts
- ⏳ event_산저병연구.ts
- ⏳ event_상병연구.ts
- ⏳ event_원융노병연구.ts
- ⏳ event_음귀병연구.ts
- ⏳ event_화륜차연구.ts
- ⏳ event_화시병연구.ts

## 구현 패턴

### 1. 기본 국가 커맨드 (증축, 감축)
- addTermStack() 메서드로 턴 누적 관리
- capset으로 수도 변경 추적
- 비용 getCost() 계산

### 2. 외교 커맨드 (선전포고, 불가침)
- setDestNation()으로 대상 국가 설정
- diplomacy 테이블 업데이트
- 외교 메시지 전송

### 3. 장수 관련 (포상, 몰수, 발령)
- setDestGeneral()로 대상 장수 설정
- 본인 체크 필요
- 자원 증감 처리

### 4. 전략 커맨드 (급습, 백성동원)
- strategic_cmd_limit 체크
- getPostReqTurn()으로 재사용 대기 시간
- 전략 효과 적용

### 5. 특수병과 연구 (event_*)
- 연구 조건 체크
- 병과 해금
- 비용과 시간 소요
