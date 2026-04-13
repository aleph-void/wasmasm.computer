/* Stub emscripten.h for native (non-WASM) test builds.
 * EMSCRIPTEN_KEEPALIVE becomes a no-op so wasmasm.c compiles with gcc/g++. */
#ifndef EMSCRIPTEN_H
#define EMSCRIPTEN_H
#define EMSCRIPTEN_KEEPALIVE
#endif
