# 게임 로직 명세서 (PHP → TypeScript)

삼국지 게임 커맨드 시스템 전체 분석

## 📊 커맨드 통계

- **General 커맨드**: 52개
- **Nation 커맨드**: 27개
- **총 커맨드**: 79개

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 커맨드 패턴 분류

### 패턴 1: 내정 투자형 (8개)
농지개간, 상업투자, 기술연구, 수비강화, 성벽보수, 치안강화, 정착장려, 주민선정

**공통 로직:**
```typescript
// 기본 점수 계산
baseScore = stat(lead/str/intel) × trust/100 × expLevelBonus × rand(0.8~1.2)

// 크리티컬 적용
criticalRatio = CriticalRatioDomestic(general, statKey)
score = baseScore × CriticalScoreEx(rng, pick) // ×3 / ×2 / ×1

// 전선 디버프
if (!isCapital && !초반) score × debuffFront

// 도시 능력치 증가
city[cityKey] += score (최대: city[cityKey + '_max'])

// 비용/경험치
gold -= develcost
exp += 0.7 × score
ded += score
statExp += 1
```

**변형 포인트:**
| 커맨드 | cityKey | stat | debuff | 비용 |
|--------|---------|------|--------|------|
| 농지개간 | agri | intel | 0.5 | [gold, 0] |
| 상업투자 | comm | intel | 0.5 | [gold, 0] |
| 기술연구 | tech(nation) | intel | 1.0 | [gold, 0] |
| 수비강화 | def | strength | 0.5 | [gold, 0] |
| 성벽보수 | wall | strength | 0.25 | [gold, 0] |
| 치안강화 | secu | strength | 1.0 | [gold, 0] |
| 정착장려 | pop | leadership | 1.0 | [0, rice] |
| 주민선정 | trust | leadership | 1.0 | [0, rice] |

### 패턴 2: 군사형 (6개)
훈련, 사기진작, 징병, 모병, 전투태세, 소집해제

**훈련:**
```typescript
score = clamp(
  round(leadership × 100 / crew × trainDelta),  // trainDelta = 30
  0,
  maxTrainByCommand - currentTrain  // maxTrainByCommand = 100
)
sideEffect = floor(atmos × atmosSideEffectByTraining)  // = 1.0

train += score
atmos = sideEffect
addDex(crewType, score)
exp += 100
ded += 70
leadership_exp += 1
```

**사기진작:**
```typescript
score = clamp(
  round(leadership × 100 / crew × atmosDelta),  // atmosDelta = 30
  0,
  maxAtmosByCommand - currentAtmos  // maxAtmosByCommand = 100
)
sideEffect = floor(train × trainSideEffectByAtmosTurn)  // = 1.0

atmos += score
train = sideEffect
addDex(crewType, score)
gold -= round(crew / 100)
exp += 100
ded += 70
leadership_exp += 1
```

**징병/모병:**
```typescript
// 비용 계산
reqGold = unit.costWithTech(tech) × maxCrew / 100 × costOffset
  // costOffset: 징병=1, 모병=2
reqRice = round(maxCrew / 100)

// 최대 병사 수
maxCrew = leadership × 100
if (sameUnitType) maxCrew -= currentCrew

// 병사 병합 (같은 병종일 때)
newTrain = (currCrew × currTrain + reqCrew × defaultTrain) / totalCrew
newAtmos = (currCrew × currAtmos + reqCrew × defaultAtmos) / totalCrew
// defaultTrain/Atmos: 징병=40, 모병=70

// 인구/민심 감소
popDecrease = onCalcDomestic('징집인구', 'score', reqCrew)
city.pop -= popDecrease
city.trust -= (popDecrease / city.pop) / costOffset × 100

// 경험치/숙련도
exp += round(reqCrew / 100)
ded += round(reqCrew / 100)
addDex(reqCrewType, reqCrew / 100)
leadership_exp += 1
gold -= reqGold
rice -= reqRice
```

### 패턴 3: 이동형 (4개)
이동, 강행, 귀환, 접경귀환

