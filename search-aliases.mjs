import { tokenize } from './search-text.mjs?v=2';

const key = text => tokenize(text).join(' ');

// Bounded adjacent-transposition distance for misspelled English aliases.
function distance(a, b, limit) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows = [Array.from({ length: b.length + 1 }, (_, i) => i)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], rows[i - 2][j - 2] + 1);
    }
    rows.push(row);
  }
  return rows[a.length][b.length];
}
function phraseDistance(words, candidate) {
  let total = 0, changed = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i] === candidate[i]) continue;
    if (!/^[a-z]{5,64}$/.test(words[i]) || !/^[a-z]+$/.test(candidate[i])) return 3;
    const limit = words[i].length >= 8 ? 2 : 1;
    const difference = distance(words[i], candidate[i], limit);
    if (difference > limit || ++changed > 1) return 3;
    total += difference;
  }
  return total;
}

// Review flags describe ambiguity; all supplied meanings remain searchable.
export function compileAliases(source) {
  if (source.schemaVersion !== 1 || !Array.isArray(source.entries)) throw new Error('Invalid search alias dictionary');
  const aliases = new Map();
  for (const entry of source.entries) {
    if (typeof entry.hebrew !== 'string') throw new Error('Missing Hebrew search term');
    const hebrew = [...new Set([entry.hebrew, ...entry.hebrewVariants])];
    for (const [field, tier] of [['transliterations', 1], ['translations', 2], ['searchPhrases', 2]]) {
      if (!Array.isArray(entry[field]) || entry[field].some(s => typeof s !== 'string')) throw new Error(`Invalid ${field} for ${entry.hebrew}`);
      for (const alias of entry[field]) {
        const normalized = key(alias);
        if (!normalized) continue;
        if (!aliases.has(normalized)) aliases.set(normalized, new Map());
        for (const term of hebrew) {
          const previous = aliases.get(normalized).get(term);
          aliases.get(normalized).set(term, Math.min(previous ?? tier, tier));
        }
      }
    }
  }
  return [...aliases].map(([alias, terms]) => [alias, [...terms]]);
}

export function createAliasSearch(engine, texts, compiled, tocOrder = Object.keys(texts)) {
  const aliases = new Map(compiled);
  const maxWords = Math.max(1, ...[...aliases.keys()].map(s => s.split(' ').length));
  const order = new Map(tocOrder.map((id, i) => [id, i]));
  const byLength = new Map();
  for (const [alias, terms] of aliases) {
    const words = alias.split(' ');
    if (!byLength.has(words.length)) byLength.set(words.length, []);
    byLength.get(words.length).push({ alias, words, terms });
  }
  const searchable = new Map();
  function contains(hit, phrase) {
    if (!searchable.has(hit.id)) searchable.set(hit.id,
      [hit.title, hit.breadcrumb, texts[hit.id] || ''].map(s => ` ${key(s)} `));
    return searchable.get(hit.id).some(field => field.includes(` ${key(phrase)} `));
  }
  return query => {
    const words = tokenize(query), groups = [], expanded = new Set(), spellingMatches = [];
    for (let i = 0; i < words.length;) {
      let size = Math.min(maxWords, words.length - i);
      while (size > 1 && !aliases.has(words.slice(i, i + size).join(' '))) size--;
      let original = words.slice(i, i + size).join(' ');
      let equivalents = aliases.get(original) || [];
      if (!equivalents.length) {
        for (let count = Math.min(maxWords, words.length - i); count >= 1; count--) {
          const portion = words.slice(i, i + count);
          const nearby = (byLength.get(count) || []).map(candidate => ({ ...candidate, distance: phraseDistance(portion, candidate.words) })).filter(c => c.distance > 0 && c.distance <= 2);
          if (!nearby.length) continue;
          const best = Math.min(...nearby.map(c => c.distance));
          const selected = nearby.filter(c => c.distance === best).slice(0, 3);
          equivalents = selected.flatMap(c => c.terms.map(([term]) => [term, 3]));
          spellingMatches.push(...selected.map(c => ({ spelling: c.alias, hebrew: c.terms.map(([term]) => term) })));
          size = count;
          original = portion.join(' ');
          break;
        }
      }
      groups.push({ original, equivalents });
      for (const [hebrew] of equivalents) expanded.add(hebrew);
      i += size;
    }
    let combined;
    for (const group of groups) {
      const candidates = new Map();
      const alternatives = [[group.original, 0], ...group.equivalents];
      for (const [term, tier] of alternatives) {
        const hits = engine.search(term, {
          prefix: tier === 0,
          fuzzy: tier === 0 ? word => word.length >= 5 ? 0.15 : false : false,
          combineWith: 'AND', boost: { title: 4, breadcrumb: 2 },
        });
        for (const hit of hits) {
          // Hebrew phrases must occur together, not as disconnected words.
          if (tier > 0 && !contains(hit, term)) continue;
          const previous = candidates.get(hit.id);
          const highlight = tier === 0 ? Object.keys(hit.match || {}) : [term];
          if (!previous || tier < previous.tier) candidates.set(hit.id, { ...hit, tier, highlights: highlight });
          else if (tier === previous.tier) {
            previous.score = Math.max(previous.score, hit.score);
            previous.highlights.push(...highlight);
          }
        }
      }
      if (!combined) combined = candidates;
      else for (const [id, hit] of combined) {
        const next = candidates.get(id);
        if (!next) combined.delete(id);
        else {
          hit.tier = Math.max(hit.tier, next.tier);
          hit.score += next.score;
          hit.highlights.push(...next.highlights);
        }
      }
      if (!combined.size) break;
    }
    return {
      hits: [...(combined?.values() || [])].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) || a.id.localeCompare(b.id)),
      expanded: [...expanded],
      spellingMatches,
    };
  };
}
