import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { resolveArchiveLink } from '../site/assets/archive-link.js';

const root = path.resolve(import.meta.dirname, '..');
const preview = fs.readFileSync(path.join(root,'site/preview.html'),'utf8');
const index = fs.readFileSync(path.join(root,'site/index.html'),'utf8');
const workflow = fs.readFileSync(path.join(root,'.github/workflows/deploy.yml'),'utf8');

test('configured parish archive URL wins over hosted GitHub reader', () => {
  const archive='https://www.stjohnsoldmalden.org.uk/magazine-archive?view=issues';
  assert.equal(resolveArchiveLink(archive),archive);
  assert.equal(resolveArchiveLink(' https://www.stjohnsoldmalden.org.uk/magazine-archive '),'https://www.stjohnsoldmalden.org.uk/magazine-archive');
  for(const invalid of ['','javascript:alert(1)','http://example.org/issues','ftp://example.org','/relative']) {
    assert.equal(resolveArchiveLink(invalid),'');
  }
  assert.match(preview,/const archiveLink = resolveArchiveLink\(params\.get\('link'\)\)/);
  assert.match(preview,/full\.href = archiveLink \|\| viewerUrl\(issue\)/);
  assert.match(preview,/anchor\.href = archiveLink \|\| viewerUrl\(issue\)/);
  assert.match(preview,/action\.textContent = archiveLink \? 'View magazine archive/);
  assert.match(index,/pq\.set\('link', link\)/);
});

test('workflow is ready for external dispatch without forcing unchanged Drive rebuilds', () => {
  assert.match(workflow,/source:\s*\n\s*description:/);
  assert.match(workflow,/options: \[manual, external-cron\]/);
  assert.match(workflow,/github\.event_name == 'schedule' \|\| inputs\.source == 'external-cron'/);
  assert.match(workflow,/cron: '\*\/15 \* \* \* \*'/);
  assert.match(workflow,/if: steps\.drive\.outputs\.changed != 'false'/);
});
