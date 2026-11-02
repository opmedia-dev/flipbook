// The archive URL is configured by the parish when generating the Duda iframe.
// Keep the URL's path and query intact; never send visitors to unsafe protocols.
export function resolveArchiveLink(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' && url.hostname ? url.href : '';
  } catch {
    return '';
  }
}