**이동:**
```typescript
cost = [develcost, 0]  // develcost = 24
distance = 1 (인접)

city = destCityID
atmos -= 5
gold -= develcost
exp += 50
leadership_exp += 1
```

**강행:**
```typescript
cost = [develcost × 5, 0]  // = 120
distance = 3 (최대)

city = destCityID
train -= 5
atmos -= 5
gold -= cost
exp += 100
leadership_exp += 1
```

### 패턴 4: 계략형 (4개)
선동, 탈취, 파괴, 화계

**공통 로직:**
```typescript
// 성공 확률
baseProb = sabotageDefaultProb  // = 0.35
attackBonus = (attackerIntel - defenderIntel) / sabotageProbCoefByStat  // 300
defenseBonus = defenderGeneralCount × sabotageDefenceCoefByGeneralCnt  // 0.04
successProb = baseProb + attackBonus - defenseBonus

// 피해량
damage = rand(sabotageDamageMin, sabotageDamageMax)  // 100~800
city[targetKey] -= damage

// 부상 (실패시)
if (failed) attacker.injury += rand(10, 50)

// 비용/경험치
gold -= 120
rice -= 120
exp += 150
ded += 100
intel_exp += 1 (화계) or strength_exp += 1 (탈취)
```

### 패턴 5: 국가/인사형
임관, 하야, 등용, 선양, 거병, 건국, 모반 등

**임관:**
```typescript
// 경험치 보너스
if (nation.genNum < initialNationGenLimit) exp += 700
else exp += 100

nation = destNationID
officer_level = 1
belong = 1
city = nation.capital
nation.genNum += 1
```

**선양:**
```typescript
// 군주 → 대상
target.officer_level = 12
self.officer_level = 1
self.exp × = 0.7
```

### 패턴 6: 외교형 (Nation)
선전포고, 불가침제의/수락, 종전제의/수락, 불가침파기제의/수락

**선전포고:**
```typescript
diplomacy(me, target).state = 1  // 선포
diplomacy(me, target).term = 24  // 24개월
// 양방향 기록

// 로그
global: "국가 A가 국가 B에 선전포고"
history: 역사 기록
messages: 양국 장수들에게 메시지
```

### 패턴 7: 전략형 (Nation)
급습, 허보, 수몰, 이호경식, 피장파장, 백성동원 등

