# 확장 장수 타입 시스템 (통무지정매 조합)

## 기존 11개 타입 (프론트엔드)
1. 랜덤 (random)
2. 균형형 (balanced)
3. 용장 (commander) - 통무지
4. 무인 (warrior) - 무
5. 지장 (strategist) - 지
6. 내정가 (administrator) - 정
7. 학자 (scholar) - 지정
8. 맹장 (general_warrior) - 통무
9. 전략가 (tactician) - 통지
10. 외교관 (diplomat) - 정매 (지매?)
11. 카리스마 (charismatic) - 통매

## 확장 가능한 조합 (2개 능력치 조합)

### 통솔(통) 기반
- ✅ **통무** (맹장) - 군사 지휘관
- ✅ **통지** (전략가) - 전략 지휘관
- **통정** (경세가) - 내정 지휘관
- ✅ **통매** (카리스마) - 군주형

### 무력(무) 기반
- ✅ **통무** (맹장)
- **무지** (검성) - 무예와 지혜 겸비
- **무정** (호걸) - 무력과 행정
- **무매** (협객) - 무력과 인망

### 지력(지) 기반
- ✅ **통지** (전략가)
- ✅ **무지** (검성)
- ✅ **지정** (학자)
- **지매** (명사) - 지혜와 명성

### 정치(정) 기반
- ✅ **통정** (경세가)
- **무정** (호걸)
- ✅ **지정** (학자)
- **정매** (외교관) - 정치와 명성

### 매력(매) 기반
- ✅ **통매** (카리스마)
- **무매** (협객)
- **지매** (명사)
- ✅ **정매** (외교관)

## 확장 타입: 3개 능력치 조합

### 통무지 계열
- ✅ **통무지** (용장) - 이미 구현
- **통무정** (명장) - 군사+내정 겸비
- **통무매** (영웅) - 군사+인망

### 통지정 계열
- **통지정** (현군) - 전략+내정 겸비
- **통지매** (명군) - 전략+인망
- **통정매** (성군) - 내정+인망

### 무지정 계열
- **무지정** (무학인) - 무예+학문+정치
- **무지매** (의사) - 무예+지혜+인망
- **무정매** (의협) - 무예+정치+인망

### 지정매 계열
- **지정매** (대현) - 지혜+정치+인망

## 확장 타입: 4개 능력치 조합

- **통무지정** (명재상) - 군사+전략+내정
- **통무지매** (영웅호걸) - 군사+전략+인망
- **통무정매** (패자) - 군사+내정+인망
- **통지정매** (대군주) - 전략+내정+인망
- **무지정매** (완인) - 무예+지혜+정치+인망

## 확장 타입: 5개 모두 (통무지정매)

- **통무지정매** (천재, 성인) - 모든 능력 우수

---

## 제안: 31가지 타입 분류 시스템

