# 미구현 기능 구현 계획서

## 📋 미구현 기능 목록

GIN7 매뉴얼에서 명시된 미구현 기능:
1. ❌ **경제 관련** (세금, 무역, 예산)
2. ❌ **AI 기능** (오프라인 플레이어 대행)
3. ❌ **서훈** (훈장 시스템)
4. ❌ **전투정** (전투정/뇌격정 상세 메커니즘)
5. ❌ **공격에 의한 물자 감소** (전투 중 보급품 소비)
6. ❌ **전사 시스템** (캐릭터 사망 처리)
7. ❌ **페잔 점령** (중립국 침공)

---

## 🎯 구현 우선순위

### Phase 1: 핵심 게임플레이 (즉시 구현)
1. **전사 시스템** ⭐⭐⭐⭐⭐
2. **공격에 의한 물자 감소** ⭐⭐⭐⭐⭐
3. **전투정 메커니즘** ⭐⭐⭐⭐

### Phase 2: 전략 게임플레이 (중기 구현)
4. **경제 시스템** ⭐⭐⭐⭐
5. **서훈 시스템** ⭐⭐⭐

### Phase 3: 고급 기능 (장기 구현)
6. **AI 기능** ⭐⭐⭐
7. **페잔 점령** ⭐⭐

---

## 1️⃣ 전사 시스템 (Death System)

### 📖 원작 설명
매뉴얼: "플레이어가 캐릭터 전사 여부를 선택 가능. 기본값은 부상 → 본거지 귀환"

### 🎮 구현 방안

#### A. 데이터 모델
```typescript
interface CharacterDeathSettings {
  characterId: string;
  deathEnabled: boolean;  // 전사 허용 여부
  injuryThreshold: number;  // 부상 확률 (0-100)
  deathThreshold: number;   // 전사 확률 (0-100)
  returnPlanet: string;     // 귀환 행성
}

interface CombatCasualty {
  characterId: string;
  eventType: 'injury' | 'death';
  flagshipDestroyed: boolean;
  timestamp: Date;
  combatId: string;
}
```

#### B. 전사/부상 판정 로직
```typescript
// 기함 격파 시 판정
function checkCasualty(character: Character, combat: Combat): CombatCasualty {
  if (!character.deathSettings.deathEnabled) {
    // 전사 비활성화 → 무조건 부상
    return {
      eventType: 'injury',
      returnPlanet: character.faction.homeworld
    };
  }
  
  // 확률 판정
  const roll = Math.random() * 100;
  
  if (roll < character.deathSettings.deathThreshold) {
    // 전사
    return { eventType: 'death' };
  } else if (roll < character.deathSettings.injuryThreshold) {
    // 부상
    return { 
      eventType: 'injury',
      recoveryDays: calculateRecoveryTime(combat.intensity)
    };
  } else {
    // 무사 탈출
    return { eventType: 'escape' };
  }
}
```

#### C. 부상 회복 시스템
```typescript
interface Injury {
  characterId: string;
  severity: 'light' | 'medium' | 'heavy';
  recoveryDays: number;  // 게임 내 일수
  abilityPenalty: {
    command: -5,    // 회복 중 능력치 페널티
    mobility: -10
  };
  hospitalPlanet: string;
}
```

#### D. 구현 단계
1. ✅ Character 모델에 `deathSettings` 추가
2. ✅ 전술 전투 엔진에 전사/부상 판정 추가
3. ✅ 부상 회복 시스템 (병원 행성, 회복 기간)
4. ✅ UI: 설정 화면 (전사 허용/거부 토글)
5. ✅ 이벤트 로그 (전사/부상 알림)

---

## 2️⃣ 공격에 의한 물자 감소 (Supply Consumption)

### 📖 원작 설명
매뉴얼: "공격 시 물자(군수물자) 소비" - 미사일, 건 병장 등

### 🎮 구현 방안

#### A. 데이터 모델
```typescript
interface SupplyConsumption {
  unitId: string;
  weaponType: 'beam' | 'gun' | 'missile' | 'antiAir';
  consumptionPerShot: number;  // 1회 발사당 소비량
  currentSupply: number;       // 현재 보유량
  maxSupply: number;           // 최대 적재량
}

interface CombatSupplyLog {
  combatId: string;
  timestamp: Date;
  unitId: string;
  weaponsFired: {
    beamShots: number;
    gunShots: number;
    missilesLaunched: number;
  };
  totalConsumption: number;
  remainingSupply: number;
}
```

