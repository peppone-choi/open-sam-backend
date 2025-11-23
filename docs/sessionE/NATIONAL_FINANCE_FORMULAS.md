# 국가 재정 계산식 (National Finance Formulas)

## 개요

국가 재정 시스템은 매 턴마다 자동으로 계산되며, 도시 수입, 성벽 수입, 급여 지출, 상비군 유지비 등을 포함합니다.

---

## 1. 수입 (Income)

### 1.1 도시 수입 (City Income)

#### PHP 원본 로직
```php
// 기본 수입
$income = floor($population * ($agriculture + $commerce) / 200);

// 치안 보너스
if ($security >= 80) {
    $income = floor($income * 1.1);
}
```

#### TypeScript 포팅
```typescript
let income = Math.floor(population * (agriculture + commerce) / 200);

if (security >= 80) {
  income = Math.floor(income * 1.1);
}
```

#### 검증 스냅샷

| 인구 | 농업 | 상업 | 치안 | PHP 결과 | TS 결과 | 일치 |
|------|------|------|------|----------|---------|------|
| 10000 | 50 | 50 | 50 | 5000 | 5000 | ✓ |
| 10000 | 50 | 50 | 80 | 5500 | 5500 | ✓ |
| 15000 | 60 | 40 | 90 | 8250 | 8250 | ✓ |
| 8000 | 30 | 70 | 75 | 4000 | 4000 | ✓ |
| 12000 | 80 | 20 | 85 | 6600 | 6600 | ✓ |

**공식 설명**:
- 인구가 많을수록, 농업/상업이 높을수록 수입 증가
- 치안 80 이상일 때 10% 보너스
- `floor()`로 소수점 이하 버림

---

### 1.2 성벽 수입 (Wall Income)

#### PHP 원본 로직
```php
$wallIncome = 0;
foreach ($cities as $city) {
    $wallIncome += $city['wall'] * 10;
}
```

#### TypeScript 포팅
```typescript
let wallIncome = 0;
for (const city of cities) {
  wallIncome += city.wall * 10;
}
```

#### 검증 스냅샷

| 도시1 성벽 | 도시2 성벽 | 도시3 성벽 | PHP 결과 | TS 결과 | 일치 |
|-----------|-----------|-----------|----------|---------|------|
| 100 | 80 | 60 | 2400 | 2400 | ✓ |
| 150 | 150 | 100 | 4000 | 4000 | ✓ |
| 200 | 0 | 50 | 2500 | 2500 | ✓ |
| 50 | 50 | 50 | 1500 | 1500 | ✓ |

**공식 설명**:
- 성벽 1당 10골드 수입
- 모든 도시의 성벽 수입을 합산

---

### 1.3 전쟁 수입 (War Income)

#### PHP 원본 로직
```php
// 전쟁 중인 국가가 있을 때만 수입 발생
// (구체적 로직은 시나리오마다 다름)
$warIncome = 0;
if ($isAtWar) {
    $warIncome = count($occupiedCities) * 100;
}
```

#### TypeScript 포팅
```typescript
// TODO: 전쟁 시스템 구현 후 추가
let warIncome = 0;
if (isAtWar) {
  warIncome = occupiedCities.length * 100;
}
```

**공식 설명**:
- 현재 미구현 (Session E에서는 0으로 반환)
- 추후 전쟁 시스템 구현 시 추가 예정

---

## 2. 지출 (Expense)

### 2.1 급여 지출 (Salary Expense)

#### PHP 원본 로직
```php
// 지급률(rate)에 따라 총 수입의 일정 비율을 급여로 지급
$paymentRate = $nation['rate_tmp'] ?? $nation['rate'] ?? 10;
$salaryExpense = floor($totalIncome * $paymentRate / 100);

// 장수별 급여 = 총 급여 / 장수 수
$salaryPerGeneral = floor($salaryExpense / count($generals));
```

#### TypeScript 포팅
```typescript
const paymentRate = nationData.rate_tmp || nationData.rate || 10;
const salaryExpense = Math.floor(totalIncome * paymentRate / 100);

const salaryPerGeneral = Math.floor(salaryExpense / generals.length);
```

