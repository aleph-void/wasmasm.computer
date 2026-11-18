// ESLint flat config (ESLint 9+). Replaces the former `eslintConfig` block in
// package.json, which ESLint 10 no longer reads.
const js = require('@eslint/js')
const pluginVue = require('eslint-plugin-vue')
const globals = require('globals')

module.exports = [
  {
    ignores: [
      'dist/',
      // Emscripten-generated binding
      'src/assets/wasmasm.js',
      'playwright-report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['tests/unit/**/*.js'],
    languageOptions: { globals: globals.jest },
  },
]
