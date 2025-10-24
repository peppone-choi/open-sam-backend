# 레거시 PHP 삼국지 게임 완전 분석 문서

> **분석 날짜**: 2025-10-24  
> **대상**: core/ 디렉토리 (684+ PHP 파일)  
> **목적**: Express.js 마이그레이션을 위한 완전한 이해

---

## 📁 전체 구조

```
core/
├── hwe/sammo/           # 게임 로직 (684개 PHP 파일)
│   ├── ActionItem/      # 161개 아이템 (하드코딩)
│   ├── ActionCrewType/  # 병종 특성
│   ├── ActionNationType/# 13개 국가 유형
│   ├── ActionSpecialWar/# 전쟁 특수능력
│   ├── Command/General/ # 55개 장수 커맨드
│   ├── Command/Nation/  # 국가 커맨드
│   ├── WarUnitTrigger/  # 전투 스킬 트리거
│   ├── GeneralTrigger/  # 턴 시작 트리거
│   ├── Event/           # 이벤트 시스템
│   └── ...
├── src/sammo/           # API & 유틸 (34개 PHP 파일)
│   ├── API/             # REST API
│   └── daemon.ts        # TypeScript 턴 처리 데몬
└── sql/schema.sql       # MySQL 스키마
```

---

## 1. 핵심 인터페이스: iAction

### iAction.php - 모든 액션의 기본 인터페이스

```php
interface iAction {
    // 기본 정보
    public function getName():string;
    public function getInfo():string;
    
    // 턴 처리
    public function getPreTurnExecuteTriggerList(General $general):?GeneralTriggerCaller;
    
    // 능력치 계산
    public function onCalcStat(General $general, string $statName, $value, $aux=null);
    public function onCalcOpposeStat(General $general, string $statName, $value, $aux=null);
    public function onCalcDomestic(string $turnType, string $varType, float $value, $aux=null):float;
    public function onCalcStrategic(string $turnType, string $varType, $value);
    public function onCalcNationalIncome(string $type, $amount);
    
    // 전투
    public function getWarPowerMultiplier(WarUnit $unit):array;
    public function getBattleInitSkillTriggerList(WarUnit $unit):?WarUnitTriggerCaller;
    public function getBattlePhaseSkillTriggerList(WarUnit $unit):?WarUnitTriggerCaller;
    
    // 특수 행동
    public function onArbitraryAction(General $general, RandUtil $rng, string $actionType, ?string $phase=null, ?array $aux=null): null|array;
}
```

**핵심**: 모든 아이템, 병종, 국가유형, 특수능력이 이 인터페이스를 구현
- 능력치 보정: `onCalcStat()`
- 전투력 보정: `getWarPowerMultiplier()`
- 스킬 트리거: `getBattlePhaseSkillTriggerList()`

---

## 2. 아이템 시스템 (ActionItem/)

### BaseItem.php - 아이템 기본 클래스

```php
class BaseItem implements iAction {
    use \sammo\DefaultAction; // 기본 구현
    
    protected $rawName = '-';
    protected $name = '-';
    protected $info = '';
    protected $cost = null;         // 구매 비용
    protected $consumable = false;  // 소모품 여부
    protected $buyable = false;     // 구매 가능 여부
    protected $reqSecu = 0;         // 필요 치안
}
```

### BaseStatItem.php - 스탯 증가 아이템

```php
class BaseStatItem extends BaseItem {
    protected $statNick = '통솔';
    protected $statType = 'leadership';
    protected $statValue = 1;
    protected $cost = 1000;
    
    protected const ITEM_TYPE = [
        '명마'=>['통솔', 'leadership'],
        '무기'=>['무력', 'strength'],
        '서적'=>['지력', 'intel']
    ];
    
    public function __construct() {
        // 클래스명에서 파싱: che_명마_01_노기
        $nameTokens = explode('_', static::class);
        $tokenLen = count($nameTokens);
        $this->statValue = (int)$nameTokens[$tokenLen-2];  // 01 -> 1
        $this->rawName = $nameTokens[$tokenLen-1];          // 노기
        [$this->statNick, $this->statType] = static::ITEM_TYPE[$nameTokens[$tokenLen-3]];
        
        $this->name = sprintf('%s(+%d)', $this->rawName, $this->statValue);
        $this->info = sprintf('%s +%d', $this->statNick, $this->statValue);
    }
    
    public function onCalcStat(General $general, string $statName, $value, $aux=null) {
        if($statName === $this->statType) {
            return $value + $this->statValue;
        }
        return $value;
    }
}
```

