# 시나리오 등록 및 수정 가이드

## 📖 개요

이 가이드는 새로운 게임 시나리오를 등록하거나 기존 시나리오를 수정하는 방법을 설명합니다.

## 🎮 시나리오란?

시나리오는 게임의 **세계관, 규칙, 콘텐츠를 정의**하는 설정 집합입니다.

- **삼국지**: 후한 말 중국, 장수/도시/국가, 농업/상업 경제
- **판타지**: 중세 마법 세계, 영웅/마을/왕국, 마법/퀘스트 시스템
- **SF**: 우주 시대, 커맨더/행성/세력, 연구/함대 전투

## 📁 파일 구조

```
src/scenarios/
├── sangokushi/          # 삼국지 시나리오
│   ├── scenario.ts      # 시나리오 정의
│   ├── systems/         # 게임 시스템
│   │   ├── economy.ts
│   │   ├── diplomacy.ts
│   │   └── warfare.ts
│   └── balance.ts       # 밸런스 상수
├── fantasy/             # 판타지 시나리오 (예시)
│   ├── scenario.ts
│   └── systems/
│       └── magic.ts
└── README.md
```

## 🚀 새 시나리오 등록하기

### 1단계: 폴더 생성

```bash
mkdir -p src/scenarios/my-scenario/systems
```

### 2단계: scenario.ts 작성

```typescript
// src/scenarios/my-scenario/scenario.ts
import { ScenarioRegistry } from '../../common/registry/scenario-registry';
import { ResourceRegistry } from '../../common/registry/resource-registry';
import { Role } from '../../common/@types/role.types';

// 자원 정의
ResourceRegistry.register('my-scenario', [
  {
    id: 'gold',
    kind: 'currency',
    label: { ko: '골드', en: 'Gold' },
    max: 999999999
  },
  {
    id: 'energy',
    kind: 'energy',
    label: { ko: '에너지', en: 'Energy' },
    max: 10000
  }
], [
  // 자원 변환 규칙
  { from: 'gold', to: 'energy', rate: 10 }
]);

// 시나리오 등록
ScenarioRegistry.register({
  id: 'my-scenario',
  name: '내 시나리오',
  description: '시나리오 설명',
  
  // 역할 매핑
  roles: {
    [Role.SETTLEMENT]: {
      collection: 'entities',  // 통합 컬렉션
      label: { ko: '거점', en: 'Base' }
    },
    [Role.COMMANDER]: {
      collection: 'entities',
      label: { ko: '사령관', en: 'Commander' }
    },
    [Role.FACTION]: {
      collection: 'entities',
      label: { ko: '진영', en: 'Faction' }
    }
  },
  
  // 관계 정의
  relations: {
    ASSIGNED_SETTLEMENT: {
      from: Role.COMMANDER,
      to: Role.SETTLEMENT,
      viaField: 'assignedSettlement'
    },
    MEMBER_OF: {
      from: Role.COMMANDER,
      to: Role.FACTION,
      viaField: 'faction'
    }
  },
  
  // 속성 정의
  attributes: {
    [Role.COMMANDER]: [
      {
        id: 'combat_power',
        label: { ko: '전투력', en: 'Combat Power' },
        type: 'number',
        min: 0,
        max: 100,
        default: 50,
        indexed: true
      },
      {
        id: 'intelligence',
        label: { ko: '지능', en: 'Intelligence' },
        type: 'number',
        min: 0,
        max: 100,
        default: 50
      }
    ],
    [Role.SETTLEMENT]: [
      {
        id: 'population',
        label: { ko: '인구', en: 'Population' },
        type: 'number',
        min: 0,
        indexed: true
      },
      {
        id: 'defense_rating',
        label: { ko: '방어도', en: 'Defense' },
        type: 'number',
        min: 0,
        max: 10000,
        default: 0
      }
    ]
  },
  
  // 슬롯 정의
  slots: {
    [Role.SETTLEMENT]: [
      {
        id: 'production_alpha',
        label: { ko: '생산 시설 A', en: 'Production A' },
        icon: '🏭',
        maxDefault: 10000,
        visible: true
      },
      {
        id: 'production_beta',
        label: { ko: '생산 시설 B', en: 'Production B' },
        icon: '⚙️',
        maxDefault: 10000,
        visible: true
      }
    ]
  },
  
  // 게임 시스템 (선택)
  systems: {
    // economy: MyEconomySystem,
    // combat: MyCombatSystem
  }
});
```

