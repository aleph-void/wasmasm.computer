module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.spec.js'],

  transform: {
    // Vue SFC → JS (requires @vue/vue3-jest for Vue 3 + Jest 27)
    '^.+\\.vue$': '@vue/vue3-jest',
    // JS/JSX → CommonJS via the project's babel.config.js
    '^.+\\.js$': 'babel-jest',
  },

  moduleNameMapper: {
    // Path alias used in source files
    '^@/(.*)$': '<rootDir>/src/$1',
    // Redirect the real Emscripten binding to a lightweight mock so
    // unit tests run without a compiled WASM binary or Emscripten SDK.
    '^.+/src/assets/wasmasm\\.js$': '<rootDir>/tests/unit/__mocks__/assemblyModuleMock.js',
    // Silence CSS imports that come through shared imports (e.g. Bootstrap)
    '\\.(css|scss|sass)$': '<rootDir>/tests/unit/__mocks__/styleMock.js',
  },

  // Needed because @vue/vue3-jest reads the project's Babel config
  // and some deep imports inside node_modules are pure-ESM.
  transformIgnorePatterns: ['/node_modules/(?!(bootstrap)/)'],
}
