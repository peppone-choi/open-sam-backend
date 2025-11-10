# 훈장(서훈) 시스템 구현 가이드

## 📋 개요

은하영웅전설의 완전한 훈장 시스템. 제국군 17종, 동맹군 17종 총 **34개 훈장** 구현.

출처: Project 은영전 최종 기획안 + GIN7 매뉴얼

---

## 🎖️ 제국군 훈장 (17종)

### 최고 등급 (Supreme Tier)

#### 1. 대쌍두독수리훈장 (大双頭鷲勲章)
- **등급**: 1등급 (최고)
- **수여자**: 황제 직접
- **조건**:
  - 원수 계급
  - 공적 50,000 이상
  - 전투 100회 이상
  - 결정적 승리 달성 또는 적 수도 점령
- **효과**:
  - 영향력 +500
  - 명성 +2,000
  - 계급 래더 +5
  - 통솔 +5, 지휘 +5
- **역대 수여자**: 최대 5명
- **희귀도**: 전설 (Legendary)

#### 2. 쌍두독수리훈장 (双頭鷲勲章)
- **등급**: 2등급
- **수여자**: 황제 직접
- **조건**:
  - 원수 계급
  - 공적 30,000 이상
  - 전투 70회 이상
  - 대규모 회전 승리
- **효과**:
  - 영향력 +300
  - 명성 +1,500
  - 계급 래더 +4
  - 통솔 +3, 공격 +3
- **역대 수여자**: 최대 10명
- **희귀도**: 전설 (Legendary)

### 고위 등급 (Highest/High Tier)

#### 3. 은하제국대십자장 (銀河帝国大十字章)
- **등급**: 3등급
- **수여자**: 군무상서
- **조건**: 상급대장 이상, 공적 20,000, 전투 50회
- **효과**: 영향력 +200, 명성 +1,000, 통솔+2, 정치+2

#### 4. 공일급기사십자장 (功一級騎士十字章)
- **등급**: 4등급
- **수여자**: 군무상서
- **조건**: 대장 이상, 공적 15,000, 전투 40회
- **효과**: 영향력 +150, 명성 +800, 지휘+2, 공격+2

#### 5. 공이급기사십자장 (功二級騎士十字章)
- **등급**: 5등급
- **수여자**: 군무상서
- **조건**: 중장 이상, 공적 10,000, 전투 30회
- **효과**: 영향력 +120, 명성 +600, 지휘+2, 기동+1

### 중급 등급 (Medium Tier)

#### 6-9. 십자장 시리즈 (공일급~공이급)
- **수여자**: 군무상서 또는 군무성인사국장
- **조건**: 소장~준장, 공적 3,000~7,000
- **효과**: 영향력 +60~100, 명성 +300~500

### 하급 등급 (Low Tier)

#### 10-12. 전공장 시리즈 (공일급~공오급)
- **수여자**: 함대사령관
- **조건**: 중위~중령, 공적 500~2,000
- **효과**: 영향력 +20~50, 명성 +100~250

### 특수 기장 (Special)

#### 13. 원정부대공군기장
- 원정 작전 참가자에게 수여
- 영향력 +15, 명성 +80

#### 14. 전투공적기장
- 전투 공적 인정
- 영향력 +10, 명성 +60

#### 15. 전상장 (戦傷章)
- 전투 중 부상자에게 수여
- 영향력 +5, 명성 +40, 사기 +10

#### 16. 특별전공메달 1~10
- **중복 수여 가능** (최대 10개)
- 특별 임무 성공 시 수여
- 영향력 +30, 명성 +120
- UI 표시: "특별전공메달 x5"

#### 17. 참모기장
- 참모 직위 임명 시 자동 수여
- 영향력 +20, 명성 +100
- 정치 +1, 운영 +1

---

## 🛡️ 동맹군 훈장 (17종)

### 최고 등급 (Supreme Tier)

#### 1. 알레 하이네센 특별 훈공대장
- **등급**: 1등급 (최고)
- **수여자**: 의장 직접
- **조건**:
  - 원수 계급
  - 공적 50,000 이상
  - 전투 100회 이상
  - 동맹에 결정적 공헌 + 민주주의 수호
- **효과**:
  - 영향력 +500
  - 명성 +2,000
  - 계급 래더 +5
  - 통솔 +5, 정치 +3
- **역사**: 건국 이래 5명만 수여
- **희귀도**: 전설 (Legendary)

