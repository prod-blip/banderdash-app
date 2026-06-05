import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultConfig, readConfig, resolveConfigPath, validateConfig } from "./config.js";
import { runCli } from "./ia.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "banderdash-cli-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("ia CLI", () => {
  it("prints help when no command is provided", () => {
    const result = runCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ia <command>");
  });

  it("dispatches setup and writes default local config", () => {
    const cwd = makeTempDir();
    const result = runCli(["setup"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Banderdash setup");
    expect(result.stdout).toContain("Created local config");

    const configPath = resolveConfigPath(cwd);
    const rawConfig = readFileSync(configPath, "utf8");
    expect(JSON.parse(rawConfig)).toEqual(createDefaultConfig());
  });

  it("does not overwrite an existing setup config", () => {
    const cwd = makeTempDir();

    runCli(["setup"], { cwd });
    const result = runCli(["setup"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Found existing local config");
  });

  it("validates config shape", () => {
    expect(validateConfig(createDefaultConfig())).toEqual([]);
    expect(validateConfig({ ...createDefaultConfig(), app: { host: "0.0.0.0", port: 5173 } })).toContain(
      "app.host must be 127.0.0.1 for the local-only MVP."
    );
  });

  it("reports missing config when reading before setup", () => {
    const cwd = makeTempDir();
    const result = readConfig(cwd);

    expect(result.config).toBeNull();
    expect(result.errors[0]).toContain("Run `ia setup` first");
  });

  it("dispatches doctor", () => {
    const result = runCli(["doctor"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Banderdash doctor");
  });

  it("dispatches start help", () => {
    const result = runCli(["start", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ia start");
  });

  it("rejects unknown commands", () => {
    const result = runCli(["unknown"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown command: unknown");
  });
});
