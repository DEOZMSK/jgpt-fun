const { execFileSync } = require('node:child_process');
let revision = process.env.VERCEL_GIT_COMMIT_SHA;
if (!revision) { try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Initial uncommitted build. */ } }
module.exports = {
  serverExternalPackages: ['sweph'],
  env: { NEXT_PUBLIC_SOURCE_URL: `https://github.com/DEOZMSK/jgpt-fun${/^[a-f0-9]{40}$/.test(revision || '') ? '/tree/' + revision : ''}` },
  outputFileTracingIncludes: {
    '/api/astrology/calculate': ['./work/astrology/ephe/sepl_18.se1', './work/astrology/ephe/semo_18.se1', './node_modules/sweph/prebuilds/linux-x64/**'],
    '/api/astrology/places': ['./.generated/chat-places/*.gz']
  },
  outputFileTracingExcludes: { '*': ['./.git/**', './.generated/places/**', './node_modules/sweph/prebuilds/win32-*/**', './node_modules/sweph/prebuilds/darwin-*/**'] },
  async headers() { return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'same-origin'},{key:'X-Frame-Options',value:'DENY'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}]; }
};
