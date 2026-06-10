import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectDatabase, type BanderdashDatabase } from "@banderdash/backend/services/db";
import { runMigrations } from "@banderdash/backend/services/migrations";
import { createArticleService, type ArticleService } from "@banderdash/backend/services/articles";

interface LocalStorageConfig {
  storage?: {
    sqlitePath?: unknown;
  };
}

let database: BanderdashDatabase | null = null;
let articleService: ArticleService | null = null;

export function getEditorDatabase(): BanderdashDatabase {
  if (database) {
    return database;
  }

  database = connectDatabase({ sqlitePath: resolveSqlitePath() });
  runMigrations(database);
  return database;
}

export function getEditorArticleService(): ArticleService {
  if (articleService) {
    return articleService;
  }

  articleService = createArticleService({ db: getEditorDatabase() });

  return articleService;
}

function resolveSqlitePath(): string {
  const projectRoot = findProjectRoot();
  const configPath = join(projectRoot, ".banderdash", "config.json");

  if (!existsSync(configPath)) {
    return join(projectRoot, ".banderdash", "banderdash.sqlite");
  }

  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as LocalStorageConfig;
  const configuredSqlitePath = parsed.storage?.sqlitePath;

  if (typeof configuredSqlitePath !== "string" || configuredSqlitePath.length === 0) {
    throw new Error("Banderdash config storage.sqlitePath must be a non-empty string.");
  }

  return resolve(projectRoot, configuredSqlitePath);
}

function findProjectRoot(): string {
  let currentDirectory = dirname(fileURLToPath(import.meta.url));

  while (currentDirectory !== dirname(currentDirectory)) {
    if (existsSync(join(currentDirectory, "package.json")) && existsSync(join(currentDirectory, "implementation-plan.md"))) {
      return currentDirectory;
    }

    currentDirectory = dirname(currentDirectory);
  }

  return process.cwd();
}