### 3단계: 시스템 구현 (선택)

```typescript
// src/scenarios/my-scenario/systems/magic.ts
import { GameSystem, GameSystemContext } from '../../../common/@types/game-system.types';

export const MagicSystem: GameSystem = {
  id: 'magic',
  scope: 'entity',
  
  initState: (ctx, owner) => ({
    mana: 100,
    spells: [],
    cooldowns: {}
  }),
  
  reducers: {
    CAST_SPELL: async (ctx, payload) => {
      const { spellId, targetRef } = payload;
      
      // 시전자 로드
      const caster = await ctx.loadEntity(ctx.actor!);
      const magicState = caster.systems.magic;
      
      // 마나 검증
      if (magicState.mana < 50) {
        throw new Error('마나가 부족합니다');
      }
      
      // 마나 소모
      magicState.mana -= 50;
      await ctx.saveEntity(caster, { 'systems.magic.mana': -50 });
      
      // 대상에게 효과
      const target = await ctx.loadEntity(targetRef);
      target.attributes.hp -= 100;
      await ctx.saveEntity(target, { 'attributes.hp': -100 });
      
      // 이벤트 발행
      await ctx.emit('SPELL_CAST', { spellId, caster: ctx.actor, target: targetRef });
    }
  },
  
  tick: async (ctx) => {
    // 매 틱마다 마나 재생
    // const entities = await loadAllWithSystem(ctx.scenario, 'magic');
    // for (const entity of entities) {
    //   entity.systems.magic.mana = Math.min(entity.systems.magic.mana + 1, 100);
    // }
  }
};
```

### 4단계: 시나리오 활성화

```typescript
// src/scenarios/index.ts
import './sangokushi/scenario';  // 삼국지
import './my-scenario/scenario';  // 내 시나리오

export * from './sangokushi/scenario';
export * from './my-scenario/scenario';
```

## 🔧 시나리오 수정하기

### 속성 추가

```typescript
// src/scenarios/my-scenario/scenario.ts

// 기존 attributes에 추가
attributes: {
  [Role.COMMANDER]: [
    // ... 기존 속성들
    {
      id: 'luck',  // 새 속성
      label: { ko: '행운', en: 'Luck' },
      type: 'number',
      min: 0,
      max: 100,
      default: 50
    }
  ]
}
```

### 자원 추가

```typescript
// ResourceRegistry에 추가
ResourceRegistry.register('my-scenario', [
  // ... 기존 자원들
  {
    id: 'crystal',  // 새 자원
    kind: 'rare',
    label: { ko: '크리스탈', en: 'Crystal' },
    max: 1000
  }
]);
```

### 새 시스템 추가

```typescript
// 1. 시스템 구현
// src/scenarios/my-scenario/systems/quest.ts
export const QuestSystem: GameSystem = {
  id: 'quest',
  scope: 'entity',
  
  initState: () => ({
    activeQuests: [],
    completedQuests: [],
    questPoints: 0
  }),
  
  reducers: {
    ACCEPT_QUEST: async (ctx, { questId }) => {
      // 퀘스트 수락 로직
    },
    COMPLETE_QUEST: async (ctx, { questId }) => {
      // 퀘스트 완료 로직
    }
  }
};

// 2. 시나리오에 등록
systems: {
  quest: QuestSystem  // 추가
}
```

## 📊 속성/슬롯 설계 가이드

### 속성 (Attributes)

**용도**: 능력치, 상태, 통계 등 **숫자 값**

**권장 사항**:
- 범위가 있는 값: min, max 지정
- 자주 검색하는 값: indexed: true
- UI 표시 필요: label 명확히

**예시**:
```typescript
{
  id: 'health_points',
  label: { ko: '체력', en: 'HP' },
  min: 0,
  max: 1000,
  default: 100,
  indexed: true,  // HP로 필터링 가능
  tags: ['combat', 'vital']
}
```

### 슬롯 (Slots)

**용도**: 생산 시설, 건물, 업그레이드 가능한 구조물

**권장 사항**:
- 최대값 관리 필요: maxDefault 지정
- 레벨 시스템: levelMax 지정
- UI 아이콘: icon 지정

**예시**:
```typescript
{
  id: 'farm',
  label: { ko: '농장', en: 'Farm' },
  icon: '🌾',
  maxDefault: 10000,
  levelMax: 10,
  visible: true
}
```

