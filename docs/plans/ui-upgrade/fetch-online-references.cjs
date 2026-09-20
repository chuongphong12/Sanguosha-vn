// Public first-party reference images, for the design review only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const refs = [
  ['sanguosha-identity-2019.png', 'https://www.sanguosha.com/uploads/201912/5dfb395a734d7.png', 'https://www.sanguosha.com/news/20191219_8089_5016'],
  ['sanguosha-room-2021.png', 'https://sanguosha.com/uploads/202105/6099eb303a305.png', 'https://sanguosha.com/news/20210510_3371_3715'],
  ['gwent-nilfgaard.jpg', 'https://cdn-l-playgwent.cdprojektred.com/screenshots/CardGameplayEffects-06-Nilfgaard_RU.jpg', 'https://playgwent.com/ru/media'],
];
(async () => {
  const dir = path.join(__dirname, 'online');
  fs.mkdirSync(dir, { recursive: true });
  const results = await Promise.allSettled(refs.map(async ([name, url, page]) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const type = response.headers.get('content-type');
    if (!type?.startsWith('image/')) throw new Error(`${name}: unexpected ${type}`);
    const data = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(dir, name), data);
    return { name, url, page, downloadedAt: new Date().toISOString(), bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), usage: 'Design reference; not cleared for game asset use' };
  }));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(results.map(r => r.status === 'fulfilled' ? r.value : { error: String(r.reason) }), null, 2));
  for (const r of results) console.log(r.status === 'fulfilled' ? r.value : String(r.reason));
  if (results.some(r => r.status === 'rejected')) process.exitCode = 1;
})();
