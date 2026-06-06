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

  it("reports failed doctor checks before setup", () => {
    const cwd = makeTempDir();
    const result = runCli(["doctor"], { cwd });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("Banderdash doctor");
    expect(result.stdout).toContain("Local config");
    expect(result.stdout).toContain("Run `ia setup` first");
  });

  it("runs doctor checks after setup", () => {
    const cwd = makeTempDir();

    runCli(["setup"], { cwd });
    const result = runCli(["doctor"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("✓ Local config");
    expect(result.stdout).toContain("✓ Local-only host");
    expect(result.stdout).toContain("! Provider");
    expect(result.stdout).toContain("Result: ready for current MVP slice.");
  });

  it("dispatches start help", () => {
    const result = runCli(["start", "--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ia start");
  });

  it("prepares start command with localhost-only binding", () => {
    const cwd = makeTempDir();
    const result = runCli(["start"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("http://127.0.0.1:5173");
    expect(result.startProcess).toMatchObject({
      command: "npm",
      cwd,
      args: ["run", "dev", "--workspace", "@banderdash/editor", "--", "--host", "127.0.0.1", "--port", "5173"]
    });
    expect(result.startProcess?.env.HOST).toBe("127.0.0.1");
    expect(result.startProcess?.env.PORT).toBe("5173");
  });

  it("rejects unknown commands", () => {
    const result = runCli(["unknown"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown command: unknown");
  });
});
