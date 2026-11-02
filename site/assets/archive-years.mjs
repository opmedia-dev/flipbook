// Pure archive state helpers shared by the reader and its regression tests.
// A "year" is the Google Drive subfolder label, including non-year folders.
export function archiveYear(issue) {
  return String(issue.group || (issue.added ? new Date(issue.added).getUTCFullYear() : 'Other'));
}

// Keep at most one expanded year. A visitor may collapse an already open
// year; opening an issue reopens that issue's year (toggle defaults to false).
export function expandArchiveYear(groups, year, { toggle = false } = {}) {
  const target = groups.get(year);
  if (!target) return false;
  const shouldOpen = !toggle || !target.open;
  for (const group of groups.values()) group.open = shouldOpen && group === target;
  return shouldOpen;
}
