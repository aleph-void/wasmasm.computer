# WASMASM

A browser-based CPU assembler powered by the [Keystone Engine](https://www.keystone-engine.org/) compiled to WebAssembly. Paste assembly instructions, choose your target architecture, and get the assembled bytes back — no server required.

**Live site:** [wasmasm.computer](https://wasmasm.computer)

## Supported architectures

| Architecture | Word sizes | Endianness |
|---|---|---|
| x86 | 16, 32, 64 | little |
| ARM | 32 | little, big |
| AArch64 | 64 | little |
| MIPS | 32, 64 | little, big |
| PPC | 32, 64 | big |
| SPARC | 32 | little, big |

## Repository layout

```
wasmasm.c               C glue layer — wraps the Keystone API for Emscripten
Makefile                Top-level build orchestrator (WASM + Vue + tests)
build.sh                Shell script alternative to make
tests/
  test_wasmasm.c        Native C unit tests for wasmasm.c
  emscripten.h          Stub header so the C source builds without Emscripten
third_party/
  keystone/             Keystone Engine (git submodule)
  capstone/             Capstone Engine (git submodule, reserved)
wasmasm/                Vue 3 front-end
  src/
    assets/
      wasmasm.js        Emscripten-generated JS loader (committed)
      wasmasm.wasm      Compiled WebAssembly module (committed)
  tests/
    unit/               Jest unit tests
    e2e/                Playwright end-to-end tests
  public/               Static assets (index.html, CNAME)
.github/workflows/
  deploy.yml            Full rebuild (WASM + Vue) triggered by C/keystone changes
  pages.yml             Fast webpack-only deploy for Vue-only changes
  test.yml              CI: C unit tests + Vue unit tests on every PR
```

## Prerequisites

### Full build (WASM + Vue)

| Tool | Minimum version |
|---|---|
| [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) (`emcc`) | 3.x |
| CMake | 3.x |
| Make / build-essential | — |
| Node.js | 18+ |
| npm | 8+ |

### Vue-only build (no WASM recompile)

The compiled `wasmasm.js` and `wasmasm.wasm` assets are committed to the repository, so you only need **Node.js** and **npm** to rebuild the front-end.

## Building

### 1. Clone with submodules

```bash
git clone --recurse-submodules https://github.com/nstarke/wasmasm.git
cd wasmasm
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

### 2. Full build (Keystone + WASM + Vue)

```bash
make build
```

This will:
1. Compile the Keystone static library via CMake (cached after the first run)
2. Compile `wasmasm.c` with `emcc` into `wasmasm/src/assets/wasmasm.{js,wasm}`
3. Run `npm ci` inside `wasmasm/`
4. Run the Vue CLI production build into `wasmasm/dist/`

### 3. Vue-only rebuild (no Emscripten required)

If you only changed front-end code and the WASM assets are already present:

```bash
make vue-build
```

Or from inside the `wasmasm/` directory:

```bash
npm run build
```

### 4. Development server

```bash
make serve
# or
cd wasmasm && npm run serve
```

The dev server starts at `http://localhost:8080` with hot-reload.

## Makefile targets

| Target | Description |
|---|---|
| `make build` | Full build: Keystone → WASM → Vue bundle |
| `make keystone` | Build the Keystone static library only |
| `make vue-build` | Vue CLI production build only |
| `make serve` | Start Vue dev server (port 8080) |
| `make test` | Compile and run C unit tests |
| `make clean` | Remove WASM assets, `dist/`, and test binary |
| `make distclean` | `clean` + remove Keystone build and `node_modules` |

## Testing

### C unit tests

Tests live in `tests/test_wasmasm.c` and build against the native Keystone library (no Emscripten required).

```bash
make test
```

### Vue unit tests (Jest)

```bash
cd wasmasm
npm run test:unit
```

### End-to-end tests (Playwright)

E2E tests run against the production build in `wasmasm/dist/`. Build first, then:

```bash
cd wasmasm
npx playwright install --with-deps chromium   # first time only
npm run test:e2e
```

## Deployment

Two GitHub Actions workflows handle deployment to GitHub Pages:

- **`deploy.yml`** — Triggered when `wasmasm.c` or `third_party/keystone/**` changes. Rebuilds Keystone and the WASM module, runs the full test suite, then deploys `wasmasm/dist/` to the `gh-pages` branch.
- **`pages.yml`** — Triggered for all other pushes (Vue source, assets, styles). Skips the Emscripten build entirely and just runs `npm run build`, making deploys fast.

Both workflows publish to [wasmasm.computer](https://wasmasm.computer) via the `CNAME` in `wasmasm/public/`.

## Credits

- Assembler engine: [Keystone Engine](https://www.keystone-engine.org/)
- Compiled to WebAssembly with [Emscripten](https://emscripten.org/)
- Front-end: [Vue 3](https://vuejs.org/)
- Written by [Nicholas Starke](https://starkeblog.com/)