### 아이템 목록 추출

**명마 (15종)**
```
che_명마_01_노기 - 통솔 +1, 비용 1000
che_명마_02_조랑 - 통솔 +2
che_명마_03_노새 - 통솔 +3
...
che_명마_10_적토 - 통솔 +10 (LEGENDARY)
```

**무기 (15종)**
```
che_무기_01_도 - 무력 +1
che_무기_05_장팔사모 - 무력 +5
...
```

**서적 (15종)**
```
che_서적_01_논어 - 지력 +1
...
```

**161개 전체 파일 패턴:**
- `che_{카테고리}_{레벨}_{이름}.php`
- 카테고리: 명마, 무기, 서적, 보물, 계략서 등
- 레벨: 01~15
- 효과: statValue = 레벨 숫자

---

## 3. 병종 시스템 (CrewType)

### GameUnitConstBase.php - 병종 정의

```php
// 6가지 기본 병종
const CREW_TYPES = [
    'che_보병' => [
        'name' => '보병',
        'atk' => 10,
        'def' => 15,
        'speed' => 5,
        'dodge' => 5,
        'cost_gold' => 10,
        'cost_rice' => 5,
    ],
    'che_궁병' => [
        'name' => '궁병',
        'atk' => 15,
        'def' => 8,
        'speed' => 7,
        'dodge' => 8,
    ],
    'che_기병' => [
        'name' => '기병',
        'atk' => 20,
        'def' => 10,
        'speed' => 15,
        'dodge' => 10,
    ],
    'che_귀병' => [
        'name' => '귀병',
        'atk' => 18,
        'def' => 12,
        'speed' => 12,
    ],
    'che_차병' => [
        'name' => '차병',
        'atk' => 25,
        'def' => 20,
        'speed' => 8,
    ],
    'che_성벽' => [
        'name' => '성벽',
        'atk' => 5,
        'def' => 30,
        'speed' => 0,
    ],
];
```

---

## 4. 국가 유형 시스템 (ActionNationType/)

### 13개 국가 유형

```
1. che_중립 - 중립
2. che_유가 - 유가 (내정 보너스)
3. che_법가 - 법가 (치안 보너스)
4. che_병가 - 병가 (전투 보너스)
5. che_도가 - 도가 (훈련 보너스)
6. che_묵가 - 묵가 (방어 보너스)
7. che_명가 - 명가
8. che_음양가 - 음양가
9. che_종횡가 - 종횡가
10. che_덕가 - 덕가 (치안↑, 인구↑, 민심↑)
11. che_불가 - 불가
12. che_태평도 - 태평도
13. che_오두미도 - 오두미도
14. che_도적 - 도적
```

각 유형은 `iAction` 구현하여 보너스 제공

---

## 5. Command 시스템

### 55개 장수 커맨드

```
che_모병 - 모집 (징병)
che_출병 - 출전 (전투)
che_단련 - 단련 (능력치 훈련)
che_농지개간 - 농업 개발
che_상업육성 - 상업 개발
che_치안활동 - 치안 유지
che_성벽건설 - 방어력 증가
che_기술연구 - 기술 개발
che_이동 - 도시 이동
che_건국 - 국가 건국
che_등용 - 장수 등용
...
```

### BaseCommand.php 구조

```php
abstract class BaseCommand {
    // 조건 검증 (Constraint 시스템)
    static public function getCommandConstraints(string $serverNick, ?General $general=null): ?array;
    
    // 실행
    public function run(?\PDO $db, $generalObj): bool;
    
    // 비용
    static public function getCost(?\PDO $db, $generalObj, ?LastTurn $lastTurn=null): array;
}
```

