// Pastefy-style raw text hosting for Vercel
//   POST /api/paste  → create paste, returns { id, rawUrl, loadstring }
//   GET  /[id]       → raw text (via vercel.json rewrite)
//   GET  /api/paste  → API info
// 
// ⚠️ In-memory storage (resets on cold start)
// For persistance, use Vercel KV
const store = new Map();

export const config = {
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

export default async function handler(req, res) {
  // CORS
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

    const host = process.env.VERCEL_URL || req.headers.host || 'localhost:3000';
    const baseUrl = `https://${host}`;

    return res.status(201).json({
      success: true,
      id,
      rawUrl: `${baseUrl}/${id}`,
      loadstring: `loadstring(game:HttpGet("${baseUrl}/${id}"))()`,
      contentLength: content.length
    });
  }

  // GET - Retrieve paste by ID from query param
  // (URL rewrites in vercel.json also route /[id] here)
  if (req.method === 'GET') {
    const id = req.query.id || req.query.pasteId;

    if (!id) {
      return res.status(200).json({
        name: 'Dubuhub Paste API',
        usage: {
          create: 'POST /api/paste  JSON: { "content": "..." }',
          get: 'GET /[id]  (e.g. https://dubuhub.vercel.app/abc123)'
        }
      });
    }

    const content = store.get(id);
    if (!content) {
      return res.status(404).send('Paste not found');
    }

    // Return as raw text for loadstring
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

