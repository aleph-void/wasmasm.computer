/**
 * End-to-end tests for wasmasm.
 *
 * These tests run against the production dist/ directory served by a static
 * file server (configured in playwright.config.js).  They exercise the REAL
 * WebAssembly binary, so `make build` must be run before executing them.
 *
 * Expected byte values are taken from keystone's own regression suite
 * (keystone/suite/regress/test_all_archs.py) to stay in sync with the C tests.
 */

const { test, expect } = require('@playwright/test')

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Wait for the WASM module to finish loading.  The component resolves the
 * Emscripten promise in its async created() hook with no visible loading
 * indicator, so we rely on networkidle (all XHR/fetch activity settled,
 * which includes the .wasm fetch).
 */
async function waitForWasm(page) {
  await page.waitForLoadState('networkidle')
}

/**
 * Fill in the assembler form and click Assemble.
 * Returns the output textarea text after the operation.
 */
async function assemble(page, { input, isa, wordSize, endianness }) {
  // Ensure we're in assemble mode.
  // Use /^Assemble$/ (exact regex) so we don't accidentally match "Disassemble".
  const asmToggle = page.locator('button.mode-btn', { hasText: /^Assemble$/ })
  if (!(await asmToggle.evaluate(el => el.classList.contains('mode-btn--active')))) {
    await asmToggle.click()
  }
  await page.fill('#input', input)
  await page.selectOption('#selectedISA', isa)
  await page.selectOption('#selectedWordSize', wordSize)
  await page.selectOption('#selectedEndianness', endianness)
  await page.click('button.btn-primary')
  await page.waitForFunction(() => {
    const out = document.querySelector('#output')
    const err = document.querySelector('.error-banner')
    return (out && out.value.trim() !== '') || (err && err.textContent.trim() !== '')
  }, { timeout: 10_000 })
  return page.inputValue('#output')
}

/**
 * Fill in the disassembler form and click Disassemble.
 * Returns the output textarea text after the operation.
 */
async function disassemble(page, { input, isa, wordSize, endianness }) {
  await page.locator('button.mode-btn', { hasText: 'Disassemble' }).click()
  await page.fill('#input', input)
  await page.selectOption('#selectedISA', isa)
  await page.selectOption('#selectedWordSize', wordSize)
  await page.selectOption('#selectedEndianness', endianness)
  await page.click('button.btn-primary')
  await page.waitForFunction(() => {
    const out = document.querySelector('#output')
    const err = document.querySelector('.error-banner')
    return (out && out.value.trim() !== '') || (err && err.textContent.trim() !== '')
  }, { timeout: 10_000 })
  return page.inputValue('#output')
}

// ── page structure ────────────────────────────────────────────────────────────

test.describe('page structure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('has the correct page title', async ({ page }) => {
    await expect(page).toHaveTitle('wasmasm')
  })

  test('renders the input textarea', async ({ page }) => {
    await expect(page.locator('#input')).toBeVisible()
  })

  test('renders the ISA select with all supported architectures', async ({ page }) => {
    const options = await page.locator('#selectedISA option:not([disabled])').allTextContents()
    expect(options).toEqual(expect.arrayContaining(['x86', 'ARM', 'AArch64', 'MIPS', 'PPC', 'SPARC']))
  })

  test('renders word-size options 16, 32 and 64-bit', async ({ page }) => {
    const options = await page.locator('#selectedWordSize option:not([disabled])').allTextContents()
    expect(options).toEqual(expect.arrayContaining(['16-bit', '32-bit', '64-bit']))
  })

  test('renders endianness options', async ({ page }) => {
    const options = await page.locator('#selectedEndianness option:not([disabled])').allTextContents()
    expect(options).toEqual(expect.arrayContaining(['Little-endian', 'Big-endian']))
  })

  test('Assemble/Disassemble mode toggle buttons are visible', async ({ page }) => {
    // Use exact regex to avoid "Assemble" matching "Disassemble" (substring).
    await expect(page.locator('button.mode-btn', { hasText: /^Assemble$/ })).toBeVisible()
    await expect(page.locator('button.mode-btn', { hasText: /^Disassemble$/ })).toBeVisible()
  })

  test('action button and Copy Link button are visible', async ({ page }) => {
    await expect(page.locator('button.btn-primary')).toBeVisible()
    await expect(page.locator('button.btn-ghost')).toBeVisible()
  })

  test('defaults to assemble mode with Assemble button active', async ({ page }) => {
    const asmBtn = page.locator('button.mode-btn', { hasText: /^Assemble$/ })
    await expect(asmBtn).toHaveClass(/mode-btn--active/)
    await expect(page.locator('button.btn-primary')).toHaveText('Assemble')
  })
})

