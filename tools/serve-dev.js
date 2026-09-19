const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;

// serve from package root
const ROOT = path.resolve(__dirname, "..");

function walk(dirAbs, relBase = "") {
  const out = [];
  for (const name of fs.readdirSync(dirAbs)) {
    const abs = path.join(dirAbs, name);
    const rel = path.join(relBase, name).replace(/\\/g, "/");
    const st = fs.statSync(abs);
    if (st.isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

function contentType(p) {
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (p.endsWith(".map")) return "application/json; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "/");
  const reqPath = decodeURIComponent(parsed.pathname || "/");

  // Dev-only: return list of files to download
  // (template-manifest.json + dist/** + assets/**)
  if (reqPath === "/__files") {
    let distFiles = [];
    try {
      distFiles = walk(path.join(ROOT, "dist"), "dist");
    } catch {
      distFiles = [];
    }
    let assetFiles = [];
    try {
      assetFiles = walk(path.join(ROOT, "assets"), "assets");
    } catch {
      assetFiles = [];
    }

    const files = ["template-manifest.json", ...distFiles, ...assetFiles];

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(files, null, 2));
    return;
  }

  // default to template-manifest.json
  const rel = reqPath === "/" ? "/template-manifest.json" : reqPath;

  const abs = path.join(ROOT, rel);

  // prevent path traversal
  if (!abs.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  fs.readFile(abs, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType(abs));
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`community-templates dev server: http://localhost:${PORT}/`);
  console.log(`files listing: http://localhost:${PORT}/__files`);
});
