import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".css": "text/css",
};
const port = Number(process.env.NEEM_PREVIEW_PORT || 4173);
createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    let target = resolve(root, `.${path}`);
    if (target !== resolve(root) && !target.startsWith(resolve(root) + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(target)).isFile()) target = resolve(root, "index.html");
    } catch {
      target = resolve(root, "index.html");
    }
    res.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404);
    res.end("Build the app with npm run build:web first.");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Neem preview: http://localhost:${port}`),
);
