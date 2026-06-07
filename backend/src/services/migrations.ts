import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BanderdashDatabase } from "./db.js";

export const EXPECTED_TABLES = [
  "approvals",
  "article_blocks",
  "article_versions",
  "articles",
  "candidates",
  "exports",
  "generated_specs",
  "llm_logs",
  "qa_results",
  "validation_results",
  "workflow_events",
  "workflow_runs"
] as const;

const MIGRATIONS = [
  {
    version: "001_init",
    filename: "001_init.sql"
  }
] as const;

export function runMigrations(db: BanderdashDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const migration of MIGRATIONS) {
    const alreadyApplied = db
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(migration.version) as { version: string } | undefined;

    if (alreadyApplied) {
      continue;
    }

    const sql = readMigrationFile(migration.filename);
    db.exec("BEGIN;");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(migration.version);
      db.exec("COMMIT;");
    } catch (error) {
      db.exec("ROLLBACK;");
      throw error;
    }
  }
}

function readMigrationFile(filename: string): string {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(currentDirectory, "../../../migrations", filename), "utf8");
}
