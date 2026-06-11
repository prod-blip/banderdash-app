export interface SandboxPreviewRequest {
  component: string;
  props: Record<string, unknown>;
  runId: string;
}

export interface SandboxPreviewResponse {
  status: "ready" | "rendered" | "error";
  runId: string;
  error?: string;
  warnings?: string[];
  height?: number;
}

export const MAX_PREVIEW_MESSAGE_BYTES = 32_000;

export function isSandboxPreviewRequest(value: unknown): value is SandboxPreviewRequest {
  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(value.component) && isRecord(value.props) && isSafeRunId(value.runId) && measurePayloadBytes(value) <= MAX_PREVIEW_MESSAGE_BYTES;
}

export function createSandboxPreviewResponse(options: SandboxPreviewResponse): SandboxPreviewResponse {
  return options;
}

export function renderPreviewMarkup(request: SandboxPreviewRequest): string {
  const safeComponent = escapeHtml(request.component);
  const safeRunId = escapeHtml(request.runId);
  const safeProps = escapeHtml(JSON.stringify(request.props, null, 2));

  return [
    `<section class="sandbox-preview" data-run-id="${safeRunId}">`,
    `<h2>${safeComponent}</h2>`,
    `<pre>${safeProps}</pre>`,
    `</section>`
  ].join("");
}

export function startSandboxRenderer(options: { parentOrigin: string; root: HTMLElement; windowRef?: Window } = getDefaultStartOptions()): void {
  const windowRef = options.windowRef ?? window;

  windowRef.addEventListener("message", (event) => {
    if (event.origin !== options.parentOrigin) {
      return;
    }

    if (!isSandboxPreviewRequest(event.data)) {
      postToParent(windowRef, options.parentOrigin, createSandboxPreviewResponse({ status: "error", runId: "invalid", error: "Invalid preview payload." }));
      return;
    }

    try {
      options.root.innerHTML = renderPreviewMarkup(event.data);
      postToParent(
        windowRef,
        options.parentOrigin,
        createSandboxPreviewResponse({ status: "rendered", runId: event.data.runId, height: options.root.scrollHeight })
      );
    } catch (error) {
      postToParent(
        windowRef,
        options.parentOrigin,
        createSandboxPreviewResponse({
          status: "error",
          runId: event.data.runId,
          error: error instanceof Error ? error.message : "Unknown preview error."
        })
      );
    }
  });

  postToParent(windowRef, options.parentOrigin, createSandboxPreviewResponse({ status: "ready", runId: "sandbox-ready" }));
}

function getDefaultStartOptions(): { parentOrigin: string; root: HTMLElement } {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Sandbox renderer can only auto-start in a browser document.");
  }

  const root = document.getElementById("sandbox-root");
  if (!root) {
    throw new Error("Missing #sandbox-root element for sandbox renderer.");
  }

  return { parentOrigin: window.location.origin, root };
}

function postToParent(windowRef: Window, targetOrigin: string, response: SandboxPreviewResponse): void {
  windowRef.parent.postMessage(response, targetOrigin);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeRunId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

function measurePayloadBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
