#!/bin/bash

# Add import at line 2
sed -i.bak '2i\
import { asyncHandler } from '"'"'../middleware/async-handler'"'"';
' battle.routes.ts

# Now wrap the routes - we'll do this with perl for better multiline handling
perl -i -pe '
  # Start route
  s/router\.post\('"'"'\/start'"'"', async \(req, res\) => \{/router.post('"'"'\/start'"'"', asyncHandler(async (req, res) => {/;
  
  # Remove try-catch and closing for /start route  
  if (/^router\.post\('"'"'\/start'"'"'/) {
    $in_start = 1;
  }
  if ($in_start && /^\s+try \{/) {
    $_ = "";
  }
  if ($in_start && /^\s+\} catch \(error: any\) \{/) {
    $skip_until_end = 1;
    $_ = "";
  }
  if ($skip_until_end && /^\s+\}$/) {
    $skip_until_end = 0;
    $in_start = 0;
    s/\}\);$/}));/;
  }
  if ($skip_until_end) {
    $_ = "";
  }
' battle.routes.ts

echo "Battle routes updated"
