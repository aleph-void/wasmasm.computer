<template>
  <form onsubmit="return false;">
    <div class="container">
      <fieldset>
        <div>
          <span style="color: red;"> {{ errorMessage }}</span>
        </div>
        <div>
          <label for="input" class="form-label">Input</label>
          <textarea id="input" class="form-control" v-model="input"></textarea>
        </div>
        <div>
          <label for="selectedISA" class="form-label">Instruction Set Architecture</label>
          <select class="form-select" id="selectedISA" v-model="selectedISA">
            <option selected disabled>Instruction Set Architecture</option>
            <option value="ARM">ARM</option>
            <option value="x86">x86</option>
            <option value="MIPS">MIPS</option>
            <option value="PPC">PPC</option>
            <option value="SPARC">SPARC</option>
          </select>
        </div>
        <div>
          <label for="selectedWordSize" class="form-label">Word Size</label>
          <select class="form-select" id="selectedWordSize" v-model="selectedWordSize" v-on:change="selectedWordSizeChanged">
            <option selected disabled>Word Size</option>
            <option value="16">16-bit</option>
            <option value="32">32-bit</option>
            <option value="64">64-bit</option>
          </select>
        </div>
        <div>
          <label for="selectedEndianness" class="form-label">Endianness</label>
          <select class="form-select" id="selectedEndianness" v-model="selectedEndianness" v-on:change="selectedEndiannessChanged">
            <option selected disabled>Endianness</option>
            <option value="big">Big</option>
            <option value="small">Small</option>
          </select>
        </div>
        <!-- <div>
          <label for="selectedExtra">Extras</label>
          <select v-model="selectedExtra" v-on:change="selectedExtraChanged">
            <option selected disabled>Extras</option>
            <option value="ARMv8">ARMv8</option>
          </select>
        </div> -->
        <div>
          <br />
          <button class="btn btn-primary" v-on:click="buttonClicked">Assemble</button>
        </div>
        <div>
          <br />
          <label for="output" class="form-label">Output</label>
          <textarea class="form-select" disabled id="output" v-model="output"></textarea>
        </div>
      </fieldset>
    </div>
  </form>
</template>

<script>
import assemblyModule from '../assets/wasmasm.js'
export default {
  name: 'MainView',
  data() {
    return {
      input: "",
      output: "",
      selectedISA: "",
      selectedWordSize: "",
      selectedEndianness: "",
      selectedExtra: "",
      assembler: null,
      errorMessage: ""
    }
  },
  async created() {
    this.assembler = await assemblyModule();
    
  },
  async mounted() {
    this.errorMessage = "";
  },
  methods: {
    buttonClicked() {
      this.errorMessage = "";
      const inputBuffer = this.assembler._malloc(this.input.length + 1);
      this.assembler.stringToUTF8(this.input, inputBuffer, this.input.length + 1);
      const isaBuffer = this.assembler._malloc(this.selectedISA.length + 1);
      this.assembler.stringToUTF8(this.selectedISA, isaBuffer, this.selectedISA.length + 1);
      const outputBuffer = this.assembler._malloc((this.input.length * 4) + 1);
      console.log(outputBuffer);      
      this.assembler._assemble(inputBuffer, this.input.length, isaBuffer, this.selectedEndianness === 'big' ? 1 : 2, parseInt(this.selectedWordSize), outputBuffer);
      this.assembler._free(inputBuffer);
      this.assembler._free(isaBuffer);
      const out = this.assembler.UTF8ToString(outputBuffer);
      if (out){
        this.output = out;
      } else {
        this.errorMessage = "Problem with disassembly. Check settings and try again";
      }
      this.assembler._free(outputBuffer);
      return false;
    }
  }
}   
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

</style>
