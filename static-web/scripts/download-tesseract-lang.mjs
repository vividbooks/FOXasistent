/**
 * Stáhne ces + eng traineddata (gzip) do public/tesseract-lang — stejný původ jako Tesseract CDN,
 * ale soubory servírujeme z GitHub Pages (blokovače často blokují jsdelivr z jiné domény než stránka).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.join(__dirname, "../public/tesseract-lang");

const files = [
  ["ces.traineddata.gz", "https://cdn.jsdelivr.net/npm/@tesseract.js-data/ces/4.0.0/ces.traineddata.gz"],
  ["eng.traineddata.gz", "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz"],
];

await fs.promises.mkdir(destDir, { recursive: true });

for (const [name, url] of files) {
  const out = path.join(destDir, name);
  let skip = false;
  try {
    const st = await fs.promises.stat(out);
    if (st.size > 500_000) skip = true;
  } catch {
    /* missing */
  }
  if (skip) continue;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Stažení ${name} selhalo: ${res.status}`);
  await fs.promises.writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log("OK", name);
}
