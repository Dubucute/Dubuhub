// Dubuhub Loader
// GET /loader.lua → returns the main loader script
// This redirects to the external script source

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const loader = `-- Dubuhub Loader v1.0
-- https://dubuhub.vercel.app
-- 
-- Supported Games:
--   • Dive Down
--   • Escape Guards to steal Brainrot
--   • Be a YouTuber
--   • Grow a Crypto Farm
--   • Survive Lava for Brainrots
--   • Reel a Brainrots
--   • Street Life Remastered
--   • Cut Grass for Brainrots
--   • Get Strong for Brainrots
--   • BBQ It
--   • My Gaming Cafe!
-- 
-- Most Popular: Street Life Remastered, BBQ It, Dive Down

loadstring(game:HttpGet("https://api.jnkie.com/api/v1/luascripts/public/a9ab3f57274bb8f7e41ebbb71507f1e91cdcc0e5138eccc7b6405ed25decdb50/download"))()
`;

  return res.status(200).send(loader);
}
