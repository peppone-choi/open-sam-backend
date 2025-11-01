-- ============================================================
-- reserveTroops: 전투를 위한 병력 예약
-- ============================================================
-- KEYS[1]: general:{generalId}
-- ARGV[1]: battleId
-- ARGV[2]: amount (예약할 병력 수)

local reserveTroops = function()
  -- 총 병력과 예약된 병력 조회
  local total = tonumber(redis.call('HGET', KEYS[1], 'crew_total') or 0)
  local reserved = tonumber(redis.call('HGET', KEYS[1], 'crew_reserved') or 0)
  local available = total - reserved

  -- 사용 가능한 병력이 부족한 경우 에러 반환
  if available < tonumber(ARGV[2]) then
    return {err = '병력 부족'}
  end

  -- 예약 병력 증가
  redis.call('HINCRBY', KEYS[1], 'crew_reserved', ARGV[2])
  
  -- 특정 전투에 대한 예약 정보 저장
  redis.call('HSET', KEYS[1], 'reservations:' .. ARGV[1], ARGV[2])
  
  -- 버전 증가
  redis.call('HINCRBY', KEYS[1], 'version', 1)

  return {ok = 'success', available = available - tonumber(ARGV[2])}
end


-- ============================================================
-- finalizeBattle: 전투 완료 처리 및 사상자 반영
-- ============================================================
-- KEYS[1]: general:{generalId}
-- ARGV[1]: battleId
-- ARGV[2]: casualties (사상자 수)

local finalizeBattle = function()
  -- 해당 전투에 예약된 병력 조회
  local reserved = tonumber(redis.call('HGET', KEYS[1], 'reservations:' .. ARGV[1]) or 0)
  
  -- 사상자는 예약된 병력을 초과할 수 없음
  local casualties = math.min(reserved, tonumber(ARGV[2]))
  local survivors = reserved - casualties

  -- 총 병력에서 사상자 감소
  redis.call('HINCRBY', KEYS[1], 'crew_total', -casualties)

  -- 예약된 병력 해제 (전체 예약 병력 감소)
  redis.call('HINCRBY', KEYS[1], 'crew_reserved', -reserved)
  
  -- 해당 전투의 예약 정보 삭제
  redis.call('HDEL', KEYS[1], 'reservations:' .. ARGV[1])
  
  -- 전투 중 델타 정보 삭제
  redis.call('HDEL', KEYS[1], 'in_combat_delta:' .. ARGV[1])

  -- 버전 증가
  redis.call('HINCRBY', KEYS[1], 'version', 1)

  return {ok = 'success', casualties = casualties, survivors = survivors}
end


-- 스크립트 실행 (인자에 따라 분기)
if ARGV[1] == 'reserve' then
  return reserveTroops()
elseif ARGV[1] == 'finalize' then
  return finalizeBattle()
else
  return {err = 'unknown command'}
end
