import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface DatabaseOptions {
  sqlitePath: string;
}

export type BanderdashDatabase = DatabaseSync;

export function connectDatabase(options: DatabaseOptions): BanderdashDatabase {
  mkdirSync(dirname(options.sqlitePath), { recursive: true });
  const db = new DatabaseSync(options.sqlitePath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}
