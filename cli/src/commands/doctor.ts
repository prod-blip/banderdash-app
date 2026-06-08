import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { connectDatabase } from "@banderdash/backend/services/db";
import { runMigrations } from "@banderdash/backend/services/migrations";
import { readConfig } from "../config.js";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorStatus;
  message: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  exitCode: number;
}

export function doctorCommand(cwd = process.cwd()): { exitCode: number; stdout: string } {
  const report = runDoctorChecks(cwd);

  return {
    exitCode: report.exitCode,
    stdout: formatDoctorReport(report)
  };
}

export function runDoctorChecks(cwd: string): DoctorReport {
  const configResult = readConfig(cwd);
  const checks: DoctorCheck[] = [
    checkNodeVersion(),
    checkConfig(configResult.errors),
    checkLocalHost(configResult.config?.app.host),
    checkStoragePaths(cwd, configResult.config?.storage.sqlitePath, configResult.config?.storage.exportsDirectory),
    checkSqliteState(cwd, configResult.config?.storage.sqlitePath),
    checkProviderConfigured(configResult.config?.provider.name, configResult.config?.provider.model)
  ];

  const hasFailure = checks.some((check) => check.status === "fail");

  return {
    checks,
    exitCode: hasFailure ? 1 : 0
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  return [
    "Banderdash doctor",
    "",
    ...report.checks.map((check) => `${statusIcon(check.status)} ${check.label}: ${check.message}`),
    "",
    report.exitCode === 0 ? "Result: ready for current MVP slice." : "Result: fix failed checks before starting Banderdash."
  ].join("\n");
}

function checkNodeVersion(): DoctorCheck {
  const majorVersion = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);

  if (!Number.isInteger(majorVersion) || majorVersion < 22) {
    return {
      id: "node-version",
      label: "Node.js",
      status: "fail",
      message: `requires Node.js 22+; found ${process.versions.node}`
    };
  }

  return {
    id: "node-version",
    label: "Node.js",
    status: "pass",
    message: `found ${process.versions.node}`
  };
}

function checkConfig(errors: string[]): DoctorCheck {
  if (errors.length > 0) {
    return {
      id: "config",
      label: "Local config",
      status: "fail",
      message: errors.join(" ")
    };
  }

  return {
    id: "config",
    label: "Local config",
    status: "pass",
    message: "config file exists and matches the MVP schema"
  };
}

function checkLocalHost(host: string | undefined): DoctorCheck {
  if (host === "127.0.0.1") {
    return {
      id: "local-host",
      label: "Local-only host",
      status: "pass",
      message: "configured for 127.0.0.1"
    };
  }

  return {
    id: "local-host",
    label: "Local-only host",
    status: "fail",
    message: "setup config must bind the editor to 127.0.0.1"
  };
}

function checkStoragePaths(cwd: string, sqlitePath: string | undefined, exportsDirectory: string | undefined): DoctorCheck {
  if (!sqlitePath || !exportsDirectory) {
    return {
      id: "storage-paths",
      label: "Storage paths",
      status: "fail",
      message: "sqlite and export paths must be configured"
    };
  }

  const sqliteDirectoryExists = existsSync(dirname(resolveConfiguredPath(cwd, sqlitePath)));

  return {
    id: "storage-paths",
    label: "Storage paths",
    status: sqliteDirectoryExists ? "pass" : "warn",
    message: sqliteDirectoryExists
      ? `sqlite=${sqlitePath}; exports=${exportsDirectory}`
      : "config directory does not exist yet; run `ia setup`"
  };
}

function checkSqliteState(cwd: string, sqlitePath: string | undefined): DoctorCheck {
  if (!sqlitePath) {
    return {
      id: "sqlite-state",
      label: "SQLite state",
      status: "fail",
      message: "storage.sqlitePath must be configured"
    };
  }

  const resolvedSqlitePath = resolveConfiguredPath(cwd, sqlitePath);
  let db: ReturnType<typeof connectDatabase> | null = null;

  try {
    db = connectDatabase({ sqlitePath: resolvedSqlitePath });
    runMigrations(db);

    return {
      id: "sqlite-state",
      label: "SQLite state",
      status: "pass",
      message: "database opens and migrations are current"
    };
  } catch (error) {
    return {
      id: "sqlite-state",
      label: "SQLite state",
      status: "fail",
      message: `could not initialize ${sqlitePath}: ${formatErrorMessage(error)}`
    };
  } finally {
    db?.close();
  }
}

function resolveConfiguredPath(cwd: string, configuredPath: string): string {
  return resolve(cwd, configuredPath);
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function checkProviderConfigured(providerName: string | undefined, model: string | null | undefined): DoctorCheck {
  if (!providerName || providerName === "unconfigured" || !model) {
    return {
      id: "provider-config",
      label: "Provider",
      status: "warn",
      message: "provider preflight is not configured yet; later provider PR will make this required"
    };
  }

  return {
    id: "provider-config",
    label: "Provider",
    status: "pass",
    message: `${providerName} / ${model}`
  };
}

function statusIcon(status: DoctorStatus): string {
  switch (status) {
    case "pass":
      return "✓";
    case "warn":
      return "!";
    case "fail":
      return "✗";
  }
}
