/**
 * 군대 이동 정보 조회 서비스
 * 
 * 지도에 표시할 예약된/진행 중인 군대 이동 정보를 반환합니다.
 */

import { generalRepository } from '../../repositories/general.repository';
import { generalTurnRepository } from '../../repositories/general-turn.repository';
import { cityRepository } from '../../repositories/city.repository';
import { nationRepository } from '../../repositories/nation.repository';

// 병종 이름 매핑
const CREW_TYPE_NAMES: Record<number, string> = {
  0: '징집병',
  1100: '도민병', 1101: '창민병', 1102: '청주병', 1103: '단양병', 1104: '함진영',
  1105: '백이병', 1106: '무당비군', 1107: '동주병', 1108: '청건병', 1109: '해번병',
  1110: '황건역사', 1111: '금군', 1112: '등갑병', 1113: '산월병', 1114: '왜구',
  1115: '가야철검수', 1116: '삼한장창병',
  1200: '궁병', 1201: '노병', 1202: '백마의종', 1203: '연노병', 1204: '호사',
  1205: '맥궁병', 1206: '읍루독궁', 1207: '선등사',
  1300: '기병', 1301: '호표기', 1302: '오환돌기', 1303: '비웅군', 1304: '서량철기',
  1305: '흉노기병', 1306: '남만상병', 1307: '선비기마대', 1308: '부여기병', 1309: '강족약탈자',
  1400: '책사', 1401: '태평도인', 1402: '오두미도사', 1403: '독전주술사',
  1500: '벽력거', 1501: '충차', 1502: '연노거', 1503: '화수',
};

export interface TroopMovementData {
  id: string;
  generalId: number;
  generalName: string;
  generalIcon?: string;
  nationId: number;
  nationName: string;
  nationColor: string;
  troops: number;
  crewType?: number;
  crewTypeName?: string;
  fromCityId: number;
  fromCityName: string;
  fromX: number;
  fromY: number;
  toCityId: number;
  toCityName: string;
  toX: number;
  toY: number;
  status: 'scheduled' | 'marching' | 'arriving' | 'completed';
  type: 'normal' | 'deploy' | 'forceMarch' | 'retreat' | 'supply';
  scheduledTurn?: number;
  startTurn?: number;
  arrivalTurn?: number;
  progress?: number;
  isEnemy?: boolean;
  isVisible?: boolean;
}

interface GetTroopMovementsOptions {
  sessionId: string;
  viewerNationId?: number;  // 보는 사람의 국가 (첩보 판단용)
  includeEnemy?: boolean;   // 적군 포함 여부
}

/**
 * 지도에 표시할 군대 이동 정보 조회
 */
