# 은하영웅전설 행성 및 성계 데이터

## 📁 파일 설명

### planets-and-systems.json
은하영웅전설의 80개 성계와 208개 행성/위성/요새 데이터

**버전**: 2.0.0  
**출처**: planets.md + 은하영웅전설 위키 (나무위키)  
**최종 업데이트**: 2025-11-10

## 📊 데이터 통계

- **총 성계**: 80개
- **총 행성/위성/요새**: 208개
- **은하제국**: 39개 성계
- **자유행성동맹**: 40개 성계
- **페잔 자치령**: 1개 성계
- **분쟁지역**: 9개 성계 (이제르론 회랑 주변)

## 🏛️ 주요 세력

### 은하제국 (Galactic Empire)
- **수도 성계**: 발할라 (Valhalla)
- **수도 행성**: 오딘 (Odin)
- **주요 시설**: 노이에 상수시 황궁, 제아들러

### 자유행성동맹 (Free Planets Alliance)
- **수도 성계**: 바라트 (Bharat)
- **수도 행성**: 하이네센 (Heinessen)
- **주요 시설**: 최고평의회, 아르테미스의 목걸이

### 페잔 자치령 (Phezzan Dominion)
- **수도 성계**: 페잔 (Phezzan)
- **수도 행성**: 페잔 (Phezzan)
- **특징**: 제국과 동맹 사이의 중립 무역 지대

## ⚔️ 분쟁지역 (이제르론 회랑)

제국과 동맹의 세력권이 맞닿는 전략적 요충지:

1. **이제르론 (Iserlohn)** - 난공불락의 요새, 토르의 망치
2. **아스타테 (Astarte)** - 라인하르트의 첫 대규모 승리
3. **반 플리트 (Van Fleet)** - 양 웬리 vs 라인하르트
4. **다곤 (Dagon)** - 다곤 성역 회전
5. **팔란티아 (Palantia)** - 팔란티아 회전
6. **파이어자드 (Firezard)** - 파이어저드 성역 회전
7. **티아매트 (Tiamat)** - 티아마트 성역
8. **알트뮐 (Altmühl)** - 알트뮐 회전
9. **알레스하임 (Arlesheim)** - 아를레스하임 성역 회전

## 🏰 주요 요새

1. **이제르론 요새** - 토르의 망치 보유, 회랑의 핵심
2. **가이에스부르크 요새** - 이동식 요새
3. **렌텐베르크 요새** - 프레이야 성계
4. **가르미슈 요새** - 키포이저 성역

## 📖 데이터 구조

### 성계 (Star System)
```json
{
  "systemNumber": 1,
  "systemId": "sirius",
  "systemName": "시리우스 성계",
  "systemNameJa": "シリウス星系",
  "systemNameEn": "Sirius",
  "faction": "empire",
  "description": "설명",
  "strategicValue": "capital|critical|high|normal",
  "territoryType": "disputed",
  "historicalSignificance": "역사적 의의",
  "planets": [...]
}
```

### 행성 (Planet)
```json
{
  "planetId": "odin",
  "planetName": "오딘",
  "planetNameJa": "オーディン",
  "planetNameEn": "Odin",
  "faction": "empire",
  "description": "설명",
  "isCapital": true,
  "type": "fortress|base",
  "strategicValue": "capital|critical|high|normal",
  "planetType": "gas_giant|ice_planet",
  "hasShipyard": true,
  "hasThorsHammer": true,
  "facilities": ["시설1", "시설2"],
  "capital": "수도 도시명"
}
```

## 🔧 사용 예시

### Node.js
```javascript
const data = require('./planets-and-systems.json');

// 전체 성계 조회
console.log('총 성계:', data.starSystems.length);

// 은하제국 성계만 필터링
const empireSystems = data.starSystems.filter(s => s.faction === 'empire');

// 수도 행성 찾기
const odin = data.starSystems
  .find(s => s.systemId === 'valhalla')
  .planets.find(p => p.isCapital);

// 분쟁지역 조회
const disputed = data.starSystems.filter(s => s.territoryType === 'disputed');
```

## 📚 참고 자료

- **planets.md** - 80개 성계 원본 데이터
- **은하영웅전설 위키** - 나무위키
- **Gin7 Manual** - 銀河英雄伝説Ⅶ

## ⚠️ 주의사항

1. **소속(faction)**: 게임 시작 시점의 지배 세력을 나타냅니다
2. **분쟁지역**: `territoryType: "disputed"`로 표시된 성계는 이제르론 회랑 주변의 전략 요충지입니다
3. **역사적 사건**: `historicalSignificance` 필드에 주요 전투/사건이 기록되어 있습니다

## 📝 변경 이력

### v2.0.0 (2025-11-10)
- ✅ 80개 성계 완전 반영
- ✅ 위키 기반 상세 설명 추가
- ✅ 분쟁지역 구분
- ✅ 요새/기지 정보 추가
- ✅ 시설/설명 데이터 보강

### v1.0.0 (초기 버전)
- 40개 성계 기본 데이터
