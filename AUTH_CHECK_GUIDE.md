# 권한 체크 유틸리티 가이드

## 📍 위치
```
src/common/utils/auth-check.util.ts
```

## 🎯 목적
게임 내에서 장수의 권한, 소속, 상태 등을 확인하는 유틸리티 함수 모음

---

## 📦 함수 목록

### 1️⃣ 직책/직위 확인

#### `isChief(general)`
장수가 군주(수뇌)인지 확인
```typescript
import { isChief } from '@/common/utils';

if (isChief(general)) {
  console.log(`${general.name}은(는) 군주입니다.`);
}
```

#### `isPrimeMinister(general)`
장수가 승상(재상)인지 확인
```typescript
if (isPrimeMinister(general)) {
  console.log(`${general.name}은(는) 승상입니다.`);
}
```

#### `hasOfficerLevel(general, minLevel)`
장수가 특정 직책 레벨 이상인지 확인
```typescript
// 레벨 1 이상(군주 이상)인지 확인
if (hasOfficerLevel(general, 1)) {
  console.log('고위 직책입니다.');
}
```

---

### 2️⃣ 국가 소속 확인

#### `hasNation(general)`
장수가 국가에 소속되어 있는지 확인
```typescript
if (hasNation(general)) {
  console.log('국가에 소속되어 있습니다.');
}
```

#### `isRonin(general)`
장수가 야인(무소속)인지 확인
```typescript
if (isRonin(general)) {
  console.log('야인입니다.');
}
```

#### `belongsToNation(general, nationId)`
장수가 특정 국가에 소속되어 있는지 확인
```typescript
const weiNationId = 'wei_nation_id';
if (belongsToNation(general, weiNationId)) {
  console.log('위나라 소속입니다.');
}
```

#### `isChiefOfNation(general, nationId)`
장수가 특정 국가의 군주인지 확인
```typescript
if (isChiefOfNation(general, nationId)) {
  console.log(`${general.name}은(는) 이 나라의 군주입니다.`);
}
```

#### `isSameNation(generalA, generalB)`
두 장수가 같은 국가에 소속되어 있는지 확인
```typescript
if (isSameNation(generalA, generalB)) {
  console.log('같은 국가 소속입니다.');
}
```

---

### 3️⃣ NPC/플레이어 확인

#### `isNPC(general)`
장수가 NPC인지 확인
```typescript
if (isNPC(general)) {
  console.log('NPC 장수입니다.');
}
```

#### `isPlayer(general)`
장수가 플레이어(유저)인지 확인
```typescript
if (isPlayer(general)) {
  console.log('유저 장수입니다.');
}
```

#### `isOwnedBy(general, userId)`
장수가 특정 유저의 소유인지 확인
```typescript
if (isOwnedBy(general, req.user.id)) {
  console.log('당신의 장수입니다.');
}
```

---

### 4️⃣ 도시/부대 확인

#### `hasCity(general)`
장수가 도시를 소유하고 있는지 확인
```typescript
if (hasCity(general)) {
  console.log('도시를 소유하고 있습니다.');
}
```

#### `isInCity(general, cityId)`
장수가 특정 도시에 있는지 확인
```typescript
if (isInCity(general, 'luoyang_id')) {
  console.log('낙양에 있습니다.');
}
```

#### `isSameCity(generalA, generalB)`
두 장수가 같은 도시에 있는지 확인
```typescript
if (isSameCity(generalA, generalB)) {
  console.log('같은 도시에 있습니다.');
}
```

#### `isInTroop(general)`
장수가 부대에 소속되어 있는지 확인
```typescript
if (isInTroop(general)) {
  console.log('부대에 소속되어 있습니다.');
}
```

---

### 5️⃣ 권한 확인

#### `hasPermission(general, permission)`
장수가 특정 권한을 가지고 있는지 확인
```typescript
if (hasPermission(general, 'auditor')) {
  console.log('감찰관 권한이 있습니다.');
}
```

#### `isAuditor(general)`
장수가 감찰관 권한을 가지고 있는지 확인
```typescript
if (isAuditor(general)) {
  console.log('감찰관입니다.');
}
```

#### `isAmbassador(general)`
장수가 외교관 권한을 가지고 있는지 확인
```typescript
if (isAmbassador(general)) {
  console.log('외교관입니다.');
}
```

---

### 6️⃣ 상태 확인

#### `hasNormalBelong(general)`
장수가 정상적으로 소속되어 있는지 확인 (배신자가 아닌지)
```typescript
if (!hasNormalBelong(general)) {
  console.log('비정상 소속 상태입니다.');
}
```

#### `isBetrayedRecently(general)`
장수가 배신자인지 확인
```typescript
if (isBetrayedRecently(general)) {
  console.log('배신 이력이 있습니다.');
}
```

#### `isBlocked(general)`
장수가 블록 상태인지 확인
```typescript
if (isBlocked(general)) {
  throw new Error('차단된 장수입니다.');
}
```

#### `isAlive(general)`
장수가 살아있는지 확인
```typescript
if (!isAlive(general)) {
  throw new Error('사망한 장수입니다.');
}
```

---

### 7️⃣ 세션 확인

#### `belongsToSession(general, sessionId)`
장수가 특정 세션에 속하는지 확인
```typescript
if (belongsToSession(general, sessionId)) {
  console.log('현재 세션의 장수입니다.');
}
```