**재사용 대기 계산:**
```typescript
delay = round(sqrt(genNum × coefficient) × 10)
// coefficient: 급습=16, 허보=4, 수몰=4, 이호경식=16 등

// nation KVStorage에 저장
next_execute_{commandKey} = currentTurn + delay
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 전체 커맨드 목록 및 핵심 스펙

### General 커맨드 (52개)

#### 개인 커맨드 (10개)

1. **휴식** - cost:[0,0], pre:0, post:0, 로그만
2. **요양** - cost:[0,0], injury=0, exp+10, ded+7
3. **단련** - cost:[24,24], 병종 숙련도 증가 (크리티컬 적용)
4. **숙련전환** - cost:[24,24], 숙련도 40% 감소 → 90% 전환
5. **견문** - cost:[0,0], 랜덤 이벤트 27가지
6. **은퇴** - cost:[0,0], pre:1, 나이≥60, 후계자 생성 (85% 스탯)
7. **장비매매** - cost:변동, 장비 구매/판매
8. **군량매매** - cost:[0,0], 금↔쌀 교환, 시세 95%~105%
9. **내정특기초기화** - cost:[0,0], pre:1, 5년 1회
10. **전투특기초기화** - cost:[0,0], pre:1, 5년 1회

#### 내정 커맨드 (8개)

11. **농지개간** - cost:[24,0], city.agri 증가, intel경험
12. **상업투자** - cost:[24,0], city.comm 증가, intel경험
13. **기술연구** - cost:[29,0], nation.tech 증가, intel경험
14. **수비강화** - cost:[19,0], city.def 증가, strength경험
15. **성벽보수** - cost:[19,0], city.wall 증가, strength경험
16. **치안강화** - cost:[24,0], city.secu 증가, strength경험
17. **정착장려** - cost:[0,48], city.pop 증가, leadership경험
18. **주민선정** - cost:[0,48], city.trust 증가, leadership경험

#### 군사 커맨드 (13개)

19. **징병** - 저렴 병사 모집 (train/atmos=40)
20. **모병** - 비싼 병사 모집 (train/atmos=70, 비용 2배)
21. **훈련** - train 증가, atmos 감소
22. **사기진작** - atmos 증가, train 감소, cost:[crew/100,0]
23. **출병** - 전투 시작, processWar 호출
24. **집합** - 부대원 소집
25. **소집해제** - 병사 해산, 인구 복귀
26. **첩보** - cost:[72,72], 정보 수집, nation.spy 갱신
27. **전투태세** - pre:3, train/atmos 95까지 상승 (비용 미차감)
28. **NPC능동** - NPC 전용
29. **전투특기초기화** - pre:1, 5년 1회

#### 인사 커맨드 (12개)

30. **이동** - cost:[24,0], 인접 도시, atmos-5
31. **강행** - cost:[120,0], 3칸 이내, train/atmos-5
32. **귀환** - cost:[0,0], 수도/관할 도시로 복귀
33. **접경귀환** - cost:[0,0], 비점령 도시에서 아군 도시로 순간이동
34. **인재탐색** - cost:[24,0], 2.4% 확률 NPC 발견
35. **등용** - cost:변동, 타국 장수 스카웃 메시지
36. **등용수락** - cost:[0,0], 등용 수락
37. **임관** - cost:[0,0], 재야 → 국가 가입
38. **랜덤임관** - cost:[0,0], 랜덤 국가 선택 후 임관
39. **장수대상임관** - cost:[0,0], 특정 장수의 국가로 임관
40. **하야** - cost:[0,0], 국가 탈퇴 → 재야
41. **선양** - cost:[0,0], 군주 권한 양도

#### 계략 커맨드 (4개)

42. **선동** - cost:[120,120], 민심 동요
43. **탈취** - cost:[120,120], 자원 탈취
44. **파괴** - cost:[120,120], 시설 파괴
45. **화계** - cost:[120,120], 화재 발생

#### 국가 커맨드 (4개)

46. **증여** - cost:[0,0], 장수 간 자원 이전
47. **헌납** - cost:[0,0], 국고에 헌납
48. **물자조달** - cost:[0,0], 국고에서 인출

#### 건국/국가 관리 (9개)

49. **거병** - cost:[0,0], 재야 → 1인 국가 창설
50. **건국** - cost:[0,0], pre:변동, 방랑국 → 정식 국가
51. **무작위건국** - 빈 도시에 건국
52. **방랑** - cost:[0,0], 국가 level=0 전환
53. **해산** - cost:[0,0], 국가 삭제
54. **모반시도** - cost:[0,0], 군주 축출

### Nation 커맨드 (27개)

#### 외교 커맨드 (10개)

1. **선전포고** - diplomacy.state=1, term=24
2. **불가침제의** - 불가침 조약 제안
3. **불가침수락** - 불가침 조약 수락
4. **불가침파기제의** - 조약 파기 제의
5. **불가침파기수락** - 조약 파기 수락
6. **종전제의** - 전쟁 종료 제의
7. **종전수락** - 전쟁 종료 수락
8. **물자원조** - 타국에 자원 지원
9. **초토화** - pre:3, 적국 도시 파괴
10. **국기변경** / **국호변경** - 국가 정보 변경

#### 전략 커맨드 (8개)

11. **급습** - pre:0, post:delay, 외교 term-3
12. **허보** - pre:1, post:delay, 적 장수 랜덤 이동
13. **수몰** - pre:2, post:delay, 도시 def/wall ×0.2
14. **이호경식** - pre:0, post:delay, 외교 term+3, 전선 재계산
15. **피장파장** - pre:1, post:8, 상대 전략 60턴 봉인
16. **백성동원** - pre:0, post:delay, city.def/wall 최대치 80%로 회복
17. **의병모집** - pre:3, post:delay, 병력 긴급 모집
18. **필사즉생** - pre:3, post:delay, 전투력 임시 강화

#### 운영 커맨드 (3개)

19. **천도** - pre:1+distance×2, cost:[base×2^distance], 수도 이전
20. **증축** - pre:5, city.level+1, 능력치/최대치 증가
21. **감축** - pre:5, city.level-1, 능력치/최대치 감소, 비용 회수

#### 인사 커맨드 (6개)

22. **발령** - officer_level/officer_city 설정
23. **포상** - 장수에게 자원 지급
24. **몰수** - 장수 자원 회수
25. **부대탈퇴지시** - 장수 부대 강제 탈퇴
26. **무작위수도이전** - pre:1, 빈 도시로 수도 이전

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔧 구현 전략

### 1단계: 공통 유틸리티 구현

```typescript
// src/common/services/
- DomesticService: 내정 점수 계산, 크리티컬, 전선 디버프
- MilitaryService: 훈련/사기/징모병 계산
- SabotageService: 계략 성공률/피해량 계산
- DiplomacyService: 외교 상태 관리
- CooldownService: 재사용 대기 관리
- ExperienceService: 경험치/공헌/스탯경험 계산
- LoggerService: 로그 기록
```

### 2단계: 커맨드 핸들러 구현

```typescript
// src/api/daemon/handlers/
- GeneralCommandHandler: 52개 General 커맨드
- NationCommandHandler: 27개 Nation 커맨드
```

### 3단계: CommandProcessor 연동

```typescript
// src/api/daemon/command-processor.ts
processCommand(commandId, commandData) {
  switch(commandData.type) {
    case CommandType.TRAIN:
      await GeneralCommandHandler.handleTrain(...)
    // ...
  }
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📐 핵심 계산식 요약

### 내정 점수
```
baseScore = stat × trust/100 × expLevelBonus × rand(0.8~1.2)
finalScore = baseScore × criticalMultiplier × debuffFront
```

### 군사 점수
```
train: leadership × 100 / crew × 30 (최대 100)
atmos: leadership × 100 / crew × 30 (최대 100)
```

### 징병/모병
```
maxCrew = leadership × 100 (- currentCrew if same type)
cost = unitCost × crew / 100 × costOffset
rice = crew / 100
```

### 계략 성공률
```
prob = 0.35 + (attackIntel - defIntel)/300 - defGenCount×0.04
damage = rand(100, 800)
```

### 경험치 기본값
- 내정: 0.7 × score
- 군사: 100
- 이동: 50
- 강행: 100
- 징병/모병: crew / 100

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ⚠️ 주의사항

1. **비용 차감 타이밍**
   - 일부 커맨드는 getCost로 요구만 하고 실제 차감 안 함 (출병, 전투태세)
   - 명세에 "비용=요구만" 표시

2. **재사용 대기 (Cooldown)**
   - KVStorage에 `next_execute_{commandKey}` 저장
   - 턴 비교로 사용 가능 여부 체크

3. **크리티컬/확률**
   - RNG 시드 일관성 유지
   - 상한/하한 정확히 적용

4. **도시 능력치 상한**
   - city.agri ≤ city.agri_max
   - city.trust ≤ 100
   - city.pop ≤ city.pop_max

5. **전선 디버프**
   - 수도 예외
   - 초반 시나리오 보정

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚀 구현 우선순위

### High Priority (핵심 게임플레이)
1. ✅ 훈련, 사기진작
2. ✅ 징병, 모병
3. ✅ 이동, 강행
4. ✅ 내정 8종 (농지개간, 상업투자 등)

### Medium Priority (국가 운영)
5. ⏳ 출병, 전투 시스템
6. ⏳ 외교 (선전포고, 불가침)
7. ⏳ 임관, 하야, 등용

### Low Priority (고급 기능)
8. ⏳ 계략 4종
9. ⏳ 전략 커맨드
10. ⏳ 건국, 천도, 증축 등
