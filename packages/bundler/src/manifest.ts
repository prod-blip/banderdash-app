import { EXPORT_MANIFEST_SCHEMA_VERSION, validateExportManifest, type ExportManifest, type ExportManifestFile, type ExportManifestInteraction } from "./types.js";

export interface CreateExportManifestInput {
  articleId: string;
  componentLibraryVersion: string;
  createdAt: Date;
  documentVersion: number;
  exportId: string;
  files: ExportManifestFile[];
  interactions: ExportManifestInteraction[];
  tagName: string;
}

export function createExportManifest(input: CreateExportManifestInput): ExportManifest {
  const manifest: ExportManifest = {
    articleId: input.articleId,
    componentLibraryVersion: input.componentLibraryVersion,
    createdAt: input.createdAt.toISOString(),
    documentVersion: input.documentVersion,
    exportId: input.exportId,
    files: input.files,
    interactions: input.interactions,
    schemaVersion: EXPORT_MANIFEST_SCHEMA_VERSION,
    tagName: input.tagName
  };

  const validation = validateExportManifest(manifest);
  if (!validation.ok) {
    throw new Error(`Invalid export manifest: ${validation.errors.join("; ")}`);
  }

  return manifest;
}
