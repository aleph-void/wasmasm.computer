import { mount, flushPromises } from '@vue/test-utils'
import MainView from '../../src/components/MainView.vue'
// mockAssembler is the same object that the component will receive from the
// mocked factory — we can inspect it and control its return values here.
import { mockAssembler } from './__mocks__/assemblyModuleMock.js'

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
    expect(wrapper.vm.assembler).toBe(mockAssembler)
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

  it('clears output and error when switching modes', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.output = '01 c8 '
    wrapper.vm.errorMessage = 'some error'
    const disBtn = wrapper.findAll('button.mode-btn').find(b => b.text() === 'Disassemble')
    await disBtn.trigger('click')
    expect(wrapper.vm.output).toBe('')
    expect(wrapper.vm.errorMessage).toBe('')
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
