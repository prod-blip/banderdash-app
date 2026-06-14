import { rm } from "node:fs/promises";

export interface CleanupExportArtifactsOptions {
  exportDirs: string[];
}

export interface CleanupTemporaryArtifactsOptions {
  paths: string[];
}

export interface CleanupArtifactsResult {
  deletedPaths: string[];
  failed: Array<{ path: string; message: string }>;
}

export async function cleanupExportArtifacts(options: CleanupExportArtifactsOptions): Promise<CleanupArtifactsResult> {
  return cleanupPaths(options.exportDirs);
}

export async function cleanupTemporaryArtifacts(options: CleanupTemporaryArtifactsOptions): Promise<CleanupArtifactsResult> {
  return cleanupPaths(options.paths);
}

async function cleanupPaths(paths: string[]): Promise<CleanupArtifactsResult> {
  const result: CleanupArtifactsResult = { deletedPaths: [], failed: [] };

  for (const path of dedupeNonEmptyPaths(paths)) {
    try {
      await rm(path, { force: true, recursive: true });
      result.deletedPaths.push(path);
    } catch (error) {
      result.failed.push({ path, message: errorMessage(error) });
    }
  }

  return result;
}

function dedupeNonEmptyPaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter((path) => path.trim().length > 0)));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
