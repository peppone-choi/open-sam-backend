#!/bin/bash
# Fix static-only repositories by adding instance exports

REPOS=("betting" "vote" "global" "inheritaction" "nationcommand" "misc")

for repo in "${REPOS[@]}"; do
  file="src/repositories/${repo}.repository.ts"
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Backup
    cp "$file" "${file}.backup"
    
    # Get the capitalized name
    name_cap=$(echo ${repo:0:1} | tr a-z A-Z)${repo:1}
    
    # Read original content
    original=$(cat "$file")
    
    # Create new content with instance export
    cat > "$file" << ENDFILE
/**
 * ${name_cap} Repository - Instance Export
 * Auto-generated to support both static and instance methods
 */

// Re-export the static class for backwards compatibility
${original}

// Add instance export
export const ${repo}Repository = new ${name_cap}Repository();
ENDFILE
    
    echo "✅ Fixed $file"
  fi
done

echo "Done!"
