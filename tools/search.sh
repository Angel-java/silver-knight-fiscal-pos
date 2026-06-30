#!/usr/bin/env bash
set -euo pipefail

WIKI_DIR="$(cd "$(dirname "$0")/../wiki" && pwd)"
QUERY="${1:-}"

if [ -z "$QUERY" ]; then
    echo "Uso: $0 <término de búsqueda>"
    exit 1
fi

echo "=== Búsqueda en wiki: '$QUERY' ==="
echo ""

rg -n -i "$QUERY" "$WIKI_DIR" --include '*.md' -l 2>/dev/null | while read -r file; do
    rel_path="${file#$WIKI_DIR/}"
    title_line=$(head -20 "$file" | grep '^# ' | head -1 || echo "sin título")
    title="${title_line##\# }"
    echo "📄 $rel_path — $title"
    rg -n -i "$QUERY" "$file" --include '*.md' 2>/dev/null | head -5 | while read -r line; do
        echo "     $line"
    done
    echo ""
done
