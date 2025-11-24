#!/bin/bash

echo "======================================"
echo "Verifying Error Handling Implementation"
echo "======================================"
echo ""

echo "✓ Checking error classes..."
test -f src/common/errors/app-error.ts && echo "  ✅ app-error.ts exists" || echo "  ❌ app-error.ts missing"
test -f src/common/errors/index.ts && echo "  ✅ index.ts exists" || echo "  ❌ index.ts missing"
grep -q "ValidationError" src/common/errors/app-error.ts && echo "  ✅ ValidationError added" || echo "  ❌ ValidationError missing"

echo ""
echo "✓ Checking async handler..."
test -f src/middleware/async-handler.ts && echo "  ✅ async-handler.ts exists" || echo "  ❌ async-handler.ts missing"

echo ""
echo "✓ Checking error middleware..."
grep -q "success: false" src/common/middleware/error.middleware.ts && echo "  ✅ Standardized format applied" || echo "  ❌ Format not standardized"

echo ""
echo "✓ Checking routes..."
GENERAL_COUNT=$(grep -c "asyncHandler" src/routes/general.routes.ts)
BATTLE_COUNT=$(grep -c "asyncHandler" src/routes/battle.routes.ts)
NATION_COUNT=$(grep -c "asyncHandler" src/routes/nation.routes.ts)

echo "  general.routes.ts: $GENERAL_COUNT uses of asyncHandler"
echo "  battle.routes.ts: $BATTLE_COUNT uses of asyncHandler"
echo "  nation.routes.ts: $NATION_COUNT uses of asyncHandler"
echo "  Total: $((GENERAL_COUNT + BATTLE_COUNT + NATION_COUNT)) routes updated"

echo ""
echo "✓ Checking documentation..."
test -f ERROR_HANDLING_SUMMARY.md && echo "  ✅ Summary documentation" || echo "  ❌ Summary missing"
test -f ERROR_HANDLING_QUICK_REF.md && echo "  ✅ Quick reference" || echo "  ❌ Quick reference missing"
test -f IMPLEMENTATION_COMPLETE.md && echo "  ✅ Completion report" || echo "  ❌ Completion report missing"

echo ""
echo "======================================"
echo "✅ Implementation verification complete!"
echo "======================================"
