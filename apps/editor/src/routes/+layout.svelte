<div class="app-shell">
  <header class="site-header">
    <a class="brand" href="/" aria-label="Banderdash home">Banderdash</a>
    <p class="product-tagline">Local interactive article editor</p>
  </header>

  <main>
    <slot />
  </main>
</div>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
    color: #172033;
    background: #f5f1ea;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  :global(a) {
    color: inherit;
  }

  .app-shell {
    min-height: 100vh;
  }

  .site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem clamp(1rem, 4vw, 3rem);
    border-bottom: 1px solid rgba(23, 32, 51, 0.12);
    background: rgba(255, 252, 246, 0.82);
    backdrop-filter: blur(16px);
  }

  .brand {
    font-weight: 800;
    letter-spacing: -0.04em;
    text-decoration: none;
  }

  .product-tagline {
    margin: 0;
    color: #526070;
    font-size: 0.85rem;
    font-weight: 700;
  }

  main {
    width: min(1180px, calc(100% - 2rem));
    margin: 0 auto;
    padding: clamp(1.5rem, 5vw, 4rem) 0;
  }
</style>