#### B. 무장별 소비율 (매뉴얼 기준)
```typescript
const WEAPON_CONSUMPTION = {
  beam: 0,        // 빔 병장: 소비 없음 (에너지만)
  gun: 1,         // 건 병장: 1발당 1 물자
  missile: 5,     // 미사일: 1발당 5 물자
  antiAir: 5,     // 대공: 1발당 5 물자
  fighter: 0      // 전투정: 별도 관리
};
```

#### C. 전투 중 물자 소비 로직
```typescript
function processCombatTurn(unit: ShipUnit, actions: CombatAction[]) {
  for (const action of actions) {
    const consumption = calculateConsumption(action);
    
    if (unit.supply.current < consumption) {
      // 물자 부족 → 공격 불가
      return { 
        success: false, 
        reason: '물자 부족',
        notification: `${unit.name}: 군수물자 부족으로 공격 불가!`
      };
    }
    
    // 물자 소비
    unit.supply.current -= consumption;
    
    // 공격 실행
    executeAttack(unit, action);
    
    // 경고 알림 (물자 20% 이하)
    if (unit.supply.current < unit.supply.max * 0.2) {
      notifyLowSupply(unit);
    }
  }
}
```

#### D. 보급 시스템 연동
```typescript
// 완전보급 커맨드
async function fullSupply(unitId: string, sourcePlanetId: string) {
  const unit = await getUnit(unitId);
  const planet = await getPlanet(sourcePlanetId);
  
  const needed = unit.supply.max - unit.supply.current;
  
  if (planet.storage.supplies < needed) {
    throw new Error('행성 창고 물자 부족');
  }
  
  // 물자 이동
  planet.storage.supplies -= needed;
  unit.supply.current = unit.supply.max;
  
  // 로그 기록
  await createSupplyLog({
    unitId,
    planetId: sourcePlanetId,
    amount: needed,
    timestamp: new Date()
  });
}
```

#### E. 구현 단계
1. ✅ ShipUnit 모델에 `supply` 필드 추가
2. ✅ 전투 엔진에 무장별 소비 로직 추가
3. ✅ 물자 부족 시 공격 차단
4. ✅ 보급 커맨드 (`완전보급`) 연동
5. ✅ UI: 전투 중 물자 게이지 표시
6. ✅ UI: 물자 부족 경고 알림

---

## 3️⃣ 전투정 메커니즘 (Fighter/Torpedo Mechanics)

### 📖 원작 설명
매뉴얼: "전투정(ワルキューレ), 뇌격정 운용" - 현재 탑재 수만 명시, 상세 메커니즘 미구현

### 🎮 구현 방안

#### A. 데이터 모델
```typescript
interface Fighter {
  type: 'combat' | 'torpedo';  // 전투정 or 뇌격정
  squadronSize: number;        // 편대 크기 (대)
  launchTime: number;          // 발진 시간 (초)
  speed: number;               // 속도 (km/1G초)
  range: number;               // 작전 반경 (만km)
  attackPower: number;         // 공격력
  defensePower: number;        // 방어력
  currentCount: number;        // 현재 탑재 수
  maxCount: number;            // 최대 탑재 수
}

interface FighterSquadron {
  squadronId: string;
  mothership: string;          // 모함 ID
  type: 'combat' | 'torpedo';
  position: {x: number, y: number};
  target: string | null;
  status: 'docked' | 'launching' | 'combat' | 'returning';
  casualties: number;
}
```

#### B. 전투정 발진 로직
```typescript
async function launchFighters(unit: ShipUnit, squadronCount: number) {
  if (unit.fighters.currentCount < squadronCount) {
    throw new Error('탑재 전투정 부족');
  }
  
  // 발진 준비 시간 (20초 * 편대 수)
  const launchTime = 20 * squadronCount;
  
  // 발진 애니메이션
  await animateLaunch(unit, squadronCount, launchTime);
  
  // 전투정 편대 생성
  const squadrons = createSquadrons({
    count: squadronCount,
    type: unit.fighters.type,
    mothership: unit.id,
    position: unit.position
  });
  
  // 모함 탑재 수 감소
  unit.fighters.currentCount -= squadronCount;
  
  return squadrons;
}
```

