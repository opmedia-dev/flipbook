// Builds the static site into _site/: copies site/ assets, copies PDFs from
// pdfs/ (or synced from Google Drive), renders cover thumbnails (poppler's pdftoppm) and writes issues.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const srcPdfs = path.join(root, 'pdfs');
const out = path.join(root, '_site');

function has(cmd) {
  try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; }
}

function slugify(s) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'issue';
}

function gitAddedDate(file) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', '--', file], { cwd: root, stdio: 'ignore' });
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file],
      { cwd: root, encoding: 'utf8' }).trim().split('\n').pop();
    return out || null;
  } catch { return null; }
}

function titleFromName(file) {
  return path.basename(file, path.extname(file)).replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
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
  // Newest first by the PDF's own creation date (when it was exported), which
  // tracks publication order even if issues are uploaded out of order. Falls back
  // to when the file was added: git history for files committed to pdfs/, else the
  // file time (sync-drive.mjs sets it to the Drive upload time).
  const uploaded = gitAddedDate(path.join('pdfs', name)) || fs.statSync(abs).mtime.toISOString();
  let created = null;
  let pages = null;
  if (canInfo) {
    try {
      const info = execFileSync('pdfinfo', ['-isodates', abs], { encoding: 'utf8' });
      pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]) || null;
      const raw = info.match(/^CreationDate:\s+(\S+)/m)?.[1];
      const d = raw && new Date(raw.replace(/([+-]\d{2})$/, '$1:00'));
      if (d && !Number.isNaN(d.getTime())) created = d.toISOString();
    } catch { /* ignore */ }
  }
  const added = created || uploaded;
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

  return { id, title: titleFromName(name), added, file: `pdfs/${id}.pdf`, cover, pages,
    sizeBytes: fs.statSync(abs).size };
});

issues.sort((a, b) => new Date(b.added) - new Date(a.added) || a.title.localeCompare(b.title));

const fingerprintFile = path.join(root, '.drive-fingerprint');
const driveFingerprint = fs.existsSync(fingerprintFile) ? fs.readFileSync(fingerprintFile, 'utf8').trim() : undefined;
fs.writeFileSync(path.join(out, 'issues.json'),
  JSON.stringify({ generated: new Date().toISOString(), driveFingerprint, issues }, null, 2));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

console.log(`Built ${issues.length} issue(s) into _site/`);
for (const i of issues) console.log(`  ${i.added}  ${i.title}  (${i.file})`);
