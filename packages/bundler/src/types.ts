export const EXPORT_MANIFEST_SCHEMA_VERSION = "1";

export type ExportInteractionMode = "library" | "restricted-bespoke";

export interface ExportManifestFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface ExportManifestInteraction {
  id: string;
  blockIds: string[];
  mode: ExportInteractionMode;
  componentName?: string;
}

export interface ExportManifest {
  exportId: string;
  articleId: string;
  documentVersion: number;
  schemaVersion: string;
  createdAt: string;
  tagName: string;
  files: ExportManifestFile[];
  componentLibraryVersion: string;
  interactions: ExportManifestInteraction[];
}

export interface ManifestValidationResult {
  errors: string[];
  ok: boolean;
}

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const CUSTOM_ELEMENT_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

export function isExportManifest(value: unknown): value is ExportManifest {
  return validateExportManifest(value).ok;
}

export function validateExportManifest(value: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { errors: ["manifest must be an object"], ok: false };
  }

  requireNonEmptyString(value, "exportId", errors);
  requireNonEmptyString(value, "articleId", errors);
  requirePositiveInteger(value, "documentVersion", errors);
  requireNonEmptyString(value, "schemaVersion", errors);
  requireIsoDateString(value, "createdAt", errors);
  requireCustomElementTagName(value, "tagName", errors);
  requireNonEmptyString(value, "componentLibraryVersion", errors);

  if (!Array.isArray(value.files) || value.files.length === 0) {
    errors.push("files must contain at least one file entry");
  } else {
    value.files.forEach((file, index) => validateManifestFile(file, `files[${index}]`, errors));
  }

  if (!Array.isArray(value.interactions)) {
    errors.push("interactions must be an array");
  } else {
    value.interactions.forEach((interaction, index) => validateManifestInteraction(interaction, `interactions[${index}]`, errors));
  }

  return { errors, ok: errors.length === 0 };
}

function validateManifestFile(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireNonEmptyString(value, `${path}.path`, errors, "path");

  if (typeof value.sha256 !== "string" || !SHA256_HEX_PATTERN.test(value.sha256)) {
    errors.push(`${path}.sha256 must be a lowercase 64-character sha256 hex digest`);
  }

  requirePositiveInteger(value, `${path}.bytes`, errors, "bytes");
}

function validateManifestInteraction(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  requireNonEmptyString(value, `${path}.id`, errors, "id");

  if (!Array.isArray(value.blockIds) || value.blockIds.length === 0 || value.blockIds.some((blockId) => typeof blockId !== "string" || blockId.trim() === "")) {
    errors.push(`${path}.blockIds must contain at least one block id`);
  }

  if (value.mode !== "library" && value.mode !== "restricted-bespoke") {
    errors.push(`${path}.mode must be library or restricted-bespoke`);
  }

  if (value.componentName !== undefined && (typeof value.componentName !== "string" || value.componentName.trim() === "")) {
    errors.push(`${path}.componentName must be a non-empty string when provided`);
  }
}

function requireNonEmptyString(value: Record<string, unknown>, label: string, errors: string[], key = label): void {
  if (typeof value[key] !== "string" || value[key].trim() === "") {
    errors.push(`${label} must be a non-empty string`);
  }
}

function requirePositiveInteger(value: Record<string, unknown>, label: string, errors: string[], key = label): void {
  if (!Number.isInteger(value[key]) || (value[key] as number) <= 0) {
    errors.push(`${label} must be a positive integer`);
  }
}

function requireIsoDateString(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (typeof value[key] !== "string" || Number.isNaN(Date.parse(value[key]))) {
    errors.push(`${key} must be an ISO date string`);
  }
}

function requireCustomElementTagName(value: Record<string, unknown>, key: string, errors: string[]): void {
  if (typeof value[key] !== "string" || !CUSTOM_ELEMENT_NAME_PATTERN.test(value[key])) {
    errors.push(`${key} must be a valid custom element tag name`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