#### C. 전투정 공격 메커니즘
```typescript
// 전투정 vs 함선
function fighterAttackShip(squadron: FighterSquadron, target: ShipUnit) {
  // 대공포 방어
  const aaFire = target.weapons.antiAir.power;
  const casualties = calculateFighterCasualties(squadron, aaFire);
  
  squadron.currentCount -= casualties;
  
  if (squadron.currentCount <= 0) {
    return { result: 'destroyed', damage: 0 };
  }
  
  // 공격 성공
  const damage = squadron.attackPower * squadron.currentCount;
  applyDamage(target, damage, 'fighter');
  
  return { 
    result: 'success', 
    damage, 
    casualties 
  };
}

// 전투정 vs 전투정 (공중전)
function fighterDogfight(attacker: FighterSquadron, defender: FighterSquadron) {
  const attackerLosses = Math.floor(defender.attackPower * 0.3);
  const defenderLosses = Math.floor(attacker.attackPower * 0.3);
  
  attacker.currentCount -= attackerLosses;
  defender.currentCount -= defenderLosses;
  
  return { attackerLosses, defenderLosses };
}
```

#### D. 전투정 귀환 시스템
```typescript
async function recallFighters(squadrons: FighterSquadron[]) {
  for (const squadron of squadrons) {
    const mothership = await getUnit(squadron.mothership);
    
    // 거리 체크
    const distance = calculateDistance(squadron.position, mothership.position);
    
    if (distance > squadron.range) {
      // 작전 반경 초과 → 손실
      squadron.status = 'lost';
      continue;
    }
    
    // 귀환
    squadron.status = 'returning';
    await animateReturn(squadron, mothership);
    
    // 모함 탑재 수 복구
    mothership.fighters.currentCount += squadron.currentCount;
  }
}
```

#### E. 뇌격정 특수 메커니즘
```typescript
interface TorpedoAttack {
  squadronId: string;
  targetId: string;
  torpedoType: 'seismic' | 'photon';  // 지진뇌, 광자어뢰
  salvos: number;  // 일제 사격 횟수
}

function torpedoAttack(squadron: FighterSquadron, target: ShipUnit) {
  // 뇌격정은 1회 공격 후 재장전 필요
  if (squadron.torpedoReady === false) {
    return { result: 'reloading' };
  }
  
  const baseDamage = squadron.attackPower * squadron.currentCount;
  const armorPenetration = 1.5;  // 뇌격정은 장갑 관통력 높음
  
  const damage = baseDamage * armorPenetration;
  applyDamage(target, damage, 'torpedo');
  
  squadron.torpedoReady = false;  // 재장전 필요
  
  return { result: 'success', damage };
}
```

#### F. 구현 단계
1. ✅ Fighter/Squadron 모델 설계
2. ✅ 발진/귀환 메커니즘
3. ✅ 전투정 vs 함선 전투
4. ✅ 전투정 vs 전투정 (공중전)
5. ✅ 뇌격정 특수 공격
6. ✅ 작전 반경/손실 처리
7. ✅ UI: 전투정 발진/귀환 명령
8. ✅ UI: 전투정 상태 표시 (탑재/출격/손실)
9. ✅ 애니메이션: 발진/공격/귀환

---

## 4️⃣ 경제 시스템 (Economic System)

### 📖 원작 설명
매뉴얼: "각 행성에서 세금 징수, 국가 예산, 무역" - 전체 미구현

### 🎮 구현 방안

#### A. 데이터 모델
```typescript
interface PlanetEconomy {
  planetId: string;
  population: number;           // 인구
  gdp: number;                  // 경제 규모
  taxRate: number;              // 세율 (0-100%)
  taxRevenue: number;           // 세수
  governmentSupportRate: number; // 정부 지지율 (0-100)
  economicGrowthRate: number;   // 경제 성장률
  productionCapacity: {
    shipyard: number;           // 조선소 생산력
    personnel: number;          // 인원 동원 능력
  };
}

interface NationalBudget {
  factionId: string;
  turn: number;
  revenue: {
    taxes: number;              // 세금 수입
    trade: number;              // 무역 수입
    fezzan: number;             // 페잔 수수료
  };
  expenditure: {
    military: number;           // 군사비
    production: number;         // 생산비
    welfare: number;            // 복지비 (지지율 상승)
    subsidies: number;          // 행성 보조금
  };
  treasury: number;             // 국고
}

interface TradeRoute {
  fromPlanet: string;
  toPlanet: string;
  goodsType: 'food' | 'minerals' | 'technology';
  volume: number;
  tariffRate: number;           // 관세율
  profit: number;
}
```

