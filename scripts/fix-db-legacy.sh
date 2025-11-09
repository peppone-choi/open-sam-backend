#!/bin/bash
# OpenSAM 레거시 DB 호출 일괄 수정 스크립트
# PHP db.table() → MongoDB Mongoose 변환

echo "=== OpenSAM Legacy DB Fix Script ==="
echo "레거시 DB 호출을 주석 처리합니다..."

# 1. db.queryFirstField 주석 처리
find src/commands -name "*.ts" -exec sed -i 's/^\(\s*\)await db\.queryFirstField/\1\/\/ TODO: await db.queryFirstField/g' {} \;
find src/commands -name "*.ts" -exec sed -i 's/^\(\s*\)const \(.*\) = await db\.queryFirstField/\1\/\/ TODO: const \2 = await db.queryFirstField/g' {} \;

# 2. db.update 주석 처리
find src/commands -name "*.ts" -exec sed -i 's/^\(\s*\)await db\.update/\1\/\/ TODO: await db.update/g' {} \;

# 3. .applyDB(db) → .save()
find src/commands -name "*.ts" -exec sed -i 's/\.applyDB(db)/.save()/g' {} \;

# 4. db.table 주석 처리
find src/commands -name "*.ts" -exec sed -i 's/^\(\s*\)await db\.table/\1\/\/ TODO: await db.table/g' {} \;
find src/commands -name "*.ts" -exec sed -i 's/^\(\s*\)const \(.*\) = await db\.table/\1\/\/ TODO: const \2 = await db.table/g' {} \;

# 5. createObjListFromDB 주석 처리
find src/commands -name "*.ts" -exec sed -i 's/^\(\s*\)createObjListFromDB/\1\/\/ TODO: createObjListFromDB/g' {} \;

# 6. const db = 라인 주석 처리
find src/commands -name "*.ts" -exec sed -i 's/^\(\s*\)const db = /\1\/\/ const db = /g' {} \;

echo "✅ 레거시 DB 호출 주석 처리 완료"
echo "다음 단계: MongoDB Mongoose로 재구현 필요"
