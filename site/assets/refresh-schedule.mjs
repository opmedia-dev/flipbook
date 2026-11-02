// External cron-job.org triggers at UTC minutes 05, 20, 35 and 50.
// GitHub Actions keeps its internal quarter-hour schedule as a fallback.
// This predicts the next external trigger, not workflow completion.
const SLOT_MS = 15 * 60 * 1000;
const OFFSET_MS = 5 * 60 * 1000;

export function nextScheduledRefresh(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError('Expected a finite Unix timestamp');
  return (Math.floor((now - OFFSET_MS) / SLOT_MS) + 1) * SLOT_MS + OFFSET_MS;
}

export function refreshCountdown(now, next) {
  const remaining = Math.max(0, Math.ceil((next - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return minutes + 'm ' + String(seconds).padStart(2, '0') + 's';
}

export function nextRefreshText(now = Date.now()) {
  const next = nextScheduledRefresh(now);
  return {
    countdown: refreshCountdown(now, next),
    next,
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit',
      hour12: false,
    }).format(new Date(next)),
  };
}
