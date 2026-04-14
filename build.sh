#!/bin/sh
set -e

KEYSTONE_LIB="third_party/keystone/build/llvm/lib/libkeystone.a"
CAPSTONE_LIB="third_party/capstone/build/libcapstone.a"
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
    echo ">>> Keystone library not found; building keystone with Emscripten..."
    if [ ! -d "third_party/keystone" ]; then
        echo "ERROR: third_party/keystone/ directory is missing" >&2
        echo "  Run: git submodule update --init --recursive" >&2
        exit 1
    fi
    mkdir -p third_party/keystone/build
    cd third_party/keystone/build
    emcmake cmake .. -DCMAKE_BUILD_TYPE=Release \
             -DBUILD_SHARED_LIBS=OFF \
             -DBUILD_LIBS_ONLY=ON \
             -DLLVM_TARGETS_TO_BUILD="all" \
             -G "Unix Makefiles"
    emmake make -j"$(nproc 2>/dev/null || echo 4)"
    cd ../../..
    if [ ! -f "$KEYSTONE_LIB" ]; then
        echo "ERROR: keystone build finished but '$KEYSTONE_LIB' was not produced" >&2
        exit 1
    fi
    echo ">>> Keystone built successfully."
fi

# ── Capstone static library ───────────────────────────────────────────────────

if [ ! -f "$CAPSTONE_LIB" ]; then
    echo ">>> Capstone library not found; building capstone with Emscripten..."
    if [ ! -d "third_party/capstone" ]; then
        echo "ERROR: third_party/capstone/ directory is missing" >&2
        echo "  Run: git submodule update --init --recursive" >&2
        exit 1
    fi
    mkdir -p third_party/capstone/build
    cd third_party/capstone/build
    emcmake cmake .. -DCMAKE_BUILD_TYPE=Release \
             -DBUILD_SHARED_LIBS=OFF \
             -DCAPSTONE_BUILD_LEGACY_TESTS=OFF \
             -DCAPSTONE_BUILD_CSTEST=OFF \
             -DCAPSTONE_BUILD_CSTOOL=OFF \
             -G "Unix Makefiles"
    emmake make -j"$(nproc 2>/dev/null || echo 4)"
    cd ../../..
    if [ ! -f "$CAPSTONE_LIB" ]; then
        echo "ERROR: capstone build finished but '$CAPSTONE_LIB' was not produced" >&2
        exit 1
    fi
    echo ">>> Capstone built successfully."
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
    -s EXPORTED_FUNCTIONS='["_assemble", "_disassemble", "_malloc", "_free"]' \
    -s ENVIRONMENT='web' \
    -s EXPORT_ES6=1 \
    -s MODULARIZE=1 \
    -I third_party/keystone/include \
    -I third_party/capstone/include \
    -L third_party/keystone/build/llvm/lib \
    -L third_party/capstone/build \
    third_party/keystone/build/llvm/lib/libkeystone.a \
    third_party/capstone/build/libcapstone.a \
    wasmasm.c \
    -lkeystone \
    -lcapstone \
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
