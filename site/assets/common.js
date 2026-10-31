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

// ?tools=search,zoom,share,print,download,fullscreen (or "none"); omitted = all.
export function toolsParam() {
  const raw = params.get('tools');
  if (raw == null) return undefined;
  return raw === 'none' ? [] : raw.split(',').map((t) => t.trim()).filter(Boolean);
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
  // Measuring the <html> element can report the *iframe viewport height*
  // rather than actual content and block legitimate shrinking on phones.
  // The main wrapper gives us the intrinsic document height independently of
  // the size Duda last assigned to the iframe.
  const content = document.querySelector('main') || document.body;
  const send = () => {
    const h = Math.max(80, Math.ceil(content.getBoundingClientRect().bottom));
    if (Math.abs(h - last) > 1) {
      last = h;
      postToParent({ type: 'height', height: h });
    }
  };
  new ResizeObserver(send).observe(content);
  window.addEventListener('resize', send);
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
