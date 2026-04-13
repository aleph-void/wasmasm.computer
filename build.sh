#!/bin/sh
set -e

KEYSTONE_LIB="third_party/keystone/build/llvm/lib/libkeystone.a"
ASSETS_DIR="wasmasm/src/assets"
TMP_JS="/tmp/wasmasm.js"
TMP_WASM="/tmp/wasmasm.wasm"

# ── Tool checks ───────────────────────────────────────────────────────────────

check_tool() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "ERROR: required tool '$1' not found in PATH" >&2
        echo "  Install hint: $2" >&2
        exit 1
    fi
}

check_tool emcc   "install Emscripten from https://emscripten.org/docs/getting_started/downloads.html"
check_tool cmake  "install cmake via your package manager (e.g. apt install cmake)"
check_tool make   "install make via your package manager (e.g. apt install build-essential)"
check_tool node   "install Node.js from https://nodejs.org or via nvm"
check_tool npm    "install npm alongside Node.js"

# ── Keystone static library ───────────────────────────────────────────────────

if [ ! -f "$KEYSTONE_LIB" ]; then
    echo ">>> Keystone library not found; building keystone..."
    if [ ! -d "third_party/keystone" ]; then
        echo "ERROR: third_party/keystone/ directory is missing" >&2
        echo "  Run: git submodule update --init --recursive" >&2
        exit 1
    fi
    mkdir -p third_party/keystone/build
    cd third_party/keystone/build
    cmake .. -DCMAKE_BUILD_TYPE=Release \
             -DBUILD_SHARED_LIBS=OFF \
             -DLLVM_TARGETS_TO_BUILD="all" \
             -G "Unix Makefiles"
    make -j"$(nproc 2>/dev/null || echo 4)"
    cd ../../..
    if [ ! -f "$KEYSTONE_LIB" ]; then
        echo "ERROR: keystone build finished but '$KEYSTONE_LIB' was not produced" >&2
        exit 1
    fi
    echo ">>> Keystone built successfully."
fi

# ── Vue / npm dependencies ────────────────────────────────────────────────────

if [ ! -d "wasmasm/node_modules" ]; then
    echo ">>> node_modules not found; running npm install..."
    cd wasmasm
    npm install
    cd ..
fi

# ── Emscripten compile ────────────────────────────────────────────────────────

echo ">>> Compiling wasmasm.c with emcc..."
emcc -O3 \
    -s WASM=1 \
    -s EXPORTED_RUNTIME_METHODS='["cwrap", "stringToUTF8", "UTF8ToString"]' \
    -s EXPORTED_FUNCTIONS='["_assemble", "_malloc", "_free"]' \
    -s ENVIRONMENT='web' \
    -s EXPORT_ES6=1 \
    -s MODULARIZE=1 \
    -I third_party/keystone/include \
    -L third_party/keystone/build/llvm/lib \
    third_party/keystone/build/llvm/lib/libkeystone.a \
    wasmasm.c \
    -lkeystone \
    -o "$TMP_JS"

if [ ! -f "$TMP_JS" ] || [ ! -f "$TMP_WASM" ]; then
    echo "ERROR: emcc did not produce expected output files" >&2
    exit 1
fi

# ── Copy assets ───────────────────────────────────────────────────────────────

mkdir -p "$ASSETS_DIR"

echo '/* eslint-disable */' > "$ASSETS_DIR/wasmasm.js"
cat "$TMP_JS" >> "$ASSETS_DIR/wasmasm.js"
rm -f "$TMP_JS"

mv "$TMP_WASM" "$ASSETS_DIR/wasmasm.wasm"

echo ">>> Assets written to $ASSETS_DIR"

# ── Vue build ─────────────────────────────────────────────────────────────────

echo ">>> Running Vue build..."
cd wasmasm
npm run build
cd ..

echo ">>> Build complete."
