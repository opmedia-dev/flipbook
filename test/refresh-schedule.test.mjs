import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { nextScheduledRefresh, refreshCountdown, nextRefreshText } from '../site/assets/refresh-schedule.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manager = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');

test('estimated refresh time follows the external cron offset, not GitHub fallback', () => {
  assert.match(workflow, /cron:\s*'\*\/15 \* \* \* \*'/);
  const cases = [
    ['2026-11-02T21:15:31Z','2026-11-02T21:20:00Z'],
    ['2026-11-02T21:19:59Z','2026-11-02T21:20:00Z'],
    ['2026-11-02T21:20:00Z','2026-11-02T21:35:00Z'],
    ['2026-11-02T23:59:58Z','2026-11-03T00:05:00Z'],
    ['2026-03-29T00:59:59Z','2026-03-29T01:05:00Z'],
  ];
  for(const [now,expected] of cases) {
    assert.equal(nextScheduledRefresh(Date.parse(now)), Date.parse(expected));
  }
});

test('countdown formats minutes and seconds without negative values', () => {
  const next = Date.parse('2026-11-02T21:20:00Z');
  assert.equal(refreshCountdown(Date.parse('2026-11-02T21:15:31Z'), next),'4m 29s');
  assert.equal(refreshCountdown(next-1000,next),'0m 01s');
  assert.equal(refreshCountdown(next+5000,next),'0m 00s');
});

test('displayed next time uses Europe/London clock and handles daylight saving', () => {
  assert.deepEqual(
    nextRefreshText(Date.parse('2026-11-02T21:15:31Z')),
    {countdown:'4m 29s',time:'21:20',next:Date.parse('2026-11-02T21:20:00Z')},
  );
  assert.equal(nextRefreshText(Date.parse('2026-07-02T20:20:00Z')).time,'21:35');
});

test('manager shows a live estimate, not a promise of exact publication', () => {
  assert.match(manager, /id="refresh-countdown"/);
  assert.match(manager, /id="refresh-time"/);
  assert.match(manager, /import \{ nextRefreshText \} from '\.\/assets\/refresh-schedule\.mjs'/);
  assert.match(manager, /setInterval\(updateRefreshCountdown, 1000\)/);
  assert.match(manager, /cron-job.org/);
  assert.match(manager, /:05, :20, :35 and :50/);
  assert.match(manager, /actions\/workflows\/deploy\.yml/);
});