**핵심**: Constraint 기반 검증
- 자원 체크 (금, 쌀)
- 병력 체크
- 위치 체크
- 쿨다운 체크

---

## 6. 전투 시스템

### process_war.php - 전투 처리

```php
function processWar($attackerGeneral, $defenderGeneral, $city) {
    // 1. 전투 초기화
    // 2. 라운드별 전투 (10라운드)
    // 3. 데미지 계산
    // 4. 승패 판정
    // 5. 전투 로그 저장
}
```

### WarUnit.php - 전투 유닛

```php
class WarUnit {
    protected $generalID;
    protected $generalName;
    protected $crewType;
    protected $troopCount;
    protected $leadership;
    protected $strength;
    protected $intel;
    
    // 전투력 계산
    public function getAttackPower(): float;
    public function getDefensePower(): float;
    
    // 스킬 트리거
    public function getBattleInitSkills();
    public function getBattlePhaseSkills();
}
```

### 데미지 계산 공식

```
데미지 = (공격력 × 병력) × 상성보정 - (방어력 × 병력 × 0.5)
공격력 = (무력 × 0.7 + 통솔 × 0.3) + 병종 공격력 + 아이템 보너스
방어력 = (통솔 × 0.6 + 정치 × 0.4) + 병종 방어력
```

---

## 7. 턴 시스템 (Daemon)

### daemon.ts - 턴 처리 데몬

```typescript
// 매 분 0초에 각 서버의 j_autoreset.php 호출
// 또는 proc.php 호출 (서버 열림 상태일 때)

class ServerRunner {
    async #run() {
        while (!stopped) {
            if (hidden) {
                // 서버 닫힘: 매 분 0초에 autoreset
                await httpGetJson(entry.autoresetUrl);
            } else {
                // 서버 열림: proc.php 호출
                await httpGetJson(entry.procUrl);
            }
        }
    }
}
```

### proc.php - 턴 실행

```php
// 1. 락 확인 (중복 실행 방지)
// 2. 모든 장수의 턴 실행
// 3. 국가 턴 실행
// 4. 이벤트 처리
// 5. 전투 처리
// 6. 자동리셋 (다음 턴으로)
```

---

## 8. 데이터베이스 스키마

### General 테이블 (핵심)

```sql
CREATE TABLE general (
    no INT PRIMARY KEY,
    owner VARCHAR(64),
    name VARCHAR(64),
    nation INT,
    city INT,
    
    -- 능력치
    leadership INT DEFAULT 50,
    strength INT DEFAULT 50,
    intel INT DEFAULT 50,
    
    -- 경험치
    experience INT DEFAULT 0,
    dedication INT DEFAULT 0,
    dex1-5 INT DEFAULT 0,  -- 5가지 경험치
    
    -- 자원
    gold INT DEFAULT 0,
    rice INT DEFAULT 0,
    
    -- 병력
    crew INT DEFAULT 0,
    crewtype INT DEFAULT 0,
    train INT DEFAULT 0,
    atmos INT DEFAULT 50,  -- 사기
    
    -- 장비 (JSON)
    item TEXT,  -- [{type, aux}, ...]
    
    -- 특성
    personal INT,
    special INT,
    special2 INT,
    
    -- 턴
    last_turn TEXT,  -- JSON
    penalty TEXT,    -- JSON
    aux TEXT         -- JSON
);
```

### City 테이블

```sql
CREATE TABLE city (
    city INT PRIMARY KEY,
    name VARCHAR(64),
    nation INT,
    level INT,
    
    -- 자원
    pop INT,     -- 인구
    agri INT,    -- 농업
    comm INT,    -- 상업
    secu INT,    -- 치안
    def INT,     -- 방어
    wall INT,    -- 성벽
    
    -- 상태
    state INT,
    region INT,
    conflict INT
);
```

### Nation 테이블

