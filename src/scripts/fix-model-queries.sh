#!/bin/bash

# Fix all 'data.no' -> 'no', 'data.nation' -> 'nation', etc. in services
# This fixes the critical model field mismatch issue (B1)

cd /mnt/e/opensam/open-sam-backend/src

# Backup first
echo "Creating backup..."
tar -czf ../backups/services-backup-$(date +%Y%m%d-%H%M%S).tar.gz services/ 2>/dev/null || true

echo "Fixing General queries..."

# Fix 'data.no' -> 'no'
find services/ -type f -name "*.ts" -exec sed -i "s/'data\.no':/'no':/g" {} \;

# Fix 'data.nation' -> 'nation'  
find services/ -type f -name "*.ts" -exec sed -i "s/'data\.nation':/'nation':/g" {} \;

# Fix 'data.city' -> 'city' (but NOT data.city_id or other variants)
find services/ -type f -name "*.ts" -exec sed -i "s/'data\.city':/'city':/g" {} \;

# Fix 'data.npc' -> 'npc'
find services/ -type f -name "*.ts" -exec sed -i "s/'data\.npc':/'npc':/g" {} \;

# Fix 'data.name' -> 'name' (only in Troop contexts, careful!)
# Skipping this one as it's context-dependent

# Fix ExecuteEngine service
echo "Fixing ExecuteEngine..."
sed -i "s/'data\.turntime':/'turntime':/g" services/global/ExecuteEngine.service.ts
sed -i "s/general\.data\.nation/general.nation/g" services/global/ExecuteEngine.service.ts  
sed -i "s/general\.data\.officer_level/general.data.officer_level/g" services/global/ExecuteEngine.service.ts

echo "Done! Please review changes and run: npm run typecheck"
