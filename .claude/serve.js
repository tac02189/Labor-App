// Minimal zero-dependency static server for the Labor App preview.
// Run:  node .claude/serve.js [rootDir] [port]
// No npm install, no network, no PATH dependency - node.exe is invoked by absolute path.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const port = Number(process.argv[3] || 8764);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".ico":  "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(root, rel);

  // never serve outside root
  if (!file.startsWith(root)) { res.writeHead(403).end("Forbidden"); return; }

  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, {"Content-Type":"text/plain"}).end("404 " + rel); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(buf);
  });
}).listen(port, () => console.log("serving " + root + " on http://localhost:" + port));
