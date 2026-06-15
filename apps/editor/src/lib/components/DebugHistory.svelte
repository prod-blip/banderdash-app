<script lang="ts">
  import type { DebugHistoryState, DebugWorkflowRun } from "$lib/debug-history";
  import { canCancelWorkflowRun } from "$lib/workflow-cancellation";

  export let canLoad = false;
  export let state: DebugHistoryState;
  export let onLoad: () => void | Promise<void>;
  export let onCancel: (runId: string) => void | Promise<void>;

  function formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  function canRequestCancellation(run: DebugWorkflowRun): boolean {
    return canCancelWorkflowRun(run.status) && !run.events.some((event) => event.eventType === "run_cancel_requested");
  }
</script>

<article class="panel debug-panel" aria-labelledby="debug-history-title">
  <div class="panel-header">
    <div>
      <p class="panel-kicker">Debug / history</p>
      <h2 id="debug-history-title">Workflow history</h2>
    </div>
    <span class:live={state.status === "ready"}>{state.status === "ready" ? "Loaded" : "Local"}</span>
  </div>

  <p>{state.message}</p>
  <button type="button" onclick={onLoad} disabled={!canLoad}>
    {state.status === "loading" ? "Loading..." : "Load debug history"}
  </button>

  {#if state.history}
    <div class="debug-summary" aria-label="Debug history summary">
      <span>{state.history.workflowRuns.length} runs</span>
      <span>{state.history.llmLogs.length} logs</span>
      <span>{state.history.qaResults.length} QA</span>
      <span>{state.history.exports.length} exports</span>
    </div>

    <details open>
      <summary>Workflow runs</summary>
      {#if state.history.workflowRuns.length === 0}
        <p class="hint">No workflow runs recorded for this article version.</p>
      {:else}
        <ol class="debug-list">
          {#each state.history.workflowRuns as run}
            <li>
              <div class="debug-row">
                <strong>{run.status}</strong>
                <span>{run.id}</span>
              </div>
              <p>Current stage: {run.currentStage ?? "none"}</p>
              {#if canRequestCancellation(run)}
                <button type="button" class="secondary" onclick={() => onCancel(run.id)}>Cancel workflow run</button>
              {:else if canCancelWorkflowRun(run.status)}
                <p class="hint">Cancellation requested; the workflow will stop at the next cooperative boundary.</p>
              {/if}
              {#if run.stageStatuses.length > 0}
                <ul>
                  {#each run.stageStatuses as stage}
                    <li>
                      {stage.stage}: {stage.status}{stage.durationMs !== undefined ? ` · ${stage.durationMs}ms` : ""}
                    </li>
                  {/each}
                </ul>
              {/if}
              {#if run.events.length > 0}
                <details>
                  <summary>{run.events.length} event{run.events.length === 1 ? "" : "s"}</summary>
                  <pre>{formatJson(run.events)}</pre>
                </details>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </details>

    <details>
      <summary>Structured LLM logs</summary>
      {#if state.history.llmLogs.length === 0}
        <p class="hint">No structured LLM logs recorded.</p>
      {:else}
        <ol class="debug-list">
          {#each state.history.llmLogs as log}
            <li>
              <div class="debug-row">
                <strong>{log.nodeName}</strong>
                <span>{log.durationMs !== undefined ? `${log.durationMs}ms` : "no timing"}</span>
              </div>
              {#if log.error}
                <p class="error">Error: {formatJson(log.error)}</p>
              {/if}
              <details>
                <summary>Structured input/output</summary>
                <pre>{formatJson({ input: log.structuredInput, output: log.structuredOutput, tokenUsage: log.tokenUsage, cost: log.cost })}</pre>
              </details>
            </li>
          {/each}
        </ol>
      {/if}
    </details>

    <details>
      <summary>QA warnings</summary>
      {#if state.history.qaResults.length === 0}
        <p class="hint">No QA results recorded.</p>
      {:else}
        <ol class="debug-list">
          {#each state.history.qaResults as qa}
            <li>
              <div class="debug-row">
                <strong>{qa.status}</strong>
                <span>{qa.generatedSpecId}</span>
              </div>
              <pre>{formatJson(qa.result)}</pre>
            </li>
          {/each}
        </ol>
      {/if}
    </details>

    <details>
      <summary>Exports</summary>
      {#if state.history.exports.length === 0}
        <p class="hint">No exports recorded.</p>
      {:else}
        <ol class="debug-list">
          {#each state.history.exports as exportRecord}
            <li>
              <div class="debug-row">
                <strong>{exportRecord.id}</strong>
                <span>v{exportRecord.documentVersion}</span>
              </div>
              <pre>{formatJson({ manifest: exportRecord.manifest, payload: exportRecord.payload })}</pre>
            </li>
          {/each}
        </ol>
      {/if}
    </details>
  {/if}
</article>

<style>
  .debug-panel {
    display: grid;
    gap: 0.85rem;
  }

  .debug-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .debug-list {
    display: grid;
    gap: 0.75rem;
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
  }

  .debug-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  details {
    border-top: 1px solid rgba(23, 32, 51, 0.08);
    padding-top: 0.75rem;
  }

  summary {
    cursor: pointer;
    color: #172033;
    font-weight: 800;
  }

  pre {
    overflow: auto;
    max-height: 18rem;
    border-radius: 12px;
    padding: 0.75rem;
    background: #0f172a;
    color: #e2e8f0;
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .hint {
    color: #64748b;
  }

  .error {
    color: #9f1239;
  }

  .secondary {
    width: fit-content;
    border-color: rgba(159, 18, 57, 0.28);
    color: #9f1239;
    background: #fff1f2;
  }
</style>
