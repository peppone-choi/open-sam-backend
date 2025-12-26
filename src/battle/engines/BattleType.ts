/**
 * 전투 타입 정의
 * PHP process_war.php 참조
 */

export enum BattleType {
  /** 야전 - 평지에서의 장수 vs 장수 전투 */
  FIELD = 'field',
  /** 공성전 - 성벽을 공격하는 전투 */
  SIEGE = 'siege',
  /** 수비전 - 성을 방어하는 전투 */
  DEFENSE = 'defense'
}

export enum BattlePhaseType {
  /** 접근 페이즈 - 전투 전 준비 */
  APPROACH = 'approach',
  /** 교전 페이즈 - 실제 전투 */
  COMBAT = 'combat',
  /** 추격/퇴각 페이즈 */
  PURSUIT_RETREAT = 'pursuit_retreat',
  /** 결과 처리 페이즈 */
  RESULT = 'result'
}

export enum BattleResult {
  /** 공격자 승리 */
  ATTACKER_WIN = 'attacker_win',
  /** 방어자 승리 */
  DEFENDER_WIN = 'defender_win',
  /** 무승부 (시간 초과) */
  DRAW = 'draw',
  /** 도시 점령 */
  CITY_CONQUERED = 'city_conquered',
  /** 공격자 퇴각 */
  ATTACKER_RETREAT = 'attacker_retreat',
  /** 방어자 패퇴 */
  DEFENDER_ROUT = 'defender_rout'
}

export enum TerrainType {
  /** 평지 */
  PLAIN = 'plain',
  /** 산악 */
  MOUNTAIN = 'mountain',
  /** 수상 */
  WATER = 'water',
  /** 성벽 */
  WALL = 'wall',
  /** 성문 */
  GATE = 'gate',
  /** 내성 */
  INNER_CASTLE = 'inner_castle'
}

export enum WeatherType {
  /** 맑음 */
  CLEAR = 'clear',
  /** 비 */
  RAIN = 'rain',
  /** 눈 */
  SNOW = 'snow',
  /** 안개 */
  FOG = 'fog',
  /** 강풍 */
  WIND = 'wind'
}

export interface BattleContext {
  battleType: BattleType;
  currentPhase: BattlePhaseType;
  terrain: TerrainType;
  weather: WeatherType;
  turn: number;
  maxTurns: number;
  isSupplyConnected: boolean;
}
