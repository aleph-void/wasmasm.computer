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
 * Mount MainView with a stubbed $route (buttonClicked logs this.$route.query)
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
    expect(options).toEqual(expect.arrayContaining(['arm', 'x86', 'mips', 'ppc', 'sparc']))
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

  it('renders the Assemble and Copy Link buttons', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('button.btn-primary').text()).toBe('Assemble')
    expect(wrapper.find('button.btn-secondary').text()).toBe('Copy Link')
  })

  it('shows no error message on initial render', async () => {
    const wrapper = await mountComponent()
    expect(wrapper.find('span').text().trim()).toBe('')
  })
})

// ── WASM initialisation ───────────────────────────────────────────────────────

describe('WASM initialisation', () => {
  it('calls the assemblyModule factory once on creation', async () => {
    // The factory mock lives in assemblyModuleMock.js; importing it here gives
    // us the same reference the component received via moduleNameMapper.
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
})

// ── assembly – success ────────────────────────────────────────────────────────

describe('buttonClicked – successful assembly', () => {
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
      expect.any(Number), // inputBuffer
      expect.any(Number), // input.length
      expect.any(Number), // isaBuffer
      1,                  // endianness: big
      32,                 // wordSize as integer
      expect.any(Number)  // outputBuffer
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

describe('buttonClicked – failed assembly', () => {
  it('shows an error message when _assemble produces no output', async () => {
    // Default mock returns '' from UTF8ToString
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
    // _assemble returns empty → error branch taken
    mockAssembler.UTF8ToString.mockReturnValue('')
    wrapper.vm.input = '@@bad@@'
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    await wrapper.find('button.btn-primary').trigger('click')
    expect(wrapper.vm.output).toBe('90 ')
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
    await wrapper.find('button.btn-secondary').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it('URL-encodes the assembly input in the link', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.selectedISA = 'x86'
    wrapper.vm.selectedWordSize = '32'
    wrapper.vm.selectedEndianness = 'small'
    wrapper.vm.input = 'mov eax, 1'
    await wrapper.find('button.btn-secondary').trigger('click')
    const url = navigator.clipboard.writeText.mock.calls[0][0]
    expect(url).toContain('input=' + encodeURIComponent('mov eax, 1'))
  })

  it('includes all form parameters in the link', async () => {
    const wrapper = await mountComponent()
    wrapper.vm.selectedISA = 'mips'
    wrapper.vm.selectedWordSize = '64'
    wrapper.vm.selectedEndianness = 'big'
    wrapper.vm.input = 'nop'
    await wrapper.find('button.btn-secondary').trigger('click')
    const url = navigator.clipboard.writeText.mock.calls[0][0]
    expect(url).toContain('isa=mips')
    expect(url).toContain('word=64')
    expect(url).toContain('endian=big')
  })
})
