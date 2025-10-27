# 도메인 체크리스트 (schema.sql 기준)

schema.sql의 모든 테이블을 독립된 도메인으로 구현

## ✅ 완료된 도메인 (4개)

1. **general** - 장수
2. **city** - 도시  
3. **nation** - 국가 (스키마만)
4. **command** - 명령

## ❌ 필요한 도메인 (24개)

### 장수 관련 (3개)
5. **general-turn** - 장수 턴 기록
6. **general-access-log** - 장수 접속 로그
7. **general-record** - 장수 동향

### 국가 관련 (2개)
8. **nation-turn** - 국가 턴 기록
9. **nation-env** - 국가 환경 변수

### 부대/전투 관련 (1개)
10. **troop** - 부대

### 커뮤니케이션 (3개)
11. **message** - 메시지
12. **board** - 회의실 게시글
13. **comment** - 댓글

### 역사/기록 (2개)
14. **world-history** - 전체 이벤트 기록
15. **ng-history** - 연감

### 게임 시스템 (5개)
16. **event** - 이벤트 핸들러
17. **plock** - 락 (동시성 제어)
18. **reserved-open** - 예약 오픈
19. **storage** - KV 저장소
20. **rank-data** - 명장일람 (랭킹)

### 장수 선택 (2개)
21. **select-npc-token** - 장수 선택 토큰
22. **select-pool** - 장수 생성 풀

### 사용자 (1개)
23. **user-record** - 유저 전용 로그

### 게임 이벤트 (4개)
24. **ng-betting** - 베팅
25. **vote** - 설문 조사
26. **vote-comment** - 설문 댓글
27. **ng-auction** - 경매
28. **ng-auction-bid** - 경매 입찰

---

## 구현 우선순위

### Phase 1: 핵심 게임 플레이 (우선순위 HIGH)
- [ ] general-turn (턴 처리 필수)
- [ ] nation-turn (국가 턴 필수)
- [ ] troop (부대 시스템)
- [ ] message (게임 내 메시지)
- [ ] plock (동시성 제어)

### Phase 2: 기록/로그 (우선순위 MEDIUM)
- [ ] general-record (장수 동향)
- [ ] general-access-log (접속 로그)
- [ ] world-history (역사 기록)
- [ ] rank-data (랭킹)

### Phase 3: 커뮤니티 (우선순위 MEDIUM)
- [ ] board (회의실)
- [ ] comment (댓글)

### Phase 4: 고급 기능 (우선순위 LOW)
- [ ] event (이벤트 시스템)
- [ ] ng-history (연감)
- [ ] storage (KV 저장소)
- [ ] nation-env (국가 환경)
- [ ] reserved-open (예약 오픈)
- [ ] select-npc-token (장수 선택)
- [ ] select-pool (장수 풀)
- [ ] user-record (유저 로그)
- [ ] ng-betting (베팅)
- [ ] vote (설문)
- [ ] vote-comment (설문 댓글)
- [ ] ng-auction (경매)
- [ ] ng-auction-bid (경매 입찰)

---

## 각 도메인 구조 (blackandwhite-dev-back 패턴)

```
domain-name/
├── domain-name.schema.ts           # Mongoose 스키마
├── repository/
│   └── domain-name.repository.ts   # 데이터 접근
├── service/
│   └── domain-name.service.ts      # 비즈니스 로직
├── controller/
│   └── domain-name.controller.ts   # 요청/응답
└── router/
    └── domain-name.router.ts       # 라우트
```

---

## 생성 명령어

```bash
# Phase 1 도메인 생성
mkdir -p src/api/general-turn/{repository,service,controller,router}
mkdir -p src/api/nation-turn/{repository,service,controller,router}
mkdir -p src/api/troop/{repository,service,controller,router}
mkdir -p src/api/message/{repository,service,controller,router}
mkdir -p src/api/plock/{repository,service,controller,router}

# Phase 2 도메인 생성
mkdir -p src/api/general-record/{repository,service,controller,router}
mkdir -p src/api/general-access-log/{repository,service,controller,router}
mkdir -p src/api/world-history/{repository,service,controller,router}
mkdir -p src/api/rank-data/{repository,service,controller,router}

# Phase 3 도메인 생성
mkdir -p src/api/board/{repository,service,controller,router}
mkdir -p src/api/comment/{repository,service,controller,router}

# Phase 4 도메인 생성
mkdir -p src/api/event/{repository,service,controller,router}
mkdir -p src/api/ng-history/{repository,service,controller,router}
mkdir -p src/api/storage/{repository,service,controller,router}
mkdir -p src/api/nation-env/{repository,service,controller,router}
mkdir -p src/api/reserved-open/{repository,service,controller,router}
mkdir -p src/api/select-npc-token/{repository,service,controller,router}
mkdir -p src/api/select-pool/{repository,service,controller,router}
mkdir -p src/api/user-record/{repository,service,controller,router}
mkdir -p src/api/ng-betting/{repository,service,controller,router}
mkdir -p src/api/vote/{repository,service,controller,router}
mkdir -p src/api/vote-comment/{repository,service,controller,router}
mkdir -p src/api/ng-auction/{repository,service,controller,router}
mkdir -p src/api/ng-auction-bid/{repository,service,controller,router}
```

---

## 완료 후 확인

- [ ] 총 28개 도메인 폴더 생성
- [ ] 각 도메인별 타입 정의 (@types/domain/)
- [ ] 각 도메인별 스키마 생성
- [ ] 각 도메인별 3계층 (Repository, Service, Controller)
- [ ] 라우터 통합 (api/index.ts)
