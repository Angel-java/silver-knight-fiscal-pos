#!/usr/bin/env bash
set -euo pipefail

WIKI_DIR="$(cd "$(dirname "$0")/../wiki" && pwd)"

echo "=== Wiki Health Check ==="
echo ""

# 1. Orphans: pages with no inbound [[wikilinks]]
echo "--- Huérfanos (sin inbound links) ---"
orphan_count=0
for page in "$WIKI_DIR"/**/*.md "$WIKI_DIR"/*.md; do
    [ -f "$page" ] || continue
    filename=$(basename "$page" .md)
    # Skip index and log
    [ "$filename" = "index" ] && continue
    [ "$filename" = "log" ] && continue
    # Count how many times this page is linked from other pages
    link_count=$(rg -c "\[\[$filename\]\]" "$WIKI_DIR" --include '*.md' -g '!index.md' -g '!log.md' 2>/dev/null | wc -l || true)
    if [ "$link_count" -eq 0 ]; then
        echo "  ⚠ $filename"
        orphan_count=$((orphan_count + 1))
    fi
done
echo "  Total: $orphan_count"
echo ""

# 2. Broken wikilinks ([[...]] pointing to non-existent pages)
echo "--- Enlaces rotos ---"
broken_count=0
# Extract all [[links]] and check if target file exists
all_links=$(rg -o '\[\[([^\]]+)\]\]' "$WIKI_DIR" --include '*.md' -r '$1' 2>/dev/null | sort -u)
while IFS= read -r link; do
    [ -z "$link" ] && continue
    target="$WIKI_DIR/$link.md"
    # Check both direct and category paths
    found=false
    for ext in ".md" ""; do
        for dir in "$WIKI_DIR" "$WIKI_DIR/entities" "$WIKI_DIR/concepts" "$WIKI_DIR/sources" "$WIKI_DIR/queries"; do
            if [ -f "$dir/$link.md" ]; then
                found=true
                break 2
            fi
        done
    done
    if [ "$found" = false ]; then
        echo "  ⚠ [[$link]]"
        broken_count=$((broken_count + 1))
    fi
done <<< "$all_links"
echo "  Total: $broken_count"
echo ""

# 3. Page count
page_count=$(find "$WIKI_DIR" -name '*.md' | wc -l)
echo "--- Estadísticas ---"
echo "  Páginas totales: $page_count"
echo ""
echo "=== Fin del health-check ==="
