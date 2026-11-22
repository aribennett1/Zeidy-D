const {
  PDFDocument,
  StandardFonts,
  PDFName,
  PDFArray,
  PDFNumber,
} = require("pdf-lib");
const fs = require("node:fs");
async function generate(name, offset = 0, edit = false, deleted = false) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = Array.from(
    { length: 360 },
    (_, i) =>
      `Line ${String(i).padStart(4, "0")} reading the sefer with unique context ${i * 17}.`,
  );
  if (edit) lines[150] = lines[150].replace("reading", "studying");
  if (deleted) lines.splice(150, 1);
  if (offset > 0)
    lines.unshift(
      ...Array.from({ length: offset }, (_, i) => `Inserted introduction ${i}`),
    );
  if (offset < 0) lines.splice(0, -offset);
  for (let i = 0; i < lines.length; i += 30) {
    const page = doc.addPage([500, 700]);
    lines
      .slice(i, i + 30)
      .forEach((text, j) =>
        page.drawText(text, { x: 40, y: 640 - j * 20, size: 12, font }),
      );
  }
  const first = doc.getPages()[0],
    dest = doc.getPages()[5];
  first.drawText("Go to index destination", { x: 40, y: 680, size: 12, font });
  const link = doc.context.register(
    doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [40, 676, 220, 696],
      Border: [0, 0, 0],
      Dest: [dest.ref, PDFName.of("XYZ"), 0, 660, 0],
    }),
  );
  // A link low on the page exposes canvas/overlay scaling mismatches that
  // are barely visible near the top border.
  const lowerLink = doc.context.register(doc.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [40, 240, 450, 248],
    Border: [0, 0, 0], Dest: [dest.ref, PDFName.of("XYZ"), 0, 660, 0],
  }));
  first.node.set(PDFName.of("Annots"), doc.context.obj([link, lowerLink]));
  fs.mkdirSync("tests/fixtures", { recursive: true });
  fs.writeFileSync(`tests/fixtures/${name}.pdf`, await doc.save());
}
(async () => {
  await generate("original");
  await generate("same");
  await generate("insert", 5);
  await generate("remove", -5);
  await generate("edit", 0, true);
  await generate("pagination", 45);
  await generate("deleted", 0, false, true);
})();
