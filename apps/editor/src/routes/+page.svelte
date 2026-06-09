<script lang="ts">
  import {
    createInitialArticleEditorState,
    getArticleWordCount,
    hasUnsavedArticleChanges,
    persistArticle
  } from "$lib/article-editor";

  interface ProductSection {
    title: string;
    status: string;
    description: string;
  }

  const productSections: ProductSection[] = [
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

  let editorState = createInitialArticleEditorState();

  $: wordCount = getArticleWordCount(editorState);
  $: hasUnsavedChanges = hasUnsavedArticleChanges(editorState);
  $: canSave = editorState.status !== "saving" && editorState.rawText.trim().length > 0 && hasUnsavedChanges;

  async function saveArticleDraft() {
    editorState = {
      ...editorState,
      status: "saving",
      message: editorState.savedArticle ? "Updating saved local draft..." : "Creating saved local draft..."
    };
    editorState = await persistArticle(fetch, editorState);
  }
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
    <strong>Current slice:</strong> article input now creates and updates saved local drafts through SQLite-backed API routes.
  </div>
</section>

<section class="workspace" aria-label="Editor workspace">
  <article class="panel article-panel" aria-labelledby="article-input-title">
    <div class="panel-header">
      <div>
        <p class="panel-kicker">Input / document</p>
        <h2 id="article-input-title">Saved article draft</h2>
      </div>
      <span class:live={editorState.savedArticle}> {editorState.savedArticle ? "Saved locally" : "New draft"}</span>
    </div>

    <label for="article-text">Article prose</label>
    <textarea
      id="article-text"
      bind:value={editorState.rawText}
      placeholder="Paste article prose here. Banderdash will save it as a local versioned ArticleDoc."
      rows="16"
    ></textarea>

    <div class="article-actions">
      <div class="article-meta" aria-live="polite">
        <strong>{wordCount}</strong> words
        {#if editorState.savedArticle}
          · draft <strong>{editorState.savedArticle.id}</strong> v<strong>{editorState.savedArticle.version}</strong>
        {/if}
        {#if hasUnsavedChanges}
          · unsaved changes
        {/if}
      </div>
      <button type="button" onclick={saveArticleDraft} disabled={!canSave}>
        {editorState.status === "saving" ? "Saving..." : editorState.savedArticle ? "Update draft" : "Save draft"}
      </button>
    </div>

    <p class:error={editorState.status === "error" || editorState.status === "conflict"} class="save-message" role="status">
      {editorState.message}
    </p>

    {#if editorState.savedArticle}
      <section class="saved-blocks" aria-labelledby="saved-blocks-title">
        <h3 id="saved-blocks-title">Persisted blocks</h3>
        <ol>
          {#each editorState.savedArticle.blocks as block}
            <li>
              <span>{block.type}</span>
              <p>{block.text}</p>
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  </article>

  <div class="side-panels">
    {#each productSections as section}
      <article class="panel">
        <div class="panel-header">
          <h2>{section.title}</h2>
          <span>{section.status}</span>
        </div>
        <p>{section.description}</p>
      </article>
    {/each}
  </div>
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
    grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr);
    gap: 1rem;
    align-items: start;
  }

  .side-panels {
    display: grid;
    gap: 1rem;
  }

  .panel {
    border: 1px solid rgba(23, 32, 51, 0.12);
    border-radius: 24px;
    padding: 1.25rem;
    background: #fffdfa;
    box-shadow: 0 24px 70px rgba(23, 32, 51, 0.08);
  }

  .article-panel {
    display: grid;
    gap: 1rem;
  }

  .panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .panel-kicker {
    margin: 0 0 0.25rem;
    color: #64748b;
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h2,
  h3 {
    margin: 0;
    color: #172033;
  }

  h2 {
    font-size: 1.1rem;
  }

  h3 {
    font-size: 0.95rem;
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

  .panel span.live {
    color: #14532d;
    background: #dcfce7;
  }

  label {
    color: #172033;
    font-weight: 800;
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    resize: vertical;
    border: 1px solid rgba(23, 32, 51, 0.16);
    border-radius: 18px;
    padding: 1rem;
    color: #172033;
    background: #fff;
    font: inherit;
    line-height: 1.55;
  }

  textarea:focus {
    outline: 3px solid rgba(245, 158, 11, 0.22);
    border-color: #b7791f;
  }

  .article-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .article-meta,
  .save-message,
  .panel p {
    margin: 0;
    color: #526070;
    line-height: 1.6;
  }

  button {
    flex: 0 0 auto;
    border: 0;
    border-radius: 999px;
    padding: 0.75rem 1rem;
    color: #fff;
    background: #172033;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    color: #64748b;
    background: #e2e8f0;
  }

  .save-message.error {
    color: #991b1b;
    font-weight: 700;
  }

  .saved-blocks {
    display: grid;
    gap: 0.75rem;
    border-top: 1px solid rgba(23, 32, 51, 0.1);
    padding-top: 1rem;
  }

  .saved-blocks ol {
    display: grid;
    gap: 0.7rem;
    margin: 0;
    padding-left: 1.25rem;
  }

  .saved-blocks li {
    color: #475569;
  }

  .saved-blocks li span {
    display: inline-block;
    margin-bottom: 0.35rem;
  }

  @media (max-width: 920px) {
    .workspace {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 620px) {
    .article-actions {
      align-items: stretch;
      flex-direction: column;
    }

    button {
      width: 100%;
    }
  }
</style>
