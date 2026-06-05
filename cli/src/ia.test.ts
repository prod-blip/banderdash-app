import { describe, expect, it } from "vitest";
import { runCli } from "./ia.js";

describe("ia CLI", () => {
  it("prints help when no command is provided", () => {
    const result = runCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage: ia <command>");
  });

  it("dispatches setup", () => {
    const result = runCli(["setup"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Banderdash setup");
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