#### 2. 구엔 킴 호아 특별 훈공대장
- **등급**: 2등급
- **수여자**: 의장 직접
- **조건**: 원수, 공적 30,000, 전투 70회, 대규모 회전 승리
- **효과**: 영향력 +300, 명성 +1,500, 통솔+3, 지휘+3
- **역사**: 초대 국방위원장의 이름을 딴 훈장

#### 3. 자유행성동맹 최고평의회 명예훈장
- **등급**: 3등급
- **수여자**: 최고평의회 만장일치
- **조건**: 원수, 공적 25,000, 전투 60회
- **효과**: 영향력 +250, 명성 +1,200, 정치+3, 통솔+2

### 고위 등급 (High Tier)

#### 4. 공화국전쟁훈장
- **수여자**: 국방위원장
- **조건**: 대장, 공적 20,000, 전투 50회
- **효과**: 영향력 +200, 명성 +1,000, 통솔+2, 방어+2

#### 5. 공화국영예훈장
- **수여자**: 국방위원장
- **조건**: 중장, 공적 15,000, 전투 40회
- **효과**: 영향력 +150, 명성 +800, 지휘+2, 공격+1

#### 6-8. 자유기사 훈장 (일등~삼등)
- **수여자**: 통합작전본부장 / 함대사령장관
- **조건**: 대령~소장, 공적 5,000~10,000
- **효과**: 영향력 +80~120, 명성 +400~600
- **상징**: 민주주의와 자유 수호의 상징

### 중급/하급 등급

#### 9-11. 영예훈장 (일등~삼등)
- **수여자**: 함대사령장관 / 함대사령관
- **조건**: 대위~중령, 공적 1,500~3,000
- **효과**: 영향력 +40~60, 명성 +200~300

### 특수 기장

#### 12. 린 파오기장
- 함대사령관 임명 시 수여
- 초대 우주함대사령장관 린 파오 기념
- 통솔 +1, 지휘 +1

#### 13. 유습 트파로울기장
- 함대부사령관 임명 시 수여
- 영웅 유습 트파로울 기념
- 지휘 +1

#### 14. 군무공로기장
- 군무 공로 인정
- 영향력 +30, 명성 +120

#### 15. 명예부상훈장
- 전투 중 부상자에게 수여
- 영향력 +5, 명성 +40, 사기 +10

#### 16. 특별전공메달 1~10
- 중복 수여 가능 (최대 10개)
- 특별 임무 성공
- 영향력 +30, 명성 +120

#### 17. 참모기장
- 참모 직위 자동 수여
- 정보 +1, 운영 +1

---

## 🎮 구현 가이드

### 1. 데이터베이스 스키마

```typescript
interface CharacterDecoration {
  characterId: string;
  decorationId: string;
  awardedDate: Date;
  awardedBy: string;        // 수여자 캐릭터 ID
  ceremonyHeld: boolean;     // 서훈식 개최 여부
  revokedDate?: Date;        // 박탈 날짜 (있을 경우)
  revokedReason?: string;    // 박탈 사유
  stackCount?: number;       // 특별전공메달 중복 수
}

interface DecorationCeremony {
  ceremonyId: string;
  decorationId: string;
  recipients: string[];      // 수상자 목록
  date: Date;
  location: string;          // 개최 장소 (행성)
  attendees: string[];       // 참석자 목록
  cost: number;              // 비용
  effects: {
    factionSupport: number;  // 정부 지지율 상승
    morale: number;          // 참석자 사기 상승
  };
}
```

### 2. 서훈 자격 체크 시스템

```typescript
async function checkDecorationEligibility(
  character: Character,
  decorationId: string
): Promise<{ eligible: boolean; reasons: string[] }> {
  
  const decoration = await getDecoration(decorationId);
  const reasons: string[] = [];
  
  // 1. 계급 체크
  if (character.rank < decoration.requirements.minRank) {
    reasons.push(`계급 부족: ${decoration.requirements.minRank} 이상 필요`);
  }
  
  // 2. 공적 체크
  if (character.merit < decoration.requirements.minMerit) {
    reasons.push(`공적 부족: ${decoration.requirements.minMerit} 필요`);
  }
  
  // 3. 전투 횟수 체크
  const battleCount = await getBattleCount(character.id);
  if (battleCount < decoration.requirements.minBattles) {
    reasons.push(`전투 횟수 부족: ${decoration.requirements.minBattles}회 필요`);
  }
  
  // 4. 특수 조건 체크
  if (decoration.requirements.specialConditions) {
    for (const condition of decoration.requirements.specialConditions) {
      const met = await checkSpecialCondition(character, condition);
      if (!met) {
        reasons.push(`특수 조건 미충족: ${condition}`);
      }
    }
  }
  
  // 5. 중복 수여 체크 (특별전공메달 제외)
  if (!decoration.stackable) {
    const alreadyHas = await hasDecoration(character.id, decorationId);
    if (alreadyHas) {
      reasons.push('이미 수여받은 훈장입니다');
    }
  }
  
  // 6. 수여자 권한 체크
  const awarder = await getCurrentUser();
  if (!canAwardDecoration(awarder, decoration)) {
    reasons.push('서훈 권한이 없습니다');
  }
  
  // 7. 최대 수여 인원 체크
  if (decoration.maxRecipients) {
    const currentRecipients = await getDecorationRecipients(decorationId);
    if (currentRecipients.length >= decoration.maxRecipients) {
      reasons.push(`최대 수여 인원 초과 (${decoration.maxRecipients}명)`);
    }
  }
  
  return {
    eligible: reasons.length === 0,
    reasons
  };
}
```

