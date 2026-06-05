import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const CONFIG_SCHEMA_VERSION = 1;
export const CONFIG_DIRECTORY = ".banderdash";
export const CONFIG_FILENAME = "config.json";

export type ProviderMode = "cli" | "api-env";

export interface BanderdashConfig {
  schemaVersion: typeof CONFIG_SCHEMA_VERSION;
  app: {
    host: "127.0.0.1";
    port: number;
  };
  provider: {
    name: "unconfigured" | "claude" | "codex" | "openai-compatible";
    mode: ProviderMode;
    model: string | null;
  };
  storage: {
    sqlitePath: string;
    exportsDirectory: string;
  };
}

export interface ConfigReadResult {
  configPath: string;
  config: BanderdashConfig | null;
  errors: string[];
}

export function resolveConfigPath(cwd: string): string {
  return join(cwd, CONFIG_DIRECTORY, CONFIG_FILENAME);
}

export function createDefaultConfig(): BanderdashConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    app: {
      host: "127.0.0.1",
      port: 5173
    },
    provider: {
      name: "unconfigured",
      mode: "cli",
      model: null
    },
    storage: {
      sqlitePath: ".banderdash/banderdash.sqlite",
      exportsDirectory: ".banderdash/exports"
    }
  };
}

export function writeDefaultConfig(cwd: string): { configPath: string; created: boolean; config: BanderdashConfig } {
  const configPath = resolveConfigPath(cwd);

  try {
    readFileSync(configPath, "utf8");
    const readResult = readConfig(cwd);
    return {
      configPath,
      created: false,
      config: readResult.config ?? createDefaultConfig()
    };
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  const config = createDefaultConfig();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { configPath, created: true, config };
}

export function readConfig(cwd: string): ConfigReadResult {
  const configPath = resolveConfigPath(cwd);

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const errors = validateConfig(parsed);
    return {
      configPath,
      config: errors.length === 0 ? (parsed as BanderdashConfig) : null,
      errors
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        configPath,
        config: null,
        errors: [`Missing config file: ${configPath}. Run \`ia setup\` first.`]
      };
    }

    if (error instanceof SyntaxError) {
      return {
        configPath,
        config: null,
        errors: [`Invalid JSON in config file: ${configPath}.`]
      };
    }

    throw error;
  }
}

export function validateConfig(value: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return ["Config must be a JSON object."];
  }

  if (value.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CONFIG_SCHEMA_VERSION}.`);
  }

  if (!isRecord(value.app)) {
    errors.push("app must be an object.");
  } else {
    if (value.app.host !== "127.0.0.1") {
      errors.push("app.host must be 127.0.0.1 for the local-only MVP.");
    }

    const port = value.app.port;
    if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push("app.port must be an integer from 1 to 65535.");
    }
  }

  if (!isRecord(value.provider)) {
    errors.push("provider must be an object.");
  } else {
    if (!["unconfigured", "claude", "codex", "openai-compatible"].includes(String(value.provider.name))) {
      errors.push("provider.name must be unconfigured, claude, codex, or openai-compatible.");
    }

    if (!["cli", "api-env"].includes(String(value.provider.mode))) {
      errors.push("provider.mode must be cli or api-env.");
    }

    if (value.provider.model !== null && typeof value.provider.model !== "string") {
      errors.push("provider.model must be a string or null.");
    }
  }

  if (!isRecord(value.storage)) {
    errors.push("storage must be an object.");
  } else {
    if (typeof value.storage.sqlitePath !== "string" || value.storage.sqlitePath.length === 0) {
      errors.push("storage.sqlitePath must be a non-empty string.");
    }

    if (typeof value.storage.exportsDirectory !== "string" || value.storage.exportsDirectory.length === 0) {
      errors.push("storage.exportsDirectory must be a non-empty string.");
    }
  }

  return errors;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
