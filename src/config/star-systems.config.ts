/**
 * 은하영웅전설 성계 설정
 * Legend of the Galactic Heroes - Star Systems Configuration
 */

export interface IStarSystem {
  id: number;
  nameKo: string;
  nameEn: string;
  faction: '은하제국' | '자유행성동맹' | '페잔 자치령';
  x: number;
  y: number;
  note?: string;
}

export const StarSystems: IStarSystem[] = [
  { id: 1, nameKo: '시리우스 성계', nameEn: 'Sirius', faction: '은하제국', x: 400, y: 50, note: '오른쪽 상단' },
  { id: 2, nameKo: '마로비아 성계', nameEn: 'Marovia', faction: '자유행성동맹', x: 50, y: 50, note: '왼쪽 상단' },
  { id: 3, nameKo: '태양계', nameEn: 'Solar System', faction: '은하제국', x: 480, y: 20, note: '오른쪽 최상단' },
  { id: 4, nameKo: '베가 성계', nameEn: 'Vega', faction: '은하제국', x: 540, y: 50 },
  { id: 5, nameKo: '시바 성계', nameEn: 'Shiva', faction: '자유행성동맹', x: 150, y: 90 },
  { id: 6, nameKo: '비프뢰스트 성계', nameEn: 'Bifröst', faction: '은하제국', x: 460, y: 100 },
  { id: 7, nameKo: '하다트 성계', nameEn: 'Hadat', faction: '자유행성동맹', x: 100, y: 150 },
  { id: 8, nameKo: '다곤 성계', nameEn: 'Dagon', faction: '자유행성동맹', x: 200, y: 150 },
  { id: 9, nameKo: '파라-파라 성계', nameEn: 'Fara-Fara', faction: '자유행성동맹', x: 80, y: 100 },
  { id: 10, nameKo: '볼소른 성계', nameEn: 'Volsorn', faction: '은하제국', x: 510, y: 150 },
  { id: 11, nameKo: '카스트로프 성계', nameEn: 'Castrop', faction: '은하제국', x: 800, y: 100, note: '오른쪽 상단' },
  { id: 12, nameKo: '엘곤 성계', nameEn: 'Elgon', faction: '자유행성동맹', x: 200, y: 100 },
  { id: 13, nameKo: '빌렌슈타인 성계', nameEn: 'Wilenstein', faction: '은하제국', x: 650, y: 150 },
  { id: 14, nameKo: '아스타테 성계', nameEn: 'Astarte', faction: '자유행성동맹', x: 350, y: 180, note: '회랑 근처' },
  { id: 15, nameKo: '린더호프 성계', nameEn: 'Linderhof', faction: '은하제국', x: 590, y: 150 },
  { id: 16, nameKo: '로포텐 성계', nameEn: 'Lofoten', faction: '자유행성동맹', x: 80, y: 190 },
  { id: 17, nameKo: '반 플리트 성계', nameEn: 'Van Fleet', faction: '자유행성동맹', x: 400, y: 250, note: '회랑 근처' },
  { id: 18, nameKo: '이제를론 성계', nameEn: 'Iserlohn', faction: '은하제국', x: 480, y: 250, note: '이젤론 회랑' },
  { id: 19, nameKo: '암리처 성계', nameEn: 'Amritsar', faction: '은하제국', x: 500, y: 200 },
  { id: 20, nameKo: '드베르그 성계', nameEn: 'Dverg', faction: '은하제국', x: 570, y: 200 },
  { id: 21, nameKo: '도리아 성계', nameEn: 'Doria', faction: '자유행성동맹', x: 290, y: 180 },
  { id: 22, nameKo: '시론 성계', nameEn: 'Chiron', faction: '자유행성동맹', x: 20, y: 250 },
  { id: 23, nameKo: '케림 성계', nameEn: 'Kerim', faction: '자유행성동맹', x: 120, y: 250 },
  { id: 24, nameKo: '알트뮐 성계', nameEn: 'Altmühl', faction: '자유행성동맹', x: 380, y: 250, note: '회랑 근처' },
  { id: 25, nameKo: '티아매트 성계', nameEn: 'Tiamat', faction: '자유행성동맹', x: 320, y: 250 },
  { id: 26, nameKo: '하인스베르크 성계', nameEn: 'Heinsberg', faction: '은하제국', x: 750, y: 200 },
  { id: 27, nameKo: '바나하임 성계', nameEn: 'Vanaheim', faction: '은하제국', x: 780, y: 150 },
  { id: 28, nameKo: '야반할 성계', nameEn: 'Javanhar', faction: '은하제국', x: 680, y: 200 },
  { id: 29, nameKo: '잠시드 성계', nameEn: 'Jamshid', faction: '자유행성동맹', x: 180, y: 300 },
  { id: 30, nameKo: '엘 파실 성계', nameEn: 'El Facil', faction: '자유행성동맹', x: 250, y: 300 },
  { id: 31, nameKo: '니플하임 성계', nameEn: 'Niflheim', faction: '은하제국', x: 780, y: 250 },
  { id: 32, nameKo: '반스타드 성계', nameEn: 'Vanstad', faction: '은하제국', x: 540, y: 300 },
  { id: 33, nameKo: '알레스하임 성계', nameEn: 'Arlesheim', faction: '자유행성동맹', x: 380, y: 320 },
  { id: 34, nameKo: '드라고니아 성계', nameEn: 'Dragonia', faction: '자유행성동맹', x: 350, y: 320 },
  { id: 35, nameKo: '룸비니 성계', nameEn: 'Lumbini', faction: '자유행성동맹', x: 50, y: 350 },
  { id: 36, nameKo: '바라트 성계', nameEn: 'Bharat', faction: '자유행성동맹', x: 150, y: 350, note: '동맹 수도' },
  { id: 37, nameKo: '알타이르 성계', nameEn: 'Altair', faction: '은하제국', x: 600, y: 350 },
  { id: 38, nameKo: '벨라 성계', nameEn: 'Wehrla', faction: '은하제국', x: 720, y: 300 },
  { id: 39, nameKo: '류카스 성계', nameEn: 'Lucas', faction: '자유행성동맹', x: 250, y: 390 },
  { id: 40, nameKo: '루이트폴딩 성계', nameEn: 'Luitpolding', faction: '은하제국', x: 800, y: 350 },
  { id: 41, nameKo: '팔란티아 성계', nameEn: 'Palantia', faction: '자유행성동맹', x: 400, y: 390 },
  { id: 42, nameKo: '발할라 성계', nameEn: 'Valhalla', faction: '은하제국', x: 790, y: 400, note: '제국 수도' },
  { id: 43, nameKo: '란테마리오 성계', nameEn: 'Lantemario', faction: '자유행성동맹', x: 350, y: 420 },
  { id: 44, nameKo: '포르세티 성계', nameEn: 'Forseti', faction: '자유행성동맹', x: 380, y: 420 },
  { id: 45, nameKo: '트라바흐 성계', nameEn: 'Trabach', faction: '은하제국', x: 530, y: 430 },
  { id: 46, nameKo: '타나토스 성계', nameEn: 'Thanatos', faction: '자유행성동맹', x: 50, y: 450 },
  { id: 47, nameKo: '버밀리언 성계', nameEn: 'Vermilion', faction: '자유행성동맹', x: 150, y: 480 },
  { id: 48, nameKo: '알비스 성계', nameEn: 'Alvis', faction: '은하제국', x: 650, y: 480 },
  { id: 49, nameKo: '마르 아데타 성계', nameEn: 'Mar Adetta', faction: '자유행성동맹', x: 350, y: 490 },
  { id: 50, nameKo: '파이어자드 성계', nameEn: 'Firezard', faction: '자유행성동맹', x: 420, y: 490 },
  { id: 51, nameKo: '아스가르드 성계', nameEn: 'Asgard', faction: '은하제국', x: 780, y: 480 },
  { id: 52, nameKo: '타실리 성계', nameEn: 'Tassili', faction: '자유행성동맹', x: 250, y: 520 },
  { id: 53, nameKo: '보름스가우 성계', nameEn: 'Wormsgau', faction: '은하제국', x: 840, y: 480 },
  { id: 54, nameKo: '샨타우 성계', nameEn: 'Schantau', faction: '은하제국', x: 750, y: 550 },
  { id: 55, nameKo: '샨달루아 성계', nameEn: 'Chandalua', faction: '자유행성동맹', x: 380, y: 550 },
  { id: 56, nameKo: '아르멘토벨 성계', nameEn: 'Armentobel', faction: '은하제국', x: 540, y: 570 },
  { id: 57, nameKo: '리오 베르데 성계', nameEn: 'Rio Verde', faction: '자유행성동맹', x: 100, y: 570 },
  { id: 58, nameKo: '알테나 성계', nameEn: 'Altena', faction: '은하제국', x: 700, y: 580 },
  { id: 59, nameKo: '엘리세라 성계', nameEn: 'Eleuthera', faction: '자유행성동맹', x: 40, y: 600 },
  { id: 60, nameKo: '프레이야 성계', nameEn: 'Freya', faction: '은하제국', x: 610, y: 600 },
  { id: 61, nameKo: '간다르바 성계', nameEn: 'Gandharva', faction: '자유행성동맹', x: 330, y: 620 },
  { id: 62, nameKo: '라이갈 성계', nameEn: 'Raigarh', faction: '자유행성동맹', x: 200, y: 620 },
  { id: 63, nameKo: '빈스팅겐 성계', nameEn: 'Winstingen', faction: '은하제국', x: 840, y: 600 },
  { id: 64, nameKo: '페잔 성계', nameEn: 'Phezzan', faction: '페잔 자치령', x: 450, y: 680, note: '페잔 회랑' },
  { id: 65, nameKo: '발데마르 성계', nameEn: 'Waldemar', faction: '은하제국', x: 780, y: 680 },
  { id: 66, nameKo: '비텔스바흐 성계', nameEn: 'Wittelsbach', faction: '은하제국', x: 820, y: 700 },
  { id: 67, nameKo: '아이젠헤르츠 성계', nameEn: 'Eisenherz', faction: '은하제국', x: 540, y: 680, note: '가이에스부르크 요새' },
  { id: 68, nameKo: '폴레비트 성계', nameEn: 'Polevit', faction: '자유행성동맹', x: 480, y: 680 },
  { id: 69, nameKo: '트리플라 성계', nameEn: 'Tripura', faction: '자유행성동맹', x: 250, y: 700 },
  { id: 70, nameKo: '예툰하임 성계', nameEn: 'Jötunheim', faction: '은하제국', x: 620, y: 720 },
  { id: 71, nameKo: '바라트루프 성계', nameEn: 'Baratrup', faction: '자유행성동맹', x: 380, y: 750 },
  { id: 72, nameKo: '람멜스베르크 성계', nameEn: 'Rammelsberg', faction: '은하제국', x: 800, y: 750 },
  { id: 73, nameKo: '브라운슈바이크 성계', nameEn: 'Braunschweig', faction: '은하제국', x: 670, y: 770 },
  { id: 74, nameKo: '리텐하임 성계', nameEn: 'Littenheim', faction: '은하제국', x: 770, y: 800 },
  { id: 75, nameKo: '멜카르트 성계', nameEn: 'Melkart', faction: '자유행성동맹', x: 320, y: 770 },
  { id: 76, nameKo: '키포이저 성계', nameEn: 'Kiphoiser', faction: '은하제국', x: 690, y: 830, note: '가르미슈 요새' },
  { id: 77, nameKo: '폴린 성계', nameEn: 'Polyn', faction: '자유행성동맹', x: 150, y: 820 },
  { id: 78, nameKo: '슈팔라 성계', nameEn: 'Schpara', faction: '자유행성동맹', x: 250, y: 830 },
  { id: 79, nameKo: '발두르 성계', nameEn: 'Baldur', faction: '은하제국', x: 740, y: 850 },
  { id: 80, nameKo: '포르겐 성계', nameEn: 'Forgen', faction: '은하제국', x: 580, y: 850 },
];