// ── assembly – x86 ───────────────────────────────────────────────────────────

test.describe('x86 assembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('assembles x86 32-bit: add eax, ecx → 01 c8', async ({ page }) => {
    const output = await assemble(page, {
      input: 'add eax, ecx',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.trim()).toBe('01 c8')
  })

  test('assembles x86 64-bit: add rax, rcx → 48 01 c8', async ({ page }) => {
    const output = await assemble(page, {
      input: 'add rax, rcx',
      isa: 'x86',
      wordSize: '64',
      endianness: 'small',
    })
    expect(output.trim()).toBe('48 01 c8')
  })

  test('assembles x86 16-bit: add eax, ecx → 66 01 c8', async ({ page }) => {
    const output = await assemble(page, {
      input: 'add eax, ecx',
      isa: 'x86',
      wordSize: '16',
      endianness: 'small',
    })
    expect(output.trim()).toBe('66 01 c8')
  })
})

// ── assembly – AArch64 ───────────────────────────────────────────────────────

test.describe('AArch64 assembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('assembles AArch64: ldr w1, [sp, #0x8] → e1 0b 40 b9', async ({ page }) => {
    const output = await assemble(page, {
      input: 'ldr w1, [sp, #0x8]',
      isa: 'aarch64',
      wordSize: '64',
      endianness: 'small',
    })
    expect(output.trim()).toBe('e1 0b 40 b9')
  })
})

// ── assembly – ARM ────────────────────────────────────────────────────────────

test.describe('ARM assembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('assembles ARM 32-bit little-endian: sub r1, r2, r5 → 05 10 42 e0', async ({ page }) => {
    const output = await assemble(page, {
      input: 'sub r1, r2, r5',
      isa: 'arm',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.trim()).toBe('05 10 42 e0')
  })

  test('assembles ARM 32-bit big-endian: sub r1, r2, r5 → e0 42 10 05', async ({ page }) => {
    const output = await assemble(page, {
      input: 'sub r1, r2, r5',
      isa: 'arm',
      wordSize: '32',
      endianness: 'big',
    })
    expect(output.trim()).toBe('e0 42 10 05')
  })

  test('assembles ARM Thumb: movs r4, #0xf0 → f0 24', async ({ page }) => {
    const output = await assemble(page, {
      input: 'movs r4, #0xf0',
      isa: 'arm',
      wordSize: '16',
      endianness: 'small',
    })
    expect(output.trim()).toBe('f0 24')
  })
})

// ── assembly – multi-instruction ─────────────────────────────────────────────

test.describe('multi-instruction assembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('assembles multiple x86 instructions separated by newlines', async ({ page }) => {
    const output = await assemble(page, {
      input: 'nop\nnop',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.trim()).toBe('90 90')
  })
})

// ── disassembly – x86 ────────────────────────────────────────────────────────

test.describe('x86 disassembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('disassembles x86 32-bit: 01 c8 → contains "add"', async ({ page }) => {
    const output = await disassemble(page, {
      input: '01 c8',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.toLowerCase()).toContain('add')
  })

  test('disassembles x86 64-bit: 48 01 c8 → contains "add"', async ({ page }) => {
    const output = await disassemble(page, {
      input: '48 01 c8',
      isa: 'x86',
      wordSize: '64',
      endianness: 'small',
    })
    expect(output.toLowerCase()).toContain('add')
  })

  test('disassembles x86 32-bit: 90 → contains "nop"', async ({ page }) => {
    const output = await disassemble(page, {
      input: '90',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.toLowerCase()).toContain('nop')
  })

  test('disassembly output includes address prefix (0x)', async ({ page }) => {
    const output = await disassemble(page, {
      input: '90',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output).toContain('0x')
  })
})