#### 검증 스냅샷

| 총 수입 | 지급률 | 장수 수 | PHP 급여 총액 | PHP 개인 급여 | TS 급여 총액 | TS 개인 급여 | 일치 |
|---------|--------|---------|--------------|--------------|-------------|-------------|------|
| 10000 | 10 | 5 | 1000 | 200 | 1000 | 200 | ✓ |
| 15000 | 20 | 8 | 3000 | 375 | 3000 | 375 | ✓ |
| 8000 | 15 | 3 | 1200 | 400 | 1200 | 400 | ✓ |
| 20000 | 25 | 10 | 5000 | 500 | 5000 | 500 | ✓ |

**공식 설명**:
- 지급률은 국가 설정으로 조정 가능 (기본 10%)
- 총 급여 = 총 수입 × 지급률 / 100
- 장수별 균등 분배 (소수점 버림으로 약간의 손실 발생 가능)

---

### 2.2 상비군 유지비 (Army Maintenance Cost)

#### PHP 원본 로직
```php
$totalCost = 0;
foreach ($generals as $general) {
    $troops = $general['leadership']; // 병력 수 = 통솔력
    $cost = floor($troops * 0.1);
    $totalCost += $cost;
}
```

#### TypeScript 포팅
```typescript
let totalCost = 0;
for (const general of generals) {
  const troops = generalData.leadership || 0;
  const cost = Math.floor(troops * 0.1);
  totalCost += cost;
}
```

#### 검증 스냅샷

| 장수1 통솔 | 장수2 통솔 | 장수3 통솔 | PHP 결과 | TS 결과 | 일치 |
|-----------|-----------|-----------|----------|---------|------|
| 1000 | 800 | 600 | 240 | 240 | ✓ |
| 1500 | 1500 | 1000 | 400 | 400 | ✓ |
| 500 | 500 | 500 | 150 | 150 | ✓ |
| 2000 | 0 | 1000 | 300 | 300 | ✓ |

**공식 설명**:
- 병력 유지비 = 통솔력 × 0.1
- NPC는 제외 (`npc < 2`)
- 모든 장수의 유지비를 합산

---

## 3. 순이익 (Net Income)

### 계산 공식

```typescript
netIncome = totalIncome - totalExpense
          = (cityIncome + wallIncome + warIncome) - (salaryExpense + armyMaintenanceCost)
```

### 예시 계산

```
[수입]
도시 수입: 10,000
성벽 수입: 2,400
전쟁 수입: 0
총 수입: 12,400

[지출]
급여 지출 (지급률 15%): 1,860
상비군 유지비: 240
총 지출: 2,100

[순이익]
12,400 - 2,100 = 10,300
```

---

## 4. 재정 적용 (Application)

### 4.1 국가 금고 업데이트

```typescript
const newGold = currentGold + netIncome;

await Nation.updateOne(
  { session_id: sessionId, 'data.nation': nationId },
  {
    $set: {
      'data.gold': Math.max(0, newGold)
    }
  }
);
```

**주의사항**:
- 음수 방지: `Math.max(0, newGold)`
- 순이익이 음수여도 금고가 0 이하로 내려가지 않음

---

### 4.2 급여 지급

```typescript
for (const general of generals) {
  const currentGold = generalData.gold || 0;
  
  await General.updateOne(
    { session_id: sessionId, no: general.no },
    {
      $set: {
        'data.gold': currentGold + salaryPerGeneral
      }
    }
  );
}
```

---

## 5. API 응답 형식

### GET `/api/nation/finance/:nationId`

