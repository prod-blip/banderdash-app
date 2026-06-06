import { spawn } from "node:child_process";

export interface StartProcessSpec {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface StartCommandResult {
  exitCode: number;
  stdout?: string;
  startProcess?: StartProcessSpec;
}

export function startCommand(args: string[] = [], cwd = process.cwd()): StartCommandResult {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      exitCode: 0,
      stdout: [
        "Banderdash start",
        "Usage: ia start",
        "Starts the localhost-only editor at http://127.0.0.1:5173."
      ].join("\n")
    };
  }

  return {
    exitCode: 0,
    stdout: [
      "Banderdash start",
      "Starting localhost-only editor at http://127.0.0.1:5173",
      "Host binding: 127.0.0.1"
    ].join("\n"),
    startProcess: {
      command: "npm",
      args: ["run", "dev", "--workspace", "@banderdash/editor", "--", "--host", "127.0.0.1", "--port", "5173"],
      cwd,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "5173"
      }
    }
  };
}

export function runStartProcess(spec: StartProcessSpec): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: spec.env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
