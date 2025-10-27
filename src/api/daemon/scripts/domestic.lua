-- 내정 처리 Lua 스크립트
-- KEYS: [entityKey, changesStreamKey, dedupKey]
-- ARGV: [commandId, fieldName, scoreValue, now, entityType, entityId, newVersion, changeData]

-- 중복 실행 방지
if redis.call('EXISTS', KEYS[3]) == 1 then
  return 'DUP'
end

-- 현재 값 조회
local currentValue = tonumber(redis.call('HGET', KEYS[1], ARGV[2]) or 0)
local newValue = currentValue + tonumber(ARGV[3])

-- 최대값 제한 (있는 경우)
local maxKey = ARGV[2] .. '_max'
local maxValue = redis.call('HGET', KEYS[1], maxKey)
if maxValue then
  local maxNum = tonumber(maxValue)
  if newValue > maxNum then
    newValue = maxNum
  end
end

-- trust 특별 처리 (최대 100)
if ARGV[2] == 'trust' and newValue > 100 then
  newValue = 100
end

-- 값 업데이트
redis.call('HSET', KEYS[1], ARGV[2], newValue)

-- 버전 및 dirty 플래그 업데이트
redis.call('HSET', KEYS[1], 'version', tonumber(ARGV[7]))
redis.call('HSET', KEYS[1], 'dirty', '1')
redis.call('HSET', KEYS[1], 'updatedAt', ARGV[4])

-- 변경 로그 기록
redis.call('XADD', KEYS[2], 'MAXLEN', '~', '1000000', '*',
  'entityType', ARGV[5],
  'id', ARGV[6],
  'op', 'update',
  'version', ARGV[7],
  'changes', ARGV[8],
  'updatedAt', ARGV[4]
)

-- De-dup 키 설정 (60초)
redis.call('SET', KEYS[3], '1', 'PX', 60000)

return 'OK'