```typescript
enum GeneralArchetype {
  // === 단일 특화 (5개) ===
  COMMANDER = 'commander',           // 통솔가
  WARRIOR = 'warrior',               // 무인
  STRATEGIST = 'strategist',         // 지장
  ADMINISTRATOR = 'administrator',   // 내정가
  CHARISMATIC_LEADER = 'charismatic', // 명사

  // === 2개 조합 (10개) ===
  GENERAL_WARRIOR = 'general_warrior',     // 통무 - 맹장
  TACTICAL_COMMANDER = 'tactician',        // 통지 - 전략가
  GOVERNING_LEADER = 'governing_leader',   // 통정 - 경세가
  INSPIRING_LEADER = 'inspiring_leader',   // 통매 - 군주
  
  MARTIAL_SAGE = 'martial_sage',           // 무지 - 검성
  GALLANT_HERO = 'gallant_hero',           // 무정 - 호걸
  CHIVALROUS_HERO = 'chivalrous',          // 무매 - 협객
  
  SCHOLAR = 'scholar',                     // 지정 - 학자
  RENOWNED_SCHOLAR = 'renowned_scholar',   // 지매 - 명사
  
  DIPLOMAT = 'diplomat',                   // 정매 - 외교관

  // === 3개 조합 (10개) ===
  GRAND_GENERAL = 'grand_general',         // 통무지 - 용장
  GREAT_COMMANDER = 'great_commander',     // 통무정 - 명장
  HEROIC_LEADER = 'heroic_leader',         // 통무매 - 영웅
  
  WISE_RULER = 'wise_ruler',               // 통지정 - 현군
  BRILLIANT_LEADER = 'brilliant_leader',   // 통지매 - 명군
  BENEVOLENT_RULER = 'benevolent_ruler',   // 통정매 - 성군
  
  WARRIOR_SCHOLAR = 'warrior_scholar',     // 무지정 - 무학인
  RIGHTEOUS_HERO = 'righteous_hero',       // 무지매 - 의사
  JUST_WARRIOR = 'just_warrior',           // 무정매 - 의협
  
  GREAT_SAGE = 'great_sage',               // 지정매 - 대현

  // === 4개 조합 (5개) ===
  GREAT_MINISTER = 'great_minister',       // 통무지정 - 명재상
  LEGENDARY_HERO = 'legendary_hero',       // 통무지매 - 영웅호걸
  CONQUEROR = 'conqueror',                 // 통무정매 - 패자
  SUPREME_RULER = 'supreme_ruler',         // 통지정매 - 대군주
  PERFECT_GENTLEMAN = 'perfect_gentleman', // 무지정매 - 완인

  // === 5개 모두 (1개) ===
  OMNITALENT = 'omnitalent',               // 통무지정매 - 천재/성인

  // === 기타 ===
  BALANCED = 'balanced',                   // 균형형 (모두 평균)
}
```

## 타입 판정 로직

