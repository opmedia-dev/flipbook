import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { nextScheduledRefresh, refreshCountdown, nextRefreshText } from '../site/assets/refresh-schedule.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manager = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');

test('estimated refresh time follows the actual 15-minute workflow schedule', () => {
  assert.match(workflow, /cron:\s*'\*\/15 \* \* \* \*'/);
  const cases = [
    ['2026-11-02T21:15:31Z','2026-11-02T21:30:00Z'],
    ['2026-11-02T21:29:59Z','2026-11-02T21:30:00Z'],
    ['2026-11-02T21:30:00Z','2026-11-02T21:45:00Z'],
    ['2026-11-02T23:59:58Z','2026-11-03T00:00:00Z'],
    ['2026-03-29T00:59:59Z','2026-03-29T01:00:00Z'],
  ];
  for(const [now,expected] of cases) {
    assert.equal(nextScheduledRefresh(Date.parse(now)), Date.parse(expected));
  }
});

test('countdown formats minutes and seconds without negative values', () => {
  const next = Date.parse('2026-11-02T21:30:00Z');
  assert.equal(refreshCountdown(Date.parse('2026-11-02T21:15:31Z'), next),'14m 29s');
  assert.equal(refreshCountdown(next-1000,next),'0m 01s');
  assert.equal(refreshCountdown(next+5000,next),'0m 00s');
});

test('displayed next time uses Europe/London clock and handles daylight saving', () => {
  assert.deepEqual(
    nextRefreshText(Date.parse('2026-11-02T21:15:31Z')),
    {countdown:'14m 29s',time:'21:30',next:Date.parse('2026-11-02T21:30:00Z')},
  );
  assert.equal(nextRefreshText(Date.parse('2026-07-02T20:20:00Z')).time,'21:30');
});

test('manager shows a live estimate, not a promise of exact publication', () => {
  assert.match(manager, /id="refresh-countdown"/);
  assert.match(manager, /id="refresh-time"/);
  assert.match(manager, /import \{ nextRefreshText \} from '\.\/assets\/refresh-schedule\.mjs'/);
  assert.match(manager, /setInterval\(updateRefreshCountdown, 1000\)/);
  assert.match(manager, /GitHub Actions may start late/);
  assert.match(manager, /actions\/workflows\/deploy\.yml/);
});
