#!/usr/bin/env node
/**
 * Preview server: serves built frontend + runs Netlify function for /api/daily-deck.
 * Simulates Netlify deployment locally.
 * Usage: npm run build (in frontend) then node scripts/preview-netlify.mjs
 */
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import handler from "../netlify/functions/daily-deck.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = join(__dirname, "..", "frontend", "dist");
const MIMES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".ico": "image/x-icon", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;

  if (path === "/api/daily-deck" || path.startsWith("/api/daily-deck?")) {
    const fullUrl = `http://localhost${req.url}`;
    const reqObj = new Request(fullUrl, { method: req.method, headers: req.headers });
    const resObj = await handler(reqObj, {});
    res.writeHead(resObj.status, Object.fromEntries(resObj.headers.entries()));
    res.end(await resObj.text());
    return;
  }

  const file = join(DIST, path.replace(/^\//, "") || "index.html");
  if (!existsSync(file) || !file.startsWith(DIST)) {
    const index = join(DIST, "index.html");
    if (existsSync(index)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(readFileSync(index, "utf8"));
      return;
    }
  }
  if (!existsSync(file)) {
    res.writeHead(404).end("Not found");
    return;
  }
  const mime = MIMES[extname(file)] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(readFileSync(file));
});

const port = 4173;
server.listen(port, () => {
  console.log(`\n  Netlify-style preview: http://localhost:${port}\n  API: http://localhost:${port}/api/daily-deck\n`);
});