### 자원 (Resources)

**용도**: 소모/획득되는 재화

**권장 사항**:
- 종류 명확히: kind 지정
- 거래 제한: transferable: false
- 변환 규칙: ConversionRule 등록

**예시**:
```typescript
{
  id: 'mana',
  kind: 'energy',
  label: { ko: '마나', en: 'Mana' },
  max: 1000,
  transferable: false  // 거래 불가
}
```

## 🔌 시스템 플러그인 작성

### 기본 템플릿

```typescript
import { GameSystem, GameSystemContext } from '../../../common/@types/game-system.types';

export const MySystem: GameSystem = {
  id: 'my-system',
  scope: 'entity',  // 'entity' | 'faction' | 'scenario'
  
  // 초기 상태
  initState: (ctx, owner) => ({
    // 시스템 상태 정의
    points: 0,
    level: 1,
    unlocks: []
  }),
  
  // 틱 처리 (선택, 자동 실행)
  tick: async (ctx) => {
    // 매 틱/턴마다 실행되는 로직
    // 예: 자원 생산, 자동 회복 등
  },
  
  // 커맨드 처리
  reducers: {
    MY_COMMAND: async (ctx, payload) => {
      // 1. 엔티티 로드
      const entity = await ctx.loadEntity(ctx.actor!);
      
      // 2. 검증
      if (entity.systems['my-system'].points < payload.cost) {
        throw new Error('포인트 부족');
      }
      
      // 3. 상태 변경
      entity.systems['my-system'].points -= payload.cost;
      
      // 4. 저장
      await ctx.saveEntity(entity, {
        'systems.my-system.points': -payload.cost
      });
      
      // 5. 이벤트 발행
      await ctx.emit('MY_EVENT', { ... });
    }
  },
  
  // 셀렉터 (UI용 데이터 조회)
  selectors: {
    getStatus: async (ctx, owner) => {
      const entity = await ctx.loadEntity(owner);
      return {
        points: entity.systems['my-system'].points,
        level: entity.systems['my-system'].level
      };
    }
  }
};
```

## 🌍 시나리오 예시

### 판타지 시나리오

```typescript
// src/scenarios/fantasy/scenario.ts
import { MagicSystem } from './systems/magic';
import { QuestSystem } from './systems/quest';

ResourceRegistry.register('fantasy', [
  { id: 'gold', kind: 'currency', label: { ko: '골드' }, max: 999999 },
  { id: 'mana', kind: 'energy', label: { ko: '마나' }, max: 1000 },
  { id: 'crystal', kind: 'rare', label: { ko: '크리스탈' }, max: 100 }
]);

ScenarioRegistry.register({
  id: 'fantasy',
  name: '판타지 세계',
  
  roles: {
    [Role.COMMANDER]: {
      collection: 'entities',
      label: { ko: '영웅', en: 'Hero' }
    },
    [Role.SETTLEMENT]: {
      collection: 'entities',
      label: { ko: '마을', en: 'Village' }
    }
  },
  
  attributes: {
    [Role.COMMANDER]: [
      { id: 'strength', label: { ko: '힘' }, min: 0, max: 100 },
      { id: 'magic_power', label: { ko: '마력' }, min: 0, max: 100 },
      { id: 'hp', label: { ko: '체력' }, min: 0, max: 1000 }
    ]
  },
  
  slots: {
    [Role.SETTLEMENT]: [
      { id: 'mage_tower', label: { ko: '마법탑' }, icon: '🔮', maxDefault: 5 },
      { id: 'barracks', label: { ko: '병영' }, icon: '⚔️', maxDefault: 10 }
    ]
  },
  
  systems: {
    magic: MagicSystem,
    quest: QuestSystem
  }
});
```

### SF 시나리오