#### B. 세금 징수 로직
```typescript
function calculateTaxRevenue(planet: PlanetEconomy, commander: Character) {
  // 기본 세수 = 인구 × GDP × 세율
  let baseTax = planet.population * planet.gdp * planet.taxRate;
  
  // 통솔 능력 보너스 (매뉴얼 명시)
  const commandBonus = 1 + (commander.abilities.command / 100);
  baseTax *= commandBonus;
  
  // 지지율 보정
  const supportModifier = planet.governmentSupportRate / 100;
  baseTax *= supportModifier;
  
  // 세율이 높으면 지지율 하락
  if (planet.taxRate > 50) {
    planet.governmentSupportRate -= (planet.taxRate - 50) * 0.5;
  }
  
  return Math.floor(baseTax);
}

async function collectTaxes(factionId: string, turnNumber: number) {
  const planets = await getPlanetsByFaction(factionId);
  const budget = await getNationalBudget(factionId);
  
  let totalRevenue = 0;
  
  for (const planet of planets) {
    const governor = await getGovernor(planet.id);
    const revenue = calculateTaxRevenue(planet, governor);
    
    totalRevenue += revenue;
    
    // 로그 기록
    await createTaxLog({
      planetId: planet.id,
      turn: turnNumber,
      revenue,
      taxRate: planet.taxRate,
      supportRate: planet.governmentSupportRate
    });
  }
  
  budget.revenue.taxes = totalRevenue;
  budget.treasury += totalRevenue;
  
  await saveBudget(budget);
}
```

#### C. 예산 배분 로직
```typescript
async function allocateBudget(factionId: string, allocation: BudgetAllocation) {
  const budget = await getNationalBudget(factionId);
  
  const totalExpenditure = 
    allocation.military + 
    allocation.production + 
    allocation.welfare + 
    allocation.subsidies;
  
  if (totalExpenditure > budget.treasury) {
    throw new Error('예산 부족');
  }
  
  // 지출 처리
  budget.expenditure = allocation;
  budget.treasury -= totalExpenditure;
  
  // 효과 적용
  if (allocation.welfare > 0) {
    // 복지비 → 전체 지지율 상승
    await increaseFactionSupport(factionId, allocation.welfare * 0.001);
  }
  
  if (allocation.subsidies > 0) {
    // 행성 보조금 → 특정 행성 지원
    await distributeSubsidies(factionId, allocation.subsidies);
  }
  
  await saveBudget(budget);
}
```

#### D. 무역 시스템
```typescript
async function establishTradeRoute(route: TradeRoute) {
  const fromPlanet = await getPlanet(route.fromPlanet);
  const toPlanet = await getPlanet(route.toPlanet);
  
  // 무역 가능 체크
  if (!canTrade(fromPlanet, toPlanet)) {
    throw new Error('무역 불가 (전쟁 중 또는 봉쇄)');
  }
  
  // 무역 이익 계산
  const baseProfit = route.volume * getGoodsPrice(route.goodsType);
  const tariff = baseProfit * route.tariffRate;
  const netProfit = baseProfit - tariff;
  
  // 관세 수입
  const budget = await getNationalBudget(toPlanet.factionId);
  budget.revenue.trade += tariff;
  
  // 경제 성장
  fromPlanet.gdp += netProfit * 0.1;
  toPlanet.gdp += netProfit * 0.1;
  
  await saveTradeRoute(route);
}
```

#### E. 경제 턴 처리
```typescript
async function processEconomicTurn(turnNumber: number) {
  const factions = await getAllFactions();
  
  for (const faction of factions) {
    // 1. 세금 징수
    await collectTaxes(faction.id, turnNumber);
    
    // 2. 무역 수입
    await processTradeRoutes(faction.id, turnNumber);
    
    // 3. 군사비 지출
    await payMilitaryCosts(faction.id, turnNumber);
    
    // 4. 경제 성장
    await applyEconomicGrowth(faction.id);
    
    // 5. 예산 보고서
    await generateBudgetReport(faction.id, turnNumber);
  }
}

async function payMilitaryCosts(factionId: string, turnNumber: number) {
  const budget = await getNationalBudget(factionId);
  const fleets = await getFleetsByFaction(factionId);
  
  let totalCost = 0;
  
  for (const fleet of fleets) {
    // 함대 유지비 = 함선 수 × 1000
    const maintenanceCost = fleet.shipCount * 1000;
    totalCost += maintenanceCost;
  }
  
  if (budget.treasury < totalCost) {
    // 예산 부족 → 사기 저하
    await penalizeFleetMorale(factionId, '예산 부족');
  } else {
    budget.expenditure.military += totalCost;
    budget.treasury -= totalCost;
  }
  
  await saveBudget(budget);
}
```

