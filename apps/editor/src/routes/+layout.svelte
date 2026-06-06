<script lang="ts">
  const navigationItems = ["Input", "Review", "Preview", "Debug", "Export"];
</script>

<div class="app-shell">
  <header class="site-header">
    <a class="brand" href="/" aria-label="Banderdash home">Banderdash</a>
    <nav aria-label="MVP workflow sections">
      {#each navigationItems as item}
        <span>{item}</span>
      {/each}
    </nav>
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

  nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    color: #526070;
    font-size: 0.85rem;
  }

  nav span {
    border: 1px solid rgba(23, 32, 51, 0.12);
    border-radius: 999px;
    padding: 0.25rem 0.65rem;
    background: #ffffffa3;
  }

  main {
    width: min(1180px, calc(100% - 2rem));
    margin: 0 auto;
    padding: clamp(1.5rem, 5vw, 4rem) 0;
  }
</style>
