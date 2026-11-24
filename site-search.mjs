import MiniSearch from './vendor/minisearch/index.js';
import { tokenize, excerpt } from './search-text.mjs?v=2';
import { createAliasSearch } from './search-aliases.mjs?v=2';

const nav = document.getElementById('nav');
const panel = nav.querySelector('.site-search');
const input = panel.querySelector('input');
const status = panel.querySelector('.search-status');
const results = panel.querySelector('.search-results');
const body = panel.querySelector('.search-body');
const close = panel.querySelector('.search-close');
function expanded() { return nav.classList.contains('search-expanded'); }
function collapse() {
  nav.classList.remove('search-expanded');
  body.hidden = true;
  close.hidden = true;
  document.getElementById('nav-tree').inert = false;
  input.blur();
}
function expand() {
  nav.classList.add('search-expanded');
  body.hidden = false;
  close.hidden = false;
  document.getElementById('nav-tree').inert = true;
  search();
}
const expansion = document.createElement('details');
expansion.className = 'search-expansion';
expansion.hidden = true;
body.insertBefore(expansion, results);
let pending, engine, texts, timer, findSheets;
function load() {
  if (!pending) pending = fetch('/search-index.json').then(response => {
    if (!response.ok) throw new Error('Search index unavailable');
    return response.json();
  }).then(data => {
    engine = MiniSearch.loadJSON(JSON.stringify(data.index), { fields: ['title', 'breadcrumb', 'text'], storeFields: ['title', 'breadcrumb'], tokenize });
    texts = data.texts;
    findSheets = createAliasSearch(engine, texts, data.aliases || [], data.tocOrder);
  }).catch(error => { pending = null; throw error; });
  return pending;
}
async function search() {
  const query = input.value.trim();
  results.replaceChildren();
  body.querySelector('.search-spelling')?.remove();
  expansion.hidden = true;
  expansion.replaceChildren();
  if (!query) { status.textContent = 'Search all sheets, including their full text.'; return; }
  status.textContent = 'Searching…';
  try {
    await load();
    if (query !== input.value.trim() || !expanded()) return;
    const { hits, expanded: equivalents, spellingMatches } = findSheets(query);
    if (equivalents.length) {
      const summary = document.createElement('summary');
      summary.textContent = `Also searched: ${equivalents.slice(0, 4).join(' · ')}${equivalents.length > 4 ? ` (+${equivalents.length - 4} more)` : ''}`;
      const list = document.createElement('p');
      list.dir = 'auto';
      list.textContent = equivalents.join(' · ');
      expansion.append(summary, list);
      if (spellingMatches.length) {
        const spellings = document.createElement('p');
        spellings.className = 'search-spelling';
        spellings.textContent = `Matched spelling: ${spellingMatches.map(match => `${match.spelling} → ${match.hebrew.join(', ')}`).join(' · ')}`;
        expansion.before(spellings);
      }
      expansion.hidden = false;
    }
    status.textContent = hits.length ? `${hits.length} matching ${hits.length === 1 ? 'sheet' : 'sheets'}` : 'No sheets found. Try fewer words or another spelling.';
    for (const hit of hits) {
      const item = document.createElement('a');
      item.className = 'search-result';
      const link = item;
      link.href = hit.id;
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.pushState({}, '', hit.id);
        window.dispatchEvent(new PopStateEvent('popstate'));
        collapse();
        if (window.innerWidth <= 1024) {
          nav.classList.remove('open');
          document.getElementById('nav-overlay').classList.remove('active');
          document.getElementById('nav-toggle').classList.remove('active');
          document.body.style.overflow = '';
        }
      });
      const heading = document.createElement('h3');
      heading.textContent = hit.title;
      heading.id = `search-result-${results.childElementCount}`;
      link.setAttribute('aria-labelledby', heading.id);
      const crumb = document.createElement('p');
      crumb.className = 'search-breadcrumb';
      crumb.textContent = hit.breadcrumb;
      item.append(heading, crumb);
      if (texts[hit.id]) {
        const snippet = excerpt(texts[hit.id], hit.highlights);
        const paragraph = document.createElement('p');
        paragraph.className = 'search-excerpt';
        paragraph.dir = 'auto';
        if (snippet.before) paragraph.append('…');
        for (const piece of snippet.pieces) {
          if (piece.match) { const mark = document.createElement('mark'); mark.textContent = piece.text; paragraph.append(mark); }
          else paragraph.append(piece.text);
        }
        if (snippet.after) paragraph.append('…');
        item.append(paragraph);
      }
      results.append(item);
    }
  } catch {
    if (query !== input.value.trim()) return;
    status.textContent = 'Search could not load. Please try again.';
    const retry = document.createElement('button');
    retry.textContent = 'Retry search';
    retry.onclick = search;
    results.append(retry);
  }
}
input.addEventListener('focus', expand);
input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 150); });
close.addEventListener('click', collapse);
nav.addEventListener('keydown', event => {
  if (event.key === 'Escape' && expanded()) {
    event.preventDefault(); event.stopPropagation(); collapse();
  }
});
document.addEventListener('pointerdown', event => {
  if (expanded() && !nav.contains(event.target)) collapse();
});
