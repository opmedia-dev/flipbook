export const params = new URLSearchParams(location.search);

export function applyTheme() {
  const root = document.documentElement.style;
  const map = { bg: '--fb-bg', accent: '--fb-accent', text: '--fb-text', font: '--fb-font' };
  for (const [key, cssVar] of Object.entries(map)) {
    const v = params.get(key);
    if (v) root.setProperty(cssVar, /^[0-9a-f]{3,8}$/i.test(v) ? `#${v}` : v);
  }
}

export async function loadIssues() {
  const res = await fetch(new URL('../issues.json', import.meta.url), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load issues.json (${res.status})`);
  const data = await res.json();
  return data.issues || [];
}

export function assetUrl(rel) {
  return rel ? new URL(`../${rel}`, import.meta.url).href : null;
}

// Dates are PDF creation/upload dates, not publication dates, so only shown with ?dates=1.
export function formatDate(issue) {
  if (params.get('dates') !== '1' || !issue.added) return '';
  return new Date(issue.added).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function viewerUrl(issue) {
  const u = new URL('../viewer.html', import.meta.url);
  u.searchParams.set('id', issue.id);
  return u.href;
}

const embedded = window.parent !== window;

export function postToParent(msg) {
  if (embedded) window.parent.postMessage({ source: 'flipbook', ...msg }, '*');
}

// Lets the host page (Duda) size the iframe to its content.
export function reportHeight() {
  if (!embedded) return;
  document.documentElement.classList.add('fb-embedded');
  let last = 0;
  let lastWidth = 0;
  const send = () => {
    const h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    const w = window.innerWidth;
    if (window.scrollY) window.scrollTo(0, 0);
    // Growing the iframe can add a scrollbar to the host page, narrowing the
    // iframe and shrinking the book; skip that shrink to avoid a resize loop.
    const narrowedShrink = h < last && w < lastWidth;
    if (Math.abs(h - last) > 1 && !narrowedShrink) {
      last = h;
      postToParent({ type: 'height', height: h });
    }
    lastWidth = w;
  };
  new ResizeObserver(send).observe(document.documentElement);
  window.addEventListener('load', send);
  send();
}

export function showError(host, message) {
  host.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'fb-error';
  p.textContent = message;
  host.append(p);
}
