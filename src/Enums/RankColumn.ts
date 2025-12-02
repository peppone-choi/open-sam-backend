/**
 * Rank Column
 * 장수 랭크 데이터 컬럼
 * 
 * PHP 대응: core/hwe/sammo/Enums/RankColumn.php
 */
export enum RankColumn {
  /** 계략 횟수 */
  firenum = 'firenum',
  /** 전투 횟수 */
  warnum = 'warnum',
  /** 전투 승리(적 전멸) 수 */
  killnum = 'killnum',
  /** 전투 패배(아군 전멸) 수 */
  deathnum = 'deathnum',
  /** 사살 병력 수 */
  killcrew = 'killcrew',
  /** 피살 병력 수 */
  deathcrew = 'deathcrew',

  /** 토너먼트 전력전 승 */
  ttw = 'ttw',
  /** 토너먼트 전력전 무 */
  ttd = 'ttd',
  /** 토너먼트 전력전 패 */
  ttl = 'ttl',
  /** 토너먼트 전력전 전 */
  ttg = 'ttg',
  /** 토너먼트 전력전 포인트 */
  ttp = 'ttp',

  /** 토너먼트 통솔전 승 */
  tlw = 'tlw',
  /** 토너먼트 통솔전 무 */
  tld = 'tld',
  /** 토너먼트 통솔전 패 */
  tll = 'tll',
  /** 토너먼트 통솔전 전 */
  tlg = 'tlg',
  /** 토너먼트 통솔전 포인트 */
  tlp = 'tlp',

  /** 토너먼트 일기토 승 */
  tsw = 'tsw',
  /** 토너먼트 일기토 무 */
  tsd = 'tsd',
  /** 토너먼트 일기토 패 */
  tsl = 'tsl',
  /** 토너먼트 일기토 전 */
  tsg = 'tsg',
  /** 토너먼트 일기토 포인트 */
  tsp = 'tsp',

  /** 토너먼트 설전 승 */
  tiw = 'tiw',
  /** 토너먼트 설전 무 */
  tid = 'tid',
  /** 토너먼트 설전 패 */
  til = 'til',
  /** 토너먼트 설전 전 */
  tig = 'tig',
  /** 토너먼트 설전 포인트 */
  tip = 'tip',

  /** 토너먼트 베팅 성공 수 */
  betwin = 'betwin',
  /** 토너먼트 베팅 금액 */
  betgold = 'betgold',
  /** 토너먼트 베팅 성공 금액 */
  betwingold = 'betwingold',

  /** 대인 사살 병력 수 */
  killcrew_person = 'killcrew_person',
  /** 대인 피살 병력 수 */
  deathcrew_person = 'deathcrew_person',

  /** 점령 */
  occupied = 'occupied',

  /** 유산 포인트 획득(지연) */
  inherit_point_earned = 'inherit_earned',
  /** 유산 포인트 소모(지연) */
  inherit_point_spent = 'inherit_spent',

  /** 유산 포인트 획득량(merge 명령) */
  inherit_point_earned_by_merge = 'inherit_earned_dyn',
  /** 유산 포인트 획득량(베팅 등 별도 명령) */
  inherit_point_earned_by_action = 'inherit_earned_act',
  /** 유산 포인트 소모량(증감 있음) */
  inherit_point_spent_dynamic = 'inherit_spent_dyn',
}

/**
 * 문자열을 RankColumn으로 변환 (tryFrom 대응)
 */
export function tryRankColumnFrom(value: string): RankColumn | null {
  const values = Object.values(RankColumn);
  if (values.includes(value as RankColumn)) {
    return value as RankColumn;
  }
  return null;
}

/**
 * 모든 RankColumn 값 반환 (cases() 대응)
 */
export function getRankColumnCases(): RankColumn[] {
  return Object.values(RankColumn);
}




