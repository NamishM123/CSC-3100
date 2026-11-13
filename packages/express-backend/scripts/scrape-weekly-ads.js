import { mkdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { weeklyAdSources } from "../../react-frontend/src/lib/weeklyAdSources.js";
import { createWeeklyAdClient } from "../src/weeklyAds.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Usage: npm run scrape:weekly-ads -w express-backend -- [--provider=all|california-fresh|spencers|slo-food-coop] [--ocr] [--output=directory]"
  );
  console.log(
    "Writes JSON snapshots under .local/weekly-ads by default. --ocr enables free local OCR for image-only PDFs; text requires review and never becomes confirmed prices."
  );
} else {
  try {
    if (
      args.some(
        (arg) =>
          arg !== "--ocr" &&
          !/^--(?:provider|output)=.+$/.test(arg)
      )
    )
      throw new Error(
        "Unknown argument. Use --help for options."
      );
    const provider =
      args
        .find((arg) => arg.startsWith("--provider="))
        ?.slice(11) || "all";
    const sources = weeklyAdSources.filter(
      (source) => provider === "all" || provider === source.id
    );
    if (!sources.length)
      throw new Error(
        "Unknown provider. Use --help for supported providers."
      );
    const directory = resolve(
      args
        .find((arg) => arg.startsWith("--output="))
        ?.slice(9) ||
        fileURLToPath(
          new URL("../.local/weekly-ads/", import.meta.url)
        )
    );
    await mkdir(directory, { recursive: true });
    const client = createWeeklyAdClient({
      ocr: args.includes("--ocr")
    });
    let failures = 0;
    for (const source of sources) {
      console.log(
        `Collecting ${source.name}${args.includes("--ocr") ? " (OCR enabled)" : ""}...`
      );
      try {
        const result = await client.collect(source.id);
        const target = join(directory, `${source.id}.json`);
        const temporary = `${target}.${process.pid}.tmp`;
        await writeFile(
          temporary,
          `${JSON.stringify(result, null, 2)}\n`
        );
        await rename(temporary, target);
        console.log(
          `${source.name}: ${result.offers.length} current advertised offers, ${result.documents.length} flyers; saved ${target}`
        );
        for (const warning of result.warnings)
          console.log(`  ${warning}`);
        if (result.incomplete) failures++;
      } catch (error) {
        failures++;
        console.error(`${source.name}: ${error.message}`);
      }
    }
    if (failures) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
