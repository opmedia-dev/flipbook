// Downloads every PDF in a public ("Anyone with the link") Google Drive folder
// into pdfs/ so build.mjs can publish them. PDFs in subfolders (e.g. "2025") go
// to pdfs/<subfolder>/, which build.mjs uses as the archive heading.
//
// Env: GDRIVE_FOLDER_ID, GDRIVE_API_KEY
//      SITE_URL       optional, deployed site; used to skip work when Drive is unchanged
//      GITHUB_OUTPUT  set by GitHub Actions; receives changed=true|false and fingerprint=...
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const dest = path.join(root, 'pdfs');
const API = process.env.GDRIVE_API_BASE || 'https://www.googleapis.com/drive/v3';
const { GDRIVE_FOLDER_ID: folderId, GDRIVE_API_KEY: apiKey, SITE_URL: siteUrl } = process.env;

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

if (!folderId || !apiKey) fail('GDRIVE_FOLDER_ID and GDRIVE_API_KEY must both be set.');

async function drive(urlPath, params) {
  const url = new URL(`${API}${urlPath}`);
  for (const [k, v] of Object.entries({ ...params, key: apiKey })) url.searchParams.set(k, v);
  let res;
  // Google sometimes throttles bursts of downloads (403 "Sorry..." page / 429); retry with backoff.
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url);
    const throttled = res.status === 429 || res.status >= 500 ||
      (res.status === 403 && /rateLimit|userRateLimit|Sorry/i.test(await res.clone().text()));
    if (!throttled || attempt >= 5) break;
    const wait = 2 ** attempt * 2000;
    console.log(`  Drive throttled (${res.status}); retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  if (!res.ok) {
    const body = await res.text();
    fail(`Google Drive API ${res.status} for ${urlPath}: ${body.slice(0, 500)}\n` +
      'Check the API key, that the Drive API is enabled, and that the folder is shared as "Anyone with the link".');
  }
  return res;
}

const FOLDER = 'application/vnd.google-apps.folder';

async function listChildren(parent) {
  const files = [];
  let pageToken;
  do {
    const res = await drive('/files', {
      q: `'${parent}' in parents and (mimeType='application/pdf' or mimeType='${FOLDER}') and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,md5Checksum,size)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    });
    const data = await res.json();
    files.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

// PDFs in the folder and its direct subfolders; `group` is the subfolder name.
async function listPdfs() {
  const pdfs = [];
  for (const item of await listChildren(folderId)) {
    if (item.mimeType !== FOLDER) { pdfs.push({ ...item, group: '' }); continue; }
    for (const f of await listChildren(item.id)) {
      if (f.mimeType !== FOLDER) pdfs.push({ ...f, group: item.name });
    }
  }
  return pdfs;
}

function clean(name) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/^\.+/, '').trim();
}

function safeName(name) {
  return `${clean(name.replace(/\.pdf$/i, '')) || 'untitled'}.pdf`;
}

// Identical uploads (e.g. "Issue (1).pdf") would show twice; keep the oldest copy.
const files = [];
const seen = new Set();
for (const f of (await listPdfs()).sort((a, b) => (a.createdTime || '').localeCompare(b.createdTime || ''))) {
  if (f.md5Checksum && seen.has(f.md5Checksum)) { console.log(`  skipping duplicate ${f.name}`); continue; }
  if (f.md5Checksum) seen.add(f.md5Checksum);
  files.push(f);
}
const fingerprint = crypto.createHash('sha256')
  .update(JSON.stringify(files.map((f) => [f.id, f.group, f.name, f.md5Checksum || f.modifiedTime]).sort()))
  .digest('hex').slice(0, 16);
setOutput('fingerprint', fingerprint);
console.log(`Drive folder has ${files.length} PDF(s); fingerprint ${fingerprint}`);

if (siteUrl && process.env.FORCE !== 'true') {
  try {
    const res = await fetch(new URL('issues.json', siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`), { cache: 'no-store' });
    if (res.ok && (await res.json()).driveFingerprint === fingerprint) {
      console.log('Deployed site already matches Drive; nothing to do.');
      setOutput('changed', 'false');
      process.exit(0);
    }
  } catch { /* site not deployed yet */ }
}

fs.mkdirSync(dest, { recursive: true });
const used = new Set();
for (const f of files) {
  const dir = f.group ? clean(f.group) || 'Other' : '';
  let name = path.join(dir, safeName(f.name));
  while (used.has(name.toLowerCase())) name = name.replace(/\.pdf$/, ' (2).pdf');
  used.add(name.toLowerCase());
  const res = await drive(`/files/${encodeURIComponent(f.id)}`, { alt: 'media', supportsAllDrives: 'true' });
  const out = path.join(dest, name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  const created = new Date(f.createdTime || f.modifiedTime || Date.now());
  fs.utimesSync(out, created, created);
  console.log(`  downloaded ${name}`);
  await new Promise((r) => setTimeout(r, 500));
}
fs.writeFileSync(path.join(root, '.drive-fingerprint'), fingerprint);
setOutput('changed', 'true');