#### F. 구현 단계
1. ✅ PlanetEconomy, NationalBudget 모델
2. ✅ 세금 징수 시스템
3. ✅ 예산 배분 시스템
4. ✅ 무역 시스템
5. ✅ 경제 성장 메커니즘
6. ✅ 군사비 지불
7. ✅ UI: 예산 화면 (수입/지출/국고)
8. ✅ UI: 세율 조정 커맨드
9. ✅ UI: 무역로 관리
10. ✅ 보고서: 매 턴 경제 보고서

---

## 5️⃣ 서훈 시스템 (Decoration System)

### 📖 원작 설명
매뉴얼: "叙勲 커맨드 존재, 계급 등 조건 충족 시 훈장 수여" - 상세 미구현

### 🎮 구현 방안

#### A. 데이터 모델
```typescript
interface Decoration {
  decorationId: string;
  name: string;               // "금성훈장", "은성훈장" 등
  nameJa: string;
  grade: 1 | 2 | 3 | 4 | 5;  // 등급
  requirements: {
    minRank: string;          // 최소 계급
    minMerit: number;         // 최소 공적
    minBattles: number;       // 최소 전투 참가 횟수
    specialConditions?: string[];
  };
  effects: {
    influenceBonus: number;   // 영향력 보너스
    rankLadderBonus: number;  // 계급 래더 보너스
    prestigeBonus: number;    // 명성 보너스
  };
  factionSpecific: boolean;   // 진영 전용 여부
}

interface CharacterDecoration {
  characterId: string;
  decorationId: string;
  awardedDate: Date;
  awardedBy: string;          // 수여자 ID
  ceremony: boolean;          // 서훈식 개최 여부
}
```

#### B. 훈장 목록 (은하영웅전설 원작 기반)
```typescript
const EMPIRE_DECORATIONS: Decoration[] = [
  {
    decorationId: 'emp_golden_lion',
    name: '황금사자훈장',
    nameJa: '金獅子勲章',
    grade: 1,
    requirements: {
      minRank: '원수',
      minMerit: 10000,
      minBattles: 50,
      specialConditions: ['결정적 승리 달성']
    },
    effects: {
      influenceBonus: 100,
      rankLadderBonus: 3,
      prestigeBonus: 500
    }
  },
  {
    decorationId: 'emp_imperial_cross',
    name: '제국십자훈장',
    nameJa: '帝国十字勲章',
    grade: 2,
    requirements: {
      minRank: '상급대장',
      minMerit: 5000,
      minBattles: 30
    },
    effects: {
      influenceBonus: 50,
      rankLadderBonus: 2,
      prestigeBonus: 300
    }
  },
  // ... 더 많은 훈장
];

const ALLIANCE_DECORATIONS: Decoration[] = [
  {
    decorationId: 'all_star_cross',
    name: '성십자훈장',
    nameJa: '星十字勲章',
    grade: 1,
    requirements: {
      minRank: '원수',
      minMerit: 10000,
      minBattles: 50
    },
    effects: {
      influenceBonus: 100,
      rankLadderBonus: 3,
      prestigeBonus: 500
    }
  },
  // ... 더 많은 훈장
];
```

#### C. 서훈 자격 체크
```typescript
function checkDecorationEligibility(
  character: Character, 
  decoration: Decoration
): { eligible: boolean; reasons: string[] } {
  
  const reasons: string[] = [];
  
  // 계급 체크
  if (character.rank < decoration.requirements.minRank) {
    reasons.push(`계급 부족 (필요: ${decoration.requirements.minRank})`);
  }
  
  // 공적 체크
  if (character.merit < decoration.requirements.minMerit) {
    reasons.push(`공적 부족 (필요: ${decoration.requirements.minMerit})`);
  }
  
  // 전투 참가 횟수
  const battleCount = await getBattleCount(character.id);
  if (battleCount < decoration.requirements.minBattles) {
    reasons.push(`전투 횟수 부족 (필요: ${decoration.requirements.minBattles})`);
  }
  
  // 특수 조건
  if (decoration.requirements.specialConditions) {
    for (const condition of decoration.requirements.specialConditions) {
      if (!await checkSpecialCondition(character, condition)) {
        reasons.push(`특수 조건 미충족: ${condition}`);
      }
    }
  }
  
  // 중복 수여 방지
  const alreadyAwarded = await hasDecoration(character.id, decoration.id);
  if (alreadyAwarded) {
    reasons.push('이미 수여받음');
  }
  
  return {
    eligible: reasons.length === 0,
    reasons
  };
}
```

