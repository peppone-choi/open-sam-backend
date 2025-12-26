/**
 * FormationSystem - 포메이션 & 방향 기반 전투 시스템
 * 
 * 병종별 포메이션과 공격 방향에 따라 전투 효율이 달라집니다.
 * "맞고 죽어라!" 전술을 포함한 깊이 있는 전략 플레이 가능
 */

export enum Formation {
  // 창병 전용
  SHIELD_WALL = 'SHIELD_WALL',   // 방패벽: 전방 방어 극대화
  SPEAR_WALL = 'SPEAR_WALL',     // 창벽: 대기병 특화
  
  // 극병 전용
  TURTLE = 'TURTLE',             // 거북: 전방위 방어
  CIRCLE = 'CIRCLE',             // 원진: 포위 저항
  
  // 기병 전용
  WEDGE = 'WEDGE',               // 쐐기: 돌격력 극대화
  LOOSE = 'LOOSE',               // 산개: 기동력 + 회피
  
  // 범용
  LINE = 'LINE',                 // 횡대: 전방 화력
  COLUMN = 'COLUMN',             // 종대: 돌파력
  SQUARE = 'SQUARE',             // 방진: 균형
  
  // 삼국지 전통 진법
  CRANE_WING = 'CRANE_WING',     // 학익진: 포위 특화
  ARROW = 'ARROW',               // 어린진: 돌파 극대화
  SNAKE = 'SNAKE'                // 사진: 기동력 특화
}

export enum AttackDirection {
  FRONT = 'FRONT',               // 정면 (0-45도, 315-360도)
  SIDE_LEFT = 'SIDE_LEFT',       // 좌측면 (45-135도)
  REAR = 'REAR',                 // 후방 (135-225도)
  SIDE_RIGHT = 'SIDE_RIGHT'      // 우측면 (225-315도)
}

export interface FormationBonus {
  defenseMultiplier: number;     // 방어력 배수
  attackMultiplier: number;      // 공격력 배수
  speedMultiplier: number;       // 이동속도 배수
  avoidMultiplier: number;       // 회피율 배수
}

/**
 * 포메이션별 기본 보너스
 */
export const FORMATION_BASE_BONUS: Record<Formation, FormationBonus> = {
  // 창병 전용
  [Formation.SHIELD_WALL]: {
    defenseMultiplier: 1.3,
    attackMultiplier: 0.9,
    speedMultiplier: 0.7,
    avoidMultiplier: 0.8
  },
  [Formation.SPEAR_WALL]: {
    defenseMultiplier: 1.2,
    attackMultiplier: 1.0,
    speedMultiplier: 0.8,
    avoidMultiplier: 0.9
  },
  
  // 극병 전용
  [Formation.TURTLE]: {
    defenseMultiplier: 1.4,
    attackMultiplier: 0.8,
    speedMultiplier: 0.5,
    avoidMultiplier: 0.7
  },
  [Formation.CIRCLE]: {
    defenseMultiplier: 1.2,
    attackMultiplier: 0.9,
    speedMultiplier: 0.7,
    avoidMultiplier: 0.9
  },
  
  // 기병 전용
  [Formation.WEDGE]: {
    defenseMultiplier: 0.9,
    attackMultiplier: 1.5,
    speedMultiplier: 1.2,
    avoidMultiplier: 0.8
  },
  [Formation.LOOSE]: {
    defenseMultiplier: 0.8,
    attackMultiplier: 1.0,
    speedMultiplier: 1.3,
    avoidMultiplier: 1.2
  },
  
  // 범용
  [Formation.LINE]: {
    defenseMultiplier: 1.0,
    attackMultiplier: 1.2,
    speedMultiplier: 1.0,
    avoidMultiplier: 1.0
  },
  [Formation.COLUMN]: {
    defenseMultiplier: 0.9,
    attackMultiplier: 1.2,
    speedMultiplier: 1.1,
    avoidMultiplier: 0.9
  },
  [Formation.SQUARE]: {
    defenseMultiplier: 1.1,
    attackMultiplier: 1.0,
    speedMultiplier: 0.9,
    avoidMultiplier: 1.0
  },
  [Formation.CRANE_WING]: {
    defenseMultiplier: 1.1,
    attackMultiplier: 1.3,
    speedMultiplier: 0.9,
    avoidMultiplier: 1.1
  },
  [Formation.ARROW]: {
    defenseMultiplier: 0.8,
    attackMultiplier: 1.6,
    speedMultiplier: 1.1,
    avoidMultiplier: 0.7
  },
  [Formation.SNAKE]: {
    defenseMultiplier: 1.0,
    attackMultiplier: 1.0,
    speedMultiplier: 1.4,
    avoidMultiplier: 1.2
  }
};

