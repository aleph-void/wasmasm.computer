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
 * which includes the .wasm fetch) plus a short stability check.
 */
async function waitForWasm(page) {
  await page.waitForLoadState('networkidle')
}

/**
 * Fill in the assembler form and click Assemble.
 * Returns the output textarea text after the operation.
 */
async function assemble(page, { input, isa, wordSize, endianness }) {
  await page.fill('#input', input)
  await page.selectOption('#selectedISA', isa)
  await page.selectOption('#selectedWordSize', wordSize)
  await page.selectOption('#selectedEndianness', endianness)
  await page.click('button.btn-primary')
  // Wait for the output textarea to become non-empty or for an error to appear
  await page.waitForFunction(() => {
    const out = document.querySelector('#output')
    const err = document.querySelector('span[style*="color: red"]')
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
    expect(options).toEqual(expect.arrayContaining(['ARM', 'x86', 'MIPS', 'PPC', 'SPARC']))
  })

  test('renders word-size options 16, 32 and 64-bit', async ({ page }) => {
    const options = await page.locator('#selectedWordSize option:not([disabled])').allTextContents()
    expect(options).toEqual(expect.arrayContaining(['16-bit', '32-bit', '64-bit']))
  })

  test('renders endianness options Big and Small', async ({ page }) => {
    const options = await page.locator('#selectedEndianness option:not([disabled])').allTextContents()
    expect(options).toEqual(expect.arrayContaining(['Big', 'Small']))
  })

  test('Assemble and Copy Link buttons are visible', async ({ page }) => {
    await expect(page.locator('button.btn-primary')).toBeVisible()
    await expect(page.locator('button.btn-secondary')).toBeVisible()
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

// ── assembly – error handling ─────────────────────────────────────────────────

test.describe('error handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForWasm(page)
  })

  test('shows an error message for invalid assembly input', async ({ page }) => {
    await page.fill('#input', '@@not_an_instruction@@')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-primary')
    // Wait for error span to become non-empty
    await page.waitForFunction(() => {
      const span = document.querySelector('span[style*="color: red"]')
      return span && span.textContent.trim() !== ''
    }, { timeout: 10_000 })
    const errorText = await page.locator('span[style*="color: red"]').textContent()
    expect(errorText.trim()).not.toBe('')
  })

  test('clears a previous error when a successful assembly follows', async ({ page }) => {
    // First: trigger an error
    await page.fill('#input', '@@bad@@')
    await page.selectOption('#selectedISA', 'x86')
    await page.selectOption('#selectedWordSize', '32')
    await page.selectOption('#selectedEndianness', 'small')
    await page.click('button.btn-primary')
    await page.waitForFunction(() => {
      const span = document.querySelector('span[style*="color: red"]')
      return span && span.textContent.trim() !== ''
    })
    // Then: assemble something valid
    await assemble(page, { input: 'add eax, ecx', isa: 'x86', wordSize: '32', endianness: 'small' })
    const errorText = await page.locator('span[style*="color: red"]').textContent()
    expect(errorText.trim()).toBe('')
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
    await page.click('button.btn-secondary')
    const clipboard = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboard).toContain('isa=x86')
    expect(clipboard).toContain('word=32')
    expect(clipboard).toContain('endian=small')
    expect(clipboard).toContain('input=')
  })
})
