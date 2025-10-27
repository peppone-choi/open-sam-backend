# 도시 생성 플로우

## 정상 플로우 (도시 생성 시)

```typescript
// 1. API 요청
POST /api/:sessionId/cities
{
  "name": "낙양",
  "level": 5,
  "pop": 100000,
  "agri": 5000,
  "comm": 5000,
  "secu": 5000,
  ...
}

// 2. CityService.create()
async create(sessionId: string, cityData: Partial<ICity>) {
  // 2-1. City 생성
  const city = await cityRepository.create({ sessionId, ...cityData });
  
  // 2-2. BattleFieldTile 자동 생성 (1600개 plain)
  await battleFieldTileRepository.create({
    sessionId,
    cityId: city.id,
    tiles: [
      { x: 0, y: 0, terrainType: 'plain', ... }, // 0
      { x: 1, y: 0, terrainType: 'plain', ... }, // 1
      ...
      { x: 39, y: 39, terrainType: 'plain', ... }, // 1599
    ]
  });
  
  return city;
}

// 3. 응답
{
  "data": {
    "id": "city-123",
    "name": "낙양",
    ...
  }
}
```

## 타일 수정 플로우

### 단일 타일 수정

```typescript
PUT /api/:sessionId/cities/:cityId/tiles/:x/:y
{
  "terrainType": "forest",
  "moveCost": 2,
  "defenseBonus": 1
}

// BattleFieldTileService.updateTile()
// → tiles[y * 40 + x] 업데이트
// → DB 저장
```

### 일괄 수정 (에디터용)

```typescript
PUT /api/:sessionId/cities/:cityId/tiles/batch
{
  "tiles": [
    { "x": 10, "y": 10, "updates": { "terrainType": "forest" } },
    { "x": 11, "y": 10, "updates": { "terrainType": "forest" } },
    { "x": 20, "y": 20, "updates": { "terrainType": "castle", "defenseBonus": 10 } },
    ...
  ]
}

// BattleFieldTileService.updateTiles()
// → 여러 타일 한번에 업데이트
// → DB 저장
```

## 마이그레이션/복구용 스크립트

```bash
# 기존 도시에 타일이 없을 경우만 생성
npm run generate:tiles

# 동작:
# 1. 모든 도시 조회
# 2. BattleFieldTile 존재 확인
# 3. 없으면 1600개 plain 타일 생성
```

## 타일 초기값

```typescript
{
  x: 0-39,
  y: 0-39,
  terrainType: 'plain',  // 전부 풀밭
  movable: true,
  moveCost: 1,
  defenseBonus: 0,
  height: 0
}
```

**총 1600개 × 도시 개수**만큼 DB에 저장됨

## 데이터 구조

```
City (도시)
  └─ BattleFieldTile (1:1 관계)
      └─ tiles: ITile[1600]
```

**중요**: 도시 생성 = 타일 자동 생성 (항상 함께)
