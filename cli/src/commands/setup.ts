import { writeDefaultConfig } from "../config.js";

export function setupCommand(cwd = process.cwd()): string {
  const result = writeDefaultConfig(cwd);
  const action = result.created ? "Created" : "Found existing";

  return [
    "Banderdash setup",
    `${action} local config: ${result.configPath}`,
    "",
    "Local app settings:",
    `- host: ${result.config.app.host}`,
    `- port: ${result.config.app.port}`,
    `- sqlite: ${result.config.storage.sqlitePath}`,
    `- exports: ${result.config.storage.exportsDirectory}`,
    "",
    "Provider settings:",
    `- provider: ${result.config.provider.name}`,
    `- mode: ${result.config.provider.mode}`,
    `- model: ${result.config.provider.model ?? "not set"}`,
    "",
    "Next: run `ia doctor` to verify local readiness."
  ].join("\n");
}
