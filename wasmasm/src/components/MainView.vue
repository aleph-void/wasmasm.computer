<template>
  <form @submit.prevent>
    <div class="assembler-shell">

      <div class="assembler-header">
        <p class="section-label">{{ $t('assembler.sectionLabel') }}</p>
        <h1 class="assembler-title">{{ $t('assembler.title') }}</h1>
        <i18n-t keypath="assembler.description" tag="p" class="assembler-desc">
          <template #keystone>
            <a href="https://www.keystone-engine.org/" target="_blank" rel="noopener">Keystone</a>
          </template>
          <template #capstone>
            <a href="https://www.capstone-engine.org/" target="_blank" rel="noopener">Capstone</a>
          </template>
        </i18n-t>
      </div>

      <div class="mode-toggle" role="group" :aria-label="$t('assembler.mode.ariaLabel')">
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': mode === 'assemble' }"
          type="button"
          @click="setMode('assemble')"
        >{{ $t('assembler.mode.assemble') }}</button>
        <button
          class="mode-btn"
          :class="{ 'mode-btn--active': mode === 'disassemble' }"
          type="button"
          @click="setMode('disassemble')"
        >{{ $t('assembler.mode.disassemble') }}</button>
      </div>

      <div class="config-row">
        <div class="field-group">
          <label for="selectedISA" class="field-label">{{ $t('assembler.architecture.label') }}</label>
          <select id="selectedISA" class="asm-select" :class="{ 'asm-select--invalid': isaInvalid }" v-model="selectedISA">
            <option value="" disabled>{{ $t('assembler.architecture.placeholder') }}</option>
            <option value="x86">x86</option>
            <option value="arm">ARM</option>
            <option value="aarch64">AArch64</option>
            <option value="mips">MIPS</option>
            <option value="ppc">PPC</option>
            <option value="sparc">SPARC</option>
            <option value="riscv">RISC-V</option>
            <option value="systemz">SystemZ</option>
          </select>
        </div>

        <div class="field-group">
          <label for="selectedWordSize" class="field-label">{{ $t('assembler.wordSize.label') }}</label>
          <select id="selectedWordSize" class="asm-select" :class="{ 'asm-select--invalid': wordSizeInvalid }" v-model="selectedWordSize" @change="selectedWordSizeChanged">
            <option value="" disabled>{{ $t('assembler.wordSize.placeholder') }}</option>
            <option value="16">{{ $t('assembler.wordSize.16') }}</option>
            <option value="32">{{ $t('assembler.wordSize.32') }}</option>
            <option value="64">{{ $t('assembler.wordSize.64') }}</option>
          </select>
          <span v-if="wordSizeHint" class="field-hint">{{ wordSizeHint }}</span>
        </div>

        <div class="field-group">
          <label for="selectedEndianness" class="field-label">{{ $t('assembler.endianness.label') }}</label>
          <select id="selectedEndianness" class="asm-select" :class="{ 'asm-select--invalid': endiannessInvalid }" v-model="selectedEndianness" @change="selectedEndiannessChanged">
            <option value="" disabled>{{ $t('assembler.endianness.placeholder') }}</option>
            <option value="small">{{ $t('assembler.endianness.little') }}</option>
            <option value="big">{{ $t('assembler.endianness.big') }}</option>
          </select>
          <span v-if="endiannessHint" class="field-hint">{{ endiannessHint }}</span>
        </div>
      </div>

      <div class="pane-row">
        <div class="pane">
          <p class="section-label">{{ mode === 'assemble' ? $t('assembler.input.labelAssemble') : $t('assembler.input.labelDisassemble') }}</p>
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
            <p class="section-label">{{ mode === 'assemble' ? $t('assembler.output.labelAssemble') : $t('assembler.output.labelDisassemble') }}</p>
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
          {{ mode === 'assemble' ? $t('assembler.actions.assemble') : $t('assembler.actions.disassemble') }}
        </button>
        <button class="btn-ghost" @click="copyClicked">{{ $t('assembler.actions.copyLink') }}</button>
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
      copied: false,
      validated: false,
    }
  },
  computed: {
    inputPlaceholder() {
      return this.mode === 'assemble'
        ? this.$t('assembler.input.placeholderAssemble')
        : this.$t('assembler.input.placeholderDisassemble')
    },
    outputPlaceholder() {
      return this.mode === 'assemble'
        ? this.$t('assembler.output.placeholderAssemble')
        : this.$t('assembler.output.placeholderDisassemble')
    },
    copyOutputLabel() {
      return this.copied
        ? this.$t('assembler.output.copied')
        : this.$t('assembler.output.copy')
    },
    isaInvalid() {
      return this.validated && !this.selectedISA
    },
    wordSizeInvalid() {
      if (!this.validated) return false
      // SystemZ ignores word size — any value (including unset) is fine
      if (this.selectedISA === 'systemz') return false
      if (!this.selectedWordSize) return true
      if (this.selectedISA === 'aarch64' && this.selectedWordSize !== '64') return true
      if (this.selectedISA === 'arm'     && this.selectedWordSize === '64') return true
      if (this.selectedISA === 'mips'    && this.selectedWordSize === '16') return true
      if (this.selectedISA === 'riscv'   && this.selectedWordSize === '16') return true
      return false
    },
    endiannessInvalid() {
      if (!this.validated) return false
      if (this.selectedISA === 'systemz') {
        // only invalid if explicitly set to little-endian; unset is fine (ignored by C)
        return this.selectedEndianness === 'small'
      }
      if (!this.selectedEndianness) return true
      if (this.selectedISA === 'x86' && this.selectedEndianness === 'big') return true
      return false
    },
    wordSizeHint() {
      if (!this.validated || !this.selectedISA || !this.selectedWordSize) return ''
      if (this.selectedISA === 'aarch64' && this.selectedWordSize !== '64') return this.$t('assembler.validation.aarch64WordSize')
      if (this.selectedISA === 'arm'     && this.selectedWordSize === '64') return this.$t('assembler.validation.armWordSize')
      if (this.selectedISA === 'mips'    && this.selectedWordSize === '16') return this.$t('assembler.validation.mips16bit')
      if (this.selectedISA === 'riscv'   && this.selectedWordSize === '16') return this.$t('assembler.validation.riscv16bit')
      return ''
    },
    endiannessHint() {
      if (!this.validated || !this.selectedISA) return ''
      if (this.selectedISA === 'systemz' && this.selectedEndianness === 'small') return this.$t('assembler.validation.systemzLittleEndian')
      if (!this.selectedEndianness) return ''
      if (this.selectedISA === 'x86' && this.selectedEndianness === 'big') return this.$t('assembler.validation.x86BigEndian')
      return ''
    },
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
      this.copied = false;
    },
    copyOutput() {
      navigator.clipboard.writeText(this.output);
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 2000);
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
      this.validated = true;
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
        this.errorMessage = this.$t('assembler.errors.assemblyFailed');
      }
    },
    _runDisassemble() {
      this.errorMessage = "";
      if (typeof this.assembler._disassemble !== 'function') {
        this.errorMessage = this.$t('assembler.errors.disassemblyUnavailable');
        return;
      }
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
        this.errorMessage = this.$t('assembler.errors.disassemblyFailed');
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

.asm-select--invalid {
  border-color: rgba(220, 38, 38, 0.7);
}

.asm-select--invalid:focus {
  border-color: rgba(220, 38, 38, 0.9);
}

.field-hint {
  font-size: 0.7rem;
  color: #f87171;
  margin-top: 0.1rem;
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
