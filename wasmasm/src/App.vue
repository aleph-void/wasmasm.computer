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
    <main>
      <RouterView />
    </main>
  </div>
</template>

<script>

export default {
  name: 'WasmAsm',
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
