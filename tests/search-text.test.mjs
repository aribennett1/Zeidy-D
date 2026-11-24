import { test } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt, tokenize } from '../search-text.mjs';
test('normalizes Hebrew vowels and accents', () => {
  assert.deepEqual(tokenize('שָׁלוֹם café'), ['שלום', 'cafe']);
});
test('excerpt preserves source text and highlights Hebrew with vowels', () => {
  const source = 'Before the passage. שָׁלוֹם to everyone. After the passage.';
  const result = excerpt(source, ['שלום']);
  assert.equal(result.pieces.map(p => p.text).join(''), source);
  assert.equal(result.pieces.find(p => p.match).text, 'שָׁלוֹם');
});
test('selects context around the densest passage rather than the opening text', () => {
  const source = 'opening '.repeat(100) + 'Before. kindness helps kindness grow. Afterwards.';
  const result = excerpt(source, ['kindness'], 35);
  assert.equal(result.before, true);
  assert.equal(result.pieces.filter(p => p.match).length, 2);
  assert.match(result.pieces.map(p => p.text).join(''), /Before.*Afterwards/);
});
