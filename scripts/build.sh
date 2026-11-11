#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHIMS="$ROOT/.build-shims"

# 部分精简 Linux 环境只安装了 GTK 运行时库，缺少 *.so 开发软链。
# 这里按需生成链接垫片，避免必须安装 *-dev 包才能链接。
mkdir -p "$SHIMS"
LIBS=(
  gobject-2.0 glib-2.0 gtk-3 gdk-3 pangocairo-1.0 pango-1.0 harfbuzz
  atk-1.0 cairo-gobject cairo gdk_pixbuf-2.0 gio-2.0 gmodule-2.0
  dbus-1 webkit2gtk-4.1 javascriptcoregtk-4.1 soup-3.0 z
)
for name in "${LIBS[@]}"; do
  if [ ! -e "/usr/lib/x86_64-linux-gnu/lib${name}.so" ]; then
    so="$(ldconfig -p 2>/dev/null | awk -v n="lib${name}.so" '$1 == n { print $NF; exit }')"
    if [ -z "$so" ]; then
      so="$(ls /usr/lib/x86_64-linux-gnu/lib${name}.so.* 2>/dev/null | head -n 1 || true)"
    fi
    if [ -n "$so" ]; then
      ln -sf "$so" "$SHIMS/lib${name}.so"
    fi
  fi
done

export LIBRARY_PATH="$SHIMS:${LIBRARY_PATH:-}"
export PATH="$HOME/.cargo/bin:$HOME/.nvm/versions/node/v24.22.1/bin:${PATH}"

cd "$ROOT"
cmd="${1:-build}"
shift || true

case "$cmd" in
  build) npm run tauri build -- "$@" ;;
  dev) npm run tauri dev -- "$@" ;;
  test) cargo test --manifest-path src-tauri/Cargo.toml "$@" ;;
  check) cargo check --manifest-path src-tauri/Cargo.toml "$@" ;;
  *)
    echo "usage: $0 [build|dev|test|check] [args...]" >&2
    exit 1
    ;;
esac
