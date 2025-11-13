# 장수 타입 시스템 (프론트엔드 기준)

## 11가지 장수 타입

### 1. 균형형 (balanced)
- **능력치**: 모든 능력치 균등 분배
- **특징**: 만능형

### 2. 용장 (commander)
- **능력치**: 통솔 60+, 무력 50+, 지력 50+
- **특징**: 통솔, 무력, 지력 골고루

### 3. 무인 (warrior)
- **능력치**: 무력 60+
- **특징**: 무력 특화

### 4. 지장 (strategist)
- **능력치**: 지력 60+
- **특징**: 지력 특화

### 5. 내정가 (administrator)
- **능력치**: 정치 60+
- **특징**: 정치 특화

### 6. 학자 (scholar)
- **능력치**: 지력 50+, 정치 50+
- **특징**: 지력, 정치 중시

### 7. 맹장 (general_warrior)
- **능력치**: 통솔 50+, 무력 60+
- **특징**: 군사 지휘관

### 8. 전략가 (tactician)
- **능력치**: 통솔 50+, 지력 60+
- **특징**: 전략 지휘관

### 9. 외교관 (diplomat)
- **능력치**: 지력 50+, 매력 60+
- **특징**: 지략과 매력

### 10. 카리스마 (charismatic)
- **능력치**: 매력 60+
- **특징**: 매력 특화

### 11. 랜덤 (random)
- **능력치**: 완전 랜덤
- **특징**: 예측 불가

---

## NPC AI에 적용하는 방법

### 현재 SimpleAI 구조
```typescript
// src/core/SimpleAI.ts:281-301
calculateGeneralType(stats: GeneralStats): number {
  TYPE_COMMANDER = 1;  // 통솔장
  TYPE_WARRIOR = 2;    // 무장
  TYPE_STRATEGIST = 4; // 지장
}
```

### 확장안: 11가지 타입으로 세분화

```typescript
enum GeneralType {
  BALANCED = 0,           // 균형형
  COMMANDER = 1,          // 용장 (통무지)
  WARRIOR = 2,            // 무인 (무력)
  STRATEGIST = 3,         // 지장 (지력)
  ADMINISTRATOR = 4,      // 내정가 (정치)
  SCHOLAR = 5,            // 학자 (지정)
  GENERAL_WARRIOR = 6,    // 맹장 (통무)
  TACTICIAN = 7,          // 전략가 (통지)
  DIPLOMAT = 8,           // 외교관 (지매)
  CHARISMATIC = 9,        // 카리스마 (매력)
  ALL_ROUNDER = 10        // 통무지정매 (5개 모두 높음)
}

private calculateDetailedGeneralType(stats: GeneralStats): GeneralType {
  const { leadership, strength, intel, politics, charm } = stats;
  
  // 5개 모두 70+ → 올라운더
  if (leadership >= 70 && strength >= 70 && intel >= 70 && politics >= 70 && charm >= 70) {
    return GeneralType.ALL_ROUNDER;
  }
  
  // 3개 높음 (통무지) → 용장
  if (leadership >= 60 && strength >= 50 && intel >= 50) {
    return GeneralType.COMMANDER;
  }
  
  // 통무 → 맹장
  if (leadership >= 50 && strength >= 60) {
    return GeneralType.GENERAL_WARRIOR;
  }
  
  // 통지 → 전략가
  if (leadership >= 50 && intel >= 60) {
    return GeneralType.TACTICIAN;
  }
  
  // 지정 → 학자
  if (intel >= 50 && politics >= 50) {
    return GeneralType.SCHOLAR;
  }
  
  // 지매 → 외교관
  if (intel >= 50 && charm >= 60) {
    return GeneralType.DIPLOMAT;
  }
  
  // 단일 능력치 특화
  const max = Math.max(leadership, strength, intel, politics, charm);
  if (strength === max && strength >= 60) return GeneralType.WARRIOR;
  if (intel === max && intel >= 60) return GeneralType.STRATEGIST;
  if (politics === max && politics >= 60) return GeneralType.ADMINISTRATOR;
  if (charm === max && charm >= 60) return GeneralType.CHARISMATIC;
  if (leadership === max) return GeneralType.COMMANDER;
  
  // 기본: 균형형
  return GeneralType.BALANCED;
}
```

### 타입별 행동 패턴

