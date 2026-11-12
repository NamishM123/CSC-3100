import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

test("both Vercel entry points start without module auto-detection and return JSON", () => {
  const entryPoints = [
    new URL("../../../api/kroger.js", import.meta.url).href,
    new URL(
      "../../react-frontend/api/kroger.js",
      import.meta.url
    ).href
  ];
  const output = execFileSync(
    process.execPath,
    [
      "--no-experimental-detect-module",
      "--no-experimental-require-module",
      "--input-type=module",
      "--eval",
      `
        for (const entryPoint of ${JSON.stringify(entryPoints)}) {
          const { default: handler } = await import(entryPoint);
          const response = {
            setHeader() {},
            status(code) { this.statusCode = code; return this; },
            json(body) {
              console.log(JSON.stringify({ status: this.statusCode, body }));
            }
          };
          await handler({ headers: {} }, response);
        }
      `
    ],
    { encoding: "utf8", timeout: 10000, stdio: "pipe" }
  );
  const responses = output
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    responses,
    entryPoints.map(() => ({
      status: 401,
      body: { error: "Sign in to continue." }
    }))
  );
});
