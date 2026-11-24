import MiniSearch from './vendor/minisearch/index.js';
import { tokenize, excerpt } from './search-text.mjs';

const dialog = document.createElement('dialog');
dialog.className = 'site-search';
dialog.setAttribute('aria-labelledby', 'search-heading');
dialog.innerHTML = `<div class="search-top"><h2 id="search-heading">Search the sheets</h2><button type="button" class="search-close" aria-label="Close search">✕</button></div><label class="search-label" for="sheet-query">Search by topic, name, parsha, or year</label><input id="sheet-query" type="search" placeholder="What are you looking for?" autocomplete="off"><p class="search-status" role="status" aria-live="polite"></p><div class="search-results"></div>`;
document.body.append(dialog);
const input = dialog.querySelector('input');
const status = dialog.querySelector('.search-status');
const results = dialog.querySelector('.search-results');
const trigger = document.getElementById('site-search-open');
let pending, engine, texts, timer;
function load() {
  if (!pending) pending = fetch('/search-index.json').then(response => {
    if (!response.ok) throw new Error('Search index unavailable');
    return response.json();
  }).then(data => {
    engine = MiniSearch.loadJSON(JSON.stringify(data.index), { fields: ['title', 'breadcrumb', 'text'], storeFields: ['title', 'breadcrumb'], tokenize });
    texts = data.texts;
  }).catch(error => { pending = null; throw error; });
  return pending;
}
async function search() {
  const query = input.value.trim();
  results.replaceChildren();
  if (!query) { status.textContent = 'Search all sheets, including their full text.'; return; }
  status.textContent = 'Searching…';
  try {
    await load();
    if (query !== input.value.trim() || !dialog.open) return;
    const hits = engine.search(query, { prefix: true, fuzzy: term => term.length >= 5 ? 0.15 : false, combineWith: 'AND', boost: { title: 4, breadcrumb: 2 } });
    status.textContent = hits.length ? `${hits.length} matching ${hits.length === 1 ? 'sheet' : 'sheets'}${hits.length > 50 ? ' · Showing the first 50' : ''}` : 'No sheets found. Try fewer words or another spelling.';
    for (const hit of hits.slice(0, 50)) {
      const item = document.createElement('article');
      item.className = 'search-result';
      const link = document.createElement('a');
      link.href = hit.id;
      link.textContent = hit.title;
      link.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.pushState({}, '', hit.id);
        window.dispatchEvent(new PopStateEvent('popstate'));
        dialog.close();
      });
      const heading = document.createElement('h3');
      heading.append(link);
      const crumb = document.createElement('p');
      crumb.className = 'search-breadcrumb';
      crumb.textContent = hit.breadcrumb;
      item.append(heading, crumb);
      if (texts[hit.id]) {
        const snippet = excerpt(texts[hit.id], [...tokenize(query), ...Object.keys(hit.match || {})]);
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
trigger.addEventListener('click', () => {
  dialog.showModal(); input.focus();
  if (!input.value.trim()) search();
  load().then(() => { if (dialog.open) search(); }).catch(() => { if (dialog.open) status.textContent = 'Search could not load. Type a query to retry.'; });
});
input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 150); });
dialog.querySelector('.search-close').onclick = () => dialog.close();
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => trigger.focus());