#### D. 서훈 실행
```typescript
async function awardDecoration(
  characterId: string, 
  decorationId: string, 
  awarderId: string,
  holdCeremony: boolean = false
) {
  
  const character = await getCharacter(characterId);
  const decoration = await getDecoration(decorationId);
  const awarder = await getCharacter(awarderId);
  
  // 자격 체크
  const eligibility = await checkDecorationEligibility(character, decoration);
  if (!eligibility.eligible) {
    throw new Error(`서훈 불가: ${eligibility.reasons.join(', ')}`);
  }
  
  // 권한 체크 (인사권자만 가능)
  if (!hasPersonnelAuthority(awarder)) {
    throw new Error('인사 권한 없음');
  }
  
  // 훈장 수여
  await createCharacterDecoration({
    characterId,
    decorationId,
    awardedDate: new Date(),
    awardedBy: awarderId,
    ceremony: holdCeremony
  });
  
  // 효과 적용
  character.influence += decoration.effects.influenceBonus;
  character.prestige += decoration.effects.prestigeBonus;
  await updateCharacter(character);
  
  // 서훈식 개최 시 추가 효과
  if (holdCeremony) {
    await broadcastCeremony(character, decoration);
    character.influence += 20;  // 서훈식 보너스
  }
  
  // 알림
  await notify(characterId, {
    type: 'decoration_awarded',
    title: '서훈',
    message: `${decoration.name}을(를) 수여받았습니다!`,
    awarder: awarder.name
  });
  
  // 로그
  await createDecorationLog({
    characterId,
    decorationId,
    awarderId,
    timestamp: new Date()
  });
}
```

#### E. 구현 단계
1. ✅ Decoration 모델 및 데이터베이스
2. ✅ 제국/동맹 훈장 목록 정의
3. ✅ 서훈 자격 체크 로직
4. ✅ 서훈 실행 로직
5. ✅ 서훈식 이벤트
6. ✅ UI: 서훈 커맨드
7. ✅ UI: 캐릭터 훈장 표시
8. ✅ UI: 서훈 후보자 목록

---

## 6️⃣ AI 기능 (AI System)

### 📖 원작 설명
매뉴얼: "오프라인 플레이어의 캐릭터를 AI가 대행" - 현재 미구현

### 🎮 구현 방안

#### A. AI 난이도 레벨
```typescript
enum AILevel {
  PASSIVE = 'passive',      // 소극적: 방어만
  CAUTIOUS = 'cautious',    // 신중: 안전한 행동만
  BALANCED = 'balanced',    // 균형: 상황 판단
  AGGRESSIVE = 'aggressive', // 공격적: 적극 교전
  EXPERT = 'expert'         // 전문가: 최적 판단
}

interface AISettings {
  characterId: string;
  enabled: boolean;
  level: AILevel;
  behavior: {
    autoRepair: boolean;     // 자동 수리
    autoSupply: boolean;     // 자동 보급
    autoRetreat: boolean;    // 위험 시 자동 후퇴
    retreatThreshold: number; // 후퇴 기함 HP % (0-100)
  };
}
```

#### B. AI 의사결정 트리
```typescript
class AICommander {
  async makeDecision(character: Character, situation: Situation): Promise<Action> {
    
    // 1. 위험 평가
    const danger = this.assessDanger(situation);
    
    if (danger > character.aiSettings.behavior.retreatThreshold) {
      return { type: 'retreat', priority: 'high' };
    }
    
    // 2. 자원 관리
    const needsSupply = this.checkSupplyNeeds(character);
    if (needsSupply && character.aiSettings.behavior.autoSupply) {
      return { type: 'supply', priority: 'medium' };
    }
    
    const needsRepair = this.checkRepairNeeds(character);
    if (needsRepair && character.aiSettings.behavior.autoRepair) {
      return { type: 'repair', priority: 'medium' };
    }
    
    // 3. 작전 수행
    const activeOperation = await getActiveOperation(character);
    if (activeOperation) {
      return this.executeOperation(activeOperation);
    }
    
    // 4. 전술 판단 (AI 레벨에 따라)
    switch (character.aiSettings.level) {
      case AILevel.PASSIVE:
        return { type: 'defend', target: character.currentPlanet };
        
      case AILevel.CAUTIOUS:
        return this.cautiousStrategy(character, situation);
        
      case AILevel.BALANCED:
        return this.balancedStrategy(character, situation);
        
      case AILevel.AGGRESSIVE:
        return this.aggressiveStrategy(character, situation);
        
      case AILevel.EXPERT:
        return this.expertStrategy(character, situation);
    }
  }
  
  private aggressiveStrategy(character: Character, situation: Situation): Action {
    // 적 탐지
    const enemies = situation.nearbyEnemies;
    
    if (enemies.length > 0) {
      // 전력 비교
      const powerRatio = character.fleet.power / enemies[0].fleet.power;
      
      if (powerRatio > 0.7) {  // 70% 이상이면 공격
        return { 
          type: 'attack', 
          target: enemies[0],
          priority: 'high' 
        };
      }
    }
    
    // 적이 없으면 전진
    return { type: 'advance', direction: 'enemy_territory' };
  }
  
  private expertStrategy(character: Character, situation: Situation): Action {
    // 복잡한 의사결정 (미래 예측, 자원 최적화 등)
    const bestAction = await this.calculateOptimalAction(character, situation);
    return bestAction;
  }
}
```

