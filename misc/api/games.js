// Dubuhub Games Config API
// Saves/loads the full games database using the paste API's KV store
//   GET  /api/games         → get all games data
//   POST /api/games         → save all games data  JSON: { [key]: {...}, ... }

const GAMES_ID = '_dubuhub_games_config_';
const BASE = 'https://dubuhub.vercel.app';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET - load games data
  if (req.method === 'GET') {
    try {
      const pasteRes = await fetch(`${BASE}/api/paste?id=${GAMES_ID}`);
      if (pasteRes.ok) {
        const text = await pasteRes.text();
        try {
          const data = JSON.parse(text);
          if (typeof data === 'object' && data !== null) {
            return res.status(200).json(data);
          }
        } catch {}
      }
    } catch {}
    return res.status(200).json({});
  }

  // POST - save games data
  if (req.method === 'POST') {
    const gamesData = req.body;
    if (!gamesData || typeof gamesData !== 'object') {
      return res.status(400).json({ error: 'Invalid games data' });
    }

    // Try to create the paste (will fail if already exists)
    try {
      const createRes = await fetch(`${BASE}/api/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: GAMES_ID,
          content: JSON.stringify(gamesData)
        })
      });
      if (createRes.ok || createRes.status === 201) {
        return res.status(200).json({ success: true, count: Object.keys(gamesData).length });
      }
    } catch {}

    // If create failed, delete and recreate
    try {
      await fetch(`${BASE}/api/paste?id=${GAMES_ID}`, { method: 'DELETE' });
      const createRes = await fetch(`${BASE}/api/paste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: GAMES_ID,
          content: JSON.stringify(gamesData)
        })
      });
      if (createRes.ok || createRes.status === 201) {
        return res.status(200).json({ success: true, count: Object.keys(gamesData).length });
      }
    } catch {}

    return res.status(500).json({ error: 'Failed to save games data' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
