# Battle Calculator - 전투 계산 시스템

## 개요

PHP 원본(`sam/hwe/process_war.php`)의 복잡한 전투 로직을 분석하여, 더 간결하고 균형잡힌 전투 시스템으로 재구현했습니다.

## 주요 개선사항

### 1. 단순화된 구조
- **PHP 원본**: 복잡한 상속 구조(WarUnit, WarUnitGeneral, WarUnitCity), 다양한 트리거 시스템
- **새 구현**: 단일 BattleCalculator 클래스로 통합, 명확한 인터페이스

### 2. 균형잡힌 전투 공식
```typescript
전투력 = 기본능력치 × 병력계수 × 사기 × 훈련도 × 기술력 
         × 병종상성 × 지형보너스 × 공성보정 × 특기효과
```

#### 주요 요소:
- **병력 계수**: √(병력/100) - 대군의 이점을 완화
- **능력치**: 병종별 가중치 적용 (통솔/무력/지력)
- **상성 시스템**: 병종간 상성 테이블
- **지형 효과**: 5가지 지형별 보너스/패널티
- **특기**: 8가지 전투 특기 구현

### 3. 전략적 깊이

#### 병종 시스템
| 병종 | 공격력 | 방어력 | 속도 | 주요 능력치 |
|------|--------|--------|------|-------------|
| 보병 | 1.0 | 1.2 | 3 | 무력(50%), 통솔(40%) |
| 기병 | 1.4 | 0.8 | 5 | 통솔(50%), 무력(40%) |
| 궁병 | 1.1 | 0.7 | 4 | 무력(50%), 지력(20%) |
| 귀병 | 1.2 | 1.0 | 3 | 지력(50%), 통솔(30%) |
| 차병 | 1.3 | 1.1 | 2 | 통솔(60%), 무력(30%) |

#### 병종 상성
- **기병** → 보병(1.4배), 궁병(1.5배)
- **보병** → 궁병(1.3배), 차병(1.2배)
- **귀병** → 기병(1.3배)
- **차병** → 성벽(1.5배)

#### 지형 효과
- **평지**: 기병 +30%
- **숲**: 궁병 +30%, 기병 -30%
- **산악**: 궁병 +40%, 기병 -50%
- **수상**: 귀병 +30%
- **요새**: 차병 +50% (공격 시), 수비 +30%

## 사용 방법

### 기본 사용

```typescript
import { simulateBattle, UnitType, TerrainType } from './battle-calculator';

const result = simulateBattle(
  '조조', 5000, [95, 72, 91], UnitType.CAVALRY,  // 공격자
  '원소', 6000, [83, 68, 75], UnitType.FOOTMAN,  // 수비자
  TerrainType.PLAINS                              // 지형
);

console.log(result.winner);              // 'attacker' | 'defender' | 'draw'
console.log(result.attackerCasualties);  // 공격자 손실
console.log(result.defenderCasualties);  // 수비자 손실
console.log(result.battleLog);           // 전투 로그
```

### 상세 설정

```typescript
import { BattleCalculator, BattleContext } from './battle-calculator';

const calculator = new BattleCalculator();

const context: BattleContext = {
  attacker: {
    name: '조조의 정예군',
    troops: 5000,
    leadership: 95,
    strength: 72,
    intelligence: 91,
    unitType: UnitType.CAVALRY,
    morale: 90,           // 사기 (0-100)
    training: 95,         // 훈련도 (0-100)
    techLevel: 70,        // 기술력 (0-100)
    specialSkills: ['돌격', '필살']  // 특기
  },
  defender: {
    name: '업성 수비군',
    troops: 4000,
    leadership: 80,
    strength: 85,
    intelligence: 65,
    unitType: UnitType.FOOTMAN,
    morale: 95,
    training: 90,
    techLevel: 60,
    specialSkills: ['철벽']
  },
  terrain: TerrainType.FORTRESS,
  isDefenderCity: true,   // 공성전 여부
  cityWall: 80            // 성벽 내구도 (0-100)
};

const result = calculator.calculateBattle(context);
```

## 전투 특기

| 특기 | 효과 | 적용 병종 |
|------|------|-----------|
| 돌격 | 공격력 +30% | 기병 |
| 저격 | 공격력 +25% | 궁병 |
| 책략 | 공격력 +35% | 귀병 |
| 공성 | 공격력 +40% | 차병 |
| 철벽 | 방어력 +25% | 전체 |
| 회복 | 방어력 +15% | 전체 |
| 필살 | 공격력 +20%, 치명타율 +15% | 전체 |
| 간파 | 방어력 +20% | 전체 |

## 전투 메커니즘

### 1. 페이즈 시스템
- 최대 10 페이즈
- 각 페이즈마다 양측이 동시 공격
- 한 페이즈당 최대 20% 손실

