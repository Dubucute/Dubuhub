// Dubuhub Paste API - Raw text hosting for loadstring
//   POST /api/paste  → create paste
//   GET  /[id]       → raw text
//
// Storage:
//   - By default: In-memory (resets on cold start)
//   - With Vercel KV (Redis): Data persists permanently
//
// To enable persistent storage:
//   1. Run: vercel kv link
//   2. Run: npm install @vercel/kv
//   3. Redeploy

const store = new Map();
let kv = null;

// Try to load Vercel KV if available
async function getKV() {
  if (kv) return kv;
  if (process.env.KV_URL) {
    try {
      const { createClient } = await import('@vercel/kv');
      kv = createClient({ url: process.env.KV_URL, token: process.env.KV_TOKEN });
      return kv;
    } catch {
      return null;
    }
  }
  return null;
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST - Create paste
  if (req.method === 'POST') {
    let content = '';

    try {
      if (req.headers['content-type']?.includes('application/json')) {
        content = req.body?.content || req.body?.text || '';
      } else {
        content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || '');
      }
    } catch (e) {
      content = '';
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const id = generateId();
    store.set(id, content);

    // Also store in KV if available
    const client = await getKV();
    if (client) {
      try { await client.set(id, content); } catch {}
    }

    const baseUrl = 'https://dubuhub.vercel.app';

    return res.status(201).json({
      success: true,
      id,
      rawUrl: `${baseUrl}/${id}`,
      loadstring: `loadstring(game:HttpGet("${baseUrl}/${id}"))()`,
      contentLength: content.length,
      storage: client ? 'persistent' : 'memory',
    });
  }

  // GET - Retrieve paste by ID
  if (req.method === 'GET') {
    const id = req.query.id || req.query.pasteId;

    if (!id) {
      return res.status(200).json({
        name: 'Dubuhub Paste API',
        endpoints: {
          create: 'POST /api/paste  JSON: { "content": "..." }',
          get: 'GET /[id]  (e.g. https://dubuhub.vercel.app/abc123)',
        },
      });
    }

    let content = store.get(id);

    // Try KV if not in memory
    if (!content) {
      const client = await getKV();
      if (client) {
        try { content = await client.get(id); } catch {}
      }
    }

    if (!content) {
      return res.status(404).send('Paste not found');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(content);
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