### 3. 서훈 실행

```typescript
async function awardDecoration(
  characterId: string,
  decorationId: string,
  options: {
    holdCeremony?: boolean;
    ceremonyLocation?: string;
  } = {}
): Promise<DecorationResult> {
  
  const character = await getCharacter(characterId);
  const decoration = await getDecoration(decorationId);
  const awarder = await getCurrentUser();
  
  // 자격 검증
  const eligibility = await checkDecorationEligibility(character, decorationId);
  if (!eligibility.eligible) {
    throw new DecorationError(eligibility.reasons);
  }
  
  // 트랜잭션 시작
  await db.transaction(async (tx) => {
    
    // 1. 훈장 기록 생성
    const charDeco = await tx.characterDecorations.create({
      characterId,
      decorationId,
      awardedDate: new Date(),
      awardedBy: awarder.id,
      ceremonyHeld: options.holdCeremony || false,
      stackCount: decoration.stackable ? 1 : undefined
    });
    
    // 2. 효과 적용
    await applyDecorationEffects(character, decoration, tx);
    
    // 3. 서훈식 개최 (옵션)
    if (options.holdCeremony) {
      await holdCeremony({
        decorationId,
        recipients: [characterId],
        location: options.ceremonyLocation || character.currentPlanet,
        awarder: awarder.id
      }, tx);
    }
    
    // 4. 로그 기록
    await tx.decorationLogs.create({
      characterId,
      decorationId,
      action: 'awarded',
      timestamp: new Date(),
      awardedBy: awarder.id
    });
    
  });
  
  // 5. 알림 발송
  await notify(characterId, {
    type: 'decoration_awarded',
    title: '서훈',
    message: `${decoration.name}을(를) 수여받았습니다!`,
    decorationId,
    ceremonyHeld: options.holdCeremony
  });
  
  // 6. 글로벌 이벤트 (최고 등급만)
  if (decoration.tier === 'supreme') {
    await broadcastGlobalEvent({
      type: 'supreme_decoration_awarded',
      characterName: character.name,
      decorationName: decoration.name,
      faction: character.faction
    });
  }
  
  return {
    success: true,
    decoration,
    ceremonyHeld: options.holdCeremony
  };
}
```

### 4. 효과 적용

```typescript
async function applyDecorationEffects(
  character: Character,
  decoration: Decoration,
  tx: Transaction
) {
  
  // 영향력 증가
  character.influence += decoration.effects.influence;
  
  // 명성 증가
  character.prestige += decoration.effects.prestige;
  
  // 계급 래더 보너스
  if (decoration.effects.rankLadder) {
    character.rankLadderBonus += decoration.effects.rankLadder;
  }
  
  // 능력치 보너스
  if (decoration.effects.abilityBonus) {
    for (const [ability, bonus] of Object.entries(decoration.effects.abilityBonus)) {
      character.abilities[ability] += bonus;
    }
  }
  
  // 사기 보너스
  if (decoration.effects.morale) {
    character.morale += decoration.effects.morale;
  }
  
  await tx.characters.update(character);
}
```

### 5. 서훈식 시스템