/**
 * 방향별 피해 보정 (포메이션 × 방향)
 */
export const DIRECTION_MODIFIER: Record<Formation, Record<AttackDirection, { defense: number; attack: number }>> = {
  // 창병 - Shield Wall: 전방 극강, 측/후방 극약
  [Formation.SHIELD_WALL]: {
    [AttackDirection.FRONT]: { defense: 1.5, attack: 1.0 },
    [AttackDirection.SIDE_LEFT]: { defense: 0.7, attack: 0.9 },
    [AttackDirection.SIDE_RIGHT]: { defense: 0.7, attack: 0.9 },
    [AttackDirection.REAR]: { defense: 0.7, attack: 0.6 }
  },
  
  // 창병 - Spear Wall: 전방 강함, 대기병 특화
  [Formation.SPEAR_WALL]: {
    [AttackDirection.FRONT]: { defense: 1.3, attack: 1.3 },
    [AttackDirection.SIDE_LEFT]: { defense: 0.8, attack: 1.0 },
    [AttackDirection.SIDE_RIGHT]: { defense: 0.8, attack: 1.0 },
    [AttackDirection.REAR]: { defense: 0.8, attack: 0.7 }
  },
  
  // 극병 - Turtle: 전방위 방어
  [Formation.TURTLE]: {
    [AttackDirection.FRONT]: { defense: 1.4, attack: 0.8 },
    [AttackDirection.SIDE_LEFT]: { defense: 1.3, attack: 0.8 },
    [AttackDirection.SIDE_RIGHT]: { defense: 1.3, attack: 0.8 },
    [AttackDirection.REAR]: { defense: 1.2, attack: 0.7 }
  },
  
  // 극병 - Circle: 포위 저항
  [Formation.CIRCLE]: {
    [AttackDirection.FRONT]: { defense: 1.2, attack: 1.0 },
    [AttackDirection.SIDE_LEFT]: { defense: 1.2, attack: 0.9 },
    [AttackDirection.SIDE_RIGHT]: { defense: 1.2, attack: 0.9 },
    [AttackDirection.REAR]: { defense: 1.2, attack: 0.8 }
  },
  
  // 기병 - Wedge: 전방 돌격 극강, 후방 극약
  [Formation.WEDGE]: {
    [AttackDirection.FRONT]: { defense: 1.0, attack: 1.5 },
    [AttackDirection.SIDE_LEFT]: { defense: 0.7, attack: 1.0 },
    [AttackDirection.SIDE_RIGHT]: { defense: 0.7, attack: 1.0 },
    [AttackDirection.REAR]: { defense: 0.6, attack: 0.6 }
  },
  
  // 기병 - Loose: 산개 기동
  [Formation.LOOSE]: {
    [AttackDirection.FRONT]: { defense: 0.9, attack: 1.1 },
    [AttackDirection.SIDE_LEFT]: { defense: 0.9, attack: 1.1 },
    [AttackDirection.SIDE_RIGHT]: { defense: 0.9, attack: 1.1 },
    [AttackDirection.REAR]: { defense: 0.9, attack: 1.0 }
  },
  
  // 범용 - Line
  [Formation.LINE]: {
    [AttackDirection.FRONT]: { defense: 1.2, attack: 1.2 },
    [AttackDirection.SIDE_LEFT]: { defense: 0.8, attack: 1.0 },
    [AttackDirection.SIDE_RIGHT]: { defense: 0.8, attack: 1.0 },
    [AttackDirection.REAR]: { defense: 0.6, attack: 0.8 }
  },
  
  // 범용 - Column
  [Formation.COLUMN]: {
    [AttackDirection.FRONT]: { defense: 1.1, attack: 1.2 },
    [AttackDirection.SIDE_LEFT]: { defense: 0.7, attack: 0.9 },
    [AttackDirection.SIDE_RIGHT]: { defense: 0.7, attack: 0.9 },
    [AttackDirection.REAR]: { defense: 0.8, attack: 0.9 }
  },
  
  // 범용 - Square
  [Formation.SQUARE]: {
    [AttackDirection.FRONT]: { defense: 1.1, attack: 1.0 },
    [AttackDirection.SIDE_LEFT]: { defense: 1.0, attack: 1.0 },
    [AttackDirection.SIDE_RIGHT]: { defense: 1.0, attack: 1.0 },
    [AttackDirection.REAR]: { defense: 0.9, attack: 0.9 }
  },
  
  [Formation.CRANE_WING]: {
    [AttackDirection.FRONT]: { defense: 1.2, attack: 1.2 },
    [AttackDirection.SIDE_LEFT]: { defense: 1.2, attack: 1.4 },
    [AttackDirection.SIDE_RIGHT]: { defense: 1.2, attack: 1.4 },
    [AttackDirection.REAR]: { defense: 0.6, attack: 0.8 }
  },
  
  [Formation.ARROW]: {
    [AttackDirection.FRONT]: { defense: 0.9, attack: 1.8 },
    [AttackDirection.SIDE_LEFT]: { defense: 0.6, attack: 0.8 },
    [AttackDirection.SIDE_RIGHT]: { defense: 0.6, attack: 0.8 },
    [AttackDirection.REAR]: { defense: 0.5, attack: 0.5 }
  },
  
  [Formation.SNAKE]: {
    [AttackDirection.FRONT]: { defense: 1.0, attack: 1.2 },
    [AttackDirection.SIDE_LEFT]: { defense: 1.0, attack: 1.0 },
    [AttackDirection.SIDE_RIGHT]: { defense: 1.0, attack: 1.0 },
    [AttackDirection.REAR]: { defense: 0.8, attack: 1.0 }
  }
};

