#!/usr/bin/env bash
set -euo pipefail

WIKI_DIR="$(cd "$(dirname "$0")/../wiki" && pwd)"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Estadísticas de la Wiki ==="
echo ""

# Total pages
total=$(find "$WIKI_DIR" -name '*.md' | wc -l)
echo "Páginas totales: $total"

# By category
for category in entities concepts sources queries; do
    count=$(find "$WIKI_DIR/$category" -name '*.md' 2>/dev/null | wc -l)
    echo "  $category: $count"
done

# Total words
words=$(find "$WIKI_DIR" -name '*.md' -exec cat {} + | wc -w)
echo "Palabras totales: $words"

# Total wikilinks
wikilinks=$(find "$WIKI_DIR" -name '*.md' -exec rg -o '\[\[([^\]]+)\]\]' {} + 2>/dev/null | wc -l || echo "0")
echo "Wikilinks totales: $wikilinks"

# Last log entries
echo ""
echo "Últimas entradas en log.md:"
grep "^## \[" "$WIKI_DIR/log.md" 2>/dev/null | tail -5 || echo "  (no entries)"
