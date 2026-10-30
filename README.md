# Flipbook

Turns the PDFs in [`pdfs/`](pdfs/) into page-turning flipbooks that can be embedded
on a Duda site (or any site) with an HTML widget. Hosted for free on GitHub Pages,
so no server is needed.

- **Home page preview** – `preview.html`: the latest issue as a compact flipbook,
  with an optional "View all issues" button linking to your issues page.
- **Issues page** – `library.html`: the latest issue as a large flipbook, with an
  archive of previous issues below. Clicking an archive cover opens it in the flipbook.
- **Embed codes** – `index.html`: copy-paste snippets for Duda.

Live site: https://opmedia-dev.github.io/flipbook/

## Managing issues

1. Name the PDF `YYYY-MM-DD Title.pdf` or `YYYY-MM Title.pdf` (e.g. `2026-10 Autumn Newsletter.pdf`).
   The date sets the order and the rest becomes the title. Undated files use their upload date.
2. Upload it at <https://github.com/opmedia-dev/flipbook/upload/main/pdfs> and press **Commit changes**.
3. About a minute later the GitHub Action ([`deploy.yml`](.github/workflows/deploy.yml))
   has rebuilt the site and both embeds show the new issue. Progress is visible in the
   [Actions tab](https://github.com/opmedia-dev/flipbook/actions).

To remove or rename an issue, open it in the `pdfs` folder on GitHub and delete it
(… menu) or rename it (pencil icon). GitHub's web upload is limited to 25 MB per file –
compress larger PDFs (e.g. "Reduce file size" in Acrobat/Preview) before uploading.

## Embedding in Duda

Open <https://opmedia-dev.github.io/flipbook/>, enter your issues page URL and
accent colour, then copy each snippet into an **HTML** widget in the Duda editor.
The snippet includes a small script that resizes the iframe to fit its content;
Duda only runs widget scripts on the preview/published site, so the widget may look
a fixed size inside the editor.

URL options (query string on `preview.html` / `library.html`):

| Option | Example | Effect |
| --- | --- | --- |
| `accent` | `accent=1f3a5f` | Button/heading colour |
| `bg` | `bg=ffffff` | Background (transparent by default) |
| `text` | `text=222222` | Text colour |
| `link` | `link=https://site/issues` | Preview only: "View all issues" button target |
| `linkText` | `linkText=Read+more` | Preview only: button label |
| `title` | `title=0` | Preview only: hide the title/date |
| `kicker` | `kicker=This+month` | Label above the title (default "Latest issue") |
| `archiveTitle` | `archiveTitle=Past+issues` | Library only: archive heading |
| `maxHeight` | `maxHeight=600` | Max book height in px (preview 520, library 760) |
| `id` | `id=2026-07-summer-newsletter` | Preview only: show a specific issue |

## How it works

`scripts/build.mjs` copies `site/` and `pdfs/` into `_site/`, renders a cover
thumbnail per PDF with poppler (`pdftoppm`), and writes `issues.json`. The pages
render PDFs in the browser with [PDF.js](https://mozilla.github.io/pdf.js/) and
animate them with [StPageFlip](https://github.com/Nodlik/StPageFlip) (both vendored
under `site/assets/vendor/`, Apache-2.0 and MIT licensed).

One-time setup: **Settings → Pages → Source: GitHub Actions**.

### Local development

```sh
sudo apt-get install poppler-utils   # optional, for cover thumbnails
node scripts/build.mjs
python3 -m http.server -d _site 8080
```
