// PDF work stays in a worker so a malformed or expensive PDF cannot block the
// request indefinitely. OCR is only enabled by the local CLI, never by the API.
import {
  Worker,
  isMainThread,
  workerData
} from "node:worker_threads";

// A literal import lets deployment tracing discover PDF.js and its native
// dependencies without loading them in ordinary community-data requests.
if (!isMainThread && workerData?.weeklyAdPdf)
  await import("./weeklyAdPdfWorker.js");

export function extractPdf(
  bytes,
  { ocr = false, timeoutMs = ocr ? 180000 : 12000 } = {}
) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./weeklyAdPdf.js", import.meta.url),
      {
        workerData: {
          weeklyAdPdf: true,
          bytes: new Uint8Array(bytes),
          ocr
        },
        resourceLimits: { maxOldGenerationSizeMb: 256 },
        execArgv: []
      }
    );
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Flyer extraction timed out; use the original flyer."
          )
        ),
      timeoutMs
    );
    worker.once("message", (message) =>
      finish(
        message.error ? new Error(message.error) : null,
        message.result
      )
    );
    worker.once("error", (error) => finish(error));
    worker.once("exit", (code) => {
      if (!settled)
        finish(
          new Error(`Flyer extraction stopped (${code}).`)
        );
    });
  });
}
