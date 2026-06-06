<script lang="ts">
  interface ProductSection {
    title: string;
    status: string;
    description: string;
  }

  const productSections: ProductSection[] = [
    {
      title: "Input / document",
      status: "Shell only",
      description: "Paste and edit article prose here once the document model and persistence land."
    },
    {
      title: "Touch-point review",
      status: "Pending workflow",
      description: "Meaningful interaction candidates will appear here for explicit writer approval."
    },
    {
      title: "Preview",
      status: "Pending components",
      description: "Approved audited interactions will render here before export."
    },
    {
      title: "Debug / history",
      status: "Pending workflow logs",
      description: "Workflow status, timings, errors, QA warnings, and export history will be visible here."
    },
    {
      title: "Export",
      status: "Pending bundler",
      description: "Immutable web-component exports will be generated from approved interactions only."
    }
  ];
</script>

<svelte:head>
  <title>Banderdash Local Editor</title>
  <meta
    name="description"
    content="Local-first editor shell for building meaningful interactive articles with Banderdash."
  />
</svelte:head>

<section class="hero" aria-labelledby="page-title">
  <p class="eyebrow">Local-first MVP editor</p>
  <h1 id="page-title">Banderdash</h1>
  <p class="lede">
    Turn ordinary articles into meaningful interactive articles through a controlled approval workflow.
  </p>
  <div class="notice" role="status">
    <strong>Current slice:</strong> localhost-only editor shell. No article data is saved yet.
  </div>
</section>

<section class="workspace" aria-label="Editor workspace placeholders">
  {#each productSections as section}
    <article class="panel">
      <div class="panel-header">
        <h2>{section.title}</h2>
        <span>{section.status}</span>
      </div>
      <p>{section.description}</p>
    </article>
  {/each}
</section>

<style>
  .hero {
    display: grid;
    gap: 1rem;
    margin-bottom: clamp(1.5rem, 4vw, 3rem);
  }

  .eyebrow {
    margin: 0;
    color: #7a4d00;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    max-width: 11ch;
    color: #111827;
    font-size: clamp(3.25rem, 12vw, 8rem);
    line-height: 0.85;
    letter-spacing: -0.08em;
  }

  .lede {
    max-width: 760px;
    margin: 0;
    color: #394456;
    font-size: clamp(1.15rem, 2.2vw, 1.55rem);
    line-height: 1.45;
  }

  .notice {
    width: fit-content;
    max-width: 100%;
    border: 1px solid rgba(145, 84, 0, 0.22);
    border-radius: 16px;
    padding: 0.85rem 1rem;
    color: #513600;
    background: #fff4d7;
  }

  .workspace {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .panel {
    min-height: 180px;
    border: 1px solid rgba(23, 32, 51, 0.12);
    border-radius: 24px;
    padding: 1.25rem;
    background: #fffdfa;
    box-shadow: 0 24px 70px rgba(23, 32, 51, 0.08);
  }

  .panel:first-child {
    grid-row: span 2;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  h2 {
    margin: 0;
    color: #172033;
    font-size: 1.1rem;
  }

  .panel span {
    flex: 0 0 auto;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    color: #475569;
    background: #edf2f7;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .panel p {
    margin: 0;
    color: #526070;
    line-height: 1.6;
  }

  @media (max-width: 760px) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .panel:first-child {
      grid-row: auto;
    }
  }
</style>
