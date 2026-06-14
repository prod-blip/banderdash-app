import { createHash, randomUUID } from "node:crypto";

const CUSTOM_ELEMENT_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

export interface GenerateExportTagNameOptions {
  entropy?: string;
  exportId?: string;
}

export function generateExportTagName(options: GenerateExportTagNameOptions = {}): string {
  const source = options.entropy ?? options.exportId ?? randomUUID();
  const suffix = createHash("sha256").update(source).digest("hex").slice(0, 12);
  return `ia-article-${suffix}`;
}

export function isValidCustomElementTagName(tagName: string): boolean {
  return CUSTOM_ELEMENT_NAME_PATTERN.test(tagName);
}
