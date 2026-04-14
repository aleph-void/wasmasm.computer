import { mount, flushPromises } from '@vue/test-utils'
import { toRaw } from 'vue'
import { createI18n } from 'vue-i18n'
import MainView from '../../src/components/MainView.vue'
// mockAssembler is the same object that the component will receive from the
// mocked factory — we can inspect it and control its return values here.
import { mockAssembler } from './__mocks__/assemblyModuleMock.js'
import en from '../../src/locales/en.json'
import fr from '../../src/locales/fr.json'
import es from '../../src/locales/es.json'
import zhCN from '../../src/locales/zh-CN.json'

function makeI18n() {
  return createI18n({ legacy: true, locale: 'en', fallbackLocale: 'en', messages: { en } })
}

function makeI18nWithLocale(locale) {
  return createI18n({
    legacy: true,
    locale,
    fallbackLocale: 'en',
    messages: { en, fr, es, 'zh-CN': zhCN },
  })
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Replace window.location with a plain object before mounting so that the
 * mounted() hook's URLSearchParams call is controlled by the test.
 */
function setLocation(search = '', origin = 'http://localhost') {
  Object.defineProperty(window, 'location', {
    value: { search, origin },
    writable: true,
    configurable: true,
  })
}

/**
 * Mount MainView with a stubbed $route (actionClicked logs this.$route.query)
 * and flush all pending promises so the async created() hook completes.
 */
async function mountComponent(locationSearch = '') {
  setLocation(locationSearch)
  const wrapper = mount(MainView, {
    global: {
      mocks: { $route: { query: {} } },
      plugins: [makeI18n()],
    },
  })
  await flushPromises()
  return wrapper
}

async function mountWithLocale(locale) {
  setLocation('')
  const wrapper = mount(MainView, {
    global: {
      mocks: { $route: { query: {} } },
      plugins: [makeI18nWithLocale(locale)],
    },
  })
  await flushPromises()
  return wrapper
}

// ── test setup ────────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn() },
    writable: true,
    configurable: true,
  })
})

beforeEach(() => {
  jest.clearAllMocks()
  // Restore default implementations cleared by clearAllMocks()
  mockAssembler._malloc.mockReturnValue(1000)
  mockAssembler.UTF8ToString.mockReturnValue('')
})

// ── rendering ─────────────────────────────────────────────────────────────────

describe('rendering', () => {
  it('renders the assembly input textarea', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('#input').exists()).toBe(true)
  })

  it('renders the output textarea', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('#output').exists()).toBe(true)
  })

  it('renders the ISA select with the expected architecture options', async () => {
    const wrapper = await mountComponent()
    const options = wrapper.findAll('#selectedISA option').map(o => o.element.value)
    expect(options).toEqual(expect.arrayContaining(['arm', 'x86', 'aarch64', 'mips', 'ppc', 'sparc']))
  })

  it('renders the word-size select with 16, 32, 64-bit options', async () => {
    const wrapper = await mountComponent()
    const options = wrapper.findAll('#selectedWordSize option').map(o => o.element.value)
    expect(options).toEqual(expect.arrayContaining(['16', '32', '64']))
  })

  it('renders the endianness select with big and small options', async () => {
    const wrapper = await mountComponent()
    const options = wrapper.findAll('#selectedEndianness option').map(o => o.element.value)
    expect(options).toEqual(expect.arrayContaining(['big', 'small']))
  })

  it('renders the Assemble and Copy Link buttons by default', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('button.btn-primary').text()).toBe('Assemble')
    expect(wrapper.find('button.btn-ghost').text()).toBe('Copy Link')
  })

  it('renders the Assemble / Disassemble mode toggle buttons', async () => {
    const wrapper = await mountComponent()
    const toggleBtns = wrapper.findAll('button.mode-btn')
    const labels = toggleBtns.map(b => b.text())
    expect(labels).toContain('Assemble')
    expect(labels).toContain('Disassemble')
  })

  it('shows no error message on initial render', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('.error-banner').exists()).toBe(false)
  })

  it('defaults to assemble mode', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.vm.mode).toBe('assemble')
  })
})