// ── disassembly – ARM ─────────────────────────────────────────────────────────

test.describe('ARM disassembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('disassembles ARM 32-bit little-endian: 05 10 42 e0 → contains "sub"', async ({ page }) => {
    const output = await disassemble(page, {
      input: '05 10 42 e0',
      isa: 'arm',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.toLowerCase()).toContain('sub')
  })

  test('disassembles ARM Thumb: f0 24 → contains "movs"', async ({ page }) => {
    const output = await disassemble(page, {
      input: 'f0 24',
      isa: 'arm',
      wordSize: '16',
      endianness: 'small',
    })
    expect(output.toLowerCase()).toContain('movs')
  })
})

// ── hex input formats ─────────────────────────────────────────────────────────

test.describe('hex input formats', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('disassembles 0x-prefixed hex bytes', async ({ page }) => {
    const output = await disassemble(page, {
      input: '0x90',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.toLowerCase()).toContain('nop')
  })

  test('disassembles comma-separated hex bytes', async ({ page }) => {
    const output = await disassemble(page, {
      input: '90,90',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(output.toLowerCase()).toContain('nop')
  })
})

// ── round-trip (assemble then disassemble) ────────────────────────────────────

test.describe('round-trip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('x86: assemble add eax, ecx then disassemble result contains "add"', async ({ page }) => {
    const bytes = await assemble(page, {
      input: 'add eax, ecx',
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(bytes.trim()).toBe('01 c8')

    const asm = await disassemble(page, {
      input: bytes.trim(),
      isa: 'x86',
      wordSize: '32',
      endianness: 'small',
    })
    expect(asm.toLowerCase()).toContain('add')
  })

  test('ARM: assemble sub r1,r2,r5 then disassemble result contains "sub"', async ({ page }) => {
    const bytes = await assemble(page, {
      input: 'sub r1, r2, r5',
      isa: 'arm',
      wordSize: '32',
      endianness: 'small',
    })
    expect(bytes.trim()).toBe('05 10 42 e0')

    const asm = await disassemble(page, {
      input: bytes.trim(),
      isa: 'arm',
      wordSize: '32',
      endianness: 'small',
    })
    expect(asm.toLowerCase()).toContain('sub')
  })
})

// ── assembly – error handling ─────────────────────────────────────────────────

test.describe('error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('shows an error banner for invalid assembly input', async ({ page }) => {
    await page.fill('#input', '@@not_an_instruction@@')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-primary')
    await page.waitForSelector('.error-banner', { timeout: 10_000 })
    await expect(page.locator('.error-banner')).toBeVisible()
  })

  test('shows an error banner for invalid hex in disassemble mode', async ({ page }) => {
    await page.locator('button.mode-btn', { hasText: 'Disassemble' }).click()
    await page.fill('#input', 'ZZ ZZ')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-primary')
    await page.waitForSelector('.error-banner', { timeout: 10_000 })
    await expect(page.locator('.error-banner')).toBeVisible()
  })

  test('clears a previous error when a successful assembly follows', async ({ page }) => {
    // trigger an error first
    await page.fill('#input', '@@bad@@')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-primary')
    await page.waitForSelector('.error-banner')
    // then succeed
    await assemble(page, { input: 'add eax, ecx', isa: 'x86', wordSize: '32', endianness: 'small' })
    await expect(page.locator('.error-banner')).not.toBeVisible()
  })
})

// ── copy output button ────────────────────────────────────────────────────────

