# Flipbook

Turns the PDFs in a shared Google Drive folder into page-turning flipbooks that can
be embedded on a Duda site (or any site) with an HTML widget. Hosted for free on
GitHub Pages, so no server is needed.

- **Home page preview** – `preview.html`: the latest issue as a compact flipbook,
  with an optional "View all issues" button linking to your issues page.
- **Issues page** – `library.html`: the latest issue as a large flipbook, with an
  archive of previous issues below, grouped under a heading per Drive subfolder
  (e.g. `2026`, `2025`). Clicking an archive cover opens it in the flipbook.
- **Embed codes** – `index.html`: copy-paste snippets for Duda.

Live site: https://opmedia-dev.github.io/flipbook/

## Managing issues

Everything is done in the Google Drive folder:

- **Add** a PDF → it appears within ~15 minutes as the latest issue.
- **Delete** a PDF → it disappears at the next sync.
- **Rename** a PDF → the title changes at the next sync.
- **Years:** keep each year's issues in a subfolder named after the year (`2026`, `2025`, …).
  Each subfolder becomes an archive heading, highest first; the latest issue is the newest
  PDF in the top folder. Non-year subfolders (e.g. `Specials`) are listed after the years.
  PDFs left directly in the main folder are grouped by the year they were created.

Within a folder, order is newest first by the date the PDF was created/exported (stored inside the
PDF), so uploading issues out of order is fine; if a PDF has no creation date, its
upload time is used. The title is the file name without `.pdf`. To publish immediately,
open [Actions → Build and deploy flipbook](https://github.com/opmedia-dev/flipbook/actions/workflows/deploy.yml),
press **Run workflow**. Sync errors (e.g. a revoked API key) show as failed runs there,
and GitHub emails the repo owner.

## One-time setup

1. **GitHub Pages:** repo Settings → Pages → Source: **GitHub Actions**.
2. **Drive folder:** create a folder in Google Drive, then Share → General access:
   **Anyone with the link** (Viewer). Copy the folder ID, the part after
   `/folders/` in its URL.
3. **API key:** in [Google Cloud Console](https://console.cloud.google.com/):
   1. Create a project (any name).
   2. APIs & Services → Library → **Google Drive API** → Enable.
   3. APIs & Services → Credentials → Create credentials → **API key**.
      Edit the key → API restrictions → Restrict key → **Google Drive API** → Save.
4. **GitHub settings:** repo Settings → Secrets and variables → Actions:
   - *Secrets* tab → New repository secret `GDRIVE_API_KEY` = the API key.
   - *Variables* tab → New repository variable `GDRIVE_FOLDER_ID` = the folder ID.
5. Run the workflow once (Actions → Build and deploy flipbook → Run workflow).

The sync runs every 15 minutes but only rebuilds when the folder has changed
(`scripts/sync-drive.mjs` compares a fingerprint of the folder listing with the one
in the deployed `issues.json`). GitHub pauses scheduled workflows in public repos
after 60 days without activity; the workflow re-enables itself on each run to try
to avoid that, but if syncing ever stops, press **Run workflow** or **Enable workflow**
on the Actions page.

Note: everything in the Drive folder becomes public on the website.

## Embedding in Duda

Open <https://opmedia-dev.github.io/flipbook/>, enter your issues page URL and
accent colour, then copy each snippet into an **HTML** widget in the Duda editor.
The snippet includes a small script that resizes the iframe to fit its content.
The **home page** snippet uses `compact=1` and starts at **360px** tall
(rather than the original 700px). The cover is displayed first, with a small
issue-title link beneath the page-turning navigation; click it to open the full
reader with all tools.
Other pages, including the full issue archive, are unchanged. You must **recopy
the home page snippet** into Duda after updating the Flipbook deployment.

Duda may not run dynamic iframe-resizing scripts while editing. In the editor,
give the HTML widget's containing column/section enough height to accommodate
the approximately 360px embed and avoid a fixed shorter row or absolutely
positioned content. Then check desktop, tablet and mobile in **site Preview**
before publishing. Changing the iframe size cannot force a fixed-height Duda
section to grow.

URL options (query string on `preview.html` / `library.html`):

| Option | Example | Effect |
| --- | --- | --- |
| `accent` | `accent=7a1424` | Button/heading colour |
| `bg` | `bg=ffffff` | Background (transparent by default) |
| `text` | `text=222222` | Text colour |
| `link` | `link=https://site/issues` | Preview only: "View all issues" button target |
| `linkText` | `linkText=Read+more` | Preview only: button label |
| `title` | `title=0` | Preview only: hide the title |
| `dates` | `dates=1` | Show the PDF's creation date under titles |
| `kicker` | `kicker=This+month` | Label above the title (default "Latest issue") |
| `archiveTitle` | `archiveTitle=Past+issues` | Library only: archive heading |
| `maxHeight` | `maxHeight=600` | Max book height in px (preview 520, library 760) |
| `compact` | `compact=1` | Preview only: smaller page and navigation-only toolbar for narrow homepage widgets; opens full reader from the title |
| `id` | `id=autumn-newsletter` | Preview only: show a specific issue |
| `tools` | `tools=search,zoom,download` | Toolbar tools to show (any of `search,zoom,share,print,download,fullscreen`, or `none`); default all |

Toolbar: first/previous/next/last page, search (text in the PDF), zoom (pannable, 150–400%),
share (native share sheet, else copies a direct link to the issue's `viewer.html`), print,
download and full screen. Keyboard: arrows, Home/End, Esc. Snippets need
`allow="fullscreen; web-share; clipboard-write"` on the iframe for full screen and share.

## How it works

`.github/workflows/deploy.yml` runs `scripts/sync-drive.mjs` (downloads the Drive
PDFs into `pdfs/`) and `scripts/build.mjs` (copies `site/` and the PDFs into `_site/`,
renders cover thumbnails with poppler's `pdftoppm`, writes `issues.json`), then deploys
to Pages. PDFs committed to `pdfs/` are published as well. The pages render PDFs in
the browser with [PDF.js](https://mozilla.github.io/pdf.js/) and animate them with
[StPageFlip](https://github.com/Nodlik/StPageFlip) (vendored under `site/assets/vendor/`,
Apache-2.0 and MIT licensed).

### Local development

```sh
sudo apt-get install poppler-utils   # optional, for cover thumbnails
GDRIVE_FOLDER_ID=... GDRIVE_API_KEY=... node scripts/sync-drive.mjs   # optional
node scripts/build.mjs
python3 -m http.server -d _site 8080
```
