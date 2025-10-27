# Admin API 가이드

## 개요

게임 관리자를 위한 API입니다. 게임 설정, 병종 상성, 밸런스 조정 등 모든 데이터를 관리할 수 있습니다.

## 인증

모든 Admin API는 인증이 필요합니다.

```http
GET /api/admin/config
X-Admin-Id: admin-user-id
```

## API 엔드포인트

### 게임 설정

#### 1. 현재 설정 조회

```http
GET /api/admin/config
```

**응답:**
```json
{
  "config": {
    "unitAdvantage": {
      "advantages": {
        "1100": [1200],
        "1200": [1300],
        "1300": [1100]
      },
      "advantageMultiplier": 1.2,
      "disadvantageMultiplier": 0.8,
      "units": [...]
    },
    "balance": {...},
    "turnConfig": {...},
    "expConfig": {...},
    "version": "1.0.0",
    "updatedBy": "admin-id",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

#### 2. 병종 상성 업데이트

```http
PUT /api/admin/config/unit-advantage
Content-Type: application/json

{
  "advantages": {
    "1100": [1200, 1400],
    "1200": [1300],
    "1300": [1100],
    "1400": [1500]
  }
}
```

**설명:**
- `1100`(보병)이 `1200`(궁병)과 `1400`(특수병)에게 강함
- 키: 병종 ID, 값: 약한 병종 ID 배열

#### 3. 병종 정보 업데이트

```http
PUT /api/admin/config/units
Content-Type: application/json

{
  "units": [
    {
      "id": 1100,
      "name": "보병",
      "type": "INFANTRY",
      "description": "기본 보병",
      "baseAttack": 100,
      "baseDefense": 120,
      "baseMobility": 80,
      "recruitCost": 50,
      "hiringCost": 100,
      "maintenanceCost": 5
    },
    {
      "id": 1200,
      "name": "궁병",
      "type": "ARCHER",
      "description": "원거리 궁병",
      "baseAttack": 110,
      "baseDefense": 80,
      "baseMobility": 90,
      "recruitCost": 60,
      "hiringCost": 120,
      "maintenanceCost": 6
    }
  ]
}
```

#### 4. 게임 밸런스 업데이트

```http
PUT /api/admin/config/balance
Content-Type: application/json

{
  "domestic": {
    "agriculture": 1.2,
    "commerce": 1.1,
    "technology": 0.9
  },
  "military": {
    "trainEfficiency": 1.1,
    "moraleEfficiency": 1.0
  },
  "production": {
    "goldPerPopulation": 12,
    "ricePerAgriculture": 110
  },
  "combat": {
    "baseDamage": 120,
    "criticalRate": 0.08,
    "criticalMultiplier": 1.8
  }
}
```

**설명:**
- `domestic`: 내정 효율 배율
- `military`: 군사 효율 배율
- `production`: 자원 생산량
- `combat`: 전투 관련 수치

#### 5. 턴 설정 업데이트

```http
PUT /api/admin/config/turn
Content-Type: application/json

{
  "turnDuration": 30,
  "maxTurnsPerDay": 2880,
  "pcp": {
    "max": 120,
    "recovery": 2
  },
  "mcp": {
    "max": 60,
    "recovery": 1
  }
}
```

#### 6. 경험치 설정 업데이트

```http
PUT /api/admin/config/exp
Content-Type: application/json

{
  "levelUpExp": [100, 200, 300, 400, 500],
  "leadership": {
    "domestic": 12,
    "military": 15
  },
  "strength": {
    "combat": 15,
    "training": 8
  },
  "intel": {
    "research": 12,
    "stratagem": 8
  }
}
```

### 도메인 관리

#### General 관리

```http
# 목록 조회
GET /api/admin/generals?page=1&limit=50

# 상세 조회
GET /api/admin/generals/:id

# 수정
PUT /api/admin/generals/:id
Content-Type: application/json

{
  "leadership": 95,
  "strength": 88,
  "intel": 92,
  "gold": 10000,
  "rice": 5000
}

