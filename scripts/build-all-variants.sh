#!/bin/bash
# Build all SyncKit WASM variants
# Usage: ./scripts/build-all-variants.sh

set -e

echo "========================================="
echo "Building All SyncKit WASM Variants"
echo "========================================="
echo ""

VARIANTS=("lite" "default")

for variant in "${VARIANTS[@]}"; do
    echo "Building $variant variant..."
    ./scripts/build-wasm.sh $variant
    echo ""
done

echo "========================================="
echo "✅ All Variants Built Successfully"
echo "========================================="
echo ""
echo "Summary:"
echo "--------"

for variant in "${VARIANTS[@]}"; do
    if [ -f "pkg-$variant/synckit_core_bg.wasm" ]; then
        RAW_SIZE=$(ls -lh pkg-$variant/synckit_core_bg.wasm | awk '{print $5}')
        GZIPPED_BYTES=$(gzip -c pkg-$variant/synckit_core_bg.wasm | wc -c | tr -d ' ')
        GZIPPED_KB=$(awk "BEGIN {printf \"%.1f\", $GZIPPED_BYTES/1024}")
        printf "%-12s  Raw: %6s  Gzipped: %6s KB\n" "$variant" "$RAW_SIZE" "$GZIPPED_KB"
    fi
done

echo ""
echo "Build directories:"
for variant in "${VARIANTS[@]}"; do
    echo "  - pkg-$variant/"
done
echo ""