```typescript
private getTypeModifiers(type: GeneralType): Record<string, number> {
  const modifiers: Record<string, number> = {
    offensive: 1.0,      // 공격 명령
    defensive: 1.0,      // 방어 명령
    domestic: 1.0,       // 내정 명령
    diplomatic: 1.0,     // 외교 명령
    training: 1.0,       // 자기계발
  };
  
  switch (type) {
    case GeneralType.ALL_ROUNDER:
      // 모든 것을 균형있게
      modifiers.offensive = 1.2;
      modifiers.defensive = 1.2;
      modifiers.domestic = 1.2;
      break;
      
    case GeneralType.COMMANDER:
      // 용장: 군사와 내정 모두 잘함
      modifiers.offensive = 1.5;
      modifiers.defensive = 1.3;
      modifiers.domestic = 1.2;
      break;
      
    case GeneralType.WARRIOR:
      // 무인: 전투만
      modifiers.offensive = 2.0;
      modifiers.defensive = 0.8;
      modifiers.domestic = 0.3;
      break;
      
    case GeneralType.STRATEGIST:
      // 지장: 전략과 내정
      modifiers.offensive = 0.8;
      modifiers.defensive = 1.5;
      modifiers.domestic = 1.8;
      break;
      
    case GeneralType.ADMINISTRATOR:
      // 내정가: 내정만
      modifiers.offensive = 0.3;
      modifiers.defensive = 0.5;
      modifiers.domestic = 2.5;
      break;
      
    case GeneralType.SCHOLAR:
      // 학자: 기술연구, 상업
      modifiers.offensive = 0.5;
      modifiers.domestic = 2.0;
      modifiers.training = 1.5;
      break;
      
    case GeneralType.GENERAL_WARRIOR:
      // 맹장: 군사 지휘
      modifiers.offensive = 1.8;
      modifiers.defensive = 1.2;
      modifiers.domestic = 0.6;
      break;
      
    case GeneralType.TACTICIAN:
      // 전략가: 계략과 군사
      modifiers.offensive = 1.3;
      modifiers.defensive = 1.5;
      modifiers.domestic = 1.3;
      break;
      
    case GeneralType.DIPLOMAT:
      // 외교관: 외교와 거래
      modifiers.offensive = 0.5;
      modifiers.diplomatic = 2.5;
      modifiers.domestic = 1.2;
      break;
      
    case GeneralType.CHARISMATIC:
      // 카리스마: 주민, 등용
      modifiers.offensive = 0.7;
      modifiers.domestic = 1.5;
      modifiers.diplomatic = 1.8;
      break;
      
    default: // BALANCED
      // 균형형: 모두 1.0 유지
      break;
  }
  
  return modifiers;
}
```

### 타입별 우선 커맨드

```typescript
private getPreferredCommands(type: GeneralType): string[] {
  switch (type) {
    case GeneralType.ALL_ROUNDER:
      return ['징병', '훈련', '농지개간', '상업투자', '기술연구'];
      
    case GeneralType.COMMANDER:
      return ['징병', '훈련', '출병', '농지개간', '주민선정'];
      
    case GeneralType.WARRIOR:
      return ['출병', '훈련', '단련'];
      
    case GeneralType.STRATEGIST:
      return ['기술연구', '농지개간', '상업투자', '주민선정'];
      
    case GeneralType.ADMINISTRATOR:
      return ['농지개간', '상업투자', '주민선정', '정착장려', '치안강화'];
      
    case GeneralType.SCHOLAR:
      return ['기술연구', '상업투자', '단련', '견문'];
      
    case GeneralType.GENERAL_WARRIOR:
      return ['징병', '출병', '훈련', '수비강화'];
      
    case GeneralType.TACTICIAN:
      return ['출병', '기술연구', '징병', '훈련'];
      
    case GeneralType.DIPLOMAT:
      return ['불가침제의', '종전제의', '물자원조', '등용', '군량매매'];
      
    case GeneralType.CHARISMATIC:
      return ['주민선정', '정착장려', '등용', '포상'];
      
    default:
      return ['휴식'];
  }
}
```

## 구현 방법

1. **SimpleAI.ts 수정**:
   - `calculateGeneralType` → `calculateDetailedGeneralType`
   - 11가지 타입으로 세분화

2. **타입별 가중치 적용**:
   - `evaluateDomesticCommands` 등에서 `getTypeModifiers()` 적용

3. **우선 커맨드 시스템**:
   - 타입에 맞는 커맨드를 더 높은 가중치로 선택

4. **로그 추가**:
   - NPC가 왜 그 커맨드를 선택했는지 이유 출력

## 예시

```typescript
// 맹장 타입 NPC (관우, 장비 스타일)
const general = {
  leadership: 85,
  strength: 95,
  intel: 60,
  politics: 50,
  charm: 70
};

// 분류: GENERAL_WARRIOR (맹장)
// 우선 커맨드: 징병, 출병, 훈련, 수비강화
// 가중치: offensive 1.8배, defensive 1.2배, domestic 0.6배

// → 전투 관련 명령을 주로 선택, 내정은 거의 안 함
```

```typescript
// 학자 타입 NPC (제갈량 초기 스타일)
const general = {
  leadership: 60,
  strength: 40,
  intel: 95,
  politics: 90,
  charm: 75
};

// 분류: SCHOLAR (학자)
// 우선 커맨드: 기술연구, 상업투자, 단련, 견문
// 가중치: offensive 0.5배, domestic 2.0배, training 1.5배

// → 내정과 자기계발 위주, 전투는 피함
```