```typescript
class GeneralTypeClassifier {
  private readonly HIGH_THRESHOLD = 70;   // 높은 능력치 기준
  private readonly MEDIUM_THRESHOLD = 55; // 중간 능력치 기준

  classify(stats: {
    leadership: number;
    strength: number;
    intel: number;
    politics: number;
    charm: number;
  }): GeneralArchetype {
    const { leadership: l, strength: s, intel: i, politics: p, charm: c } = stats;
    
    // 높은 능력치 체크
    const highStats = {
      l: l >= this.HIGH_THRESHOLD,
      s: s >= this.HIGH_THRESHOLD,
      i: i >= this.HIGH_THRESHOLD,
      p: p >= this.HIGH_THRESHOLD,
      c: c >= this.HIGH_THRESHOLD,
    };
    
    const highCount = Object.values(highStats).filter(Boolean).length;
    
    // 5개 모두 높음
    if (highCount === 5) {
      return GeneralArchetype.OMNITALENT;
    }
    
    // 4개 높음
    if (highCount === 4) {
      if (!highStats.l) return GeneralArchetype.PERFECT_GENTLEMAN;  // 무지정매
      if (!highStats.s) return GeneralArchetype.SUPREME_RULER;      // 통지정매
      if (!highStats.i) return GeneralArchetype.CONQUEROR;          // 통무정매
      if (!highStats.p) return GeneralArchetype.LEGENDARY_HERO;     // 통무지매
      if (!highStats.c) return GeneralArchetype.GREAT_MINISTER;     // 통무지정
    }
    
    // 3개 높음
    if (highCount === 3) {
      if (highStats.l && highStats.s && highStats.i) return GeneralArchetype.GRAND_GENERAL;     // 통무지
      if (highStats.l && highStats.s && highStats.p) return GeneralArchetype.GREAT_COMMANDER;   // 통무정
      if (highStats.l && highStats.s && highStats.c) return GeneralArchetype.HEROIC_LEADER;     // 통무매
      if (highStats.l && highStats.i && highStats.p) return GeneralArchetype.WISE_RULER;        // 통지정
      if (highStats.l && highStats.i && highStats.c) return GeneralArchetype.BRILLIANT_LEADER;  // 통지매
      if (highStats.l && highStats.p && highStats.c) return GeneralArchetype.BENEVOLENT_RULER;  // 통정매
      if (highStats.s && highStats.i && highStats.p) return GeneralArchetype.WARRIOR_SCHOLAR;   // 무지정
      if (highStats.s && highStats.i && highStats.c) return GeneralArchetype.RIGHTEOUS_HERO;    // 무지매
      if (highStats.s && highStats.p && highStats.c) return GeneralArchetype.JUST_WARRIOR;      // 무정매
      if (highStats.i && highStats.p && highStats.c) return GeneralArchetype.GREAT_SAGE;        // 지정매
    }
    
    // 중간 능력치 체크 (2개 조합)
    const mediumStats = {
      l: l >= this.MEDIUM_THRESHOLD,
      s: s >= this.MEDIUM_THRESHOLD,
      i: i >= this.MEDIUM_THRESHOLD,
      p: p >= this.MEDIUM_THRESHOLD,
      c: c >= this.MEDIUM_THRESHOLD,
    };
    
    // 2개 높음
    if (highCount === 2) {
      if (highStats.l && highStats.s) return GeneralArchetype.GENERAL_WARRIOR;    // 통무
      if (highStats.l && highStats.i) return GeneralArchetype.TACTICAL_COMMANDER; // 통지
      if (highStats.l && highStats.p) return GeneralArchetype.GOVERNING_LEADER;   // 통정
      if (highStats.l && highStats.c) return GeneralArchetype.INSPIRING_LEADER;   // 통매
      if (highStats.s && highStats.i) return GeneralArchetype.MARTIAL_SAGE;       // 무지
      if (highStats.s && highStats.p) return GeneralArchetype.GALLANT_HERO;       // 무정
      if (highStats.s && highStats.c) return GeneralArchetype.CHIVALROUS_HERO;    // 무매
      if (highStats.i && highStats.p) return GeneralArchetype.SCHOLAR;            // 지정
      if (highStats.i && highStats.c) return GeneralArchetype.RENOWNED_SCHOLAR;   // 지매
      if (highStats.p && highStats.c) return GeneralArchetype.DIPLOMAT;           // 정매
    }
    
    // 1개만 높음 (단일 특화)
    if (highCount === 1) {
      if (highStats.l) return GeneralArchetype.COMMANDER;
      if (highStats.s) return GeneralArchetype.WARRIOR;
      if (highStats.i) return GeneralArchetype.STRATEGIST;
      if (highStats.p) return GeneralArchetype.ADMINISTRATOR;
      if (highStats.c) return GeneralArchetype.CHARISMATIC_LEADER;
    }
    
    // 기본: 균형형
    return GeneralArchetype.BALANCED;
  }
  
  getTypeDescription(type: GeneralArchetype): string {
    const descriptions: Record<GeneralArchetype, string> = {
      [GeneralArchetype.OMNITALENT]: '천재 - 모든 능력이 뛰어난 완벽한 인재',
      [GeneralArchetype.GREAT_MINISTER]: '명재상 - 군사, 전략, 내정에 모두 능한 대신',
      [GeneralArchetype.LEGENDARY_HERO]: '영웅호걸 - 군사, 전략, 인망을 갖춘 영웅',
      [GeneralArchetype.CONQUEROR]: '패자 - 군사, 내정, 인망으로 천하를 호령',
      [GeneralArchetype.SUPREME_RULER]: '대군주 - 전략, 내정, 인망을 갖춘 군주',
      [GeneralArchetype.PERFECT_GENTLEMAN]: '완인 - 무예, 지혜, 정치, 인망을 두루 갖춤',
      
      [GeneralArchetype.GRAND_GENERAL]: '용장 - 통솔, 무력, 지력을 겸비한 명장',
      [GeneralArchetype.GREAT_COMMANDER]: '명장 - 군사와 내정을 겸비한 장수',
      [GeneralArchetype.HEROIC_LEADER]: '영웅 - 군사와 인망을 갖춘 영웅',
      [GeneralArchetype.WISE_RULER]: '현군 - 전략과 내정에 능한 현명한 군주',
      [GeneralArchetype.BRILLIANT_LEADER]: '명군 - 전략과 인망을 갖춘 명군',
      [GeneralArchetype.BENEVOLENT_RULER]: '성군 - 내정과 인망을 갖춘 성스러운 군주',
      [GeneralArchetype.WARRIOR_SCHOLAR]: '무학인 - 무예와 학문을 겸비',
      [GeneralArchetype.RIGHTEOUS_HERO]: '의사 - 무예, 지혜, 인망을 갖춘 의로운 자',
      [GeneralArchetype.JUST_WARRIOR]: '의협 - 무예, 정치, 인망을 갖춘 협객',
      [GeneralArchetype.GREAT_SAGE]: '대현 - 지혜, 정치, 인망을 갖춘 대현인',
      
      [GeneralArchetype.GENERAL_WARRIOR]: '맹장 - 군사를 지휘하는 용맹한 장수',
      [GeneralArchetype.TACTICAL_COMMANDER]: '전략가 - 전략을 구사하는 지휘관',
      [GeneralArchetype.GOVERNING_LEADER]: '경세가 - 통솔과 내정에 능함',
      [GeneralArchetype.INSPIRING_LEADER]: '군주 - 통솔과 인망을 갖춘 지도자',
      [GeneralArchetype.MARTIAL_SAGE]: '검성 - 무예와 지혜를 겸비한 고수',
      [GeneralArchetype.GALLANT_HERO]: '호걸 - 무력과 정치를 겸비',
      [GeneralArchetype.CHIVALROUS_HERO]: '협객 - 무력과 인망을 갖춘 협객',
      [GeneralArchetype.SCHOLAR]: '학자 - 지혜와 정치에 능한 학자',
      [GeneralArchetype.RENOWNED_SCHOLAR]: '명사 - 지혜와 명성을 갖춘 명사',
      [GeneralArchetype.DIPLOMAT]: '외교관 - 정치와 인망으로 외교에 능함',
      
      [GeneralArchetype.COMMANDER]: '통솔가 - 통솔에 특화',
      [GeneralArchetype.WARRIOR]: '무인 - 무력에 특화',
      [GeneralArchetype.STRATEGIST]: '지장 - 지력에 특화',
      [GeneralArchetype.ADMINISTRATOR]: '내정가 - 정치에 특화',
      [GeneralArchetype.CHARISMATIC_LEADER]: '명사 - 매력에 특화',
      
      [GeneralArchetype.BALANCED]: '균형형 - 모든 능력이 평균적',
    };
    
    return descriptions[type] || '알 수 없는 타입';
  }
}
```

