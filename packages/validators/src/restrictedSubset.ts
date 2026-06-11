import { createValidationResult, type ValidationFinding, type ValidationResult } from "./types.js";

export interface RestrictedSubsetValidationInput {
  source: string;
  allowedImportPrefixes?: string[];
}

interface BlockRule {
  code: string;
  message: string;
  pattern: RegExp;
}

const BLOCK_RULES: BlockRule[] = [
  { code: "RUNTIME_NETWORK_FETCH", message: "Runtime fetch calls are not allowed in exported components.", pattern: /\bfetch\s*\(/ },
  { code: "RUNTIME_NETWORK_XHR", message: "XMLHttpRequest is not allowed in exported components.", pattern: /\bXMLHttpRequest\b/ },
  { code: "RUNTIME_NETWORK_WEBSOCKET", message: "WebSocket is not allowed in exported components.", pattern: /\bWebSocket\b/ },
  { code: "RUNTIME_NETWORK_EVENTSOURCE", message: "EventSource is not allowed in exported components.", pattern: /\bEventSource\b/ },
  { code: "STORAGE_LOCAL", message: "localStorage is not allowed in exported components.", pattern: /\blocalStorage\b/ },
  { code: "STORAGE_SESSION", message: "sessionStorage is not allowed in exported components.", pattern: /\bsessionStorage\b/ },
  { code: "STORAGE_INDEXEDDB", message: "indexedDB is not allowed in exported components.", pattern: /\bindexedDB\b/ },
  { code: "COOKIE_ACCESS", message: "document.cookie is not allowed in exported components.", pattern: /\bdocument\s*\.\s*cookie\b/ },
  { code: "DYNAMIC_EVAL", message: "eval is not allowed in exported components.", pattern: /\beval\s*\(/ },
  { code: "DYNAMIC_FUNCTION", message: "new Function is not allowed in exported components.", pattern: /\bnew\s+Function\b/ },
  { code: "DYNAMIC_IMPORT", message: "Dynamic import() is not allowed in exported components.", pattern: /\bimport\s*\(/ },
  { code: "RAW_HTML", message: "Svelte raw HTML rendering is not allowed in exported components.", pattern: /\{@html\b/ },
  { code: "HOST_DOM_QUERY", message: "Host DOM queries are not allowed in exported components.", pattern: /\bdocument\s*\.\s*querySelector(All)?\s*\(/ },
  { code: "HOST_PARENT_WINDOW", message: "Access to window.parent is not allowed in exported components.", pattern: /\bwindow\s*\.\s*parent\b/ },
  { code: "REMOTE_URL", message: "Remote URLs are not allowed in exported components.", pattern: /https?:\/\// },
  { code: "GLOBAL_EVENT_LISTENER", message: "Unscoped global event listeners are not allowed in exported components.", pattern: /\b(window|document)\s*\.\s*addEventListener\s*\(/ },
  { code: "GLOBAL_TIMER", message: "Global timers are not allowed in exported components.", pattern: /\b(setInterval|setTimeout)\s*\(/ }
];

const STATIC_IMPORT_PATTERN = /\bimport\s+(?:[^"';]+?\s+from\s+)?["']([^"']+)["']/g;

export function validateRestrictedSubset(input: RestrictedSubsetValidationInput): ValidationResult {
  const hardFailures: ValidationFinding[] = [];

  for (const rule of BLOCK_RULES) {
    if (rule.pattern.test(input.source)) {
      hardFailures.push({ code: rule.code, message: rule.message });
    }
  }

  hardFailures.push(...validateStaticImports(input.source, input.allowedImportPrefixes ?? ["./", "../"]));

  return createValidationResult({ hardFailures });
}

function validateStaticImports(source: string, allowedImportPrefixes: string[]): ValidationFinding[] {
  const failures: ValidationFinding[] = [];
  const matches = source.matchAll(STATIC_IMPORT_PATTERN);

  for (const match of matches) {
    const specifier = match[1];
    if (!specifier) {
      continue;
    }
    const isAllowed = allowedImportPrefixes.some((prefix) => specifier.startsWith(prefix));
    if (!isAllowed) {
      failures.push({
        code: "EXTERNAL_IMPORT",
        message: `External import '${specifier}' is not allowed in exported components.`
      });
    }
  }

  return failures;
}
