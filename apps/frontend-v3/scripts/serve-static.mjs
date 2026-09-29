#!/usr/bin/env node
// Rootstock local static server — S102 (Boss 2026-09-26, boat integrity).
// Replaces `python3 -m http.server` for the export: unknown paths must show
// the app's styled 404 page (with navbar), not a bare server error page —
// the bare 404 was the missing-navbar surface Boss reported. Zero deps.
//
// Usage: node scripts/serve-static.mjs [port]  (default 8091, serves out/)

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../out')
const PORT = Number(process.argv[2] || 8091)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function send(res, path, status = 200) {
  const body = await readFile(path)
  res.writeHead(status, {
    'Content-Type': MIME[extname(path)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  })
  res.end(body)
}

const server = createServer(async (req, res) => {
  try {
    // decode + normalize; strip query; reject traversal outside out/
    const url = decodeURIComponent((req.url || '/').split('?')[0])
    let rel = normalize(url).replace(/^([/\\])+/, '')
    if (rel.includes('..')) {
      res.writeHead(400)
      res.end('Bad Request')
      return
    }

    const base = join(OUT, rel)

    // directory -> index.html
    if (rel === '' || (await exists(base)) && (await stat(base)).isDirectory()) {
      const index = join(base, 'index.html')
      if (await exists(index)) {
        await send(res, index)
        return
      }
    }

    // exact file (assets, _next chunks, route files)
    if ((await exists(base)) && (await stat(base)).isFile()) {
      await send(res, base)
      return
    }

    // legacy extensionless route (pre-trailingSlash) -> route.html fallback
    const asHtml = `${base}.html`
    if (await exists(asHtml)) {
      await send(res, asHtml)
      return
    }

    // unknown path -> styled app 404 (S102: never a bare error page)
    await send(res, join(OUT, '404', 'index.html'), 404)
  } catch {
    res.writeHead(500)
    res.end('Internal Server Error')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[serve-static] http://127.0.0.1:${PORT}/ serving ${OUT} (styled 404 fallback)\n[serve-static] WORKDIR-MARKER: survives via nohup; restart if dead after container recreation`)
})