#### C. 전술 전투 AI
```typescript
class TacticalAI {
  async commandFleet(fleet: Fleet, battle: TacticalBattle): Promise<TacticalCommand[]> {
    const commands: TacticalCommand[] = [];
    
    // 적 분석
    const enemyFleet = battle.getEnemyFleet(fleet.factionId);
    const powerRatio = fleet.totalPower / enemyFleet.totalPower;
    
    // 대형 선택
    if (powerRatio > 1.5) {
      // 압도적 우위 → 공격 대형
      commands.push({ type: 'formation', formation: 'assault' });
    } else if (powerRatio < 0.7) {
      // 열세 → 방어 대형
      commands.push({ type: 'formation', formation: 'defensive' });
    }
    
    // 유닛별 명령
    for (const unit of fleet.units) {
      const nearestEnemy = this.findNearestEnemy(unit, enemyFleet);
      
      if (nearestEnemy) {
        const distance = calculateDistance(unit.position, nearestEnemy.position);
        
        if (distance > unit.weapons.maxRange) {
          // 사정거리 밖 → 접근
          commands.push({
            type: 'move',
            unitId: unit.id,
            target: nearestEnemy.position
          });
        } else {
          // 사정거리 내 → 공격
          commands.push({
            type: 'attack',
            unitId: unit.id,
            targetId: nearestEnemy.id
          });
        }
      }
    }
    
    return commands;
  }
}
```

#### D. 구현 단계
1. ✅ AI Settings 모델
2. ✅ AI 의사결정 엔진 (전략)
3. ✅ AI 전술 엔진 (전투)
4. ✅ AI 레벨별 행동 패턴
5. ✅ 자동 자원 관리 (수리/보급)
6. ✅ 자동 후퇴 시스템
7. ✅ UI: AI 설정 화면
8. ✅ 테스트: AI vs AI 시뮬레이션

---

## 7️⃣ 페잔 점령 (Fezzan Occupation)

### 📖 원작 설명
매뉴얼: "페잔은 중립국, 침공 시 패널티" - 점령 메커니즘 미구현

### 🎮 구현 방안

#### A. 데이터 모델
```typescript
interface FezzanStatus {
  isNeutral: boolean;
  occupiedBy: string | null;    // 점령 진영 ID
  occupationDate: Date | null;
  internationalPenalty: number;  // 국제적 비난 수치
  tradeDisruption: number;       // 무역 차질 (0-100%)
}

interface FezzanViolation {
  factionId: string;
  violationType: 'invasion' | 'bombardment' | 'occupation';
  timestamp: Date;
  penalty: {
    influence: -500,             // 영향력 대폭 감소
    fezzanHostility: 100,        // 페잔 적대도 최대
    tradeEmbargo: true,          // 무역 금지
    diplomaticPenalty: -1000     // 외교 패널티
  };
}
```

#### B. 페잔 침공 체크
```typescript
async function invadeFezzan(factionId: string) {
  const fezzan = await getFezzanStatus();
  
  if (!fezzan.isNeutral) {
    throw new Error('페잔은 이미 점령됨');
  }
  
  // 경고 메시지
  await warnPlayer(factionId, {
    title: '⚠️ 페잔 침공 경고',
    message: `페잔 침공은 심각한 국제적 비난을 초래합니다!
    
    예상 패널티:
    - 영향력 -500
    - 무역 금지
    - 외교 관계 악화
    - 중립국 신뢰도 하락
    
    정말 침공하시겠습니까?`,
    options: ['침공 강행', '취소']
  });
  
  // 침공 실행
  fezzan.isNeutral = false;
  fezzan.occupiedBy = factionId;
  fezzan.occupationDate = new Date();
  
  // 패널티 적용
  await applyFezzanViolationPenalty(factionId);
  
  // 전 진영에 알림
  await broadcastGlobalEvent({
    type: 'fezzan_occupied',
    aggressor: factionId,
    message: `${getFactionName(factionId)}이(가) 페잔을 점령했습니다!`
  });
}
```

