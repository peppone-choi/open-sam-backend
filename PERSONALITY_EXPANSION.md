# NPC 성격/특성 확장 가이드

## 현재 구현된 시스템
- 장수 타입 분류: 통솔장/무장/지장
- 능력치 기반 명령 선택
- 가중치 확률 시스템

## 확장 방안

### 1. 성격(Personality) 시스템 추가

#### 데이터 구조
```typescript
// general.data.personality 필드 사용
type Personality = {
  aggression: number;    // 공격성 (0-100)
  caution: number;       // 신중함 (0-100)
  loyalty: number;       // 충성도 (0-100)
  ambition: number;      // 야망 (0-100)
  intelligence: number;  // 지략 (0-100)
}

// 성격 타입 (PHP personal 필드)
enum PersonalityType {
  AGGRESSIVE = 1,    // 맹장형
  DEFENSIVE = 2,     // 수비형
  BALANCED = 3,      // 균형형
  STRATEGIC = 4,     // 모사형
  LOYAL = 5,         // 충신형
  AMBITIOUS = 6,     // 야심가형
}
```

#### 구현 위치: `src/core/SimpleAI.ts`

```typescript
private getPersonalityModifiers(genData: any): Record<string, number> {
  const personal = genData.personal || 3; // PHP personal 필드
  
  const modifiers = {
    offensive: 1.0,    // 공격 명령 가중치
    defensive: 1.0,    // 방어 명령 가중치
    domestic: 1.0,     // 내정 명령 가중치
    training: 1.0,     // 단련 명령 가중치
    trade: 1.0,        // 거래 명령 가중치
    loyalty: 1.0,      // 충성도 관련
  };
  
  switch (personal) {
    case 1: // 맹장형
      modifiers.offensive = 2.0;
      modifiers.defensive = 0.5;
      modifiers.domestic = 0.3;
      break;
      
    case 2: // 수비형
      modifiers.offensive = 0.5;
      modifiers.defensive = 2.0;
      modifiers.domestic = 0.8;
      break;
      
    case 3: // 균형형 (기본)
      // 모든 가중치 1.0 유지
      break;
      
    case 4: // 모사형
      modifiers.offensive = 0.7;
      modifiers.defensive = 0.7;
      modifiers.domestic = 1.5;
      modifiers.training = 1.5;
      break;
      
    case 5: // 충신형
      modifiers.offensive = 0.8;
      modifiers.defensive = 1.2;
      modifiers.domestic = 1.3;
      modifiers.loyalty = 2.0;
      break;
      
    case 6: // 야심가형
      modifiers.offensive = 1.5;
      modifiers.domestic = 1.2;
      modifiers.loyalty = 0.5;
      break;
  }
  
  return modifiers;
}
```

### 2. 특기(Special) 기반 행동 패턴

```typescript
private getSpecialBonus(genData: any, commandType: string): number {
  const special = genData.special || 'None';
  const special2 = genData.special2 || 'None';
  
  const bonuses = {
    // 전투 특기
    '신속': commandType === '이동' || commandType === '출병' ? 1.5 : 1.0,
    '맹공': commandType === '출병' ? 2.0 : 1.0,
    '철벽': commandType === '수비강화' || commandType === '성벽보수' ? 1.5 : 1.0,
    
    // 내정 특기
    '명정': commandType === '주민선정' ? 2.0 : 1.0,
    '상술': commandType === '상업투자' ? 1.8 : 1.0,
    '농업': commandType === '농지개간' ? 1.8 : 1.0,
    '징병': commandType === '징병' ? 1.5 : 1.0,
  };
  
  return (bonuses[special] || 1.0) * (bonuses[special2] || 1.0);
}
```

### 3. 상황별 행동 변화

#### 전쟁 중 행동
```typescript
private isAtWar(nationData: any): boolean {
  return (nationData?.war_list?.length || 0) > 0;
}

private modifyCommandsByWarStatus(
  commands: AICommandDecision[], 
  isAtWar: boolean
): void {
  if (isAtWar) {
    // 전쟁 중: 군사 명령 가중치 증가, 내정 감소
    commands.forEach(cmd => {
      if (['징병', '훈련', '출병'].includes(cmd.command)) {
        cmd.weight *= 2.0;
      } else if (['농지개간', '상업투자'].includes(cmd.command)) {
        cmd.weight *= 0.3;
      }
    });
  }
}
```

#### 자원 부족 시 행동
```typescript
private adjustForResourceShortage(
  commands: AICommandDecision[],
  stats: GeneralStats
): void {
  const isLowGold = stats.gold < 1000;
  const isLowRice = stats.rice < 1000;
  
  if (isLowGold || isLowRice) {
    // 자원 부족: 내정 우선, 군사 후순위
    commands.forEach(cmd => {
      if (['농지개간', '상업투자'].includes(cmd.command)) {
        cmd.weight *= 2.0;
      } else if (['징병', '출병'].includes(cmd.command)) {
        cmd.weight *= 0.2;
      }
    });
  }
}
```

### 4. 관계/외교 기반 행동

```typescript
private evaluateDiplomacy(genData: any): AICommandDecision[] {
  const commands: AICommandDecision[] = [];
  const affinity = genData.affinity || 75; // 상성
  
  // 낮은 상성: 배신 가능성
  if (affinity < 40 && genData.officer_level < 12) {
    commands.push({
      command: '모반시도',
      args: {},
      weight: (100 - affinity) / 10,
      reason: '낮은 상성, 배신 가능성'
    });
  }
  
  // 높은 상성: 충성 행동
  if (affinity > 80) {
    // 군주를 위한 행동 우선
  }
  
  return commands;
}
```

### 5. 계절/시간 기반 행동

이미 구현됨 (491-513번 줄):
- 봄/여름: 농지개간 가중치 +20%
- 가을/겨울: 상업투자 가중치 +20%

### 6. 학습/성장 시스템

```typescript
// general.data.ai_memory 필드 사용
type AIMemory = {
  lastCommands: string[];           // 최근 실행한 명령들
  successRate: Record<string, number>; // 명령별 성공률
  preferredCommands: string[];      // 선호하는 명령들
}

private learnFromHistory(genData: any, commands: AICommandDecision[]): void {
  const memory = genData.ai_memory || { successRate: {} };
  
  // 성공률이 높은 명령 가중치 증가
  commands.forEach(cmd => {
    const rate = memory.successRate[cmd.command] || 0.5;
    cmd.weight *= (0.5 + rate);
  });
}
```

## 구현 순서 추천

1. ✅ **기본 타입 시스템** (이미 구현됨)
2. **성격(Personality) 모디파이어 추가**
3. **특기 기반 보너스**
4. **전쟁/자원 상황 대응**
5. **외교/관계 기반 행동**
6. **학습/성장 시스템** (고급)

## 테스트 방법

```typescript
// 테스트 코드 예시
const testGeneral = {
  no: 1,
  name: '조조',
  data: {
    leadership: 95,
    strength: 70,
    intel: 92,
    personal: 6,  // 야심가형
    special: '맹공',
    special2: '상술',
    gold: 5000,
    rice: 3000,
    crew: 2000,
  }
};

// 예상 행동: 공격적, 내정 강화, 군사 준비
```

## 참고

- PHP 원본: `sammo-php/hwe/sammo/General/GeneralAI.php`
- 현재 구현: `src/core/SimpleAI.ts`
- NPC 자동 명령: `src/services/ai/NPCAutoCommand.service.ts`