```typescript
// src/scenarios/sf/scenario.ts
ResourceRegistry.register('sf', [
  { id: 'credits', kind: 'currency', label: { ko: '크레딧' }, max: 999999 },
  { id: 'minerals', kind: 'consumable', label: { ko: '광물' }, max: 999999 },
  { id: 'gas', kind: 'consumable', label: { ko: '가스' }, max: 999999 },
  { id: 'energy', kind: 'energy', label: { ko: '에너지' }, max: 10000 }
]);

ScenarioRegistry.register({
  id: 'sf',
  name: 'Space Force',
  
  roles: {
    [Role.SETTLEMENT]: {
      collection: 'entities',
      label: { ko: '행성', en: 'Planet' }
    },
    [Role.COMMANDER]: {
      collection: 'entities',
      label: { ko: '커맨더', en: 'Commander' }
    },
    [Role.FORCE]: {
      collection: 'entities',
      label: { ko: '함대', en: 'Fleet' }
    }
  },
  
  attributes: {
    [Role.COMMANDER]: [
      { id: 'command_rating', label: { ko: '지휘 등급' }, min: 0, max: 100 },
      { id: 'tactical_skill', label: { ko: '전술 능력' }, min: 0, max: 100 }
    ],
    [Role.SETTLEMENT]: [
      { id: 'population', label: { ko: '인구' }, min: 0 },
      { id: 'orbital_defense', label: { ko: '궤도 방어' }, min: 0, max: 100 }
    ]
  },
  
  slots: {
    [Role.SETTLEMENT]: [
      { id: 'mineral_extractor', label: { ko: '광물 추출기' }, icon: '⛏️' },
      { id: 'gas_refinery', label: { ko: '가스 정제소' }, icon: '🏭' },
      { id: 'power_plant', label: { ko: '발전소' }, icon: '⚡' }
    ]
  },
  
  systems: {
    research: ResearchSystem,
    fleet: FleetSystem
  }
});
```

## 🎯 API 사용법

### 엔티티 조회

```http
# 모든 영웅 조회 (판타지)
GET /api/entities/COMMANDER?scenario=fantasy

# 특정 행성 조회 (SF)
GET /api/entities/SETTLEMENT/planet_001?scenario=sf

# 속성으로 필터링
GET /api/entities/COMMANDER?scenario=fantasy&attributes.magic_power>80
```

### 엔티티 수정

```http
# 속성 업데이트
PATCH /api/entities/COMMANDER/hero_001/attributes
{
  "magic_power": 95,
  "hp": 500
}

# 자원 업데이트
PATCH /api/entities/COMMANDER/hero_001/resources
{
  "gold": 5000,
  "mana": 1000
}

# 슬롯 업데이트
PATCH /api/entities/SETTLEMENT/village_001/slots
{
  "mage_tower": { "value": 5, "max": 5, "level": 1 }
}
```

### 시스템 커맨드 실행

```http
# 마법 시전 (판타지)
POST /api/entities/COMMANDER/hero_001/systems/magic/commands/CAST_SPELL
{
  "spellId": "fireball",
  "targetRef": { "role": "COMMANDER", "id": "enemy_001", "scenario": "fantasy" }
}

# 연구 시작 (SF)
POST /api/entities/FACTION/faction_001/systems/research/commands/START_RESEARCH
{
  "techId": "warp_drive"
}
```

## 📝 체크리스트

새 시나리오 등록 시 확인:

- [ ] 폴더 구조 생성 (`src/scenarios/[시나리오명]/`)
- [ ] 자원 정의 (ResourceRegistry.register)
- [ ] 역할 매핑 (roles)
- [ ] 관계 정의 (relations)
- [ ] 속성 정의 (attributes) - 역할별
- [ ] 슬롯 정의 (slots) - 역할별
- [ ] 시스템 구현 (systems) - 선택
- [ ] ScenarioRegistry.register() 호출
- [ ] src/scenarios/index.ts에 import 추가
- [ ] 테스트 (API 호출, 엔티티 생성)

## 🐛 문제 해결

### "속성을 찾을 수 없습니다"

→ ScenarioRegistry의 attributes에 해당 속성이 정의되어 있는지 확인

### "시스템을 찾을 수 없습니다"

→ systems에 시스템이 등록되어 있는지 확인

### "자원이 부족합니다"

→ ResourceRegistry에 자원이 정의되어 있는지 확인

## 📚 참고 자료

- **삼국지 시나리오**: `src/scenarios/sangokushi/scenario.ts`
- **Entity 타입**: `src/common/@types/entity.types.ts`
- **GameSystem 인터페이스**: `src/common/@types/game-system.types.ts`
- **API 문서**: `API_ROUTES.md`

## 🎉 완료!

시나리오를 등록한 후:
1. 서버 재시작
2. `GET /v2/meta/scenarios`로 등록 확인
3. `GET /api/entities/COMMANDER?scenario=my-scenario`로 테스트
4. 웹소켓 이벤트 구독하여 실시간 업데이트 확인
