import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { connectDatabase } from "./db.js";
import { EXPECTED_TABLES, runMigrations } from "./migrations.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-db-test-"));
  tempDirectories.push(directory);
  return join(directory, "state", "banderdash.sqlite");
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("SQLite migrations", () => {
  it("creates the expected MVP state tables", () => {
    const db = connectDatabase({ sqlitePath: createTempDatabasePath() });

    try {
      runMigrations(db);

      const rows = db
        .prepare("select name from sqlite_master where type = 'table' order by name")
        .all() as Array<{ name: string }>;

      expect(rows.map((row) => row.name)).toEqual(["schema_migrations", ...EXPECTED_TABLES].sort());
    } finally {
      db.close();
    }
  });

  it("can run migrations more than once without changing the applied migration list", () => {
    const db = connectDatabase({ sqlitePath: createTempDatabasePath() });

    try {
      runMigrations(db);
      runMigrations(db);

      const rows = db
        .prepare("select version from schema_migrations order by version")
        .all() as Array<{ version: string }>;

      expect(rows).toEqual([{ version: "001_init" }]);
    } finally {
      db.close();
    }
  });
});
