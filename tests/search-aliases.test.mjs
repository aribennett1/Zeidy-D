import { test } from 'node:test';
import assert from 'node:assert/strict';
import MiniSearch from 'minisearch';
import { compileAliases, createAliasSearch } from '../search-aliases.mjs';
import { tokenize, excerpt } from '../search-text.mjs';

const entry = (hebrew, transliterations, translations = [], extra = {}) => ({ hebrew, hebrewVariants: [], transliterations, translations, searchPhrases: [], ...extra });
function setup(entries, documents) {
  const engine = new MiniSearch({ fields: ['title', 'breadcrumb', 'text'], storeFields: ['title', 'breadcrumb'], tokenize });
  const docs = documents.map(([id, text]) => ({ id, title: 'Sheet', breadcrumb: '', text }));
  engine.addAll(docs);
  return createAliasSearch(engine, Object.fromEntries(documents), compileAliases({ schemaVersion: 1, entries }));
}

test('retains English and both ambiguous Hebrew meanings, sorted in table-of-contents order', () => {
  const search = setup([
    entry('תשובה', ['teshuva'], ['answer'], { needsReview: true }),
    entry('תירוץ', ['answer']),
  ], [['translation', 'תשובה '.repeat(50)], ['transliteration', 'תירוץ'], ['literal', 'answer']]);
  const result = search('answer');
  assert.deepEqual(result.hits.map(h => h.id), ['translation', 'transliteration', 'literal']);
  assert.deepEqual(new Set(result.expanded), new Set(['תשובה', 'תירוץ']));
  assert.equal(search('teshuva').hits[0].id, 'translation');
});
test('uses longest English alias, requires contiguous Hebrew phrases, preserves extra query terms', () => {
  const search = setup([
    entry('בחירה חפשית', [], ['free will']),
    entry('חינם', [], ['free']),
  ], [['phrase', 'בחירה חפשית and kindness'], ['scattered', 'בחירה and חפשית and kindness'], ['partial', 'חינם kindness'], ['other', 'בחירה חפשית']]);
  assert.deepEqual(search('free will kindness').hits.map(h => h.id), ['phrase']);
  assert.deepEqual(search('free will').expanded, ['בחירה חפשית']);
});
test('one card per sheet, even when multiple aliases and meanings match', () => {
  const search = setup([entry('טבע', ['teva']), entry('תיבה', ['teva'], [], { hebrewVariants: ['תבה'] })], [['both', 'טבע תיבה תבה']]);
  const { hits } = search('teva');
  assert.equal(hits.length, 1);
  assert.deepEqual(new Set(hits[0].highlights), new Set(['טבע', 'תיבה', 'תבה']));
});
test('highlights Hebrew phrases with vowel marks, without repeating overlapping text', () => {
  const text = 'Before. בְּחִירָה חָפְשִׁית. After.';
  const snippet = excerpt(text, ['בחירה חפשית', 'בחירה']);
  assert.equal(snippet.pieces.map(p => p.text).join(''), text);
  assert.deepEqual(snippet.pieces.filter(p => p.match).map(p => p.text), ['בְּחִירָה חָפְשִׁית']);
});
test('literal search without aliases retains prefix and typo matching', () => {
  const search = setup([], [['one', 'kindness'], ['two', 'unrelated']]);
  assert.equal(search('kindn').hits[0].id, 'one');
  assert.equal(search('kindnes').hits[0].id, 'one');
});

test('fuzzy English aliases find Hebrew and explain the spelling', () => {
  const search = setup([entry('תיבה', ['teivah'])], [['hebrew', 'תיבה'], ['english', 'taivah']]);
  const result = search('taivah');
  assert.deepEqual(result.hits.map(h => h.id), ['hebrew', 'english']);
  assert.equal(result.spellingMatches[0].spelling, 'teivah');
  assert.deepEqual(result.hits[0].highlights, ['תיבה']);
  assert.equal(search('teivha').hits[0].id, 'hebrew');
});
test('short words do not expand fuzzily and exact aliases take precedence', () => {
  const search = setup([entry('תיבה', ['teivah']), entry('תאוה', ['taivah']), entry('אור', ['light'])], [['one', 'תיבה'], ['two', 'תאוה'], ['three', 'אור']]);
  assert.deepEqual(search('taivah').expanded, ['תאוה']);
  assert.deepEqual(search('lite').expanded, []);
  assert.deepEqual(search('xyzzy').expanded, []);
});
test('fuzzy phrases preserve their other words and remaining query terms', () => {
  const search = setup([entry('בעל שם טוב', ['baal shem tov'])], [['one', 'בעל שם טוב kindness'], ['two', 'בעל שם טוב']]);
  const result = search('baal shemm tov kindness');
  assert.deepEqual(result.hits.map(h => h.id), ['one']);
  assert.equal(result.spellingMatches[0].spelling, 'baal shem tov');
});
