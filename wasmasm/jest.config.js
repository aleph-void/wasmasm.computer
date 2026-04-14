const path = require('path')

module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.spec.js'],

  transform: {
    // Vue SFC → JS (requires @vue/vue3-jest for Vue 3 + Jest 29)
    '^.+\\.vue$': '@vue/vue3-jest',
    // JS/JSX → CommonJS via the project's babel.config.js
    '^.+\\.js$': 'babel-jest',
  },

  // jsdom normally activates browser export conditions, causing vue/intlify
  // packages to resolve to their ESM browser bundles which Jest can't parse.
  // Override to Node-compatible conditions so CJS builds are selected instead.
  testEnvironmentOptions: {
    customExportConditions: ['node', 'require', 'default'],
  },

  moduleNameMapper: {
    // Path alias used in source files
    '^@/(.*)$': '<rootDir>/src/$1',
    // Redirect the real Emscripten binding to a lightweight mock so
    // unit tests run without a compiled WASM binary or Emscripten SDK.
    // Use path.resolve so the mapped path is identical to what the spec file
    // resolves when it imports the mock directly — this ensures a single
    // module-registry entry and stable reference equality in tests.
    '(^|/)assets/wasmasm\\.js$': path.resolve(__dirname, 'tests/unit/__mocks__/assemblyModuleMock.js'),
    // Silence CSS imports that come through shared imports (e.g. Bootstrap)
    '\\.(css|scss|sass)$': '<rootDir>/tests/unit/__mocks__/styleMock.js',
  },

  // Needed because @vue/vue3-jest reads the project's Babel config
  // and some deep imports inside node_modules are pure-ESM.
  transformIgnorePatterns: ['/node_modules/(?!(bootstrap)/)'],
}