## SimpleAI에 적용

```typescript
// src/core/SimpleAI.ts 수정

import { GeneralTypeClassifier, GeneralArchetype } from './GeneralTypeClassifier';

export class SimpleAI {
  private classifier = new GeneralTypeClassifier();
  
  async decideNextCommand(): Promise<AICommandDecision | null> {
    const genData = this.general.data || this.general;
    const stats = this.extractGeneralStats(genData);
    
    // 31가지 타입 중 하나로 분류
    const archetype = this.classifier.classify(stats);
    
    console.log(`[NPC AI] ${genData.name} 타입: ${archetype} - ${this.classifier.getTypeDescription(archetype)}`);
    
    // 타입별 가중치 적용
    const typeModifiers = this.getArchetypeModifiers(archetype);
    
    // ... 기존 로직에 typeModifiers 적용
  }
}
```

## 기대 효과

1. **다양성**: 11개 → 31개로 NPC 행동 패턴 3배 증가
2. **현실감**: 삼국지 무장들의 실제 특성 반영
   - 조조: 통무지정 (명재상)
   - 관우: 통무매 (영웅)
   - 제갈량: 통지정 (현군)
   - 여포: 무매 (협객)
   - 사마의: 지정매 (대현)
3. **전략성**: 타입별로 다른 역할 수행
4. **재미**: 장수마다 독특한 성격과 행동

## 다음 단계

이 31가지 타입을 `SimpleAI.ts`에 실제로 구현할까요?
