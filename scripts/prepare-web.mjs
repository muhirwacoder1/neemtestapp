import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
async function files(path) {
  return (
    await Promise.all(
      (await readdir(path, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? files(join(path, e.name)) : [join(path, e.name)],
      ),
    )
  ).flat();
}
const assets = (await files(root))
  .filter((p) => !p.endsWith(".map") && !p.endsWith("sw.js"))
  .map((p) => `/${relative(root, p)}`);
const hash = createHash("sha256")
  .update(await readFile(join(root, "index.html")))
  .digest("hex")
  .slice(0, 12);
await writeFile(
  join(root, "sw.js"),
  `const CACHE = 'neem-shell-${hash}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('neem-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') { event.respondWith(fetch(event.request).catch(() => caches.match('/index.html'))); return; }
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
});
`,
);
console.log(
  `Prepared offline app shell: ${assets.length} local assets. Health APIs are never cached.`,
);