#### C. 패널티 적용
```typescript
async function applyFezzanViolationPenalty(factionId: string) {
  const faction = await getFaction(factionId);
  
  // 영향력 대폭 감소
  faction.influence -= 500;
  
  // 모든 무역로 차단
  await blockAllTradeRoutes(factionId);
  
  // 페잔 경유 보급 불가
  await disableFezzanSupplyRoute(factionId);
  
  // 적대 진영에게 외교 이점
  const enemyFaction = await getEnemyFaction(factionId);
  enemyFaction.influence += 200;  // 도덕적 우위
  
  // 중립국들의 신뢰 상실
  await decreaseNeutralTrust(factionId, -1000);
  
  await createViolationLog({
    factionId,
    violationType: 'fezzan_occupation',
    timestamp: new Date(),
    penaltiesApplied: true
  });
}
```

#### D. 페잔 점령 효과
```typescript
async function processFezzanOccupation(factionId: string) {
  const fezzan = await getFezzanStatus();
  
  if (fezzan.occupiedBy !== factionId) return;
  
  // 페잔 자원 획득 (제한적)
  const fezzanTreasury = await getFezzanTreasury();
  const confiscatedWealth = fezzanTreasury * 0.1;  // 10%만 획득 가능
  
  await addToNationalBudget(factionId, confiscatedWealth);
  
  // 페잔 조선소 사용 가능
  const fezzanShipyard = await getFezzanShipyard();
  fezzanShipyard.availableToFaction = factionId;
  
  // 하지만 지속적인 페널티
  await applyOccupationPenalty(factionId);
}

async function applyOccupationPenalty(factionId: string) {
  // 매 턴 패널티
  const faction = await getFaction(factionId);
  
  // 무역 차질로 경제 성장률 -50%
  faction.economicGrowthRate *= 0.5;
  
  // 점령 유지 비용
  const occupationCost = 1000000;  // 매 턴 100만
  faction.budget.expenditure.military += occupationCost;
  
  // 저항 운동 (랜덤 이벤트)
  if (Math.random() < 0.3) {  // 30% 확률
    await triggerFezzanResistance(factionId);
  }
}
```

#### E. 구현 단계
1. ✅ Fezzan Status 모델
2. ✅ 침공 경고 시스템
3. ✅ 패널티 적용 로직
4. ✅ 점령 효과 (자원, 조선소)
5. ✅ 점령 유지 비용
6. ✅ 저항 운동 이벤트
7. ✅ UI: 페잔 점령 확인 다이얼로그
8. ✅ 글로벌 이벤트 알림

---

## 📅 구현 타임라인

### Phase 1: 핵심 전투 (1-2개월)
- Week 1-2: **전사 시스템** 완성
- Week 3-4: **물자 소비** 완성
- Week 5-8: **전투정 메커니즘** 완성

### Phase 2: 전략 게임 (2-3개월)
- Week 9-14: **경제 시스템** 완성
- Week 15-16: **서훈 시스템** 완성

### Phase 3: 고급 기능 (3-4개월)
- Week 17-22: **AI 시스템** 완성
- Week 23-24: **페잔 점령** 완성

**총 예상 기간: 6개월**

---

## 🧪 테스트 계획

각 기능 구현 후:
1. ✅ **단위 테스트**: 개별 함수/메서드
2. ✅ **통합 테스트**: 시스템 간 연동
3. ✅ **밸런스 테스트**: 게임 밸런스 조정
4. ✅ **사용자 테스트**: 알파/베타 테스트
5. ✅ **성능 테스트**: 대규모 전투/세션

---

## 📊 성공 지표

- ✅ 전사 시스템: 전투 후 전사/부상 정상 처리
- ✅ 물자 소비: 물자 부족 시 공격 차단
- ✅ 전투정: 발진/귀환/공격 정상 작동
- ✅ 경제: 세금 징수 → 예산 배분 → 군사비 지불
- ✅ 서훈: 자격 체크 → 수여 → 효과 적용
- ✅ AI: 오프라인 플레이어 정상 대행
- ✅ 페잔: 침공 시 패널티 정상 적용

---

생성 일시: 2025-01-09  
작성자: OpenCode AI  
기반: GIN7 매뉴얼 + 원작 은하영웅전설
