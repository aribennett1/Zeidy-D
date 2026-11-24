import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { XMLParser } from 'fast-xml-parser';
import MiniSearch from 'minisearch';
import { tokenize } from './search-text.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const routes = JSON.parse(await fs.readFile(path.join(root, 'routes.json'), 'utf8'));
const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true, trimValues: false, parseTagValue: false });
function content(nodes) {
  let text = '';
  for (const node of nodes || []) {
    for (const [tag, value] of Object.entries(node)) {
      if (tag === 'w:t') text += value.map(n => n['#text'] ?? '').join('');
      else if (tag === 'w:tab' || tag === 'w:br') text += ' ';
      else if (Array.isArray(value)) text += content(value) + (tag === 'w:p' ? '\n\n' : '');
    }
  }
  return text;
}
const documents = [], missing = [];
for (const [route, entry] of Object.entries(routes.byRoute)) {
  const directory = path.join(root, 'Files', entry.contentPath);
  let text = '';
  const source = path.join(directory, `${entry.baseFilename}.docx`);
  try {
    await fs.access(source);
    const parts = execFileSync('unzip', ['-Z1', source], { encoding: 'utf8' }).split('\n');
    const xmlParts = ['word/document.xml', ...parts.filter(p => /^word\/(footnotes|endnotes)\.xml$/.test(p))];
    text = xmlParts.map(part => content(parser.parse(execFileSync('unzip', ['-p', source, part], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })))).join('\n\n').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    missing.push(route);
  }
  const breadcrumb = entry.contentPath.split('/').map(p => p.replace(/^\d+\s*-\s*/, '')).join(' / ');
  documents.push({ id: route, title: entry.title || entry.baseFilename, breadcrumb, text });
}
const index = new MiniSearch({ fields: ['title', 'breadcrumb', 'text'], storeFields: ['title', 'breadcrumb'], tokenize });
index.addAll(documents);
await fs.writeFile(path.join(root, 'search-index.json'), JSON.stringify({ index: index.toJSON(), texts: Object.fromEntries(documents.map(d => [d.id, d.text])), missing }));
await fs.mkdir(path.join(root, 'vendor/minisearch'), { recursive: true });
await fs.copyFile(path.join(root, 'node_modules/minisearch/dist/es/index.js'), path.join(root, 'vendor/minisearch/index.js'));
await fs.copyFile(path.join(root, 'node_modules/minisearch/LICENSE.txt'), path.join(root, 'vendor/minisearch/LICENSE.txt'));
console.log(`Indexed ${documents.length} sheets; ${missing.length} have title-only search (no matching Word document).`);
if (missing.length) console.log(missing.join('\n'));