test.describe('copy output button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('copy button is hidden before any output is produced', async ({ page }) => {
    await expect(page.locator('button.btn-copy')).not.toBeVisible()
  })

  test('copy button appears after assembly produces output', async ({ page }) => {
    await assemble(page, { input: 'nop', isa: 'x86', wordSize: '32', endianness: 'small' })
    await expect(page.locator('button.btn-copy')).toBeVisible()
  })

  test('clicking copy button copies the assembled output to the clipboard', async ({ page }) => {
    await assemble(page, { input: 'nop', isa: 'x86', wordSize: '32', endianness: 'small' })
    await page.click('button.btn-copy')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard.trim()).toBe('90')
  })

  test('copy button label changes to "Copied!" immediately after click', async ({ page }) => {
    await assemble(page, { input: 'nop', isa: 'x86', wordSize: '32', endianness: 'small' })
    await page.click('button.btn-copy')
    await expect(page.locator('button.btn-copy')).toHaveText('Copied!')
  })
})

// ── URL parameter pre-population ──────────────────────────────────────────────

test.describe('URL parameter loading', () => {
  test('pre-fills the form from query parameters', async ({ page }) => {
    await page.goto('/?isa=arm&word=32&endian=big&input=sub%20r1%2C%20r2%2C%20r5')
    await waitForWasm(page)
    await expect(page.locator('#selectedISA')).toHaveValue('arm')
    await expect(page.locator('#selectedWordSize')).toHaveValue('32')
    await expect(page.locator('#selectedEndianness')).toHaveValue('big')
    await expect(page.locator('#input')).toHaveValue('sub r1, r2, r5')
  })

  test('restores disassemble mode from the mode query param', async ({ page }) => {
    await page.goto('/?mode=disassemble&isa=x86&word=32&endian=small&input=01+c8')
    await waitForWasm(page)
    const disBtn = page.locator('button.mode-btn', { hasText: 'Disassemble' })
    await expect(disBtn).toHaveClass(/mode-btn--active/)
    await expect(page.locator('button.btn-primary')).toHaveText('Disassemble')
  })

  test('assembles correctly after loading state from URL parameters', async ({ page }) => {
    await page.goto('/?isa=x86&word=32&endian=small&input=add%20eax%2C%20ecx')
    await waitForWasm(page)
    await page.click('button.btn-primary')
    await page.waitForFunction(() => {
      const out = document.querySelector('#output')
      return out && out.value.trim() !== ''
    }, { timeout: 10_000 })
    const output = await page.inputValue('#output')
    expect(output.trim()).toBe('01 c8')
  })

  test('disassembles correctly after loading disassemble mode from URL parameters', async ({ page }) => {
    await page.goto('/?mode=disassemble&isa=x86&word=32&endian=small&input=01+c8')
    await waitForWasm(page)
    await page.click('button.btn-primary')
    await page.waitForFunction(() => {
      const out = document.querySelector('#output')
      const err = document.querySelector('.error-banner')
      return (out && out.value.trim() !== '') || (err && err.textContent.trim() !== '')
    }, { timeout: 10_000 })
    const output = await page.inputValue('#output')
    expect(output.toLowerCase()).toContain('add')
  })
})

// ── i18n / language selector ──────────────────────────────────────────────────