// ── WASM initialisation ───────────────────────────────────────────────────────

describe('WASM initialisation', () => {
  it('calls the assemblyModule factory once on creation', async () => {
    const assemblyModule = (await import('./__mocks__/assemblyModuleMock.js')).default
    await mountComponent()
    expect(assemblyModule).toHaveBeenCalledTimes(1)
  })

  it('stores the resolved module on this.assembler', async () => {
    const wrapper = await mountComponent()
    // Vue 3 wraps reactive data in a Proxy; toRaw() unwraps it so we can
    // compare the underlying object reference with strict equality.
    expect(toRaw(wrapper.vm.assembler)).toBe(mockAssembler)
  })
})

// ── URL parameter loading (mounted hook) ─────────────────────────────────────

describe('URL parameter loading', () => {
  it('populates selectedISA from the isa query param', async () => {
    const wrapper = await mountComponent('?isa=arm&word=32&endian=big&input=nop')
    expect(wrapper.vm.selectedISA).toBe('arm')
  })

  it('populates selectedWordSize from the word query param', async () => {
    const wrapper = await mountComponent('?isa=x86&word=64&endian=small&input=nop')
    expect(wrapper.vm.selectedWordSize).toBe('64')
  })

  it('populates selectedEndianness from the endian query param', async () => {
    const wrapper = await mountComponent('?isa=mips&word=32&endian=big&input=nop')
    expect(wrapper.vm.selectedEndianness).toBe('big')
  })

  it('populates input from the input query param', async () => {
    const wrapper = await mountComponent('?isa=x86&word=32&endian=small&input=mov%20eax%2C%201')
    expect(wrapper.vm.input).toBe('mov eax, 1')
  })

  it('restores disassemble mode from the mode query param', async () => {
    const wrapper = await mountComponent('?mode=disassemble&isa=x86&word=32&endian=small&input=90')
    expect(wrapper.vm.mode).toBe('disassemble')
  })

  it('defaults to assemble mode when mode param is missing', async () => {
    const wrapper = await mountComponent('?isa=x86&word=32&endian=small&input=nop')
    expect(wrapper.vm.mode).toBe('assemble')
  })
})

// ── mode toggle ───────────────────────────────────────────────────────────────

describe('mode toggle', () => {
  it('switches to disassemble mode when Disassemble toggle is clicked', async () => {
    const wrapper = await mountComponent()
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    expect(wrapper.vm.mode).toBe('disassemble')
  })

  it('switches back to assemble mode when Assemble toggle is clicked', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.mode = 'disassemble'
    const asmBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Assemble')
    await asmBtn.trigger('click')
    expect(wrapper.vm.mode).toBe('assemble')
  })

  it('action button label changes to "Disassemble" in disassemble mode', async () => {
    const wrapper = await mountComponent()
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    expect(wrapper.find('button.btn-primary').text()).toBe('Disassemble')
  })

  it('clears output, error, and copied flag when switching modes', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.output = '01 c8 '
    wrapper.vm.errorMessage = 'some error'
    wrapper.vm.copied = true
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    expect(wrapper.vm.output).toBe('')
    expect(wrapper.vm.errorMessage).toBe('')
    expect(wrapper.vm.copied).toBe(false)
  })
})

// ── assembly – success ────────────────────────────────────────────────────────

