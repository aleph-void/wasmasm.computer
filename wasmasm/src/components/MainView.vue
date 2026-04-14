<template>
  <form @submit.prevent>
    <div class="assembler-shell">

      <div class="assembler-header">
        <p class="section-label">// Assembler</p>
        <h1 class="assembler-title">Browser-based CPU Assembler</h1>
        <p class="assembler-desc">
          Paste assembly instructions or hex bytes, choose your target architecture, and click the action button.
          Powered by <a href="https://www.keystone-engine.org/" target="_blank" rel="noopener">Keystone</a>
          (assemble) and <a href="https://www.capstone-engine.org/" target="_blank" rel="noopener">Capstone</a>
          (disassemble) compiled to WebAssembly.
        </p>
      </div>

      <div class="mode-toggle" role="group" aria-label="Mode">
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': mode === 'assemble' }"
          type="button"
          @click="setMode('assemble')"
        >Assemble</button>
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': mode === 'disassemble' }"
          type="button"
          @click="setMode('disassemble')"
        >Disassemble</button>
      </div>

      <div class="config-row">
        <div class="field-group">
          <label for="selectedISA" class="field-label">Architecture</label>
          <select id="selectedISA" class="asm-select" v-model="selectedISA">
            <option value="" disabled>Select ISA</option>
            <option value="x86">x86</option>
            <option value="arm">ARM</option>
            <option value="aarch64">AArch64</option>
            <option value="mips">MIPS</option>
            <option value="ppc">PPC</option>
            <option value="sparc">SPARC</option>
          </select>
        </div>

        <div class="field-group">
          <label for="selectedWordSize" class="field-label">Word Size</label>
          <select id="selectedWordSize" class="asm-select" v-model="selectedWordSize" @change="selectedWordSizeChanged">
            <option value="" disabled>Select size</option>
            <option value="16">16-bit</option>
            <option value="32">32-bit</option>
            <option value="64">64-bit</option>
          </select>
        </div>

        <div class="field-group">
          <label for="selectedEndianness" class="field-label">Endianness</label>
          <select id="selectedEndianness" class="asm-select" v-model="selectedEndianness" @change="selectedEndiannessChanged">
            <option value="" disabled>Select endian</option>
            <option value="small">Little-endian</option>
            <option value="big">Big-endian</option>
          </select>
        </div>
      </div>

      <div class="pane-row">
        <div class="pane">
          <p class="section-label">{{ mode === 'assemble' ? '// Input (assembly)' : '// Input (hex bytes)' }}</p>
          <textarea
            id="input"
            class="asm-textarea"
            v-model="input"
            :placeholder="inputPlaceholder"
            spellcheck="false"
          ></textarea>
        </div>

        <div class="pane">
          <div class="pane-header">
            <p class="section-label">{{ mode === 'assemble' ? '// Output (hex bytes)' : '// Output (assembly)' }}</p>
            <button
              v-if="output"
              class="btn-copy"
              type="button"
              @click="copyOutput"
              :title="copyOutputLabel"
            >{{ copyOutputLabel }}</button>
          </div>
          <textarea
            id="output"
            class="asm-textarea asm-textarea--output"
            :value="output"
            readonly
            :placeholder="outputPlaceholder"
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <div v-if="errorMessage" class="error-banner" role="alert">
        {{ errorMessage }}
      </div>

      <div class="action-row">
        <button class="btn-primary" @click="actionClicked">
          {{ mode === 'assemble' ? 'Assemble' : 'Disassemble' }}
        </button>
        <button class="btn-ghost" @click="copyClicked">Copy Link</button>
      </div>

    </div>
  </form>
</template>