### 2. 필살/회피 시스템
- **필살 확률**: 기본 10% + (무력+지력)/300 × 10%
- **필살 피해**: 일반 피해의 1.8배
- **회피 확률**: 기본 5% + 무력/150 × 10% + 훈련도/100 × 5%
- **회피 효과**: 피해 80% 감소

### 3. 사기 시스템
- 병력이 30% 이하로 떨어지면 패주 가능
- 사기가 높을수록 패주 확률 감소
- 사기 붕괴 시 즉시 전투 종료

### 4. 승패 판정
- 한쪽 병력이 0이 되면 즉시 승부 결정
- 사기 붕괴로 인한 패배
- 10 페이즈 종료 시 남은 병력으로 판정

## 전투 로그 예시

```
=== 전투 시작 ===
공격: 조조 (5000명, CAVALRY)
수비: 원소 (6000명, FOOTMAN)
지형: PLAINS

[1턴] 조조 -234 ← 원소 -412
[2턴] 조조 -198 ← 원소 -389(치명타!)
[3턴] 원소 회피! 조조 -156 ← 원소 -85
[4턴] 조조 -211 ← 원소 -378
[5턴] 조조 -189 ← 원소 -401
원소의 군대가 사기가 떨어져 퇴각합니다!

=== 전투 종료 ===
승자: 조조
공격자 생존: 4012명 (손실: 988명)
수비자 생존: 4335명 (손실: 1665명)
```

## 전투 시뮬레이션 예제

```bash
# 예제 실행
npm run ts-node src/core/battle-calculator.example.ts
```

다양한 시나리오:
1. 평지 기병 vs 보병
2. 병종 상성 테스트
3. 지형 효과 비교
4. 공성전 시뮬레이션
5. 특기 효과 검증
6. 귀병 계략전
7. 대군 vs 소수정예
8. 연속 전투 (피로도)
9. 병종별 승률 분석

## PHP 원본과의 비교

### PHP 원본의 특징
- 복잡한 트리거 시스템 (40개+ 트리거 클래스)
- 특기별로 개별 클래스 구현
- General 객체와 강하게 결합
- 난수 시드 기반 재현성
- 이벤트 핸들러 통합

### 새 구현의 장점
- ✅ 단순하고 이해하기 쉬운 구조
- ✅ 독립적인 전투 계산 (의존성 최소화)
- ✅ 명확한 전투 공식
- ✅ 쉬운 밸런스 조정
- ✅ 테스트 용이성
- ✅ TypeScript 타입 안정성

### 유지된 핵심 요소
- 병종 시스템 (5종)
- 지형 효과
- 특기 시스템
- 사기/훈련도 메커니즘
- 공성전 시스템

## 밸런스 조정 가이드

### 병종 밸런스
`UNIT_BASE_STATS` 객체에서 조정:
```typescript
[UnitType.CAVALRY]: { 
  attack: 1.4,    // 공격력 계수
  defense: 0.8,   // 방어력 계수
  speed: 5        // 페이즈 수
}
```

### 병종 상성
`UNIT_ADVANTAGE_TABLE`에서 조정:
```typescript
[UnitType.CAVALRY]: {
  [UnitType.FOOTMAN]: 1.4,  // 기병 vs 보병 = 1.4배
  ...
}
```

### 지형 효과
`TERRAIN_BONUS`에서 조정:
```typescript
[TerrainType.PLAINS]: {
  [UnitType.CAVALRY]: 1.3,  // 평지에서 기병 +30%
  ...
}
```

### 특기 효과
`applySpecialSkills` 메서드에서 조정

## 테스트

```bash
# 유닛 테스트 실행
npm test src/core/battle-calculator.test.ts

# 커버리지 확인
npm test -- --coverage
```

테스트 항목:
- 기본 전투 시뮬레이션
- 병종 상성
- 지형 효과
- 공성전
- 특기 효과
- 사기 시스템
- 능력치 영향
- 전투 로그 생성

## 확장 가능성

### 추가 가능한 기능
1. **날씨 시스템**: 비/눈/안개 효과
2. **지휘관 특성**: 공격형/수비형/균형형
3. **부대 편제**: 선봉/중군/후군
4. **진형 시스템**: 학익진/어린진/방원진
5. **보급 시스템**: 식량/탄약 소모
6. **지원 시스템**: 원군/매복/함정
7. **야전/공성전 구분**: 별도 메커니즘
8. **다대다 전투**: 3파전 이상

### 확장 예시

```typescript
interface ExtendedBattleContext extends BattleContext {
  weather?: WeatherType;        // 날씨
  formation?: FormationType;    // 진형
  supplies?: number;            // 보급
  reinforcements?: BattleUnit[]; // 원군
}
```

## 성능

- 단일 전투 계산: ~1ms
- 1000회 시뮬레이션: ~1초
- 메모리 사용: 최소화 (상태 없는 계산)

## 라이선스

이 코드는 원본 PHP 프로젝트의 로직을 참고하여 재구현되었습니다.
