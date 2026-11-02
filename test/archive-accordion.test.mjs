import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { archiveYear, expandArchiveYear } from '../site/assets/archive-years.mjs';

const root = path.resolve(import.meta.dirname, '..');
const page = fs.readFileSync(path.join(root, 'site/library.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'site/assets/flipbook.css'), 'utf8');

test('issue folder determines year and date/Other fallback remain stable', () => {
  assert.equal(archiveYear({ group:'2026', added:'2025-02-03' }), '2026');
  assert.equal(archiveYear({ group:'Specials', added:'2026-02-03' }), 'Specials');
  assert.equal(archiveYear({ added:'2024-09-08T09:00:00Z' }), '2024');
  assert.equal(archiveYear({}), 'Other');
});

test('only the active year opens at initial load and clicking years expands or collapses', () => {
  const groups = new Map([
    ['2026', { open:false }], ['2025', { open:false }], ['Specials', { open:false }],
  ]);
  assert.equal(expandArchiveYear(groups, '2026'), true);
  assert.deepEqual([...groups.values()].map(g => g.open), [true,false,false]);
  assert.equal(expandArchiveYear(groups, '2025', {toggle:true}), true);
  assert.deepEqual([...groups.values()].map(g => g.open), [false,true,false]);
  assert.equal(expandArchiveYear(groups, '2025', {toggle:true}), false);
  assert.deepEqual([...groups.values()].map(g => g.open), [false,false,false]);
  // Selecting an issue from an archived year opens its section again.
  assert.equal(expandArchiveYear(groups, 'Specials'), true);
  assert.deepEqual([...groups.values()].map(g => g.open), [false,false,true]);
  // Missing year must not unexpectedly close an already open year.
  assert.equal(expandArchiveYear(groups, 'unknown'), false);
  assert.deepEqual([...groups.values()].map(g => g.open), [false,false,true]);
});

test('library uses accessible native details/summary with counts and active-year behaviour', () => {
  assert.match(page, /document\.createElement\('details'\)/);
  assert.match(page, /document\.createElement\('summary'\)/);
  assert.match(page, /section\.className = 'archive-group'/);
  assert.match(page, /count\.textContent = n \+ \(n === 1 \? ' issue' : ' issues'\)/);
  assert.match(page, /expandArchiveYear\(archiveGroups, archiveYear\(issue\)\)/);
  assert.match(page, /expandArchiveYear\(archiveGroups, year, \{ toggle: true \}\)/);
  assert.match(page, /event\.preventDefault\(\)/);
  assert.match(page, /btn\.addEventListener\('click', \(\) => show\(issue, \{ scroll: true \}\)\)/);
  assert.match(page, /document\.getElementById\('back'\)\.addEventListener\('click', \(\) => show\(issues\[0\]/);
});

test('collapsed archive rows stay hidden even with the existing .grid display styling', () => {
  assert.match(css, /\.archive-group:not\(\[open\]\) > \.grid \{ display: none; \}/);
  assert.match(css, /\.archive-group\[open\] > \.grid \{ padding:/);
  assert.match(css, /\.archive-year:focus-visible/);
  assert.match(css, /@media \(max-width: 600px\)/);
});
