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
  if (process.env.KV_URL) {
    try {
      const { createClient } = await import('@vercel/kv');
      kv = createClient({ url: process.env.KV_URL, token: process.env.KV_TOKEN });
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
        // Add to index list
        await client.sadd('pastes:index', id);
        // Store creation time for sorting
        await client.zadd('pastes:bytime', { score: pasteData.createdAt, member: id });
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
    // --- LIST all pastes ---
    if (req.query.list === '' || req.query.list === 'true') {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const search = req.query.search || '';

      let pasteList = [];

      if (isUsingKV) {
        try {
          // Get total count
          const total = await client.zcard('pastes:bytime');
          // Get IDs sorted by creation time (newest first)
          const start = (page - 1) * limit;
          const end = start + limit - 1;
          const ids = await client.zrange('pastes:bytime', -end - 1, -start, { rev: true });

          for (const pid of ids) {
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

    let pasteData = store.get(id);

    if (!pasteData && isUsingKV) {
      try {
        const raw = await client.get(id);
        if (raw) pasteData = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
    }

    // Expired check
    if (pasteData && pasteData.expiresAt && Date.now() > pasteData.expiresAt) {
      store.delete(id);
      if (isUsingKV) {
        try { await client.del(id); await client.srem('pastes:index', id); await client.zrem('pastes:bytime', id); } catch {}
      }
      pasteData = null;
    }

    if (!pasteData) {
      return res.status(404).send('Paste not found');
    }

    // Return raw content for loadstring
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
        await client.srem('pastes:index', id);
        await client.zrem('pastes:bytime', id);
      } catch {}
    }

    return res.status(200).json({ success: true, message: 'Paste deleted' });
  }

  // ==================== PATCH - Update Expiration ====================
  if (req.method === 'PATCH') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    const expires = req.body?.expires;

    let pasteData = store.get(id);
    if (!pasteData && isUsingKV) {
      try {
        const raw = await client.get(id);
        if (raw) pasteData = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {}
    }

    if (!pasteData) return res.status(404).json({ error: 'Paste not found' });

    if (expires === null || expires === 'never') {
      // No expiration
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

    store.set(id, pasteData);
    if (isUsingKV) {
      try {
        await client.set(id, JSON.stringify(pasteData));
        if (pasteData.expiresAt) {
          const ttl = Math.ceil((pasteData.expiresAt - Date.now()) / 1000);
          if (ttl > 0) await client.expire(id, ttl);
        } else {
          await client.persist(id); // Remove TTL
        }
      } catch {}
    }

    return res.status(200).json({
      success: true,
      id,
      expiresAt: pasteData.expiresAt,
      message: pasteData.expiresAt ? 'Expiration set' : 'No expiration (permanent)',
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
