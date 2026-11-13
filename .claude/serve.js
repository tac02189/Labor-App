// Minimal zero-dependency static server for browser previews of a static folder.
// Run:  node .claude/serve.js [rootDir] [port]
// No npm install, no PATH dependency: node.exe is invoked by absolute path from .claude/launch.json.
// Binds to 127.0.0.1 only and answers malformed URLs with 400. Refuses dot-files and dot-folders such as
// .git, .claude and .env, NTFS data streams, and anything outside rootDir, whether asked for directly, by an
// 8.3 short name (GIT~1 for .git) or through a link or junction. infra/templates/README.md has the details.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
if (!fs.existsSync(root)) { console.error("no such folder: " + root); process.exit(1); }
let realRoot;
try { realRoot = fs.realpathSync.native(root); }
catch (e) { console.error("cannot resolve " + root + ": " + e.message); process.exit(1); }
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

// The normalized path asked for: directory membership, not string prefixes; no dot-file or dot-folder below root.
const outside = (base, p) => { const r = path.relative(base, p); return r === "" || r === ".." || r.startsWith(".." + path.sep) || path.isAbsolute(r); };
const hidden = (base, p) => path.relative(base, p).split(path.sep).some(seg => seg.startsWith("."));
// The real path is compared exactly, case included. On NTFS, as tested, the native real path gives each name as
// it is stored, while Windows' path.relative ignores case, so in a case-sensitive folder it would pass a sibling
// ROOT for root. root itself is refused, as outside() refuses it.
const realBase = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
const realRefused = real => real === realRoot || !real.startsWith(realBase) ||
  real.slice(realBase.length).split(path.sep).some(seg => seg.startsWith(".") || seg.includes(":"));

http.createServer((req, res) => {
  const fail = (code, msg) => res.writeHead(code, {"Content-Type":"text/plain"}).end(code + " " + msg);
  let rel;
  try { rel = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]); }
  catch (e) { fail(400, "bad request"); return; }
  if (rel.indexOf(String.fromCharCode(0)) >= 0) { fail(400, "bad request"); return; } // a NUL byte would make fs throw synchronously
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(root, "." + path.posix.normalize("/" + rel));

  // On Windows a colon can only name a data stream (index.html:note, ::$DATA, $INDEX_ALLOCATION) or a drive.
  if (rel.includes(":") || outside(root, file) || hidden(root, file)) { fail(403, "forbidden"); return; }

  // Then check where the request really ends up, after links and junctions, so none can lead out of root or to
  // a hidden file in it. Only the end is checked: out through a junction and back in is served. The native call
  // (GetFinalPathNameByHandle on Windows) gives NTFS names in their long form, as tested on the laptop's C:, so
  // GIT~1 is checked as .git; the JS fs.realpath keeps a short name as it was written, and serves .git through it.
  // Not covered, and each takes someone with write access to root or a folder above it: a process that swaps a
  // folder, or root itself, for a link between this check and the read could still win; and a hard link is the
  // file itself under a second name, so one to a file outside root, or to a dot-file in it, is served.
  fs.realpath.native(file, (rerr, real) => {
    if (rerr) { fail(404, rel); return; }
    if (realRefused(real)) { fail(403, "forbidden"); return; }
    fs.readFile(real, (err, buf) => {
      if (err) { fail(404, rel); return; }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      res.end(buf);
    });
  });
}).listen(port, "127.0.0.1", () => console.log("serving " + root + " on http://127.0.0.1:" + port + "/"));
