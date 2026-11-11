#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS packaging must run on Darwin with Xcode/Apple SDK." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm ci
rustup target add aarch64-apple-darwin
npm run tauri -- build --target aarch64-apple-darwin --bundles app,dmg

echo
echo "Apple Silicon artifacts:"
find src-tauri/target/aarch64-apple-darwin/release/bundle -maxdepth 3 \
  \( -name '*.dmg' -o -name '*.app' \) -print