# 삭제 (슈퍼 관리자만)
DELETE /api/admin/generals/:id
```

#### City 관리

```http
# 목록 조회
GET /api/admin/cities

# 수정
PUT /api/admin/cities/:id
Content-Type: application/json

{
  "gold": 100000,
  "rice": 50000,
  "population": 10000,
  "agriculture": 500,
  "commerce": 300
}
```

#### Nation 관리

```http
# 목록 조회
GET /api/admin/nations

# 수정
PUT /api/admin/nations/:id
Content-Type: application/json

{
  "gold": 500000,
  "rice": 300000,
  "tech": 100,
  "power": 5000
}
```

### 시스템

#### 시스템 상태

```http
GET /api/admin/system/status
```

**응답:**
```json
{
  "status": "running",
  "uptime": 3600,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 87654321
  },
  "version": "1.0.0"
}
```

#### 데이터베이스 통계

```http
GET /api/admin/system/stats
```

**응답:**
```json
{
  "generals": 1523,
  "cities": 89,
  "nations": 15,
  "users": 342
}
```

## 권한 시스템

### 권한 레벨

1. **SUPER_ADMIN**: 모든 권한
2. **ADMIN**: 대부분의 관리 권한
3. **MODERATOR**: 조회 및 제한된 수정 권한

### 권한 목록

- `MANAGE_CONFIG`: 게임 설정 관리
- `MANAGE_GENERALS`: 장수 관리
- `MANAGE_CITIES`: 도시 관리
- `MANAGE_NATIONS`: 국가 관리
- `MANAGE_COMMANDS`: 커맨드 관리
- `MANAGE_SESSIONS`: 게임 세션 관리
- `MANAGE_USERS`: 사용자 관리
- `VIEW_LOGS`: 로그 조회
- `EXECUTE_SCRIPTS`: 스크립트 실행

## 사용 예시

### 1. 병종 밸런스 조정

보병을 강화하고 기병을 약화시키는 경우:

```bash
curl -X PUT http://localhost:3000/api/admin/config/units \
  -H "X-Admin-Id: admin-123" \
  -H "Content-Type: application/json" \
  -d '{
    "units": [
      {
        "id": 1100,
        "name": "보병",
        "type": "INFANTRY",
        "baseAttack": 120,
        "baseDefense": 140,
        "baseMobility": 80,
        "recruitCost": 45,
        "hiringCost": 90,
        "maintenanceCost": 4
      },
      {
        "id": 1300,
        "name": "기병",
        "type": "CAVALRY",
        "baseAttack": 110,
        "baseDefense": 85,
        "baseMobility": 130,
        "recruitCost": 90,
        "hiringCost": 180,
        "maintenanceCost": 10
      }
    ]
  }'
```

### 2. 내정 효율 높이기

농업과 상업 효율을 20% 증가:

```bash
curl -X PUT http://localhost:3000/api/admin/config/balance \
  -H "X-Admin-Id: admin-123" \
  -H "Content-Type: application/json" \
  -d '{
    "domestic": {
      "agriculture": 1.2,
      "commerce": 1.2
    }
  }'
```

### 3. 특정 장수 스탯 수정

```bash
curl -X PUT http://localhost:3000/api/admin/generals/general-123 \
  -H "X-Admin-Id: admin-123" \
  -H "Content-Type: application/json" \
  -d '{
    "leadership": 99,
    "strength": 95,
    "intel": 98
  }'
```

## 보안 주의사항

1. **인증 필수**: 모든 Admin API는 인증 필요
2. **권한 체크**: 각 작업별로 적절한 권한 필요
3. **로그 기록**: 모든 수정 작업은 로그에 기록됨
4. **IP 제한**: 프로덕션 환경에서는 IP 화이트리스트 적용 권장

## TODO

- [ ] Admin 사용자 관리 API
- [ ] Admin 로그 조회 API
- [ ] 도메인별 상세 CRUD 구현
- [ ] JWT 인증 구현
- [ ] IP 화이트리스트
- [ ] 2FA (Two-Factor Authentication)
