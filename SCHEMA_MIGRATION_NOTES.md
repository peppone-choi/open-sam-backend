# Schema Migration Notes

schema.sql (MySQL/MariaDB)을 MongoDB로 마이그레이션한 내역

## 주요 변경 사항

### 1. General (장수) 테이블
**원본**: `general` 테이블 (MySQL)
**대상**: `GeneralModel` (MongoDB)

#### 주요 필드 매핑
| MySQL 필드 | MongoDB 필드 | 타입 | 비고 |
|---|---|---|---|
| `no` | `_id` | ObjectId | Auto-generated |
| `owner` | `owner` | String | User ID 참조 |
| `name` | `name` | String | 장수명 |
| `nation` | `nation` | String | Nation ObjectId 참조 |
| `city` | `city` | String | City ObjectId 참조 |
| `leadership` | `leadership` | Number | 통솔 |
| `strength` | `strength` | Number | 무력 |
| `intel` | `intel` | Number | 지력 |
| `gold` | `gold` | Number | 금 |
| `rice` | `rice` | Number | 쌀 |
| `crew` | `crew` | Number | 병사 수 |
| `crewtype` | `crewType` | Number | 병종 (1100=보병, 1200=궁병, 1300=기병) |
| `last_turn` | `lastTurn` | Object | JSON 필드 |
| `aux` | `aux` | Object | JSON 필드 |
| `penalty` | `penalty` | Object | JSON 필드 |

#### 제거된 필드
- 없음 (모든 필드 유지)

### 2. City (도시) 테이블
**원본**: `city` 테이블 (MySQL)
**대상**: `CityModel` (MongoDB)

#### 주요 필드 매핑
| MySQL 필드 | MongoDB 필드 | 타입 | 비고 |
|---|---|---|---|
| `city` | `_id` | ObjectId | Auto-generated |
| `name` | `name` | String | 도시명 |
| `nation` | `nation` | String | Nation ObjectId 참조 |
| `pop` | `pop` | Number | 인구 |
| `agri` | `agri` | Number | 농업 |
| `comm` | `comm` | Number | 상업 |
| `secu` | `secu` | Number | 치안 |
| `def` | `def` | Number | 방어력 |
| `wall` | `wall` | Number | 성벽 |
| `trade` | `trade` | Number | 시세 (100=표준) |
| `conflict` | `conflict` | Object | JSON 필드 |

### 3. Nation (국가) 테이블
**원본**: `nation` 테이블 (MySQL)
**대상**: `NationModel` (MongoDB)

#### 주요 필드 매핑
| MySQL 필드 | MongoDB 필드 | 타입 | 비고 |
|---|---|---|---|
| `nation` | `_id` | ObjectId | Auto-generated |
| `name` | `name` | String | 국가명 |
| `color` | `color` | String | 국가 색상 |
| `capital` | `capital` | Number | 수도 레벨 |
| `capset` | `capSet` | String | 수도 cityId |
| `tech` | `tech` | Number | 기술력 |
| `power` | `power` | Number | 국력 |
| `spy` | `spy` | Object | JSON 필드 |
| `aux` | `aux` | Object | JSON 필드 |

### 4. Command (명령) 테이블
**신규 설계** (CQRS 패턴 적용)

#### 필드 구조
| 필드 | 타입 | 비고 |
|---|---|---|
| `_id` | ObjectId | Auto-generated |
| `generalId` | String | General ObjectId 참조 |
| `type` | Enum | MOVE, PRODUCE, RECRUIT 등 |
| `status` | Enum | PENDING, EXECUTING, COMPLETED 등 |
| `payload` | Object | 명령 데이터 (타입별 다름) |
| `cpCost` | Number | CP 비용 |
| `cpType` | String | PCP 또는 MCP |
| `startTime` | Date | 시작 시간 |
| `completionTime` | Date | 완료 예정 시간 |

## MySQL vs MongoDB 주요 차이점

### 1. 자동 증가 ID
- **MySQL**: `AUTO_INCREMENT`
- **MongoDB**: `ObjectId` (자동 생성)

### 2. JSON 필드
- **MySQL**: `TEXT` + `JSON_VALID()` 제약
- **MongoDB**: Native `Object` 타입

### 3. ENUM
- **MySQL**: `ENUM('value1', 'value2')`
- **MongoDB**: Schema validation with `enum: []`

### 4. 인덱스
- **MySQL**: `INDEX`, `UNIQUE INDEX`
- **MongoDB**: `.index()` 메서드

## 병종 (CrewType) 코드

unit/basic.php 기반:

| 코드 | 이름 | 타입 | 특성 |
|---|---|---|---|
| 1000 | 성벽 | CASTLE | 공격 불가 |
| 1100 | 보병 | FOOTMAN | 방어 특화 |
| 1200 | 궁병 | ARCHER | 회피 특화 |
| 1300 | 기병 | CAVALRY | 공격 특화 |
| 1400 | 귀병 | WIZARD | 계략 특화 |
| 1405 | 남귀병 | WIZARD | 계략 전문 |
| 1500 | 정란 | SIEGE | 공성 특화 |
| 1501 | 충차 | SIEGE | 성벽 파괴 |

## 특기 (Personal) 종류

scenario 데이터 기반:

- `무쌍`: 강력한 전투력
- `위압`: 적 위협
- `돌격`: 기병 공격
- `집중`: 정확도 증가
- `기병`: 기병 보너스
- `궁병`: 궁병 보너스
- `보병`: 보병 보너스
- `귀병`: 계략 보너스
- `귀모`: 계략 마스터
- `상재`: 내정 보너스
- `인덕`: 인구 증가
- `신중`: 방어 보너스
- `징병`: 징병 보너스
- `경작`: 농업 보너스
- `공성`: 공성전 보너스
- `신산`: 산악전 보너스
- `의술`: 부상 회복

## 향후 작업

### Phase 1: 기본 CRUD
- [x] General 스키마 완성
- [x] City 스키마 완성
- [x] Nation 스키마 완성
- [x] Command 스키마 완성

### Phase 2: 시나리오 데이터 로드
- [ ] scenario/*.json 파싱
- [ ] 초기 장수 데이터 로드
- [ ] 초기 도시 데이터 로드
- [ ] 초기 국가 데이터 로드

### Phase 3: 게임 로직
- [ ] 턴 처리 시스템
- [ ] 전투 시스템
- [ ] 내정 시스템
- [ ] CP 시스템
- [ ] 병종 시스템

### Phase 4: 추가 테이블
- [ ] `general_turn` - 턴 기록
- [ ] `general_access_log` - 접속 로그
- [ ] `nation_turn` - 국가 턴 기록
- [ ] `board`, `comment` - 회의실
- [ ] `message` - 메시지
- [ ] `world_history` - 역사 기록
- [ ] `general_record` - 장수 동향

## 참고 자료
- schema.sql - 원본 MySQL 스키마
- scenario/ - 시나리오 데이터
- unit/basic.php - 병종 정의
- FOLDER_STRUCTURE.md - 프로젝트 구조