export async function getTroopMovements(
  options: GetTroopMovementsOptions
): Promise<TroopMovementData[]> {
  const { sessionId, viewerNationId, includeEnemy = true } = options;
  const movements: TroopMovementData[] = [];

  try {
    // 도시 좌표 정보 로드 (캐시 우선)
    const cities = await cityRepository.findBySession(sessionId);
    
    const cityMap = new Map<number, { name: string; nation: number; x: number; y: number }>();
    for (const city of cities) {
      cityMap.set(city.city, { 
        name: city.name, 
        nation: city.nation || 0, 
        x: city.x || 0, 
        y: city.y || 0 
      });
    }

    // 국가 정보 로드 (활성 국가만)
    const nations = await nationRepository.findByFilter({ 
      session_id: sessionId, 
      nation: { $gt: 0 } 
    });
    
    const nationMap = new Map<number, { name: string; color: string }>();
    for (const nation of nations) {
      nationMap.set(nation.nation, { 
        name: nation.name || `국가${nation.nation}`, 
        color: nation.color || '#888888' 
      });
    }

    // 이동 관련 커맨드 목록
    const moveCommandNames = ['이동', '출정', '강행군', '귀환', '변경귀환'];
    
    // 국가 소속 장수 조회
    const generals = await generalRepository.findByFilter({
      session_id: sessionId,
      'data.nation': { $gt: 0 },
    });

    // 장수 정보를 맵으로 변환
    const generalMap = new Map<number, any>();
    for (const general of generals) {
      const generalData = general.data || general;
      generalMap.set(generalData.no, generalData);
    }

    // GeneralTurn 컬렉션에서 이동 관련 예약 커맨드 조회
    const allTurns = await generalTurnRepository.findBySession(sessionId);
    
    for (const turn of allTurns) {
      const turnData = turn.data || turn;
      const generalId = turnData.general_id;
      const turnIdx = turnData.turn_idx;
      const action = turnData.action || '';
      const arg = typeof turnData.arg === 'string' ? JSON.parse(turnData.arg) : turnData.arg || {};
      
      // 이동 관련 커맨드인지 확인
      if (!moveCommandNames.includes(action)) continue;
      
      // 목적지 도시 ID 추출
      const destCityId = arg.destCityID || arg.destCity || 0;
      if (!destCityId) continue;
      
      // 장수 정보 가져오기
      const generalData = generalMap.get(generalId);
      if (!generalData) continue;
      
      const generalNationId = generalData.nation;
      
      // 적군이고 includeEnemy가 false면 스킵
      if (!includeEnemy && viewerNationId && generalNationId !== viewerNationId) {
        continue;
      }
      
      const fromCity = cityMap.get(generalData.city);
      const toCity = cityMap.get(destCityId);
      
      if (!fromCity || !toCity) continue;
      
      const nation = nationMap.get(generalNationId);
      if (!nation) continue;

      // 적군 가시성 판단
      let isVisible = true;
      let isEnemy = false;
      
      if (viewerNationId && generalNationId !== viewerNationId) {
        isEnemy = true;
        // 기본적으로 적군 이동은 숨김
        isVisible = false;
        
        // 아군 도시로 향하는 이동은 표시 (접경 감지)
        if (toCity.nation === viewerNationId) {
          isVisible = true;
        }
        // 아군 도시에서 출발하는 적군 이동도 표시 (점령된 도시에서)
        if (fromCity.nation === viewerNationId) {
          isVisible = true;
        }
      }
      
      // 이동 타입 결정
      let movementType: TroopMovementData['type'] = 'normal';
      if (action === '출정') movementType = 'deploy';
      else if (action === '강행군') movementType = 'forceMarch';
      else if (action === '귀환' || action === '변경귀환') movementType = 'retreat';
      
      // 진행도 계산 (턴 0이 가장 임박, 턴 4가 가장 멀리)
      const progress = Math.max(0, Math.min(100, (5 - turnIdx) * 20));
      
      // 병종 이름 조회
      const crewTypeName = CREW_TYPE_NAMES[generalData.crewtype] || undefined;
      
      movements.push({
        id: `mv-${generalId}-${turnIdx}`,
        generalId,
        generalName: generalData.name,
        generalIcon: generalData.picture ? `/image/face/${generalData.picture}.jpg` : undefined,
        nationId: generalNationId,
        nationName: nation.name,
        nationColor: nation.color,
        troops: generalData.crew || 0,
        crewType: generalData.crewtype,
        crewTypeName,
        fromCityId: generalData.city,
        fromCityName: fromCity.name,
        fromX: fromCity.x,
        fromY: fromCity.y,
        toCityId: destCityId,
        toCityName: toCity.name,
        toX: toCity.x,
        toY: toCity.y,
        status: turnIdx === 0 ? 'arriving' : turnIdx <= 2 ? 'marching' : 'scheduled',
        type: movementType,
        scheduledTurn: turnIdx,
        progress,
        isEnemy,
        isVisible,
      });
    }

    // 가시성 필터링
    return movements.filter(m => m.isVisible);
    
  } catch (error) {
    console.error('[GetTroopMovements] 에러:', error);
    return [];
  }
}

export class GetTroopMovementsService {
  static async execute(options: GetTroopMovementsOptions): Promise<TroopMovementData[]> {
    return getTroopMovements(options);
  }
}

