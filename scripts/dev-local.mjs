import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const frontend = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL("node_modules/vite/bin/vite.js", root)
    ),
    "--host",
    "localhost",
    "--port",
    "5173",
    "--strictPort"
  ],
  {
    cwd: fileURLToPath(
      new URL("packages/react-frontend/", root)
    ),
    stdio: "inherit",
    windowsHide: true
  }
);
const backend = spawn(
  process.execPath,
  ["--env-file-if-exists=.env.local", "src/index.js"],
  {
    cwd: fileURLToPath(
      new URL("packages/express-backend/", root)
    ),
    stdio: "inherit",
    windowsHide: true
  }
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  frontend.kill();
  backend.kill();
  process.exitCode = code;
}
for (const child of [frontend, backend]) {
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
