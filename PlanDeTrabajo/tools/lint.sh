#!/usr/bin/env bash
set -euo pipefail
shopt -s globstar

WIKI_DIR="$(cd "$(dirname "$0")/../wiki" && pwd)"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Wiki Health Check ==="
echo ""

# 1. Orphans: pages with no inbound [[wikilinks]] (excluding index/log)
echo "--- Huérfanos (sin inbound links) ---"
orphan_count=0
for page in "$WIKI_DIR"/**/*.md; do
    [ -f "$page" ] || continue
    filename=$(basename "$page" .md)
    [ "$filename" = "index" ] && continue
    [ "$filename" = "log" ] && continue
    # Count [[filename]] and [[filename|alias]]
    link_count=$(rg -c "\[\[$filename(\|[^\]]+)?\]\]" "$WIKI_DIR" -g '*.md' -g '!index.md' -g '!log.md' 2>/dev/null | wc -l || true)
    if [ "$link_count" -eq 0 ]; then
        echo "  ⚠ $filename"
        orphan_count=$((orphan_count + 1))
    fi
done
echo "  Total: $orphan_count"
echo ""

# 2. Broken wikilinks
echo "--- Enlaces rotos ---"
broken_count=0
all_links=$(rg --no-filename -o '\[\[([^\|\]]+)(\|[^\]]+)?\]\]' "$WIKI_DIR" -g '*.md' -r '$1' 2>/dev/null | sort -u)
while IFS= read -r link; do
    [ -z "$link" ] && continue
    found=false
    for dir in "$WIKI_DIR" "$WIKI_DIR/entities" "$WIKI_DIR/concepts" "$WIKI_DIR/sources" "$WIKI_DIR/queries" "$ROOT_DIR" "$ROOT_DIR/planning"; do
        if [ -f "$dir/$link.md" ]; then
            found=true
            break
        fi
    done
    if [ "$found" = false ]; then
        echo "  ⚠ [[$link]]"
        broken_count=$((broken_count + 1))
    fi
done <<< "$all_links"
echo "  Total: $broken_count"
echo ""

# 3. Stats
page_count=$(find "$WIKI_DIR" -name '*.md' | wc -l)
echo "--- Estadísticas ---"
echo "  Páginas totales: $page_count"
echo ""
echo "=== Fin del health-check ==="