describe('assemble mode – successful assembly', () => {
  async function assemble(isa, wordSize, endianness, input) {
    mockAssembler.UTF8ToString.mockReturnValue('90 ')
    const wrapper = await mountComponent()
    wrapper.vm.input = input
    wrapper.vm.selectedISA = isa
    wrapper.vm.selectedWordSize = wordSize
    wrapper.vm.selectedEndianness = endianness
    await wrapper.find('button.btn-primary').trigger('click')
    return wrapper
  }

  it('allocates memory for the input, ISA and output buffers', async () => {
    await assemble('x86', '32', 'small', 'nop')
    expect(mockAssembler._malloc).toHaveBeenCalledTimes(3)
  })

  it('copies the input string into WASM memory', async () => {
    await assemble('x86', '32', 'small', 'nop')
    expect(mockAssembler.stringToUTF8).toHaveBeenCalledWith('nop', 1000, 4)
  })

  it('copies the ISA string into WASM memory', async () => {
    await assemble('x86', '32', 'small', 'nop')
    expect(mockAssembler.stringToUTF8).toHaveBeenCalledWith('x86', 1000, 4)
  })

  it('passes endianness=1 to _assemble when "big" is selected', async () => {
    await assemble('arm', '32', 'big', 'nop')
    expect(mockAssembler._assemble).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      1,
      32,
      expect.any(Number)
    )
  })

  it('passes endianness=2 to _assemble when "small" is selected', async () => {
    await assemble('x86', '32', 'small', 'nop')
    expect(mockAssembler._assemble).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      2,
      32,
      expect.any(Number)
    )
  })

  it('passes word size as an integer', async () => {
    await assemble('x86', '64', 'small', 'nop')
    const call = mockAssembler._assemble.mock.calls[0]
    expect(call[4]).toBe(64)
    expect(typeof call[4]).toBe('number')
  })

  it('sets the output data property from UTF8ToString', async () => {
    const wrapper = await assemble('x86', '32', 'small', 'nop')
    expect(wrapper.vm.output).toBe('90 ')
  })

  it('frees all three allocated buffers', async () => {
    await assemble('x86', '32', 'small', 'nop')
    expect(mockAssembler._free).toHaveBeenCalledTimes(3)
  })

  it('clears any previous error message before assembling', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.errorMessage = 'previous error'
    mockAssembler.UTF8ToString.mockReturnValue('90 ')
    wrapper.vm.input = 'nop'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.errorMessage).toBe('')
  })
})

// ── assembly – failure ────────────────────────────────────────────────────────

describe('assemble mode – failed assembly', () => {
  it('shows an error message when _assemble produces no output', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.input = '@@invalid@@'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.errorMessage).not.toBe('')
  })

  it('does not overwrite a previous good output on failure', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.output = '90 '
    mockAssembler.UTF8ToString.mockReturnValue('')
    wrapper.vm.input = '@@bad@@'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.output).toBe('90 ')
  })
})

// ── disassemble – success ─────────────────────────────────────────────────────

describe('disassemble mode – successful disassembly', () => {
  async function disassemble(isa, wordSize, endianness, input) {
    mockAssembler.UTF8ToString.mockReturnValue('0x0000:  add        eax, ecx\n')
    const wrapper = await mountComponent()
    // switch to disassemble mode
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    wrapper.vm.input = input
    wrapper.vm.selectedISA = isa
    wrapper.vm.selectedWordSize = wordSize
    wrapper.vm.selectedEndianness = endianness
    await wrapper.find('button.btn-primary').trigger('click')
    return wrapper
  }

  it('calls _disassemble (not _assemble) in disassemble mode', async () => {
    await disassemble('x86', '32', 'small', '01 c8')
    expect(mockAssembler._disassemble).toHaveBeenCalledTimes(1)
    expect(mockAssembler._assemble).not.toHaveBeenCalled()
  })

  it('allocates memory for input, ISA, and output buffers', async () => {
    await disassemble('x86', '32', 'small', '01 c8')
    expect(mockAssembler._malloc).toHaveBeenCalledTimes(3)
  })

  it('passes endianness=1 to _disassemble when "big" is selected', async () => {
    await disassemble('arm', '32', 'big', '05 10 42 e0')
    expect(mockAssembler._disassemble).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      1,
      32,
      expect.any(Number)
    )
  })

  it('passes endianness=2 to _disassemble when "small" is selected', async () => {
    await disassemble('x86', '32', 'small', '90')
    expect(mockAssembler._disassemble).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      2,
      32,
      expect.any(Number)
    )
  })

  it('sets the output data property from UTF8ToString', async () => {
    const wrapper = await disassemble('x86', '32', 'small', '90')
    expect(wrapper.vm.output).toBe('0x0000:  add        eax, ecx\n')
  })

  it('frees all three allocated buffers after disassembly', async () => {
    await disassemble('x86', '32', 'small', '90')
    expect(mockAssembler._free).toHaveBeenCalledTimes(3)
  })

  it('clears any previous error message before disassembling', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.errorMessage = 'old error'
    mockAssembler.UTF8ToString.mockReturnValue('0x0000:  nop\n')
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    wrapper.vm.input = '90'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.errorMessage).toBe('')
  })
})

