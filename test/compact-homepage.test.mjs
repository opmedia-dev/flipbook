import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const preview = fs.readFileSync(path.join(root, 'site/preview.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'site/assets/flipbook.css'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');

test('homepage generator uses compact 360px iframe; archive remains unchanged', () => {
  assert.match(generator, /pq\.set\('compact', '1'\)/);
  assert.match(generator, /iframe\('preview\.html', pq, 360, 'Latest issue'\)/);
  assert.match(generator, /iframe\('library\.html', q, 1400, 'Issues'\)/);
});

test('compact mode is opt-in and keeps the full-reader title link', () => {
  assert.match(preview, /params\.get\('compact'\) === '1'/);
  assert.match(preview, /classList\.toggle\('fb-compact', compact\)/);
  assert.match(preview, /full\.href = viewerUrl\(issue\)/);
  assert.match(preview, /tools: compact \? \[\] : toolsParam\(\)/);
});

test('compact CSS displays book first, title underneath, and reduces wasted space', () => {
  assert.match(css, /\.fb-compact \.wrap\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*padding:\s*0 8px 6px/);
  assert.match(css, /\.fb-compact #book\s*\{\s*order:\s*0;/);
  assert.match(css, /\.fb-compact \.issue-head\s*\{\s*order:\s*1;/);
  assert.match(css, /\.fb-compact \.issue-kicker\s*\{\s*display:\s*none;/);
  assert.match(css, /\.fb-compact \.cta\s*\{\s*order:\s*2;/);
});
