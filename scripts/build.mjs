// Builds the static site into _site/: copies site/ assets, copies PDFs from
// pdfs/, renders cover thumbnails (poppler's pdftoppm) and writes issues.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const srcPdfs = path.join(root, 'pdfs');
const out = path.join(root, '_site');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

function has(cmd) {
  try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; }
}

function slugify(s) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'issue';
}

function gitAddedDate(file) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file],
      { cwd: root, encoding: 'utf8' }).trim().split('\n').pop();
    return out || null;
  } catch { return null; }
}

function parseName(file) {
  const base = path.basename(file, path.extname(file));
  const m = base.match(/^(\d{4})[-_.](\d{1,2})(?:[-_.](\d{1,2}))?(?:[\s_-]+(.*))?$/);
  let date = null;
  let rest = base;
  let precision = 'day';
  if (m) {
    const [, y, mo, d, tail] = m;
    precision = d ? 'day' : 'month';
    date = `${y}-${mo.padStart(2, '0')}-${(d || '1').padStart(2, '0')}`;
    rest = tail || '';
  }
  let title = rest.replace(/_+/g, ' ').trim();
  if (!title.includes(' ')) title = title.replace(/-+/g, ' ');
  title = title.replace(/\s+/g, ' ').trim();
  if (!title && date) {
    const [y, mo, d] = date.split('-').map(Number);
    title = precision === 'month' ? `${MONTHS[mo - 1]} ${y}` : `${d} ${MONTHS[mo - 1]} ${y}`;
  }
  return { title: title || base, date, precision };
}

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'site'), out, { recursive: true });
fs.mkdirSync(path.join(out, 'pdfs'), { recursive: true });
fs.mkdirSync(path.join(out, 'covers'), { recursive: true });

const canCover = has('pdftoppm');
const canInfo = has('pdfinfo');
if (!canCover) console.warn('pdftoppm not found: covers will be rendered in the browser instead.');

const files = fs.existsSync(srcPdfs)
  ? fs.readdirSync(srcPdfs).filter((f) => f.toLowerCase().endsWith('.pdf'))
  : [];

const used = new Set();
const issues = files.map((name) => {
  const abs = path.join(srcPdfs, name);
  const parsed = parseName(name);
  let date = parsed.date;
  let precision = parsed.precision;
  if (!date) {
    date = (gitAddedDate(path.join('pdfs', name)) || fs.statSync(abs).mtime.toISOString()).slice(0, 10);
    precision = 'day';
  }
  let id = slugify(path.basename(name, '.pdf'));
  while (used.has(id)) id += '-1';
  used.add(id);

  fs.copyFileSync(abs, path.join(out, 'pdfs', `${id}.pdf`));

  let cover = null;
  if (canCover) {
    try {
      execFileSync('pdftoppm', ['-f', '1', '-l', '1', '-singlefile', '-scale-to', '700',
        '-jpeg', '-jpegopt', 'quality=82', abs, path.join(out, 'covers', id)]);
      cover = `covers/${id}.jpg`;
    } catch (e) { console.warn(`Cover failed for ${name}: ${e.message}`); }
  }

  let pages = null;
  if (canInfo) {
    try {
      const info = execFileSync('pdfinfo', [abs], { encoding: 'utf8' });
      pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]) || null;
    } catch { /* ignore */ }
  }

  return { id, title: parsed.title, date, precision, file: `pdfs/${id}.pdf`, cover, pages,
    sizeBytes: fs.statSync(abs).size };
});

issues.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

fs.writeFileSync(path.join(out, 'issues.json'),
  JSON.stringify({ generated: new Date().toISOString(), issues }, null, 2));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

console.log(`Built ${issues.length} issue(s) into _site/`);
for (const i of issues) console.log(`  ${i.date}  ${i.title}  (${i.file})`);
