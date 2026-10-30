// Downloads every PDF in a public ("Anyone with the link") Google Drive folder
// into pdfs/ so build.mjs can publish them.
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
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    fail(`Google Drive API ${res.status} for ${urlPath}: ${body.slice(0, 500)}\n` +
      'Check the API key, that the Drive API is enabled, and that the folder is shared as "Anyone with the link".');
  }
  return res;
}

async function listPdfs() {
  const files = [];
  let pageToken;
  do {
    const res = await drive('/files', {
      q: `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'nextPageToken,files(id,name,createdTime,modifiedTime,md5Checksum,size)',
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

function safeName(name) {
  const base = name.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim();
  return `${base || 'untitled'}.pdf`;
}

const files = await listPdfs();
const fingerprint = crypto.createHash('sha256')
  .update(JSON.stringify(files.map((f) => [f.id, f.name, f.md5Checksum || f.modifiedTime]).sort()))
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
  let name = safeName(f.name);
  while (used.has(name.toLowerCase())) name = name.replace(/\.pdf$/, ' (2).pdf');
  used.add(name.toLowerCase());
  const res = await drive(`/files/${encodeURIComponent(f.id)}`, { alt: 'media', supportsAllDrives: 'true' });
  const out = path.join(dest, name);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  const created = new Date(f.createdTime || f.modifiedTime || Date.now());
  fs.utimesSync(out, created, created);
  console.log(`  downloaded ${name}`);
}
fs.writeFileSync(path.join(root, '.drive-fingerprint'), fingerprint);
setOutput('changed', 'true');
