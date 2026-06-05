export function startCommand(args: string[] = []): string {
  if (args.includes("--help") || args.includes("-h")) {
    return [
      "Banderdash start",
      "Usage: ia start",
      "Starts the localhost-only editor once the editor app exists."
    ].join("\n");
  }

  return [
    "Banderdash start",
    "Status: MVP stub only.",
    "Editor app is not implemented yet."
  ].join("\n");
}
