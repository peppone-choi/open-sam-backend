#!/bin/bash
# Tournament 서비스
for file in ./src/services/tournament/*.service.ts; do
  [ ! -f "$file" ] && continue
  echo "처리: $(basename $file)"
  sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
  sed -i "s|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.no':[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndNo(\1, \2)|g" "$file"
done
# Betting 서비스
for file in ./src/services/betting/*.service.ts; do
  [ ! -f "$file" ] && continue
  echo "처리: $(basename $file)"
  sed -i "s|import { General } from '../../models/general.model';|import { generalRepository } from '../../repositories/general.repository';|g" "$file"
  sed -i "s|import { Betting } from '../../models/betting.model';|import { bettingRepository } from '../../repositories/betting.repository';|g" "$file"
  sed -i "s|(General as any)\.findOne({[[:space:]]*session_id:[[:space:]]*\([^,]*\),[[:space:]]*'data\.no':[[:space:]]*\([^}]*\)[[:space:]]*})|generalRepository.findBySessionAndNo(\1, \2)|g" "$file"
done
echo "Tournament & Betting 서비스 리팩토링 완료!"
