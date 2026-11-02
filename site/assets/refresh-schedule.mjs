// GitHub Actions workflow "Build and deploy flipbook" uses cron */15 * * * *.
// This predicts the next *scheduled* check, not an exact GitHub start time.
const SLOT_MS = 15 * 60 * 1000;

export function nextScheduledRefresh(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError('Expected a finite Unix timestamp');
  return (Math.floor(now / SLOT_MS) + 1) * SLOT_MS;
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
