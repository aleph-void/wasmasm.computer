#!/bin/sh
# /* eslint-disable */
emcc -O3 -s WASM=1 -s EXPORTED_RUNTIME_METHODS='["cwrap", "stringToUTF8", "UTF8ToString"]' -s EXPORTED_FUNCTIONS='["_assemble", "_malloc", "_free"]' -s ENVIRONMENT='web' -s EXPORT_ES6=1 -s MODULARIZE=1 -I keystone/include -L keystone/build/llvm/lib keystone/build/llvm/lib/libkeystone.a wasmasm.c -lkeystone -o /tmp/wasmasm.js
echo '/* eslint-disable */' > wasmasm/src/assets/wasmasm.js
cat /tmp/wasmasm.js >> wasmasm/src/assets/wasmasm.js
mv /tmp/wasmasm.wasm wasmasm/src/assets/
cd wasmasm
vue build