test.describe('i18n / language selector', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any previously stored locale so tests start from English.
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('wasmasm_locale'))
    await page.goto('/')
    await waitForWasm(page)
  })

  test('language selector is visible in the nav', async ({ page }) => {
    await expect(page.locator('select.locale-select')).toBeVisible()
  })

  test('language selector contains all 10 supported locales', async ({ page }) => {
    const texts = await page.locator('select.locale-select option').allTextContents()
    expect(texts).toEqual(expect.arrayContaining([
      'English',
      '简体中文',
      'हिन्दी',
      'Español',
      'Français',
      'العربية',
      'বাংলা',
      'Português',
      'Русский',
      'اردو',
    ]))
    expect(texts).toHaveLength(10)
  })

  test('selector defaults to English on first visit', async ({ page }) => {
    await expect(page.locator('select.locale-select')).toHaveValue('en')
  })

  test('switching to French updates the nav subtitle', async ({ page }) => {
    await page.selectOption('select.locale-select', 'fr')
    await expect(page.locator('.nav-tag')).toHaveText('Assembleur WebAssembly')
  })

  test('switching to French updates the action button to "Assembler"', async ({ page }) => {
    await page.selectOption('select.locale-select', 'fr')
    await expect(page.locator('button.btn-primary')).toHaveText('Assembler')
  })

  test('switching to French updates mode toggle buttons', async ({ page }) => {
    await page.selectOption('select.locale-select', 'fr')
    await expect(page.locator('button.mode-btn', { hasText: /^Assembler$/ })).toBeVisible()
    await expect(page.locator('button.mode-btn', { hasText: /^Désassembler$/ })).toBeVisible()
  })

  test('switching to Spanish updates the action button to "Ensamblar"', async ({ page }) => {
    await page.selectOption('select.locale-select', 'es')
    await expect(page.locator('button.btn-primary')).toHaveText('Ensamblar')
  })

  test('switching to Spanish updates mode toggle labels', async ({ page }) => {
    await page.selectOption('select.locale-select', 'es')
    await expect(page.locator('button.mode-btn', { hasText: /^Ensamblar$/ })).toBeVisible()
    await expect(page.locator('button.mode-btn', { hasText: /^Desensamblar$/ })).toBeVisible()
  })

  test('switching to Chinese updates the action button to "汇编"', async ({ page }) => {
    await page.selectOption('select.locale-select', 'zh-CN')
    await expect(page.locator('button.btn-primary')).toHaveText('汇编')
  })

  test('selected locale is saved to localStorage', async ({ page }) => {
    await page.selectOption('select.locale-select', 'fr')
    const stored = await page.evaluate(() => localStorage.getItem('wasmasm_locale'))
    expect(stored).toBe('fr')
  })

  test('locale stored in localStorage is restored on page reload', async ({ page }) => {
    await page.selectOption('select.locale-select', 'fr')
    await page.reload()
    await waitForWasm(page)
    await expect(page.locator('select.locale-select')).toHaveValue('fr')
    await expect(page.locator('button.btn-primary')).toHaveText('Assembler')
  })

  test('assembler still works correctly after switching locale', async ({ page }) => {
    await page.selectOption('select.locale-select', 'fr')
    // Use btn-primary directly — the assemble() helper looks for /^Assemble$/ (English only).
    await page.fill('#input', 'add eax, ecx')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-primary')
    await page.waitForFunction(() => {
      const out = document.querySelector('#output')
      const err = document.querySelector('.error-banner')
      return (out && out.value.trim() !== '') || (err && err.textContent.trim() !== '')
    }, { timeout: 10_000 })
    const output = await page.inputValue('#output')
    expect(output.trim()).toBe('01 c8')
  })

  test('copy button label shows translated text after clicking in French locale', async ({ page }) => {
    await page.selectOption('select.locale-select', 'fr')
    await page.fill('#input', 'nop')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-primary')
    await page.waitForFunction(() => {
      const out = document.querySelector('#output')
      return out && out.value.trim() !== ''
    }, { timeout: 10_000 })
    await page.click('button.btn-copy')
    await expect(page.locator('button.btn-copy')).toHaveText('Copié')
  })
})

// ── copy link ─────────────────────────────────────────────────────────────────

test.describe('copy link', () => {
  test('writes a URL containing all form parameters to the clipboard', async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
    await page.fill('#input', 'add eax, ecx')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-ghost')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('mode=assemble')
    expect(clipboard).toContain('isa=x86')
    expect(clipboard).toContain('word=32')
    expect(clipboard).toContain('endian=small')
    expect(clipboard).toContain('input=')
  })

  test('includes mode=disassemble in link when in disassemble mode', async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
    await page.locator('button.mode-btn', { hasText: 'Disassemble' }).click()
    await page.fill('#input', '90')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-ghost')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('mode=disassemble')
  })
})
