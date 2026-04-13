/**
 * Manual mock for src/assets/wasmasm.js (the Emscripten WASM binding).
 *
 * Wired up via moduleNameMapper in jest.config.js so that every
 * `import assemblyModule from '../assets/wasmasm.js'` in source code
 * resolves to this file instead of the real 64 KB minified module.
 *
 * Tests import `mockAssembler` directly to inspect call arguments and
 * control return values.
 */

export const mockAssembler = {
  _malloc:      jest.fn().mockReturnValue(1000),
  _free:        jest.fn(),
  stringToUTF8: jest.fn(),
  UTF8ToString: jest.fn().mockReturnValue(''),
  _assemble:    jest.fn(),
}

// The real module default-exports a factory function whose return value
// is a Promise that resolves to the module object.
const assemblyModule = jest.fn(() => Promise.resolve(mockAssembler))
export default assemblyModule
