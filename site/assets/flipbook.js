import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

const VENDOR = new URL('./vendor/pdfjs/', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = `${VENDOR}pdf.worker.min.mjs`;

const ICONS = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  exitFull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  first: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l-7 7 7 7M19 5l-7 7 7 7"/></svg>',
  last: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l7 7-7 7M12 5l7 7-7 7"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M10.5 8v5M8 10.5h5"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/></svg>',
  print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export const ALL_TOOLS = ['search', 'zoom', 'share', 'print', 'download', 'fullscreen'];

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function loadPdf(url) {
  return pdfjsLib.getDocument({
    url,
    isEvalSupported: false,
    cMapUrl: `${VENDOR}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${VENDOR}standard_fonts/`,
  }).promise;
}

export async function renderPageToCanvas(pdf, pageNumber, cssWidth, canvas = document.createElement('canvas')) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = cssWidth / base.width;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas;
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/**
 * Mounts a PDF flipbook into `host`.
 * options: { coverUrl, downloadName, title, shareUrl, fullscreenFallbackUrl,
 *            maxHeight (px or fn), minPageWidth, tools (subset of ALL_TOOLS) }
 * Returns { destroy() }.
 */
export async function createFlipbook(host, pdfUrl, options = {}) {
  const minPageWidth = options.minPageWidth ?? 260;
  host.classList.add('fb');
  host.innerHTML = '';

  const stageWrap = el('div', 'fb-stage');
  const sizer = el('div', 'fb-sizer');
  const book = el('div', 'fb-book');
  const loading = el('div', 'fb-loading', '<span class="fb-spinner"></span><span>Loading…</span>');
  sizer.append(book);
  stageWrap.append(sizer, loading);

  const tools = new Set(options.tools || ALL_TOOLS);
  function button(icon, label, cls = 'fb-btn') {
    const b = el('button', cls, ICONS[icon]);
    b.type = 'button'; b.title = label; b.setAttribute('aria-label', label);
    return b;
  }

  const bar = el('div', 'fb-bar');
  const nav = el('div', 'fb-group fb-nav');
  const firstBtn = button('first', 'First page');
  const prev = button('prev', 'Previous page');
  const counter = el('span', 'fb-counter', '–');
  const next = button('next', 'Next page');
  const lastBtn = button('last', 'Last page');
  nav.append(firstBtn, prev, counter, next, lastBtn);

  const toolGroup = el('div', 'fb-group fb-tools');
  const searchBtn = button('search', 'Search');
  const zoomBtn = button('zoom', 'Zoom');
  const shareBtn = button('share', 'Share');
  const printBtn = button('print', 'Print');
  const full = button('full', 'Full screen');
  const dl = el('a', 'fb-btn', ICONS.download);
  dl.href = pdfUrl; dl.title = 'Download PDF'; dl.setAttribute('aria-label', 'Download PDF');
  dl.target = '_blank'; dl.rel = 'noopener';
  if (options.downloadName) dl.download = options.downloadName;
  const toolButtons = { search: searchBtn, zoom: zoomBtn, share: shareBtn, print: printBtn, download: dl, fullscreen: full };
  for (const name of ALL_TOOLS) if (tools.has(name)) toolGroup.append(toolButtons[name]);
  bar.append(nav);
  if (toolGroup.children.length) bar.append(toolGroup);

  const searchPanel = el('div', 'fb-search');
  searchPanel.hidden = true;
  searchPanel.innerHTML = '<form class="fb-search-form" role="search"><input type="search" placeholder="Search this issue…" aria-label="Search this issue"><button type="submit" class="fb-search-go">Search</button></form><p class="fb-search-status" aria-live="polite"></p><ol class="fb-search-results"></ol>';

  const zoomLayer = el('div', 'fb-zoom');
  zoomLayer.hidden = true;
  const zoomScroll = el('div', 'fb-zoom-scroll');
  const zoomPages = el('div', 'fb-zoom-pages');
  zoomScroll.append(zoomPages);
  const zoomBar = el('div', 'fb-zoom-bar');
  const zoomOut = button('zoomOut', 'Zoom out');
  const zoomLevel = el('span', 'fb-counter fb-zoom-level', '200%');
  const zoomIn = button('zoom', 'Zoom in');
  const zoomClose = button('close', 'Close zoom');
  zoomBar.append(zoomOut, zoomLevel, zoomIn, zoomClose);
  zoomLayer.append(zoomScroll, zoomBar);
  stageWrap.append(zoomLayer);

  const toast = el('div', 'fb-toast');
  toast.setAttribute('role', 'status');
  stageWrap.append(toast);

  host.append(stageWrap, bar, searchPanel);

  let destroyed = false;
  let pageFlip = null;
  const cleanups = [];

  const pdf = await loadPdf(pdfUrl);
  if (destroyed) return { destroy() {} };
  const first = await pdf.getPage(1);
  const vp = first.getViewport({ scale: 1 });
  const ratio = vp.width / vp.height;
  const total = pdf.numPages;

  const pages = [];
  for (let i = 0; i < total; i++) {
    const p = el('div', 'fb-page');
    if (i === 0 || i === total - 1) p.dataset.density = 'hard';
    const inner = el('div', 'fb-page-inner');
    inner.style.aspectRatio = `${vp.width} / ${vp.height}`;
    if (i === 0 && options.coverUrl) {
      const img = el('img', 'fb-placeholder');
      img.src = options.coverUrl; img.alt = '';
      inner.append(img);
    }
    p.append(inner);
    pages.push(p);
    book.append(p);
  }

  const isFullscreen = () => document.fullscreenElement === host;

  function availableHeight() {
    if (isFullscreen()) return window.innerHeight - bar.offsetHeight - 24;
    const mh = typeof options.maxHeight === 'function' ? options.maxHeight() : options.maxHeight;
    return mh || window.innerHeight * 0.85;
  }

  function fitSizer() {
    const w = stageWrap.clientWidth;
    const landscape = w >= minPageWidth * 2;
    const maxW = availableHeight() * ratio * (landscape ? 2 : 1);
    sizer.style.maxWidth = `${Math.max(minPageWidth, Math.floor(Math.min(w, maxW)))}px`;
  }
  fitSizer();

  pageFlip = new window.St.PageFlip(book, {
    width: Math.round(vp.width),
    height: Math.round(vp.height),
    size: 'stretch',
    minWidth: minPageWidth,
    maxWidth: 3000,
    minHeight: Math.round(minPageWidth / ratio),
    maxHeight: Math.round(3000 / ratio),
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: true,
    maxShadowOpacity: 0.35,
    flippingTime: 700,
    startZIndex: 1,
    autoSize: true,
  });
  pageFlip.loadFromHTML(pages);

  const rendered = new Map();
  const queue = [];
  let working = false;

  function pageCssWidth() {
    const w = sizer.clientWidth || stageWrap.clientWidth;
    const single = pageFlip.getOrientation() === 'portrait';
    return single ? w : w / 2;
  }

  function targetPixelWidth() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const css = isFullscreen() ? pageCssWidth() : Math.max(pageCssWidth(), 500);
    return Math.min(2400, Math.round(css * dpr * 1.15));
  }

  async function pump() {
    if (working) return;
    working = true;
    while (queue.length && !destroyed) {
      const idx = queue.shift();
      const px = targetPixelWidth();
      if ((rendered.get(idx) || 0) >= px * 0.9) continue;
      try {
        const canvas = await renderPageToCanvas(pdf, idx + 1, px);
        if (destroyed) break;
        canvas.className = 'fb-canvas';
        const inner = pages[idx].querySelector('.fb-page-inner');
        inner.querySelector('.fb-canvas')?.remove();
        inner.querySelector('.fb-placeholder')?.remove();
        inner.append(canvas);
        rendered.set(idx, px);
      } catch (e) {
        console.warn('Render failed for page', idx + 1, e);
      }
    }
    working = false;
  }

  function schedule(center) {
    const order = [0, 1, -1, 2, 3, -2, 4, 5, -3];
    for (const d of order) {
      const i = center + d;
      if (i >= 0 && i < total && !queue.includes(i)) queue.push(i);
    }
    pump();
  }

  function updateUi() {
    const i = pageFlip.getCurrentPageIndex();
    const portrait = pageFlip.getOrientation() === 'portrait';
    let label = `${i + 1}`;
    if (!portrait && i > 0 && i < total - 1) {
      const left = i % 2 === 1 ? i : i - 1;
      label = `${left + 1}–${Math.min(left + 2, total)}`;
    }
    counter.textContent = `${label} / ${total}`;
    const alone = !portrait && (i === 0 || (i === total - 1 && total % 2 === 0));
    sizer.classList.toggle('fb-shift-left', alone && i === 0);
    sizer.classList.toggle('fb-shift-right', alone && i !== 0);
    prev.disabled = i <= 0;
    firstBtn.disabled = i <= 0;
    const lastVisible = portrait || i === 0 || i % 2 === 0 ? i : i + 1;
    next.disabled = lastVisible >= total - 1;
    lastBtn.disabled = next.disabled;
    if (!zoomLayer.hidden) renderZoom();
    schedule(i);
  }

  pageFlip.on('flip', updateUi);
  pageFlip.on('changeOrientation', updateUi);
  function goTo(index) {
    const target = Math.max(0, Math.min(total - 1, index));
    if (target === pageFlip.getCurrentPageIndex()) return;
    pageFlip.turnToPage(target);
    updateUi();
  }

  prev.addEventListener('click', () => pageFlip.flipPrev());
  next.addEventListener('click', () => pageFlip.flipNext());
  firstBtn.addEventListener('click', () => goTo(0));
  lastBtn.addEventListener('click', () => goTo(total - 1));

  function visiblePages() {
    const i = pageFlip.getCurrentPageIndex();
    if (pageFlip.getOrientation() === 'portrait' || i === 0) return [i];
    const left = i % 2 === 1 ? i : i - 1;
    return [left, left + 1].filter((n) => n < total);
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('fb-toast-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('fb-toast-show'), 2200);
  }

  // Share
  shareBtn.addEventListener('click', async () => {
    const url = options.shareUrl || location.href;
    const title = options.title || document.title;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    } catch {
      window.prompt('Copy this link:', url);
    }
  });

  // Print: load the PDF in a hidden same-origin frame and use the browser's PDF printing.
  printBtn.addEventListener('click', () => {
    showToast('Preparing to print…');
    const frame = document.createElement('iframe');
    frame.className = 'fb-print-frame';
    frame.src = pdfUrl;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        window.open(pdfUrl, '_blank', 'noopener');
      }
      setTimeout(() => frame.remove(), 60000);
    };
    document.body.append(frame);
  });

  // Zoom: renders the visible page(s) at a higher scale in a pannable layer.
  const ZOOM_STEPS = [1.5, 2, 3, 4];
  let zoomIdx = 1;
  let zoomToken = 0;
  async function renderZoom() {
    const token = ++zoomToken;
    const scale = ZOOM_STEPS[zoomIdx];
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;
    zoomOut.disabled = zoomIdx === 0;
    zoomIn.disabled = zoomIdx === ZOOM_STEPS.length - 1;
    const pagesToShow = visiblePages();
    const cssWidth = (stageWrap.clientWidth / pagesToShow.length) * scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvases = [];
    for (const idx of pagesToShow) {
      const c = await renderPageToCanvas(pdf, idx + 1, Math.min(cssWidth * dpr, 4000));
      c.style.width = `${cssWidth}px`;
      canvases.push(c);
    }
    if (token !== zoomToken) return;
    zoomPages.replaceChildren(...canvases);
  }
  function openZoom() {
    closeSearch();
    zoomLayer.hidden = false;
    zoomBtn.setAttribute('aria-pressed', 'true');
    renderZoom().then(() => {
      zoomScroll.scrollLeft = (zoomScroll.scrollWidth - zoomScroll.clientWidth) / 2;
    });
  }
  function closeZoom() {
    zoomLayer.hidden = true;
    zoomBtn.setAttribute('aria-pressed', 'false');
    zoomPages.replaceChildren();
  }
  zoomBtn.addEventListener('click', () => (zoomLayer.hidden ? openZoom() : closeZoom()));
  zoomClose.addEventListener('click', closeZoom);
  zoomIn.addEventListener('click', () => { zoomIdx = Math.min(zoomIdx + 1, ZOOM_STEPS.length - 1); renderZoom(); });
  zoomOut.addEventListener('click', () => { zoomIdx = Math.max(zoomIdx - 1, 0); renderZoom(); });
  let drag = null;
  zoomScroll.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    drag = { x: e.clientX, y: e.clientY, left: zoomScroll.scrollLeft, top: zoomScroll.scrollTop };
    zoomScroll.setPointerCapture(e.pointerId);
    zoomScroll.classList.add('fb-dragging');
  });
  zoomScroll.addEventListener('pointermove', (e) => {
    if (!drag) return;
    zoomScroll.scrollLeft = drag.left - (e.clientX - drag.x);
    zoomScroll.scrollTop = drag.top - (e.clientY - drag.y);
  });
  const endDrag = () => { drag = null; zoomScroll.classList.remove('fb-dragging'); };
  zoomScroll.addEventListener('pointerup', endDrag);
  zoomScroll.addEventListener('pointercancel', endDrag);

  // Search
  const searchInput = searchPanel.querySelector('input');
  const searchStatus = searchPanel.querySelector('.fb-search-status');
  const searchResults = searchPanel.querySelector('.fb-search-results');
  let pageTexts = null;
  async function getTexts() {
    if (!pageTexts) {
      pageTexts = [];
      for (let n = 1; n <= total; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        pageTexts.push(content.items.map((it) => it.str).join(' ').replace(/\s+/g, ' '));
      }
    }
    return pageTexts;
  }
  function closeSearch() {
    searchPanel.hidden = true;
    searchBtn.setAttribute('aria-pressed', 'false');
  }
  searchBtn.addEventListener('click', () => {
    if (!searchPanel.hidden) { closeSearch(); return; }
    closeZoom();
    searchPanel.hidden = false;
    searchBtn.setAttribute('aria-pressed', 'true');
    searchInput.focus();
  });
  searchPanel.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    searchResults.replaceChildren();
    if (q.length < 2) { searchStatus.textContent = 'Type at least 2 characters.'; return; }
    searchStatus.textContent = 'Searching…';
    const texts = await getTexts();
    const needle = q.toLowerCase();
    const hits = [];
    texts.forEach((text, idx) => {
      const lower = text.toLowerCase();
      let at = lower.indexOf(needle);
      let count = 0;
      while (at !== -1 && count < 3 && hits.length < 100) {
        hits.push({ idx, at, text });
        count++;
        at = lower.indexOf(needle, at + needle.length);
      }
    });
    searchStatus.textContent = hits.length
      ? `${hits.length}${hits.length === 100 ? '+' : ''} result${hits.length === 1 ? '' : 's'} for “${q}”`
      : `No results for “${q}”.`;
    for (const h of hits) {
      const start = Math.max(0, h.at - 40);
      const end = Math.min(h.text.length, h.at + needle.length + 40);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fb-search-hit';
      b.innerHTML = `<span class="fb-search-page">Page ${h.idx + 1}</span> ${start > 0 ? '…' : ''}${escapeHtml(h.text.slice(start, h.at))}<mark>${escapeHtml(h.text.slice(h.at, h.at + needle.length))}</mark>${escapeHtml(h.text.slice(h.at + needle.length, end))}${end < h.text.length ? '…' : ''}`;
      b.addEventListener('click', () => goTo(h.idx));
      li.append(b);
      searchResults.append(li);
    }
  });

  function onKey(e) {
    if (e.key === 'Escape') { closeZoom(); closeSearch(); return; }
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') pageFlip.flipPrev();
    if (e.key === 'ArrowRight') pageFlip.flipNext();
    if (e.key === 'Home') goTo(0);
    if (e.key === 'End') goTo(total - 1);
  }
  window.addEventListener('keydown', onKey);
  cleanups.push(() => window.removeEventListener('keydown', onKey));

  const fullscreenSupported = document.fullscreenEnabled && host.requestFullscreen;
  full.addEventListener('click', async () => {
    if (isFullscreen()) { document.exitFullscreen(); return; }
    if (fullscreenSupported) {
      try { await host.requestFullscreen(); return; } catch { /* fall through */ }
    }
    if (options.fullscreenFallbackUrl) window.open(options.fullscreenFallbackUrl, '_blank', 'noopener');
  });
  if (!fullscreenSupported && !options.fullscreenFallbackUrl) full.hidden = true;

  let resizeTimer;
  function relayout() {
    fitSizer();
    pageFlip.update();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateUi, 250);
  }
  function onFsChange() {
    full.innerHTML = isFullscreen() ? ICONS.exitFull : ICONS.full;
    full.title = isFullscreen() ? 'Exit full screen' : 'Full screen';
    requestAnimationFrame(relayout);
  }
  document.addEventListener('fullscreenchange', onFsChange);
  cleanups.push(() => document.removeEventListener('fullscreenchange', onFsChange));

  const ro = new ResizeObserver(() => relayout());
  ro.observe(stageWrap);
  cleanups.push(() => ro.disconnect());

  loading.remove();
  host.classList.add('fb-ready');
  updateUi();

  return {
    pageCount: total,
    destroy() {
      destroyed = true;
      cleanups.forEach((fn) => fn());
      try { pageFlip.destroy(); } catch { /* ignore */ }
      pdf.destroy();
      host.innerHTML = '';
    },
  };
}
