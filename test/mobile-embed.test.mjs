import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const preview = fs.readFileSync(path.join(root, 'site/preview.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'site/assets/flipbook.css'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');

test('mobile cover mode applies only to compact touchscreen phone previews', () => {
  assert.match(preview, /compact && window\.matchMedia\('\(max-width: 600px\) and \(pointer: coarse\)'\)\.matches/);
  assert.match(preview, /if \(mobileCover\)/);
  assert.match(preview, /className = 'fb-mobile-cover-link'/);
  assert.match(preview, /anchor\.href = viewerUrl\(issue\)/);
  assert.match(preview, /anchor\.target = '_blank'/);
  assert.match(preview, /anchor\.rel = 'noopener noreferrer'/);
  assert.match(preview, /else \{\s*await createFlipbook\(host/);
});

test('mobile cover is height-bounded and does not fill the column', () => {
  assert.match(css, /\.fb-mobile-cover-link\s*\{[^}]*width:\s*min\(100%,\s*190px\)/);
  assert.match(css, /\.fb-mobile-cover-link img\s*\{[^}]*max-height:\s*230px/);
  assert.match(css, /\.fb-mobile-cover-link img\s*\{[^}]*object-fit:\s*contain/);
});

test('archive covers use two narrow columns on phones with bounded issue titles', () => {
  assert.match(css, /@media \(max-width: 600px\)\s*\{[^]*?\.archive \.grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.archive \.card-cover\s*\{[^}]*max-width:\s*180px/);
  assert.match(css, /\.archive \.card-title\s*\{[^}]*-webkit-line-clamp:\s*2/);
});

test('home embed still starts at 360px and full archive remains available', () => {
  assert.match(generator, /iframe\('preview\.html', pq, 360, 'Latest issue'\)/);
  assert.match(generator, /iframe\('library\.html', q, 1400, 'Issues'\)/);
});

test('Duda height reporting tracks content and permits shrinking after mobile reflow', async () => {
  let bottom = 520;
  const messages = [];
  let observer;
  const main = { getBoundingClientRect: () => ({ bottom }) };
  globalThis.location = { search: '' };
  globalThis.document = {
    body: main,
    documentElement: { classList: { add() {} } },
    querySelector: (selector) => {
      if (selector === 'main') return main;
      if (selector === '.fb-ready, .fb-mobile-cover-link, .fb-error') return main;
      return null;
    },
  };
  globalThis.window = {
    parent: { postMessage: (message) => messages.push(message) },
    addEventListener() {},
  };
  globalThis.ResizeObserver = class {
    constructor(callback) { observer = callback; }
    observe(node) { assert.equal(node, main); }
  };
  const { reportHeight } = await import('../site/assets/common.js');
  reportHeight();
  assert.equal(messages.at(-1).height, 520);
  bottom = 285;
  observer();
  assert.equal(messages.at(-1).height, 285,
    'the parent must receive a smaller height after a mobile reflow');
  assert.equal(messages.at(-1).source, 'flipbook');
});