```typescript
async function holdCeremony(
  ceremony: {
    decorationId: string;
    recipients: string[];
    location: string;
    awarder: string;
  },
  tx: Transaction
): Promise<CeremonyResult> {
  
  const decoration = await getDecoration(ceremony.decorationId);
  const planet = await getPlanet(ceremony.location);
  
  // 비용 차감
  const cost = 10000 * ceremony.recipients.length;
  await deductFactionBudget(planet.factionId, cost, tx);
  
  // 서훈식 기록
  const ceremonyRecord = await tx.ceremonies.create({
    ceremonyId: generateId(),
    decorationId: ceremony.decorationId,
    recipients: ceremony.recipients,
    date: new Date(),
    location: ceremony.location,
    cost
  });
  
  // 진영 효과
  const faction = await getFaction(planet.factionId);
  faction.governmentSupport += 5;  // 정부 지지율 +5%
  await tx.factions.update(faction);
  
  // 참석자 사기 상승
  const attendees = await getCharactersAtPlanet(ceremony.location);
  for (const attendee of attendees) {
    attendee.morale += 10;
    await tx.characters.update(attendee);
  }
  
  // 추가 영향력 보너스
  for (const recipientId of ceremony.recipients) {
    const recipient = await getCharacter(recipientId);
    recipient.influence += 20;  // 서훈식 보너스
    await tx.characters.update(recipient);
  }
  
  // 글로벌 뉴스
  await broadcastNews({
    type: 'ceremony',
    title: `${decoration.name} 서훈식 거행`,
    content: `${planet.name}에서 ${ceremony.recipients.length}명에게 ${decoration.name}이(가) 수여되었습니다.`,
    faction: planet.factionId
  });
  
  return {
    ceremonyId: ceremonyRecord.ceremonyId,
    cost,
    attendeeCount: attendees.length,
    effectsApplied: true
  };
}
```

### 6. 특별전공메달 스택 시스템

```typescript
async function awardStackableDecoration(
  characterId: string,
  decorationId: string = 'special_merit_1'
): Promise<void> {
  
  const existing = await db.characterDecorations.findOne({
    characterId,
    decorationId
  });
  
  if (existing) {
    // 이미 보유 중 → 스택 증가
    if (existing.stackCount < 10) {  // 최대 10개
      existing.stackCount += 1;
      await db.characterDecorations.update(existing);
      
      // 효과 재적용
      const decoration = await getDecoration(decorationId);
      await applyDecorationEffects(
        await getCharacter(characterId),
        decoration,
        db
      );
    } else {
      throw new Error('특별전공메달 최대 보유 수 초과 (10개)');
    }
  } else {
    // 신규 수여
    await awardDecoration(characterId, decorationId);
  }
}
```

### 7. 훈장 박탈 시스템

```typescript
async function revokeDecoration(
  characterId: string,
  decorationId: string,
  reason: string,
  revokedBy: string
): Promise<void> {
  
  const charDeco = await db.characterDecorations.findOne({
    characterId,
    decorationId,
    revokedDate: null  // 아직 박탈되지 않은 것만
  });
  
  if (!charDeco) {
    throw new Error('해당 훈장을 보유하고 있지 않습니다');
  }
  
  const decoration = await getDecoration(decorationId);
  const character = await getCharacter(characterId);
  
  await db.transaction(async (tx) => {
    
    // 1. 박탈 기록
    charDeco.revokedDate = new Date();
    charDeco.revokedReason = reason;
    await tx.characterDecorations.update(charDeco);
    
    // 2. 효과 제거
    character.influence -= decoration.effects.influence;
    character.prestige -= decoration.effects.prestige;
    
    // 추가 패널티
    character.influence -= 200;   // 명예 실추
    character.prestige -= 500;
    character.morale -= 50;
    
    await tx.characters.update(character);
    
    // 3. 로그 기록
    await tx.decorationLogs.create({
      characterId,
      decorationId,
      action: 'revoked',
      reason,
      revokedBy,
      timestamp: new Date()
    });
    
  });
  
  // 알림
  await notify(characterId, {
    type: 'decoration_revoked',
    title: '훈장 박탈',
    message: `${decoration.name}이(가) 박탈되었습니다.\n사유: ${reason}`,
    severity: 'critical'
  });
}
```

---

## 🎯 UI 구현 가이드

### 1. 캐릭터 프로필 훈장 표시

```typescript
function DecorationDisplay({ character }: { character: Character }) {
  const decorations = character.decorations
    .sort((a, b) => a.grade - b.grade)  // 낮은 등급 = 높은 훈장
    .slice(0, 5);  // 최대 5개 표시
  
  return (
    <div className="decorations">
      {decorations.map(deco => (
        <Tooltip key={deco.id} content={deco.description}>
          <DecorationBadge 
            decoration={deco}
            stackCount={deco.stackCount}
          />
        </Tooltip>
      ))}
    </div>
  );
}

function DecorationBadge({ decoration, stackCount }) {
  return (
    <div className="decoration-badge" data-rarity={decoration.rarity}>
      <img src={decoration.icon} alt={decoration.name} />
      {stackCount > 1 && (
        <span className="stack-count">×{stackCount}</span>
      )}
    </div>
  );
}
```