```sql
CREATE TABLE nation (
    nation INT PRIMARY KEY,
    name VARCHAR(64),
    color VARCHAR(16),
    capital INT,
    
    -- 자원
    gold INT,
    rice INT,
    tech INT,  -- 기술력
    power INT, -- 국력
    
    -- 관리
    gennum INT,  -- 소속 장수 수
    level INT,   -- 국가 레벨
    type VARCHAR(64),  -- 국가 유형 (che_유가 등)
    
    -- JSON
    spy TEXT,
    aux TEXT
);
```

---

## 9. 커맨드 종류 (55개)

### 내정 커맨드
```
che_농지개간 - 농업 개발 (agri++)
che_상업육성 - 상업 개발 (comm++)
che_치안활동 - 치안 유지 (secu++)
che_성벽건설 - 방어 건설 (wall++)
che_기술연구 - 기술 연구 (tech++)
```

### 군사 커맨드
```
che_모병 - 병력 모집 (crew++)
che_훈련 - 병력 훈련 (train++)
che_출병 - 전투 시작
che_이동 - 도시 이동
```

### 능력치 커맨드
```
che_단련 - 능력치 훈련 (stat++)
```

### 외교 커맨드
```
che_외교 - 외교 관계
che_선전포고 - 전쟁 선포
```

---

## 10. Daemon 작동 방식

### j_autoreset.php - 자동 턴 진행

```php
// 매 분 0초에 호출
// 1. 모든 장수의 last_turn 실행
// 2. 자원 자동 생산
// 3. 세금 징수 (매월)
// 4. 전투 진행
// 5. 이벤트 트리거
```

### proc.php - 수동 턴 처리

```php
// 관리자가 수동으로 턴 실행
// locked 체크하여 중복 실행 방지
```

---

## 11. 마이그레이션 매핑

| 레거시 PHP | Express.js | 비고 |
|-----------|-----------|------|
| `ActionItem/*.php` (161개) | `ItemType` 테이블 | ID: che_명마_01_노기 |
| `ActionCrewType/*.php` | `CrewType` 테이블 | |
| `ActionNationType/*.php` | `NationType` 테이블 | |
| `Command/General/*.php` (55개) | `CommandType` 테이블 | |
| `iAction::onCalcStat()` | `GeneralStatCalculator` | TypeScript 서비스 |
| `WarUnit` | `BattleUnit` 모델 | Prisma |
| `process_war()` | `BattleHandler` | Game Daemon |
| `daemon.ts` | `game-loop.ts` | 100ms interval |
| `proc.php` | `CommandProcessor` | Redis Streams |
| `General` 테이블 | `General` 모델 | Prisma |

---

## 12. 핵심 발견사항

### 1. 하드코딩 패턴
- **161개 아이템**: 클래스명에서 스탯 파싱
- **병종 스탯**: 상수 배열로 정의
- **국가 유형**: 13개 클래스로 구현

### 2. 확장성 설계
- **iAction 인터페이스**: 모든 객체가 동일한 메서드로 효과 적용
- **Trigger 시스템**: 전투 중 스킬 발동
- **Constraint 검증**: 커맨드 실행 조건 체크

### 3. 턴 기반 시스템
- **last_turn JSON**: 이전 턴의 커맨드 저장
- **자동 반복**: term 필드로 반복 횟수 지정
- **매 분 실행**: daemon.ts가 매 분 0초에 턴 처리

---

## 13. 다음 단계: 데이터 추출

### 필요한 작업

1. **PHP 파서 작성**
```python
# scripts/extract_items.py
# ActionItem/ 161개 파일 파싱
# → items.json 생성
```

2. **Prisma Seed 데이터**
```typescript
// prisma/seeds/items.json
[
  { "id": "che_명마_01_노기", "name": "노기(+1)", "statType": "leadership", "statValue": 1, "cost": 1000 },
  ...
]
```

3. **병종 데이터 추출**
```typescript
// prisma/seeds/crew-types.json
```

---

**문서 작성 완료**

