const { readFileSync } = require('node:fs');

function validatePreviewUrl(value) {
  const url = new URL(value.trim());
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.vercel.app') ||
    !url.hostname.startsWith('stssomaliaclient-') ||
    url.username || url.password || url.port ||
    url.pathname !== '/' || url.search || url.hash
  ) {
    throw new Error('Expected an STS Vercel preview deployment URL.');
  }
  return url.origin;
}

if (require.main === module) {
  console.log(`url=${validatePreviewUrl(readFileSync(process.argv[2], 'utf8'))}`);
}
module.exports = { validatePreviewUrl };