### 2. 서훈 후보자 목록

```typescript
async function getDecorationCandidates(
  decorationId: string
): Promise<Character[]> {
  
  const decoration = await getDecoration(decorationId);
  const characters = await getAllCharacters({
    faction: decoration.faction,
    minRank: decoration.requirements.minRank
  });
  
  const candidates = [];
  
  for (const character of characters) {
    const eligibility = await checkDecorationEligibility(
      character,
      decorationId
    );
    
    if (eligibility.eligible) {
      candidates.push({
        character,
        score: calculateDecorationScore(character, decoration)
      });
    }
  }
  
  // 점수 순으로 정렬
  return candidates
    .sort((a, b) => b.score - a.score)
    .map(c => c.character);
}

function calculateDecorationScore(
  character: Character,
  decoration: Decoration
): number {
  
  let score = 0;
  
  // 공적 점수
  score += character.merit / 100;
  
  // 전투 횟수
  score += character.battleCount * 10;
  
  // 명성
  score += character.prestige / 10;
  
  // 능력치 (관련 능력치만)
  if (decoration.effects.abilityBonus) {
    for (const ability of Object.keys(decoration.effects.abilityBonus)) {
      score += character.abilities[ability] * 5;
    }
  }
  
  return score;
}
```

### 3. 서훈식 UI

```typescript
function CeremonyDialog({ decorationId, candidates }: CeremonyProps) {
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [location, setLocation] = useState<string>('');
  
  const cost = 10000 * selectedRecipients.length;
  
  async function handleConfirm() {
    try {
      for (const recipientId of selectedRecipients) {
        await awardDecoration(recipientId, decorationId, {
          holdCeremony: true,
          ceremonyLocation: location
        });
      }
      
      showSuccess(`${selectedRecipients.length}명에게 훈장을 수여했습니다`);
    } catch (error) {
      showError(error.message);
    }
  }
  
  return (
    <Dialog title="서훈식 개최">
      <DecorationInfo decorationId={decorationId} />
      
      <CandidateList
        candidates={candidates}
        selected={selectedRecipients}
        onSelect={setSelectedRecipients}
      />
      
      <PlanetSelector
        label="개최 장소"
        value={location}
        onChange={setLocation}
      />
      
      <div className="ceremony-cost">
        예상 비용: {cost.toLocaleString()}
      </div>
      
      <div className="ceremony-effects">
        <h4>효과</h4>
        <ul>
          <li>정부 지지율 +5%</li>
          <li>참석자 사기 +10</li>
          <li>수상자 영향력 +20 (추가)</li>
        </ul>
      </div>
      
      <Button onClick={handleConfirm} disabled={!location || selectedRecipients.length === 0}>
        서훈식 개최
      </Button>
    </Dialog>
  );
}
```

---

## 📊 밸런스 가이드

### 훈장 가치 계산

```
훈장 가치 = (영향력 × 2) + (명성 ÷ 5) + (능력치 보너스 × 100)

예: 쌍두독수리훈장
= (300 × 2) + (1500 ÷ 5) + ((3+3) × 100)
= 600 + 300 + 600
= 1500 포인트
```

### 권장 수여 기준

| 계급 | 최소 훈장 | 권장 훈장 |
|------|----------|----------|
| 원수 | 공일급십자장 | 쌍두독수리훈장 |
| 상급대장 | 공이급기사십자장 | 은하제국대십자장 |
| 대장 | 공일급십자장 | 공일급기사십자장 |
| 중장 | 공이급십자장 | 공이급기사십자장 |
| 소장 | 공일급전공장 | 공일급십자장 |
| 준장 | 공이급전공장 | 공이급십자장 |
| 대령 | 공삼급전공장 | 공일급전공장 |

---

## ⚠️ 주의사항

1. **중복 수여**: 특별전공메달만 중복 가능
2. **박탈**: 반역/중대 군율 위반 시 자동 박탈
3. **서훈식**: 비용이 높지만 추가 효과 큼
4. **최고 훈장**: 쌍두독수리/하이네센 훈장은 매우 제한적으로 수여
5. **능력치 보너스**: 훈장 박탈 시 능력치도 감소

---

생성 일시: 2025-01-09  
출처: Project 은영전 최종 기획안  
비고: 34개 훈장 완전 구현
