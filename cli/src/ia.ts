#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { doctorCommand } from "./commands/doctor.js";
import { setupCommand } from "./commands/setup.js";
import { runStartProcess, startCommand, type StartProcessSpec } from "./commands/start.js";

export interface CliResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  startProcess?: StartProcessSpec;
}

const helpText = [
  "Banderdash CLI",
  "",
  "Usage: ia <command>",
  "",
  "Commands:",
  "  setup   Create local Banderdash configuration",
  "  doctor  Run local diagnostics and preflight checks",
  "  start   Start the localhost-only editor"
].join("\n");

export interface CliOptions {
  cwd?: string;
}

export function runCli(args: string[], options: CliOptions = {}): CliResult {
  const [command, ...rest] = args;
  const cwd = options.cwd ?? process.cwd();

  if (!command || command === "--help" || command === "-h") {
    return { exitCode: 0, stdout: helpText };
  }

  switch (command) {
    case "setup":
      return { exitCode: 0, stdout: setupCommand(cwd) };
    case "doctor":
      return doctorCommand(cwd);
    case "start":
      return startCommand(rest, cwd);
    default:
      return {
        exitCode: 1,
        stderr: [`Unknown command: ${command}`, "", helpText].join("\n")
      };
  }
}

async function main(): Promise<void> {
  const result = runCli(process.argv.slice(2));

  if (result.stdout) {
    console.log(result.stdout);
  }

  if (result.stderr) {
    console.error(result.stderr);
  }

  if (result.startProcess) {
    process.exitCode = await runStartProcess(result.startProcess);
    return;
  }

  process.exitCode = result.exitCode;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
