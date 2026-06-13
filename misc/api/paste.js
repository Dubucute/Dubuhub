// Dubuhub Paste API - Full management system
//   POST   /api/paste       → create paste (with optional expiry)
//   GET    /api/paste?id=X  → get raw text
//   GET    /api/paste/list  → list all pastes
//   DELETE /api/paste?id=X  → delete a paste
//   PATCH  /api/paste?id=X  → update expiration
//   GET    /[id]            → raw text (via vercel rewrite)

const store = new Map();
let kv = null;

async function getKV() {
  if (kv) return kv;
  const redisUrl = process.env.STORAGE_REDIS_URL || process.env.KV_URL;
  if (redisUrl) {
    try {
      const { createClient } = await import('redis');
      kv = createClient({ url: redisUrl });
      kv.on('error', () => {});
      await kv.connect();
      return kv;
    } catch { return null; }
  }
  return null;
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = await getKV();
  const isUsingKV = !!client;

  // ==================== POST - Create Paste ====================
  if (req.method === 'POST') {
    let content = '';
    try {
      if (req.headers['content-type']?.includes('application/json')) {
        content = req.body?.content || req.body?.text || '';
      } else {
        content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');
      }
    } catch (e) { content = ''; }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Custom ID or auto-generate
    let id = req.body?.id || '';
    if (id) {
      if (!/^[a-zA-Z0-9_-]{3,32}$/.test(id)) {
        return res.status(400).json({ error: 'Custom ID must be 3-32 chars: letters, numbers, -, _' });
      }
      // Check if ID already exists
      const exists = isUsingKV ? await client.get(id) : store.has(id);
      if (exists) return res.status(409).json({ error: 'ID already exists' });
    } else {
      id = generateId();
    }

    // Expiration
    let expiresAt = null;
    const expiryInput = req.body?.expires;
    if (expiryInput) {
      if (typeof expiryInput === 'number') {
        expiresAt = expiryInput;
      } else if (typeof expiryInput === 'string') {
        const match = expiryInput.match(/^(\d+)\s*(m|h|d|w)$/);
        if (match) {
          const num = parseInt(match[1]);
          const unit = match[2];
          const multipliers = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
          expiresAt = Date.now() + num * (multipliers[unit] || 86400000);
        }
      }
    }

    const pasteData = {
      content,
      id,
      createdAt: Date.now(),
      expiresAt,
      length: content.length,
    };

    store.set(id, pasteData);

    if (isUsingKV) {
      try {
        await client.set(id, JSON.stringify(pasteData));
        if (expiresAt) {
          const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
          if (ttl > 0) await client.expire(id, ttl);
        }
        // Add to index list (simple JSON array, works with raw redis npm pkg)
        const indexRaw = await client.get('pastes:list');
        const index = indexRaw ? JSON.parse(indexRaw) : [];
        if (!index.includes(id)) {
          index.push(id);
          await client.set('pastes:list', JSON.stringify(index));
        }
      } catch {}
    }

    const baseUrl = 'https://dubuhub.vercel.app';

    return res.status(201).json({
      success: true,
      id,
      rawUrl: `${baseUrl}/${id}`,
      loadstring: `loadstring(game:HttpGet("${baseUrl}/${id}"))()`,
      contentLength: content.length,
      expiresAt,
      storage: isUsingKV ? 'persistent' : 'memory',
      manageUrl: `${baseUrl}/manage?id=${id}`,
    });
  }

  // ==================== GET - List or Retrieve ====================
  if (req.method === 'GET') {
    // --- DEBUG: diagnostic endpoint ---
    if (req.query.diag === 'true') {
      const diag = { isUsingKV, redisUrl: process.env.STORAGE_REDIS_URL ? 'SET' : 'MISSING' };
      if (isUsingKV) {
        try {
          const idx = await client.get('pastes:list');
          diag.indexRaw = idx ? 'exists (' + idx.length + ' chars)' : 'EMPTY';
          diag.indexParsed = idx ? JSON.parse(idx) : [];
          // Try SCAN
          let cursor = 0, scannedKeys = [];
          do {
            const r = await client.scan(cursor, { MATCH: '*', COUNT: 50 });
            cursor = r.cursor;
            scannedKeys = scannedKeys.concat(r.keys);
          } while (cursor !== 0);
          diag.scanCount = scannedKeys.length;
          diag.scanKeys = scannedKeys.filter(k => k !== 'pastes:list');
          // Try to read first paste
          if (diag.scanKeys.length > 0) {
            const raw = await client.get(diag.scanKeys[0]);
            diag.firstPasteRaw = raw ? raw.substring(0, 200) : 'NULL';
          }
        } catch(e) { diag.error = e.message; }
      }
      return res.status(200).json(diag);
    }

    // --- LIST all pastes ---
    if (req.query.list === '' || req.query.list === 'true') {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const search = req.query.search || '';

      let pasteList = [];

      if (isUsingKV) {
        try {
          // Get paste list from Redis (simple JSON array)
          const indexRaw = await client.get('pastes:list');
          let allIds = indexRaw ? JSON.parse(indexRaw) : [];

          // Always scan to find any missing pastes (index update may have quietly failed)
          try {
            let cursor = 0;
            const scanned = [];
            do {
              const result = await client.scan(cursor, { MATCH: '*', COUNT: 100 });
              cursor = result.cursor;
              for (const k of result.keys) {
                if (k !== 'pastes:list' && !allIds.includes(k)) scanned.push(k);
              }
            } while (cursor !== 0);
            // Merge scanned IDs into index and save back
            if (scanned.length > 0) {
              allIds = allIds.concat(scanned);
              await client.set('pastes:list', JSON.stringify(allIds));
            }
          } catch {}

          // Reverse so newest first
          const ids = allIds.reverse();
          const total = ids.length;

          const start = (page - 1) * limit;
          const end = start + limit;
          const pageIds = ids.slice(start, end);

          for (const pid of pageIds) {
            try {
              const raw = await client.get(pid);
              if (raw) {
                const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (search && !data.id.includes(search) && !data.content.includes(search)) continue;
                pasteList.push({
                  id: data.id,
                  createdAt: data.createdAt,
                  expiresAt: data.expiresAt,
                  length: data.length,
                  preview: data.content.substring(0, 100),
                });
              }
            } catch {}
          }

          return res.status(200).json({
            success: true,
            pastes: pasteList,
            total,
            page,
            limit,
            storage: 'persistent',
          });
        } catch (e) {
          // Fallback to memory
        }
      }

      // In-memory fallback
      pasteList = Array.from(store.entries())
        .map(([pid, data]) => ({
          id: data.id || pid,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          length: data.length || (typeof data === 'string' ? data.length : 0),
          preview: (data.content || data || '').substring(0, 100),
        }))
        .filter(p => !search || p.id.includes(search) || (p.preview && p.preview.includes(search)))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      const total = pasteList.length;
      pasteList = pasteList.slice((page - 1) * limit, page * limit);

      return res.status(200).json({
        success: true,
        pastes: pasteList,
        total,
        page,
        limit,
        storage: 'memory',
      });
    }

    // --- GET single paste by ID ---
    const id = req.query.id || req.query.pasteId;
    if (!id) {
      return res.status(200).json({
        name: 'Dubuhub Paste API',
        endpoints: {
          create: 'POST /api/paste  JSON: { "content": "...", "expires": "1d" }',
          get: 'GET /api/paste?id=xxx',
          list: 'GET /api/paste?list=true',
          delete: 'DELETE /api/paste?id=xxx',
          update: 'PATCH /api/paste?id=xxx  JSON: { "expires": "7d" }',
        },
      });
    }

    let pasteData = null;

    // Check KV first (persistent) since serverless instances lose memory
    if (isUsingKV) {
      try {
        const raw = await client.get(id);
        if (raw) {
          pasteData = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
      } catch {}
    }

    // Fallback to in-memory store
    if (!pasteData) {
      pasteData = store.get(id);
    }

    // Expired check
    if (pasteData && pasteData.expiresAt && Date.now() > pasteData.expiresAt) {
      store.delete(id);
      if (isUsingKV) {
        try { await client.del(id); await removeFromIndex(client, id); } catch {}
      }
      pasteData = null;
    }

    if (!pasteData) {
      return res.status(404).send('Paste not found');
    }

    // Allow ?raw=true to bypass browser block (for internal config / admin access)
    const rawBypass = req.query.raw === 'true' || req.query.raw === '1';

    if (!rawBypass) {
      // Block browser access - only allow Roblox executors / non-browser clients
      const ua = (req.headers['user-agent'] || '').toLowerCase();
      const isBrowser =
        ua.includes('mozilla') ||
        ua.includes('chrome') ||
        ua.includes('safari') ||
        ua.includes('firefox') ||
        ua.includes('edge') ||
        ua.includes('opera') ||
        ua.includes('msie') ||
        ua.includes('trident');

      if (isBrowser) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(getBlockPage(id));
      }
    }

    // Return raw content for loadstring (Roblox executors)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(pasteData.content || pasteData);
  }

  // ==================== DELETE - Remove Paste ====================
  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    store.delete(id);

    if (isUsingKV) {
      try {
        await client.del(id);
        await removeFromIndex(client, id);
      } catch {}
    }

    return res.status(200).json({ success: true, message: 'Paste deleted' });
  }

  // ==================== PATCH - Update Paste (content + expiration) ====================
  if (req.method === 'PATCH') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    const expires = req.body?.expires;
    const content = req.body?.content;

    let pasteData = store.get(id);
    if (!pasteData && isUsingKV) {
      try {
        const raw = await client.get(id);
        if (raw) pasteData = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
    }

    if (!pasteData) return res.status(404).json({ error: 'Paste not found' });

    let updated = false;

    // Update content if provided
    if (content !== undefined && content !== null) {
      pasteData.content = content;
      pasteData.length = content.length;
      updated = true;
    }

    // Update expiration if provided
    if (expires !== undefined) {
      if (expires === null || expires === 'never') {
        pasteData.expiresAt = null;
      } else if (typeof expires === 'number') {
        pasteData.expiresAt = expires;
      } else if (typeof expires === 'string') {
        const match = expires.match(/^(\d+)\s*(m|h|d|w)$/);
        if (match) {
          const num = parseInt(match[1]);
          const unit = match[2];
          const multipliers = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
          pasteData.expiresAt = Date.now() + num * (multipliers[unit] || 86400000);
        }
      }
      updated = true;
    }

    if (!updated) return res.status(400).json({ error: 'No updates provided' });

    store.set(id, pasteData);
    if (isUsingKV) {
      try {
        await client.set(id, JSON.stringify(pasteData));
        if (pasteData.expiresAt) {
          const ttl = Math.ceil((pasteData.expiresAt - Date.now()) / 1000);
          if (ttl > 0) await client.expire(id, ttl);
        }
      } catch {}
    }

    return res.status(200).json({
      success: true,
      id,
      expiresAt: pasteData.expiresAt,
      length: pasteData.length,
      message: content !== undefined ? 'Content updated' : (pasteData.expiresAt ? 'Expiration set' : 'No expiration (permanent)'),
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function removeFromIndex(client, id) {
  try {
    const indexRaw = await client.get('pastes:list');
    const index = indexRaw ? JSON.parse(indexRaw) : [];
    const filtered = index.filter(i => i !== id);
    await client.set('pastes:list', JSON.stringify(filtered));
  } catch {}
}

function getBlockPage(id) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dubuhub - Not Accessible</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 576 512%22%3E%3Cpath d=%22M320 192l17.1 0c22.1 38.3 63.5 64 110.9 64c11 0 21.8-1.4 32-4l0 4 0 32 0 192c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-140.8L280 448l56 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-144 0c-53 0-96-43-96-96l0-223.5c0-16.1-12-29.8-28-31.8l-7.9-1c-17.5-2.2-30-18.2-27.8-35.7s18.2-30 35.7-27.8l7.9 1c48 6 84.1 46.8 84.1 95.3l0 85.3c34.4-51.7 93.2-85.8 160-85.8zm160 26.5s0 0 0 0c-10 3.5-20.8 5.5-32 5.5c-28.4 0-54-12.4-71.6-32c0 0 0 0 0 0c-3.7-4.1-7-8.5-9.9-13.2C357.3 164 352 146.6 352 128c0 0 0 0 0 0l0-96 0-20 0-1.3C352 4.8 356.7 .1 362.6 0l.2 0c3.3 0 6.4 1.6 8.4 4.2c0 0 0 0 0 .1L384 21.3l27.2 36.3L416 64l64 0 4.8-6.4L512 21.3 524.8 4.3c0 0 0 0 0-.1c2-2.6 5.1-4.2 8.4-4.2l.2 0C539.3 .1 544 4.8 544 10.7l0 1.3 0 20 0 96c0 17.3-4.6 33.6-12.6 47.6c-11.3 19.8-29.6 35.2-51.4 42.9zM432 128a16 16 0 1 0 -32 0 16 16 0 1 0 32 0zm48 16a16 16 0 1 0 0-32 16 16 0 1 0 0 32z%22 fill=%22%23ff69b4%22/%3E%3C/svg%3E">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}
.bg-grid{position:fixed;top:0;left:0;width:100%;height:100%;background-image:linear-gradient(rgba(255,20,147,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,20,147,0.03) 1px,transparent 1px);background-size:60px 60px;z-index:0;pointer-events:none}
.bg-glow{position:fixed;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(ellipse at 30% 20%,rgba(255,20,147,0.12) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(255,105,180,0.08) 0%,transparent 50%),radial-gradient(ellipse at 50% 50%,rgba(255,20,147,0.04) 0%,transparent 70%);z-index:0;pointer-events:none;animation:pulseGlow 8s ease-in-out infinite alternate}
@keyframes pulseGlow{0%{transform:scale(1) rotate(0deg);opacity:.6}100%{transform:scale(1.2) rotate(5deg);opacity:1}}
.container{position:relative;z-index:1;text-align:center;padding:20px;max-width:600px;margin:0 auto}
.lock-icon{font-size:4rem;color:#ff69b4;margin-bottom:20px;opacity:.8}
h1{font-size:2.5rem;font-weight:900;margin-bottom:12px}
h1 .gradient{background:linear-gradient(135deg,#ff1493,#ff69b4,#ff1493);background-size:200% 200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 4s ease-in-out infinite}
@keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
p{color:#888;font-size:1.05rem;line-height:1.6;margin-bottom:24px}
.card{background:linear-gradient(135deg,rgba(255,20,147,0.08),rgba(255,105,180,0.04));border:1px solid rgba(255,20,147,0.2);border-radius:16px;padding:24px;backdrop-filter:blur(10px);position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle,rgba(255,20,147,0.05) 0%,transparent 60%);animation:rotateGlow 10s linear infinite}
@keyframes rotateGlow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.card .label{font-size:.75rem;text-transform:uppercase;letter-spacing:2px;color:#ff69b4;margin-bottom:10px;font-weight:700;position:relative;z-index:1}
.code-block{display:flex;align-items:center;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 18px;position:relative;z-index:1;gap:12px}
.code-block code{flex:1;color:#ff69b4;font-family:'Courier New',monospace;font-size:.85rem;word-break:break-all;white-space:pre-wrap;text-align:left}
.copy-btn{background:rgba(255,20,147,0.15);border:1px solid rgba(255,20,147,0.3);color:#ff69b4;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:600;transition:all .3s;white-space:nowrap;flex-shrink:0}
.copy-btn:hover{background:rgba(255,20,147,0.3);box-shadow:0 0 20px rgba(255,20,147,0.2)}
.visit-link{display:inline-block;margin-top:20px;color:#555;font-size:.85rem;text-decoration:none;transition:color .3s}
.visit-link:hover{color:#ff69b4}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(255,20,147,0.3);color:#ff69b4;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;display:none;z-index:100;backdrop-filter:blur(10px)}
.toast.show{display:block}
@media(max-width:500px){h1{font-size:1.8rem}.code-block{flex-direction:column;gap:10px}.code-block .copy-btn{margin-left:0;width:100%;text-align:center}}
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="bg-glow"></div>
<div class="container">
<div class="lock-icon"><i class="fas fa-shield-halved"></i></div>
<h1>Not <span class="gradient">Accessible</span></h1>
<p>This paste cannot be viewed in a browser.<br>Use a Roblox executor to access the content.</p>
<div class="card">
<div class="label">Loadstring</div>
<div class="code-block">
<code>loadstring(game:HttpGet("https://dubuhub.vercel.app/${id}"))()</code>
<button class="copy-btn" onclick="copyLoadstring()">Copy</button>
</div>
</div>
<a class="visit-link" href="https://dubuhub.vercel.app">&larr; Visit Dubuhub</a>
</div>
<div class="toast" id="toast"></div>
<script>
async function copyLoadstring(){const t='loadstring(game:HttpGet("https://dubuhub.vercel.app/${id}"))()';try{await navigator.clipboard.writeText(t);showToast("Copied!")}catch{const e=document.createElement("textarea");e.value=t;e.style.position="fixed";e.style.opacity="0";document.body.appendChild(e);e.select();document.execCommand("copy");e.remove();showToast("Copied!")}}
function showToast(m){const e=document.getElementById("toast");e.textContent=m;e.className="toast show";setTimeout(function(){e.classList.remove("show")},2500)}
</script>
</body>
</html>`;
}