/**
 * 공격 방향 계산
 */
export function calculateAttackDirection(
  attackerX: number,
  attackerY: number,
  defenderX: number,
  defenderY: number,
  defenderFacing: number // 0-360도
): AttackDirection {
  // 공격 각도 계산 (라디안 → 도)
  const dx = defenderX - attackerX;
  const dy = defenderY - attackerY;
  const attackAngle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  // 0-360 범위로 정규화
  const normalizedAttackAngle = (attackAngle + 360) % 360;
  
  // 방어자 방향 기준 상대 각도
  let relativeAngle = (normalizedAttackAngle - defenderFacing + 360) % 360;
  
  // 방향 판정 (8방향 → 4방향)
  if (relativeAngle < 45 || relativeAngle >= 315) {
    return AttackDirection.FRONT;
  } else if (relativeAngle >= 45 && relativeAngle < 135) {
    return AttackDirection.SIDE_LEFT;
  } else if (relativeAngle >= 135 && relativeAngle < 225) {
    return AttackDirection.REAR;
  } else {
    return AttackDirection.SIDE_RIGHT;
  }
}

/**
 * 포메이션 보정 적용
 */
export function getFormationModifier(
  formation: Formation,
  direction: AttackDirection,
  isAttacker: boolean
): number {
  const modifier = DIRECTION_MODIFIER[formation]?.[direction];
  
  if (!modifier) return 1.0;
  
  return isAttacker ? modifier.attack : modifier.defense;
}

/**
 * 최종 데미지 계산 (포메이션 & 방향 포함)
 */
export function calculateFormationDamage(
  baseDamage: number,
  attackerFormation: Formation,
  defenderFormation: Formation,
  attackDirection: AttackDirection,
  unitAdvantage: number = 1.0
): { attackerDamage: number; defenderDamage: number; description: string } {
  // 공격자 포메이션 보너스
  const attackerMod = getFormationModifier(attackerFormation, attackDirection, true);
  
  // 방어자 포메이션 보너스
  const defenderMod = getFormationModifier(defenderFormation, attackDirection, false);
  
  // 최종 데미지
  const finalDamage = baseDamage * unitAdvantage * attackerMod * defenderMod;
  
  // 설명 생성
  const directionText = {
    [AttackDirection.FRONT]: '정면',
    [AttackDirection.SIDE_LEFT]: '좌측면',
    [AttackDirection.SIDE_RIGHT]: '우측면',
    [AttackDirection.REAR]: '후방'
  }[attackDirection];
  
  const description = `${directionText} 공격 (공격 x${attackerMod.toFixed(1)}, 방어 x${defenderMod.toFixed(1)})`;
  
  return {
    attackerDamage: Math.floor(finalDamage),
    defenderDamage: Math.floor(baseDamage * 0.5), // 반격 피해 (간단 계산)
    description
  };
}