/**
 * 성계 ID로 검색
 */
export function getStarSystemById(id: number): IStarSystem | undefined {
  return StarSystems.find((sys) => sys.id === id);
}

/**
 * 영문 이름으로 검색
 */
export function getStarSystemByNameEn(nameEn: string): IStarSystem | undefined {
  return StarSystems.find((sys) => sys.nameEn.toLowerCase() === nameEn.toLowerCase());
}

/**
 * 한글 이름으로 검색
 */
export function getStarSystemByNameKo(nameKo: string): IStarSystem | undefined {
  return StarSystems.find((sys) => sys.nameKo.includes(nameKo));
}

/**
 * 세력별로 성계 목록 반환
 */
export function getStarSystemsByFaction(faction: '은하제국' | '자유행성동맹' | '페잔 자치령'): IStarSystem[] {
  return StarSystems.filter((sys) => sys.faction === faction);
}

/**
 * 특정 좌표 범위 내의 성계 검색
 */
export function getStarSystemsInRange(
  centerX: number,
  centerY: number,
  range: number
): IStarSystem[] {
  return StarSystems.filter((sys) => {
    const distance = Math.sqrt(Math.pow(sys.x - centerX, 2) + Math.pow(sys.y - centerY, 2));
    return distance <= range;
  });
}

/**
 * 두 성계 간의 거리 계산
 */
export function getDistanceBetweenSystems(id1: number, id2: number): number | null {
  const sys1 = getStarSystemById(id1);
  const sys2 = getStarSystemById(id2);
  
  if (!sys1 || !sys2) return null;
  
  return Math.sqrt(Math.pow(sys2.x - sys1.x, 2) + Math.pow(sys2.y - sys1.y, 2));
}

/**
 * 주요 성계 상수
 */
export const MAJOR_SYSTEMS = {
  // 수도
  VALHALLA: 42,  // 은하제국 수도 (발할라)
  BHARAT: 36,    // 자유행성동맹 수도 (바라트)
  
  // 주요 회랑 및 요새
  ISERLOHN: 18,  // 이젤론 회랑
  PHEZZAN: 64,   // 페잔 회랑
  
  // 주요 요새
  GAIESBURG: 67, // 가이에스부르크 요새 (아이젠헤르츠)
  GARMISCH: 76,  // 가르미슈 요새 (키포이저)
  
  // 지구
  SOLAR_SYSTEM: 3, // 태양계
} as const;
