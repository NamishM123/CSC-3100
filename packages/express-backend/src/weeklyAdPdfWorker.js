import { parentPort, workerData } from "node:worker_threads";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function readPdf() {
  const task = getDocument({
    data: workerData.bytes,
    isEvalSupported: false,
    useSystemFonts: true,
    stopAtErrors: true,
    verbosity: 0,
    maxImageSize: 16000000
  });
  let ocrWorker;
  try {
    const pdf = await task.promise;
    const pages = [];
    const maxPages = workerData.ocr ? 4 : 6;
    for (
      let index = 1;
      index <= Math.min(pdf.numPages, maxPages);
      index++
    ) {
      const page = await pdf.getPage(index);
      const { items } = await page.getTextContent();
      const extracted = items
        .filter((item) => item.str?.trim())
        .map((item) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          w: item.width,
          h: item.height
        }));
      const result = {
        page: index,
        width: page.view[2] - page.view[0],
        height: page.view[3] - page.view[1],
        items: extracted,
        text: extracted
          .map((item) => item.text)
          .join("\n")
          .slice(0, 30000),
        extraction: extracted.length ? "pdf_text" : "image_only"
      };
      if (!extracted.length && workerData.ocr) {
        const { createCanvas } =
          await import("@napi-rs/canvas");
        const { createWorker } = await import("tesseract.js");
        if (!ocrWorker)
          ocrWorker = await createWorker("eng", 1, {
            cacheMethod: "none",
            gzip: true
          });
        const viewport = page.getViewport({
          scale: Math.min(
            2.5,
            Math.sqrt(4000000 / (result.width * result.height))
          )
        });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height)
        );
        await page.render({
          canvasContext: canvas.getContext("2d"),
          viewport
        }).promise;
        const { data } = await ocrWorker.recognize(
          canvas.toBuffer("image/png")
        );
        // OCR is review evidence only. Never feed guessed digits into offers.
        result.review_text = data.text.slice(0, 30000);
        result.ocr_confidence = data.confidence;
        result.extraction = "ocr_review";
      }
      pages.push(result);
      page.cleanup();
    }
    return {
      pages,
      page_count: pdf.numPages,
      truncated: pdf.numPages > maxPages
    };
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
    await task.destroy();
  }
}

if (parentPort) {
  readPdf().then(
    (result) => parentPort.postMessage({ result }),
    () =>
      parentPort.postMessage({
        error:
          "The flyer could not be read. Use the original flyer."
      })
  );
}
