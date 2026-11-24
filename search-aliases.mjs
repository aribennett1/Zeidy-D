import { tokenize } from './search-text.mjs?v=2';

const key = text => tokenize(text).join(' ');

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

export function createAliasSearch(engine, texts, compiled) {
  const aliases = new Map(compiled);
  const maxWords = Math.max(1, ...[...aliases.keys()].map(s => s.split(' ').length));
  const searchable = new Map();
  function contains(hit, phrase) {
    if (!searchable.has(hit.id)) searchable.set(hit.id,
      [hit.title, hit.breadcrumb, texts[hit.id] || ''].map(s => ` ${key(s)} `));
    return searchable.get(hit.id).some(field => field.includes(` ${key(phrase)} `));
  }
  return query => {
    const words = tokenize(query), groups = [], expanded = new Set();
    for (let i = 0; i < words.length;) {
      let size = Math.min(maxWords, words.length - i);
      while (size > 1 && !aliases.has(words.slice(i, i + size).join(' '))) size--;
      const original = words.slice(i, i + size).join(' ');
      const equivalents = aliases.get(original) || [];
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
      hits: [...(combined?.values() || [])].sort((a, b) => a.tier - b.tier || b.score - a.score || a.id.localeCompare(b.id)),
      expanded: [...expanded],
    };
  };
}
