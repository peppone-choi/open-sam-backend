/**
 * 요새 시드 데이터
 * 
 * 은하영웅전설의 주요 요새들을 초기화합니다.
 */

import { FortressType } from '../../types/gin7/fortress.types';
import { fortressService, CreateFortressRequest } from './FortressService';

/**
 * 초기 요새 데이터
 */
export interface FortressSeedConfig {
  type: FortressType;
  ownerId: string;
  location: {
    type: 'SYSTEM' | 'CORRIDOR' | 'DEEP_SPACE';
    systemId?: string;
    corridorId?: string;
    coordinates?: { x: number; y: number };
  };
  customName?: string;
  description?: string;
}

/**
 * 은하영웅전설 기본 요새 설정
 */
export const LOGH_FORTRESS_SEEDS: FortressSeedConfig[] = [
  // 이제르론 요새 - 이제르론 회랑의 핵심
  {
    type: 'ISERLOHN',
    ownerId: 'FREE_PLANETS_ALLIANCE', // 초기 소유자 (시나리오에 따라 변경)
    location: {
      type: 'CORRIDOR',
      corridorId: 'ISERLOHN_CORRIDOR',
      coordinates: { x: 500, y: 500 },
    },
    customName: '이제르론 요새',
    description: '이제르론 회랑의 핵심 요새. 토르 해머 주포로 무장.',
  },
  
  // 가이에스부르크 요새 - 이동 가능한 요새
  {
    type: 'GEIERSBURG',
    ownerId: 'GALACTIC_EMPIRE', // 은하제국 소유
    location: {
      type: 'SYSTEM',
      systemId: 'ODIN_SYSTEM', // 오딘 성계 근처
      coordinates: { x: 200, y: 300 },
    },
    customName: '가이에스부르크 요새',
    description: '이동 가능한 요새. 워프 엔진으로 성계 간 이동 가능.',
  },
  
  // 렌텐베르크 요새
  {
    type: 'RENTENBERG',
    ownerId: 'GALACTIC_EMPIRE',
    location: {
      type: 'SYSTEM',
      systemId: 'RENTENBERG_SYSTEM',
      coordinates: { x: 150, y: 250 },
    },
    customName: '렌텐베르크 요새',
    description: '제국령 내 방어 요새.',
  },
];

/**
 * 시나리오별 요새 초기 상태
 */
export const SCENARIO_FORTRESS_CONFIGS: Record<string, Partial<FortressSeedConfig>[]> = {
  // 초기 시나리오 - 이제르론은 제국이 보유
  INITIAL: [
    {
      type: 'ISERLOHN',
      ownerId: 'GALACTIC_EMPIRE',
    },
    {
      type: 'GEIERSBURG',
      ownerId: 'GALACTIC_EMPIRE',
    },
    {
      type: 'RENTENBERG',
      ownerId: 'GALACTIC_EMPIRE',
    },
  ],
  
  // 아스타르테 회전 이후 - 이제르론 함락
  AFTER_ASTARTE: [
    {
      type: 'ISERLOHN',
      ownerId: 'FREE_PLANETS_ALLIANCE', // 양 웬리가 함락
    },
  ],
  
  // 립슈타트 전역 - 귀족연합 시나리오
  LIPPSTADT: [
    {
      type: 'ISERLOHN',
      ownerId: 'FREE_PLANETS_ALLIANCE',
    },
    {
      type: 'GEIERSBURG',
      ownerId: 'NOBLE_COALITION', // 귀족연합 (브라운슈바이크)
    },
  ],
  
  // 회랑 전투 시나리오 - 가이에스부르크가 이제르론으로 이동
  CORRIDOR_BATTLE: [
    {
      type: 'ISERLOHN',
      ownerId: 'FREE_PLANETS_ALLIANCE',
    },
    {
      type: 'GEIERSBURG',
      ownerId: 'GALACTIC_EMPIRE',
      location: {
        type: 'CORRIDOR',
        corridorId: 'ISERLOHN_CORRIDOR',
        coordinates: { x: 450, y: 480 },
      },
    },
  ],
};

/**
 * 요새 시드 데이터 초기화
 */
export async function seedFortresses(
  sessionId: string,
  scenario?: string
): Promise<void> {
  // 기본 요새 데이터 사용
  let fortressConfigs = [...LOGH_FORTRESS_SEEDS];
  
  // 시나리오별 설정 오버라이드
  if (scenario && SCENARIO_FORTRESS_CONFIGS[scenario]) {
    const scenarioConfigs = SCENARIO_FORTRESS_CONFIGS[scenario];
    
    for (const override of scenarioConfigs) {
      const index = fortressConfigs.findIndex(f => f.type === override.type);
      if (index >= 0) {
        fortressConfigs[index] = {
          ...fortressConfigs[index],
          ...override,
        };
      }
    }
  }
  
  // 요새 생성
  for (const config of fortressConfigs) {
    const request: CreateFortressRequest = {
      sessionId,
      type: config.type,
      ownerId: config.ownerId,
      location: config.location,
      customName: config.customName,
    };
    
    await fortressService.createFortress(request);
  }
}

/**
 * 특정 요새만 생성
 */
export async function seedSingleFortress(
  sessionId: string,
  type: FortressType,
  ownerId: string,
  location: FortressSeedConfig['location'],
  customName?: string
): Promise<void> {
  await fortressService.createFortress({
    sessionId,
    type,
    ownerId,
    location,
    customName,
  });
}

/**
 * 이제르론 요새 생성 헬퍼
 */
export async function createIserlohnFortress(
  sessionId: string,
  ownerId: string
): Promise<void> {
  await seedSingleFortress(
    sessionId,
    'ISERLOHN',
    ownerId,
    {
      type: 'CORRIDOR',
      corridorId: 'ISERLOHN_CORRIDOR',
      coordinates: { x: 500, y: 500 },
    },
    '이제르론 요새'
  );
}

/**
 * 가이에스부르크 요새 생성 헬퍼
 */
export async function createGeierburgFortress(
  sessionId: string,
  ownerId: string,
  location?: FortressSeedConfig['location']
): Promise<void> {
  await seedSingleFortress(
    sessionId,
    'GEIERSBURG',
    ownerId,
    location || {
      type: 'SYSTEM',
      systemId: 'ODIN_SYSTEM',
      coordinates: { x: 200, y: 300 },
    },
    '가이에스부르크 요새'
  );
}












