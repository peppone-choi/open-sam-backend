-- 훈련 처리 Lua 스크립트
-- KEYS: [generalKey, changesStreamKey, dedupKey]
-- ARGV: [commandId, trainIncrease, newAtmos, now, generalId, newVersion, changeData]

-- 중복 실행 방지
if redis.call('EXISTS', KEYS[3]) == 1 then
  return 'DUP'
end

-- 현재 값 조회
local currentTrain = tonumber(redis.call('HGET', KEYS[1], 'train') or 0)
local currentAtmos = tonumber(redis.call('HGET', KEYS[1], 'atmos') or 0)

-- 값 업데이트
redis.call('HSET', KEYS[1], 'train', tonumber(ARGV[2]))
redis.call('HSET', KEYS[1], 'atmos', tonumber(ARGV[3]))

-- 버전 및 dirty 플래그 업데이트
redis.call('HSET', KEYS[1], 'version', tonumber(ARGV[6]))
redis.call('HSET', KEYS[1], 'dirty', '1')
redis.call('HSET', KEYS[1], 'updatedAt', ARGV[4])

-- 변경 로그 기록
redis.call('XADD', KEYS[2], 'MAXLEN', '~', '1000000', '*',
  'entityType', 'general',
  'id', ARGV[5],
  'op', 'update',
  'version', ARGV[6],
  'changes', ARGV[7],
  'updatedAt', ARGV[4]
)

-- De-dup 키 설정 (60초)
redis.call('SET', KEYS[3], '1', 'PX', 60000)

return 'OK'
