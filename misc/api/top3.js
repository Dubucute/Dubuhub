// Dubuhub Top3 Config API
// Saves/loads the top 3 game keys using the paste API's KV store
//   GET  /api/top3          → get top3 config
//   POST /api/top3          → save top3 config  JSON: { "top3": ["key1","key2","key3"] }

const TOP3_ID = '_dubuhub_top3_config_';
const BASE = 'https://dubuhub.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - load top3 config
  if (req.method === 'GET') {
    try {
      const pasteRes = await fetch(`${BASE}/api/paste?id=${TOP3_ID}`);
      if (pasteRes.ok) {
        const text = await pasteRes.text();
        try {
          const data = JSON.parse(text);
          if (data.top3 && Array.isArray(data.top3) && data.top3.length === 3) {
            return res.status(200).json({ top3: data.top3, stored: true });
          }
        } catch {}
      }
    } catch {}
    return res.status(200).json({ top3: ['', '', ''], stored: false });
  }

  // POST - save top3 config
  if (req.method === 'POST') {
    const top3 = req.body?.top3;
    if (!top3 || !Array.isArray(top3) || top3.length !== 3) {
      return res.status(400).json({ error: 'top3 must be an array of 3 keys' });
    }

    // Try to create the paste (will fail if already exists)
    try {
      const createRes = await fetch(`${BASE}/api/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: TOP3_ID,
          content: JSON.stringify({ top3 })
        })
      });
      if (createRes.ok || createRes.status === 201) {
        return res.status(200).json({ success: true, top3 });
      }
    } catch {}

    // If create failed (e.g. already exists), try to update by re-creating
    // First delete the old one, then create anew
    try {
      await fetch(`${BASE}/api/paste?id=${TOP3_ID}`, { method: 'DELETE' });
      const createRes = await fetch(`${BASE}/api/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: TOP3_ID,
          content: JSON.stringify({ top3 })
        })
      });
      if (createRes.ok || createRes.status === 201) {
        return res.status(200).json({ success: true, top3 });
      }
    } catch {}

    return res.status(500).json({ error: 'Failed to save top3 config' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
