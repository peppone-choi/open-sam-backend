#!/bin/bash
# Info 서비스
for file in ./src/services/info/*.service.ts; do
  [ ! -f "$file" ] && continue
  echo "처리: $(basename $file)"
  sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
  sed -i "s|import { Nation } from '../../models/nation.model';|import { nationRepository } from '../../repositories/nation.repository';|g" "$file"
  sed -i "s|import { GeneralRecord } from '../../models/general_record.model';|import { generalRecordRepository } from '../../repositories/general-record.repository';|g" "$file"
  sed -i "s|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.no':[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndNo(\1, \2)|g" "$file"
  sed -i "s|(Nation as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.nation':[[:space:]]*\([^}]*\)[[:space:]]*})|nationRepository.findByNationNum(\1, \2)|g" "$file"
done
# Message 서비스
for file in ./src/services/message/*.service.ts; do
  [ ! -f "$file" ] && continue
  echo "처리: $(basename $file)"
  sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
  sed -i "s|import { Message } from '../../models/message.model';|import { messageRepository } from '../../repositories/message.repository';|g" "$file"
  sed -i "s|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.no':[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndNo(\1, \2)|g" "$file"
done
echo "Info & Message 서비스 리팩토링 완료!"