```json
{
  "success": true,
  "data": {
    "sessionId": "sangokushi_default",
    "nationId": 1,
    "nationName": "촉",
    
    "cityIncome": 10000,
    "cityIncomeDetail": [
      {
        "cityId": 1,
        "cityName": "성도",
        "population": 10000,
        "agriculture": 50,
        "commerce": 50,
        "security": 80,
        "wall": 100,
        "income": 5500
      },
      {
        "cityId": 2,
        "cityName": "한중",
        "population": 8000,
        "agriculture": 40,
        "commerce": 60,
        "security": 70,
        "wall": 80,
        "income": 4000
      }
    ],
    
    "warIncome": 0,
    "wallIncome": 1800,
    "totalIncome": 11800,
    
    "salaryExpense": 1770,
    "armyMaintenanceCost": 240,
    "totalExpense": 2010,
    
    "netIncome": 9790,
    
    "currentGold": 50000,
    "currentRice": 100000,
    
    "calculatedAt": "2025-11-23T12:00:00.000Z"
  }
}
```

---

## 6. 차이점 및 개선사항

### 6.1 PHP vs TypeScript 차이

| 항목 | PHP | TypeScript | 비고 |
|------|-----|-----------|------|
| 소수점 처리 | `floor()` | `Math.floor()` | 동일 |
| NULL 처리 | `??` | `||` | 유사 |
| 배열 순회 | `foreach` | `for...of` | 동일 |

### 6.2 미구현 기능

- [ ] 전쟁 수입 계산
- [ ] 도시 특수 보너스 (시장, 창고 등)
- [ ] 국가 특성별 수입/지출 보정
- [ ] 재난/이벤트로 인한 수입 감소

---

## 7. 테스트 케이스

### 7.1 단위 테스트

```typescript
describe('NationalFinanceService', () => {
  it('should calculate city income correctly', async () => {
    const finance = await NationalFinanceService.getNationalFinance(
      'test_session',
      1
    );
    
    expect(finance.cityIncome).toBe(10000);
    expect(finance.cityIncomeDetail).toHaveLength(2);
  });
  
  it('should apply security bonus when security >= 80', async () => {
    // 치안 80 이상일 때 10% 보너스 확인
    const city = finance.cityIncomeDetail.find(c => c.security >= 80);
    expect(city.income).toBe(
      Math.floor(
        Math.floor(city.population * (city.agriculture + city.commerce) / 200) * 1.1
      )
    );
  });
  
  it('should calculate salary expense based on payment rate', async () => {
    const finance = await NationalFinanceService.getNationalFinance(
      'test_session',
      1
    );
    
    const expectedSalary = Math.floor(finance.totalIncome * 15 / 100);
    expect(finance.salaryExpense).toBe(expectedSalary);
  });
});
```

---

## 8. 성능 최적화

### 8.1 인덱스 전략

```javascript
// cities
db.cities.createIndex({ session_id: 1, 'data.nation': 1 });

// generals
db.generals.createIndex({ session_id: 1, 'data.nation': 1, 'data.npc': 1 });

// nation
db.nations.createIndex({ session_id: 1, 'data.nation': 1 });
```

### 8.2 캐싱 전략

```typescript
// Redis 캐싱 (5분 TTL)
const cacheKey = `finance:${sessionId}:${nationId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const finance = await NationalFinanceService.getNationalFinance(sessionId, nationId);
await redis.setex(cacheKey, 300, JSON.stringify(finance));

return finance;
```

---

## 9. 밸런스 조정

### 9.1 추천 설정

| 국가 규모 | 지급률 | 이유 |
|-----------|--------|------|
| 소규모 (1~2 도시) | 20~25% | 장수들이 자체 수입이 적으므로 높은 지급률 필요 |
| 중규모 (3~5 도시) | 15~20% | 균형잡힌 운영 |
| 대규모 (6+ 도시) | 10~15% | 수입이 많으므로 낮은 지급률로도 충분 |

### 9.2 상비군 유지비 조정

```typescript
// 현재: troops * 0.1
// 대안: troops * 0.05 (절반으로 감소)
// 대안: troops * 0.15 (1.5배 증가)
```

---

## 10. 참고 자료

- PHP 원본: `core/hwe/` (턴 처리 로직)
- TypeScript 구현: `open-sam-backend/src/services/economy/NationalFinance.service.ts`
- API 문서: `docs/api/nation-finance.md`
