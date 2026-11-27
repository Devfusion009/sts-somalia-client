const { isIP } = require('node:net');

function httpsOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be a public HTTPS origin.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.') || !/^[a-z0-9.-]+$/.test(url.hostname)) {
    throw new Error(`${name} must be a public HTTPS origin.`);
  }
  return url;
}

/** Use the same production origins at image-build time and container runtime. */
function productionPaymentRouting(env) {
  const site = httpsOrigin(env.NEXT_PUBLIC_SITE_URL, 'NEXT_PUBLIC_SITE_URL');
  const api = httpsOrigin(env.NEXT_PUBLIC_API_URL, 'NEXT_PUBLIC_API_URL');
  if (env.NEXT_PUBLIC_APP_HOST !== site.hostname) throw new Error('NEXT_PUBLIC_APP_HOST must match the production site hostname.');
  if (api.hostname !== site.hostname && api.hostname !== `api.${site.hostname}`) throw new Error('The production API must use the production site or its api subdomain.');
  const origins = [site.origin, ...['admin', 'agent', 'manager', 'partner', 'affiliate', 'venue'].map(portal => `https://${portal}.${site.hostname}`)];
  return {
    NEXT_PUBLIC_SITE_URL: site.origin,
    NEXT_PUBLIC_API_URL: api.origin,
    NEXT_PUBLIC_APP_HOST: site.hostname,
    WEB_ORIGIN: origins.join(','),
    SITE_DOMAIN: site.hostname,
    CADDYFILE: 'Caddyfile.domain',
  };
}

module.exports = { productionPaymentRouting };
if (require.main === module) {
  try {
    const routing = productionPaymentRouting(process.env);
    if (process.argv.includes('--emit-env')) {
      for (const [key, value] of Object.entries(routing)) console.log(`${key}='${value}'`);
    } else console.log('Production payment HTTPS routing validated.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
