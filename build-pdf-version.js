// Run during Pages deployment. Content-addressed URLs cannot serve an older PDF.
const { createHash } = require("node:crypto");
const {
  readFileSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");
const source = "Files/09 - Misc/Final Sefer/Final Sefer.pdf";
const version = createHash("sha256").update(readFileSync(source)).digest("hex");
mkdirSync("pdf-versions", { recursive: true });
const filename = `${version}.pdf`;
copyFileSync(source, path.join("pdf-versions", filename));
writeFileSync(
  "pdf-version.json",
  JSON.stringify({ version, url: `/pdf-versions/${filename}` }) + "\n",
);
