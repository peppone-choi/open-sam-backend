# 최종 폴더 구조 (확정)

## 도메인별 표준 구조

```
domain-name/
├── @types/              # 도메인 전용 타입 (선택적)
├── controller/          # 요청/응답 처리
│   └── domain-name.controller.ts
├── dto/                 # 데이터 전송 객체 (Yup 스키마)
│   └── domain-name.dto.ts
├── model/               # Mongoose 모델/스키마
│   └── domain-name.model.ts
├── repository/          # 데이터 접근 계층
│   └── domain-name.repository.ts
├── router/              # 라우트 정의
│   └── domain-name.router.ts
└── service/             # 비즈니스 로직
    └── domain-name.service.ts
```

## 예시: General 도메인

```
general/
├── @types/              # General 도메인 전용 타입
├── controller/
│   └── general.controller.ts
├── dto/
│   ├── train-general.dto.ts
│   ├── equip-item.dto.ts
│   └── create-general.dto.ts
├── model/
│   └── general.model.ts         # Mongoose Schema
├── repository/
│   └── general.repository.ts
├── router/
│   └── general.router.ts
└── service/
    └── general.service.ts
```

## 변경 사항

### Before
```
general/
├── general.schema.ts     ❌ (최상위)
├── general.types.ts      ❌ (최상위)
├── controller/
├── repository/
├── router/
└── service/
```

### After
```
general/
├── @types/               ✅ (신규)
├── dto/                  ✅ (신규)
├── model/                ✅ (변경)
│   └── general.model.ts  # schema.ts → model.ts
├── controller/           ✅ (유지)
├── repository/           ✅ (유지)
├── router/               ✅ (유지)
└── service/              ✅ (유지)
```

## Import 경로 변경

### Model
```typescript
// Before
import { GeneralModel } from '../general.schema';

// After
import { GeneralModel } from '../model/general.model';
```

### DTO
```typescript
// 신규
import { TrainGeneralSchema } from '../dto/train-general.dto';
```

## 전체 도메인 목록 (31개)

모든 도메인이 동일한 구조를 따릅니다:

1. general ✅
2. general-turn ✅
3. general-access-log ✅
4. general-record ✅
5. city ✅
6. nation ✅
7. nation-turn ✅
8. nation-env ✅
9. command ✅
10. troop ✅
11. battle ✅
12. battlefield-tile ✅
13. item ✅
14. message ✅
15. board ✅
16. comment ✅
17. world-history ✅
18. ng-history ✅
19. event ✅
20. plock ✅
21. reserved-open ✅
22. select-npc-token ✅
23. select-pool ✅
24. storage ✅
25. rank-data ✅
26. user-record ✅
27. ng-betting ✅
28. vote ✅
29. vote-comment ✅
30. ng-auction ✅
31. ng-auction-bid ✅

## 파일 개수

- **도메인**: 31개
- **폴더**: 31 × 7 = 217개
- **파일**: 약 160개+ (model, repository, service, controller, router 등)

## 작업 완료 항목

- ✅ 모든 도메인에 @types/, dto/, model/ 폴더 생성
- ✅ {domain}.schema.ts → model/{domain}.model.ts 이동
- ✅ import 경로 수정 완료
- ✅ 타일 초기값: 전부 plain (풀밭)
- ✅ 타일 수정 API 추가

## 다음 단계

1. DTO 스키마 작성 (Yup)
2. Controller 활성화
3. Router 연결
4. Container.ts에 팩토리 추가
