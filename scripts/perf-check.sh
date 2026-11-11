#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm run test:frontend
npm run test:backend
npm run build
npm run test:e2e

echo
echo "Build size:"
du -sh dist
echo
echo "Largest assets:"
find dist/assets -type f -printf '%s %p\n' | sort -nr | head -10