// ── disassemble – failure ─────────────────────────────────────────────────────

describe('disassemble mode – failed disassembly', () => {
  it('shows an error message when _disassemble produces no output', async () => {
    const wrapper = await mountComponent()
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    mockAssembler.UTF8ToString.mockReturnValue('')
    wrapper.vm.input = 'zz zz'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.errorMessage).not.toBe('')
  })
})

// ── copy output button ────────────────────────────────────────────────────────

describe('copy output button', () => {
  it('copy button is hidden when output is empty', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.output = ''
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button.btn-copy').exists()).toBe(false)
  })

  it('copy button appears when output is populated', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.output = '90 '
    await wrapper.vm.$nextTick()
    expect(wrapper.find('button.btn-copy').exists()).toBe(true)
  })

  it('copyOutput writes the output value to the clipboard', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.output = '90 '
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn-copy').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('90 ')
  })

  it('copy button label changes to "Copied!" after click', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.output = '90 '
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn-copy').trigger('click')
    expect(wrapper.find('button.btn-copy').text()).toBe('Copied!')
  })

  it('copy button label resets to "Copy" after 2 seconds', async () => {
    jest.useFakeTimers()
    const wrapper = await mountComponent()
    wrapper.vm.output = '90 '
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn-copy').trigger('click')
    // copied flag drives the computed copyOutputLabel
    expect(wrapper.vm.copied).toBe(true)
    jest.advanceTimersByTime(2000)
    expect(wrapper.vm.copied).toBe(false)
    jest.useRealTimers()
  })

  it('copy button label is still "Copied!" before the 2-second reset fires', async () => {
    jest.useFakeTimers()
    const wrapper = await mountComponent()
    wrapper.vm.output = '90 '
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn-copy').trigger('click')
    jest.advanceTimersByTime(1999)
    expect(wrapper.vm.copied).toBe(true)
    jest.useRealTimers()
  })
})

// ── mode-btn--active class ────────────────────────────────────────────────────

describe('mode toggle active class', () => {
  it('Assemble button has mode-btn--active class in assemble mode', async () => {
    const wrapper = await mountComponent()
    const asmBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Assemble')
    expect(asmBtn.classes()).toContain('mode-btn--active')
  })

  it('Disassemble button does not have mode-btn--active in assemble mode', async () => {
    const wrapper = await mountComponent()
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    expect(disBtn.classes()).not.toContain('mode-btn--active')
  })

  it('Disassemble button has mode-btn--active after switching modes', async () => {
    const wrapper = await mountComponent()
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    expect(disBtn.classes()).toContain('mode-btn--active')
  })

  it('Assemble button loses mode-btn--active after switching to disassemble', async () => {
    const wrapper = await mountComponent()
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    const asmBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Assemble')
    expect(asmBtn.classes()).not.toContain('mode-btn--active')
  })
})

// ── input / output placeholders ───────────────────────────────────────────────

describe('placeholders', () => {
  it('input placeholder is assembly syntax in assemble mode', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('#input').attributes('placeholder')).toBe('mov eax, edx')
  })

  it('input placeholder is hex bytes in disassemble mode', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.mode = 'disassemble'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#input').attributes('placeholder')).toBe('89 d0')
  })

  it('output placeholder is "assembled bytes appear here" in assemble mode', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('#output').attributes('placeholder')).toBe('assembled bytes appear here')
  })

  it('output placeholder is "disassembled instructions appear here" in disassemble mode', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.mode = 'disassemble'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('#output').attributes('placeholder')).toBe('disassembled instructions appear here')
  })
})

// ── i18n / locale switching ───────────────────────────────────────────────────