#### `nationBelongsToSession(nation, sessionId)`
국가가 특정 세션에 속하는지 확인
```typescript
if (nationBelongsToSession(nation, sessionId)) {
  console.log('현재 세션의 국가입니다.');
}
```

---

### 8️⃣ 국가 상태 확인

#### `isNeutralNation(nation)`
국가가 중립 국가인지 확인
```typescript
if (isNeutralNation(nation)) {
  console.log('중립 국가입니다.');
}
```

#### `isDestroyedNation(nation)`
국가가 멸망했는지 확인 (장수가 0명)
```typescript
if (isDestroyedNation(nation)) {
  console.log('멸망한 국가입니다.');
}
```

#### `isAtWar(nation)`
국가가 전쟁 상태인지 확인
```typescript
if (isAtWar(nation)) {
  console.log('전쟁 중입니다.');
}
```

---

## 🎮 실전 예시

### 예시 1: 명령 실행 권한 체크
```typescript
import { isOwnedBy, isAlive, isBlocked, hasNation } from '@/common/utils';

async function executeCommand(general: IGeneral, userId: string) {
  // 1. 자기 장수인지 확인
  if (!isOwnedBy(general, userId)) {
    throw new Error('자신의 장수가 아닙니다.');
  }
  
  // 2. 살아있는지 확인
  if (!isAlive(general)) {
    throw new Error('사망한 장수입니다.');
  }
  
  // 3. 블록되지 않았는지 확인
  if (isBlocked(general)) {
    throw new Error('차단된 장수입니다.');
  }
  
  // 4. 국가에 소속되어 있는지 확인
  if (!hasNation(general)) {
    throw new Error('국가에 소속되어야 합니다.');
  }
  
  // 명령 실행
  console.log('명령 실행 가능!');
}
```

### 예시 2: 외교 권한 체크
```typescript
import { isChief, isAmbassador, belongsToNation } from '@/common/utils';

async function canDiplomacy(general: IGeneral, targetNationId: string) {
  // 자기 국가가 아니어야 함
  if (belongsToNation(general, targetNationId)) {
    throw new Error('자국과는 외교할 수 없습니다.');
  }
  
  // 군주 또는 외교관이어야 함
  if (!isChief(general) && !isAmbassador(general)) {
    throw new Error('외교 권한이 없습니다.');
  }
  
  return true;
}
```

### 예시 3: 군주 전용 명령 체크
```typescript
import { isChiefOfNation, hasNation } from '@/common/utils';

async function executeChiefCommand(general: IGeneral) {
  if (!hasNation(general)) {
    throw new Error('국가에 소속되어야 합니다.');
  }
  
  if (!isChiefOfNation(general, general.nation!)) {
    throw new Error('군주만 실행할 수 있는 명령입니다.');
  }
  
  console.log('군주 명령 실행!');
}
```

### 예시 4: 같은 국가 장수끼리만 가능한 행동
```typescript
import { isSameNation, isNPC } from '@/common/utils';

async function transferItem(from: IGeneral, to: IGeneral) {
  // 같은 국가여야 함
  if (!isSameNation(from, to)) {
    throw new Error('같은 국가 장수에게만 아이템을 줄 수 있습니다.');
  }
  
  // NPC에게는 줄 수 없음
  if (isNPC(to)) {
    throw new Error('NPC에게 아이템을 줄 수 없습니다.');
  }
  
  console.log('아이템 전송 가능!');
}
```

---

## 📝 미들웨어 활용 예시

```typescript
import { Request, Response, NextFunction } from 'express';
import { isOwnedBy, isAlive, isBlocked } from '@/common/utils';
import { GeneralRepository } from '@/api/general/repository/general.repository';

export const requireOwnGeneral = (repo: GeneralRepository) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const generalId = req.params.generalId;
    const userId = req.user.id; // 인증 미들웨어에서 설정됨
    
    const general = await repo.findById(generalId);
    
    if (!general) {
      return res.status(404).json({ error: '장수를 찾을 수 없습니다.' });
    }
    
    if (!isOwnedBy(general, userId)) {
      return res.status(403).json({ error: '자신의 장수가 아닙니다.' });
    }
    
    if (!isAlive(general)) {
      return res.status(400).json({ error: '사망한 장수입니다.' });
    }
    
    if (isBlocked(general)) {
      return res.status(403).json({ error: '차단된 장수입니다.' });
    }
    
    // req에 장수 정보 추가
    req.general = general;
    next();
  };
};
```

---

## 🚀 장점

1. **타입 안정성**: TypeScript로 작성되어 타입 체크 지원
2. **재사용성**: 여러 도메인에서 공통으로 사용 가능
3. **가독성**: 함수명만으로 의도 파악 가능
4. **유지보수성**: 권한 로직이 한 곳에 집중
5. **테스트 용이**: 순수 함수로 작성되어 테스트 간편

---

## 🔧 확장 방법

새로운 권한 체크 함수가 필요하면 `auth-check.util.ts`에 추가:

```typescript
/**
 * 장수가 특정 레벨 이상인지 확인
 */
export function hasExpLevel(general: IGeneral, minLevel: number): boolean {
  return general.expLevel >= minLevel;
}
```

---

## 📚 관련 파일

- `src/common/utils/auth-check.util.ts` - 유틸리티 함수
- `src/api/general/@types/general.types.ts` - General 타입
- `src/api/nation/@types/nation.types.ts` - Nation 타입
