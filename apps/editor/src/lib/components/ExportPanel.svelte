<script lang="ts">
  import type { ExportPanelState } from "$lib/export-panel";

  interface Props {
    approvedCandidateCount: number;
    canExport: boolean;
    state: ExportPanelState;
    onExport: () => void | Promise<void>;
    onQaOverrideChange: (confirmed: boolean) => void;
  }

  let { approvedCandidateCount, canExport, state, onExport, onQaOverrideChange }: Props = $props();
</script>

<article class="panel export-panel" aria-labelledby="export-panel-title">
  <div class="panel-header">
    <div>
      <p class="panel-kicker">Download</p>
      <h2 id="export-panel-title">Export</h2>
    </div>
    <span class:live={state.status === "exported"}>{state.status === "exported" ? "Exported" : "Ready after approval"}</span>
  </div>

  <p>{state.message}</p>
  <p class="hint">
    Approved interactions: <strong>{approvedCandidateCount}</strong>
  </p>

  <details class="advanced-export-options">
    <summary>Advanced export option</summary>
    <label class="checkbox-row">
      <input checked={state.qaOverrideConfirmed} type="checkbox" onchange={(event) => onQaOverrideChange(event.currentTarget.checked)} />
      Allow export when local QA records warnings. Leave off unless you reviewed the warning.
    </label>
  </details>

  <button type="button" onclick={onExport} disabled={!canExport}>
    {state.status === "exporting" ? "Exporting..." : "Export article"}
  </button>

  {#if state.result}
    <section class="export-result" aria-labelledby="export-result-title">
      <h3 id="export-result-title">Export files</h3>
      <p><strong>Preview:</strong> {state.result.previewPath}</p>
      <p><strong>Custom element:</strong> <code>{state.result.tagName}</code></p>
      <ul>
        {#each state.result.files as file}
          <li>
            <span>{file.path}</span>
            <small>{file.bytes} bytes · {file.sha256.slice(0, 12)}…</small>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</article>

<style>
  .export-panel {
    display: grid;
    gap: 1rem;
  }

  .checkbox-row {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    color: #4b5563;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .checkbox-row input {
    margin-top: 0.2rem;
  }

  .advanced-export-options {
    border-top: 1px solid rgba(23, 32, 51, 0.08);
    padding-top: 0.75rem;
  }

  .advanced-export-options summary {
    cursor: pointer;
    color: #475569;
    font-size: 0.9rem;
    font-weight: 800;
  }

  .advanced-export-options .checkbox-row {
    margin-top: 0.75rem;
  }

  .export-result {
    display: grid;
    gap: 0.65rem;
    border-top: 1px solid rgba(23, 32, 51, 0.1);
    padding-top: 0.9rem;
  }

  .export-result h3,
  .export-result p {
    margin: 0;
  }

  .export-result ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .export-result li {
    display: grid;
    gap: 0.2rem;
    border: 1px solid rgba(23, 32, 51, 0.08);
    border-radius: 12px;
    padding: 0.65rem;
    background: #f8fafc;
  }

  .export-result small {
    color: #64748b;
  }
</style>