describe('i18n / locale switching', () => {
  it('renders the action button in French ("Assembler") when locale is fr', async () => {
    const wrapper = await mountWithLocale('fr')
    expect(wrapper.find('button.btn-primary').text()).toBe('Assembler')
  })

  it('renders mode toggle buttons in French when locale is fr', async () => {
    const wrapper = await mountWithLocale('fr')
    const labels = wrapper.findAll('button.mode-btn').map(b => b.text())
    expect(labels).toContain('Assembler')
    expect(labels).toContain('Désassembler')
  })

  it('copyOutputLabel computed returns the French word "Copier" when locale is fr', async () => {
    const wrapper = await mountWithLocale('fr')
    expect(wrapper.vm.copyOutputLabel).toBe('Copier')
  })

  it('copyOutputLabel reflects "Copied" in French ("Copié") after copy click', async () => {
    const wrapper = await mountWithLocale('fr')
    wrapper.vm.output = '90 '
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn-copy').trigger('click')
    expect(wrapper.find('button.btn-copy').text()).toBe('Copié')
  })

  it('inputPlaceholder is the same assembly snippet regardless of locale', async () => {
    const wrapper = await mountWithLocale('fr')
    expect(wrapper.find('#input').attributes('placeholder')).toBe('mov eax, edx')
  })

  it('renders the action button in Spanish ("Ensamblar") when locale is es', async () => {
    const wrapper = await mountWithLocale('es')
    expect(wrapper.find('button.btn-primary').text()).toBe('Ensamblar')
  })

  it('renders the action button in Chinese ("汇编") when locale is zh-CN', async () => {
    const wrapper = await mountWithLocale('zh-CN')
    expect(wrapper.find('button.btn-primary').text()).toBe('汇编')
  })

  it('changing the i18n locale reactively updates copyOutputLabel', async () => {
    const i18n = makeI18nWithLocale('en')
    setLocation('')
    const wrapper = mount(MainView, {
      global: {
        mocks: { $route: { query: {} } },
        plugins: [i18n],
      },
    })
    await flushPromises()
    expect(wrapper.vm.copyOutputLabel).toBe('Copy')
    i18n.global.locale = 'fr'
    await wrapper.vm.$nextTick()
    expect(wrapper.vm.copyOutputLabel).toBe('Copier')
  })

  it('error message is in French when assembly fails with French locale', async () => {
    const wrapper = await mountWithLocale('fr')
    wrapper.vm.input = '@@invalid@@'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.errorMessage).toBe(fr.assembler.errors.assemblyFailed)
  })

  it('disassembly error message is in Spanish when locale is es', async () => {
    const wrapper = await mountWithLocale('es')
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Desensamblar')
    await disBtn.trigger('click')
    mockAssembler.UTF8ToString.mockReturnValue('')
    wrapper.vm.input = 'zz zz'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.errorMessage).toBe(es.assembler.errors.disassemblyFailed)
  })
})

// ── copy link ─────────────────────────────────────────────────────────────────

describe('copyClicked', () => {
  it('writes a shareable URL to the clipboard', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.selectedISA = 'arm'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'big'
    wrapper.vm.input = 'sub r1, r2, r5'
    await wrapper.find('button.btn-ghost').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it('URL-encodes the input in the link', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    wrapper.vm.input = 'mov eax, 1'
    await wrapper.find('button.btn-ghost').trigger('click')
    const url = navigator.clipboard.writeText.mock.calls[0][0]
    expect(url).toContain('input=' + encodeURIComponent('mov eax, 1'))
  })

  it('includes all form parameters including mode in the link', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.selectedISA = 'mips'
    wrapper.vm.selectedWordSize = '64'
    wrapper.vm.selectedEndianness = 'big'
    wrapper.vm.input = 'nop'
    await wrapper.find('button.btn-ghost').trigger('click')
    const url = navigator.clipboard.writeText.mock.calls[0][0]
    expect(url).toContain('mode=assemble')
    expect(url).toContain('isa=mips')
    expect(url).toContain('word=64')
    expect(url).toContain('endian=big')
  })

  it('includes mode=disassemble in the link when in disassemble mode', async () => {
    const wrapper = await mountComponent()
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    wrapper.vm.input = '90'
    await wrapper.find('button.btn-ghost').trigger('click')
    const url = navigator.clipboard.writeText.mock.calls[0][0]
    expect(url).toContain('mode=disassemble')
  })
})