<script>
import assemblyModule from '../assets/wasmasm.js'
export default {
  name: 'MainView',
  data() {
    return {
      mode: 'assemble',
      input:  "",
      output: "",
      selectedISA: "",
      selectedWordSize: "",
      selectedEndianness: "",
      assembler: null,
      errorMessage: "",
      copyOutputLabel: "Copy"
    }
  },
  computed: {
    inputPlaceholder() {
      return this.mode === 'assemble' ? 'mov eax, edx' : '89 d0'
    },
    outputPlaceholder() {
      return this.mode === 'assemble' ? 'assembled bytes appear here' : 'disassembled instructions appear here'
    }
  },
  async created() {
    this.assembler = await assemblyModule();
    this.errorMessage = "";
  },
  async mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    this.selectedEndianness = urlParams.get('endian') || "";
    this.selectedISA        = urlParams.get('isa')    || "";
    this.selectedWordSize   = urlParams.get('word')   || "";
    this.input              = urlParams.get('input')  || "";
    this.mode               = urlParams.get('mode') === 'disassemble' ? 'disassemble' : 'assemble';
    this.errorMessage = "";
  },
  methods: {
    setMode(m) {
      this.mode = m;
      this.output = "";
      this.errorMessage = "";
      this.copyOutputLabel = "Copy";
    },
    copyOutput() {
      navigator.clipboard.writeText(this.output);
      this.copyOutputLabel = "Copied!";
      setTimeout(() => { this.copyOutputLabel = "Copy"; }, 2000);
    },
    selectedWordSizeChanged() {},
    selectedEndiannessChanged() {},
    copyClicked() {
      const link = window.location.origin + '/?'
        + 'mode='  + this.mode
        + '&isa='  + this.selectedISA
        + '&word=' + this.selectedWordSize
        + '&endian=' + this.selectedEndianness
        + '&input=' + encodeURIComponent(this.input);
      navigator.clipboard.writeText(link);
    },
    actionClicked() {
      if (this.mode === 'assemble') {
        this._runAssemble();
      } else {
        this._runDisassemble();
      }
    },
    _runAssemble() {
      console.log(this.$route.query);
      this.errorMessage = "";
      const inputBuffer  = this.assembler._malloc(this.input.length + 1);
      this.assembler.stringToUTF8(this.input, inputBuffer, this.input.length + 1);
      const isaBuffer    = this.assembler._malloc(this.selectedISA.length + 1);
      this.assembler.stringToUTF8(this.selectedISA, isaBuffer, this.selectedISA.length + 1);
      const outputBuffer = this.assembler._malloc((this.input.length * 4) + 1);
      this.assembler._assemble(
        inputBuffer, this.input.length,
        isaBuffer,
        this.selectedEndianness === 'big' ? 1 : 2,
        parseInt(this.selectedWordSize),
        outputBuffer
      );
      this.assembler._free(inputBuffer);
      this.assembler._free(isaBuffer);
      const out = this.assembler.UTF8ToString(outputBuffer);
      this.assembler._free(outputBuffer);
      if (out) {
        this.output = out;
      } else {
        this.errorMessage = "Assembly failed. Check your input and settings and try again.";
      }
    },
    _runDisassemble() {
      this.errorMessage = "";
      const inputBuffer  = this.assembler._malloc(this.input.length + 1);
      this.assembler.stringToUTF8(this.input, inputBuffer, this.input.length + 1);
      const isaBuffer    = this.assembler._malloc(this.selectedISA.length + 1);
      this.assembler.stringToUTF8(this.selectedISA, isaBuffer, this.selectedISA.length + 1);
      // Generous output buffer: each byte can expand to ~80 chars of disassembly text
      const outSize = Math.max(4096, this.input.length * 20);
      const outputBuffer = this.assembler._malloc(outSize);
      this.assembler._disassemble(
        inputBuffer, this.input.length,
        isaBuffer,
        this.selectedEndianness === 'big' ? 1 : 2,
        parseInt(this.selectedWordSize),
        outputBuffer
      );
      this.assembler._free(inputBuffer);
      this.assembler._free(isaBuffer);
      const out = this.assembler.UTF8ToString(outputBuffer);
      this.assembler._free(outputBuffer);
      if (out) {
        this.output = out;
      } else {
        this.errorMessage = "Disassembly failed. Check your hex bytes, ISA, and settings.";
      }
    }
  }
}
</script>

<style scoped>
.assembler-shell {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* Header */
.assembler-header {
  max-width: 640px;
}

.section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--accent-light);
  margin-bottom: 0.5rem;
}

.assembler-title {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 0.65rem;
}

.assembler-desc {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.7;
}

.assembler-desc a {
  color: var(--accent-light);
  text-decoration: none;
  transition: color 0.2s;
}

.assembler-desc a:hover {
  color: #a78bfa;
}

/* Mode toggle */
.mode-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  align-self: flex-start;
}

.mode-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.mode-btn + .mode-btn {
  border-left: 1px solid var(--border);
}

.mode-btn--active {
  background: var(--accent);
  color: #fff;
}

.mode-btn:not(.mode-btn--active):hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

/* Config row */
.config-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 160px;
}

.field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.asm-select {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.65rem center;
  padding-right: 2rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.asm-select:focus {
  outline: none;
  border-color: var(--accent-light);
}

/* Panes */
.pane-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.pane {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 1.25rem;
}

.pane-header .section-label {
  margin-bottom: 0;
}

.btn-copy {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.55rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.btn-copy:hover {
  border-color: var(--accent-light);
  color: var(--accent-light);
}

.asm-textarea {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  padding: 0.875rem 1rem;
  resize: vertical;
  min-height: 220px;
  transition: border-color 0.2s;
}

.asm-textarea:focus {
  outline: none;
  border-color: var(--accent-light);
}

.asm-textarea--output {
  color: var(--accent-light);
  cursor: default;
}

.asm-textarea::placeholder {
  color: var(--text-muted);
}

/* Error */
.error-banner {
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 6px;
  color: #f87171;
  font-size: 0.875rem;
  padding: 0.75rem 1rem;
}

/* Actions */
.action-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.625rem 1.5rem;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}

.btn-primary:hover {
  background: var(--accent-light);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.625rem 1.5rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.btn-ghost:hover {
  border-color: var(--accent-light);
  color: var(--text-primary);
}

/* Mobile */
@media (max-width: 768px) {
  .pane-row {
    grid-template-columns: 1fr;
  }

  .config-row {
    flex-direction: column;
  }

  .field-group {
    min-width: unset;
  }
}
</style>
