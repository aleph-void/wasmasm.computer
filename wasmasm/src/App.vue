<template>
  <div class="app-shell">
    <header class="site-nav">
      <div class="nav-inner">
        <div class="nav-brand">
          <span class="nav-title">WASMASM</span>
          <span class="nav-tag">WebAssembly Assembler</span>
        </div>
        <nav class="nav-links">
          <a href="https://www.keystone-engine.org/" target="_blank" rel="noopener">Keystone</a>
          <a href="https://starkeblog.com/" target="_blank" rel="noopener">StarkeBlog</a>
        </nav>
      </div>
    </header>

    <main class="site-main">
      <RouterView />
    </main>

    <footer class="site-footer">
      <p>Built with <a href="https://www.keystone-engine.org/" target="_blank" rel="noopener">Keystone Engine</a> compiled to WebAssembly &mdash; by <a href="https://starkeblog.com/" target="_blank" rel="noopener">Nicholas Starke</a></p>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'WasmAsm',
}
</script>

<style>
*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-card: #16161f;
  --border: #1e1e2e;
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --accent: #6d28d9;
  --accent-light: #8b5cf6;
  --accent-glow: rgba(139, 92, 246, 0.15);
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Navigation */
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 1rem 2rem;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.nav-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.nav-title {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  font-size: 1.1rem;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.nav-tag {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 400;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--text-primary);
}

/* Main content */
.site-main {
  flex: 1;
  padding: 3rem 2rem;
}

/* Footer */
.site-footer {
  padding: 1.5rem 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
  border-top: 1px solid var(--border);
}

.site-footer a {
  color: var(--accent-light);
  text-decoration: none;
  transition: color 0.2s;
}

.site-footer a:hover {
  color: #a78bfa;
}

/* Mobile */
@media (max-width: 768px) {
  .site-nav {
    padding: 0.875rem 1.25rem;
  }

  .nav-tag {
    display: none;
  }

  .nav-links {
    gap: 1.25rem;
  }

  .site-main {
    padding: 2rem 1.25rem;
  }
}
</style>
