// 📄 Raw Text Paste API for Vercel
// 
// This is a SINGLE serverless function that handles:
//   POST /api/paste  - Create a paste
//   GET  /api/paste?id=xxx - Get raw text (for loadstring)
//   GET  /api/paste   - Show API info
//
// ⚠️ NOTE: Uses in-memory storage (resets on cold starts)
// For persistent storage, replace with Vercel KV, Upstash, Supabase, etc.

const store = new Map();

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // === CORS Headers (essential for loadstring) ===
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // === GET /api/paste?id=xxx → Return raw text ===
  if (req.method === 'GET') {
    const id = req.query.id;
    
    if (!id) {
      return res.status(200).json({
        name: 'Raw Paste API',
        version: '1.0.0',
        endpoints: {
          create: 'POST /api/paste  (send JSON: { "content": "..." } or raw text)',
          retrieve: 'GET /api/paste?id=xxx',
          raw: 'GET /api/paste/raw?id=xxx  (alias)'
        },
        usage: 'loadstring(game:HttpGet("https://your-domain.vercel.app/api/paste?id=xxx"))()'
      });
    }

    const content = store.get(id);
    if (!content) {
      return res.status(404).json({ error: 'Paste not found' });
    }

    // 🔥 Return as pure text/plain for loadstring compatibility
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(content);
  }

  // === POST /api/paste → Create a paste ===
  if (req.method === 'POST') {
    let content = '';

    // Parse content from various input formats
    try {
      if (req.headers['content-type']?.includes('application/json')) {
        content = req.body?.content || req.body?.text || '';
      } else {
        content = req.body || '';
        if (typeof content !== 'string') {
          content = JSON.stringify(content);
        }
      }
    } catch (e) {
      content = '';
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Generate unique ID
    const id = generateId();
    store.set(id, content);

    // Build the URL
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = process.env.VERCEL_URL || req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const rawUrl = `${baseUrl}/api/paste?id=${id}`;

    return res.status(201).json({
      success: true,
      id,
      rawUrl,
      loadstring: `loadstring(game:HttpGet("${rawUrl}"))()`,
      createdAt: new Date().toISOString(),
      contentLength: content.length
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
