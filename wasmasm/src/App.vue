<template>
  <div class="container-fluid">
    <div class="container">
      <h1>WASMASM</h1>
      <p>WebAssembly-based Assembler</p>
      <p>
        <a href="https://www.keystone-engine.org/">Built with Keystone</a>
      </p>
      <p>Written by Nicholas Starke: <a href="https://starkeblog.com/">StarkeBlog.com</a></p>
      <p>The input should be valid CPU assembly instructions for your target architecture.  Like <pre>mov eax, edx</pre> for x86 or <pre>mov r0, r1</pre> for arm</p>
      <p>I built this because I often need to assemble a simple set of instructions for exploit development.</p>
      <p>This is not built to assemble entire programs.</p>
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
