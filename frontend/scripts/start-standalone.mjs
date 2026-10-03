import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = path.join(frontendRoot, ".next", "standalone");

await mkdir(path.join(standaloneRoot, ".next"), { recursive: true });
await cp(path.join(frontendRoot, "public"), path.join(standaloneRoot, "public"), { recursive: true });
await cp(path.join(frontendRoot, ".next", "static"), path.join(standaloneRoot, ".next", "static"), { recursive: true });

const server = spawn(process.execPath, [path.join(standaloneRoot, "server.js")], {
  cwd: standaloneRoot,
  env: process.env,
  stdio: "inherit",
});

server.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
