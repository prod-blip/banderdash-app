import type { ArticleDoc, Block } from "@banderdash/doc-model";

export type ArticleSaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

export interface ArticleEditorState {
  rawText: string;
  savedArticle: ArticleDoc | null;
  lastSavedText: string;
  status: ArticleSaveStatus;
  message: string;
}

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

export function createInitialArticleEditorState(rawText = ""): ArticleEditorState {
  return {
    rawText,
    savedArticle: null,
    lastSavedText: "",
    status: "idle",
    message: "Paste article prose to create the first saved local draft."
  };
}

export function getArticleWordCount(state: Pick<ArticleEditorState, "rawText">): number {
  return state.rawText.trim().length === 0 ? 0 : state.rawText.trim().split(/\s+/u).length;
}

export function hasUnsavedArticleChanges(state: ArticleEditorState): boolean {
  return state.rawText !== state.lastSavedText;
}

export async function persistArticle(fetcher: FetchLike, state: ArticleEditorState): Promise<ArticleEditorState> {
  const trimmedText = state.rawText.trim();
  if (trimmedText.length === 0) {
    return {
      ...state,
      status: "error",
      message: "Paste article prose before saving."
    };
  }

  const request = state.savedArticle
    ? {
        url: `/api/articles/${state.savedArticle.id}`,
        init: jsonRequest("PUT", { rawText: state.rawText, expectedVersion: state.savedArticle.version })
      }
    : {
        url: "/api/articles",
        init: jsonRequest("POST", { rawText: state.rawText })
      };

  const response = await fetcher(request.url, request.init);
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return {
      ...state,
      status: response.status === 409 ? "conflict" : "error",
      message: readApiErrorMessage(payload, response.status)
    };
  }

  if (!isArticleDoc(payload)) {
    return {
      ...state,
      status: "error",
      message: "Article API returned an invalid document."
    };
  }

  return {
    rawText: state.rawText,
    savedArticle: payload,
    lastSavedText: state.rawText,
    status: "saved",
    message: `Saved local draft v${payload.version} with ${payload.blocks.length} block${payload.blocks.length === 1 ? "" : "s"}.`
  };
}

function jsonRequest(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

function readApiErrorMessage(payload: unknown, status: number): string {
  if (isApiErrorPayload(payload)) {
    return payload.error.message;
  }

  return `Article save failed with HTTP ${status}.`;
}

function isArticleDoc(value: unknown): value is ArticleDoc {
  if (!isRecord(value) || !isRecord(value.meta)) {
    return false;
  }

  const { id, version, blocks, meta } = value;

  return (
    typeof id === "string" &&
    id.length > 0 &&
    isPositiveInteger(version) &&
    Array.isArray(blocks) &&
    blocks.every(isBlock) &&
    typeof meta.createdAt === "string" &&
    typeof meta.updatedAt === "string" &&
    isNonNegativeInteger(meta.wordCount)
  );
}

function isBlock(value: unknown): value is Block {
  if (!isRecord(value)) {
    return false;
  }

  const { id, version, type, text, spans, signals } = value;

  return (
    typeof id === "string" &&
    id.length > 0 &&
    isPositiveInteger(version) &&
    typeof type === "string" &&
    typeof text === "string" &&
    Array.isArray(spans) &&
    Array.isArray(signals)
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isApiErrorPayload(value: unknown): value is { error: { message: string } } {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false;
  }

  return typeof value.error.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
