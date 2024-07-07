<template>
  <div class="container-fluid">
    <div class="container">
      <h1>WASMASM</h1>
      <p>WebAssembly-based Assembler</p>
      <p>
        <a href="https://www.keystone-engine.org/">Built with Keystone</a>
      </p>
      <p>Written by Nicholas Starke: <a href="https://starkeblog.com/">StarkeBlog.com</a></p>
    </div>
    <MainView />
  </div>
</template>

<script>
import MainView from './components/MainView.vue'

export default {
  name: 'WasmAsm',
  components: {
    MainView
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
