// Shared normalization keeps Hebrew vowel marks and punctuation out of matching.
export function normalize(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f\u0591-\u05c7]/g, '').toLowerCase();
}
export function tokenize(text) {
  return normalize(text).match(/[\p{L}\p{N}]+/gu) || [];
}

export function excerpt(text, terms, radius = 140) {
  // Keep an offset map because normalization can remove marks from the original.
  let folded = '';
  const offsets = [];
  for (let i = 0; i < text.length; i++) {
    const part = normalize(text[i]);
    for (const char of part) { folded += char; offsets.push(i); }
  }
  const words = [...folded.matchAll(/[\p{L}\p{N}]+/gu)];
  const wanted = [...new Set(terms)].map(tokenize).filter(parts => parts.length);
  const ranges = [];
  for (let i = 0; i < words.length; i++) {
    for (const phrase of wanted) {
      if (i + phrase.length > words.length) continue;
      const found = phrase.length === 1
        ? words[i][0].startsWith(phrase[0])
        : phrase.every((part, j) => words[i + j][0] === part);
      if (!found) continue;
      const last = words[i + phrase.length - 1];
      const start = offsets[words[i].index];
      let end = offsets[last.index + last[0].length - 1] + 1;
      while (end < text.length && /\p{M}/u.test(text[end])) end++;
      ranges.push([start, end]);
    }
  }
  // Overlapping aliases should render one highlight, without duplicating text.
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const matches = [];
  for (const range of ranges) {
    const previous = matches.at(-1);
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else matches.push(range);
  }
  // Choose the window with the most matches, preferring earlier passages on ties.
  let best = matches[0]?.[0] || 0, score = -1;
  for (const [position] of matches) {
    const count = matches.filter(([p]) => p >= position - radius && p <= position + radius).length;
    if (count > score) { best = position; score = count; }
  }
  let start = Math.max(0, best - radius), end = Math.min(text.length, Math.max(best + radius + 100, matches.find(([p]) => p === best)?.[1] || 0));
  while (start > 0 && start < best && !/\s/.test(text[start - 1])) start++;
  while (end < text.length && !/\s/.test(text[end])) end++;
  const pieces = [];
  let cursor = start;
  for (const [from, to] of matches) {
    if (from < start || to > end) continue;
    if (from > cursor) pieces.push({ text: text.slice(cursor, from), match: false });
    pieces.push({ text: text.slice(from, to), match: true });
    cursor = to;
  }
  if (cursor < end) pieces.push({ text: text.slice(cursor, end), match: false });
  return { before: start > 0, after: end < text.length, pieces };
}
