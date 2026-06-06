// Dubuhub Loader
// GET /loader.lua → returns the main loader script
// Blocks browser access - only works in Roblox executors

export default async function handler(req, res) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  
  // Check if it's a Roblox executor (likely not a standard browser)
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
    // Serve a block page for browsers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dubu Hub - Loader</title>
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
.lock-icon i{filter:drop-shadow(0 0 20px rgba(255,20,147,0.4))}
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
<p>The loader script cannot be used in a browser.<br>Use a Roblox executor to run the loadstring.</p>
<div class="card">
<div class="label">Dubu Hub Loadstring</div>
<div class="code-block">
<code>loadstring(game:HttpGet("https://dubuhub.vercel.app/loader.lua"))()</code>
<button class="copy-btn" onclick="copyLoadstring()">Copy</button>
</div>
</div>
<a class="visit-link" href="https://dubuhub.vercel.app">← Visit Dubu Hub</a>
</div>
<div class="toast" id="toast"></div>
<script>
async function copyLoadstring() {
const text = 'loadstring(game:HttpGet("https://dubuhub.vercel.app/loader.lua"))()';
try { await navigator.clipboard.writeText(text); showToast("Copyied!"); }
catch { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); showToast("Copyied!"); }
}
function showToast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.className = "toast show"; setTimeout(function(){t.classList.remove("show")},2500); }
</script>
</body>
</html>`);
  }

  // For Roblox executors - serve the actual Lua loader
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const loader = `-- Dubuhub Loader v1.0
loadstring(game:HttpGet("https://api.jnkie.com/api/v1/luascripts/public/a9ab3f57274bb8f7e41ebbb71507f1e91cdcc0e5138eccc7b6405ed25decdb50/download"))()
`;

  return res.status(200).send(loader);
}
