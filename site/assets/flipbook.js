import * as pdfjsLib from './vendor/pdfjs/pdf.min.mjs';

const VENDOR = new URL('./vendor/pdfjs/', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = `${VENDOR}pdf.worker.min.mjs`;

const ICONS = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  exitFull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};

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
 * options: { coverUrl, downloadName, fullscreenFallbackUrl, maxHeight (px or fn), minPageWidth }
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

  const bar = el('div', 'fb-bar');
  const prev = el('button', 'fb-btn', ICONS.prev);
  prev.type = 'button'; prev.title = 'Previous page'; prev.setAttribute('aria-label', 'Previous page');
  const counter = el('span', 'fb-counter', '–');
  const next = el('button', 'fb-btn', ICONS.next);
  next.type = 'button'; next.title = 'Next page'; next.setAttribute('aria-label', 'Next page');
  const spacer = el('span', 'fb-spacer');
  const full = el('button', 'fb-btn', ICONS.full);
  full.type = 'button'; full.title = 'Full screen'; full.setAttribute('aria-label', 'Full screen');
  const dl = el('a', 'fb-btn', ICONS.download);
  dl.href = pdfUrl; dl.title = 'Download PDF'; dl.setAttribute('aria-label', 'Download PDF');
  dl.target = '_blank'; dl.rel = 'noopener';
  if (options.downloadName) dl.download = options.downloadName;
  bar.append(prev, counter, next, spacer, full, dl);

  host.append(stageWrap, bar);

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
    const lastVisible = portrait || i === 0 || i % 2 === 0 ? i : i + 1;
    next.disabled = lastVisible >= total - 1;
    schedule(i);
  }

  pageFlip.on('flip', updateUi);
  pageFlip.on('changeOrientation', updateUi);
  prev.addEventListener('click', () => pageFlip.flipPrev());
  next.addEventListener('click', () => pageFlip.flipNext());

  function onKey(e) {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') pageFlip.flipPrev();
    if (e.key === 'ArrowRight') pageFlip.flipNext();
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
