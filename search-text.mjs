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
  const matches = [];
  const wanted = [...new Set(terms.map(normalize).filter(Boolean))];
  const words = folded.matchAll(/[\p{L}\p{N}]+/gu);
  for (const word of words) {
    const term = wanted.find(t => word[0].startsWith(t));
    if (term) matches.push([offsets[word.index], offsets[word.index + word[0].length - 1] + 1]);
  }
  // Choose the window with the most matches, preferring earlier passages on ties.
  let best = matches[0]?.[0] || 0, score = -1;
  for (const [position] of matches) {
    const count = matches.filter(([p]) => p >= position - radius && p <= position + radius).length;
    if (count > score) { best = position; score = count; }
  }
  let start = Math.max(0, best - radius), end = Math.min(text.length, best + radius + 100);
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
