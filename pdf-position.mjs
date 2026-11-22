// Match PDF text items with context; coordinates are restored against rendered text.
export const normalize = (text) =>
  text
    .normalize("NFKC")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
export function scoreMatch(anchor, lines, index, page) {
  const text = normalize(lines[index]);
  const target = normalize(anchor.text);
  let score = text === target ? 12 : 0;
  if (!score) {
    const a = new Set(target.split(" ")),
      b = new Set(text.split(" "));
    const common = [...a].filter((w) => b.has(w)).length;
    const similarity = (2 * common) / (a.size + b.size || 1);
    if (similarity < 0.65) return -Infinity;
    score = similarity * 7;
  }
  for (let d = 1; d <= 3; d++) {
    if (
      anchor.before.at(-d) &&
      normalize(lines[index - d] || "") === normalize(anchor.before.at(-d))
    )
      score += 4 / d;
    if (
      anchor.after[d - 1] &&
      normalize(lines[index + d] || "") === normalize(anchor.after[d - 1])
    )
      score += 4 / d;
  }
  return score - Math.min(Math.abs(page - anchor.page) * 0.015, 2);
}
export async function locateAnchor(doc, anchor, cancelled = () => false) {
  let best = null,
    exact = null,
    neighbor = null;
  // Search all pages: pagination shifts may be arbitrarily large. Retain only the best result.
  for (let page = 1; page <= doc.numPages; page++) {
    if (cancelled()) throw new Error("Viewer disposed");
    const pdfPage = await doc.getPage(page);
    const content = await pdfPage.getTextContent({
      disableNormalization: true,
    });
    const items = content.items.filter((i) => "str" in i && normalize(i.str));
    const lines = items.map((i) => i.str);
    for (let index = 0; index < lines.length; index++) {
      const score = scoreMatch(anchor, lines, index, page);
      const result = { page, index, text: lines[index], score };
      if (
        normalize(lines[index]) === normalize(anchor.text) &&
        score > (exact?.score ?? -Infinity)
      )
        exact = result;
      if (score > (best?.score ?? 8)) best = result;
      for (const n of anchor.neighbors || []) {
        if (normalize(lines[index]) !== normalize(n.text)) continue;
        const neighborScore =
          scoreMatch({ ...anchor, text: n.text }, lines, index, page) -
          Math.abs(n.dy) * 0.001;
        if (neighborScore > (neighbor?.score ?? -Infinity))
          neighbor = { ...result, score: neighborScore, dx: n.dx, dy: n.dy };
      }
    }
    // Do not retain text or font caches for hundreds of pages.
    pdfPage.cleanup();
  }
  return exact || neighbor || best;
}
