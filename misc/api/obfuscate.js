// Lua Obfuscator - Dubuhub - Lightweight
// POST /api/obfuscate  JSON: { "code": "..." }

export const config = { api: { bodyParser: { sizeLimit: "5mb" } } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let code = "";
  try {
    if (req.headers["content-type"]?.includes("application/json"))
      code = req.body?.code || req.body?.content || "";
    else code = typeof req.body === "string" ? req.body : "";
  } catch (e) { code = ""; }

  if (!code || code.trim().length === 0)
    return res.status(400).json({ error: "Code is required" });

  try {
    const obfuscated = obfuscateLua(code);
    return res.status(200).json({ success: true, obfuscated, originalLength: code.length, obfuscatedLength: obfuscated.length });
  } catch (err) {
    return res.status(500).json({ error: "Obfuscation failed: " + err.message });
  }
}

function rn() {
  const c = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 5 + Math.floor(Math.random() * 6); i++)
    s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function obfuscateLua(src) {
  let enc = "";
  for (let i = 0; i < src.length; i++)
    enc += "\\" + src.charCodeAt(i).toString().padStart(3, "0");

  const nc = 2 + Math.floor(Math.random() * 3);
  const cs = Math.ceil(enc.length / nc);
  const ch = [];
  for (let i = 0; i < enc.length; i += cs) ch.push('"' + enc.slice(i, i + cs) + '"');

  // Generate all variable names upfront so they match
  const tbl = rn();
  const concat = rn();
  const slen = rn();
  const schar = rn();
  const result = rn();
  const idx = rn();
  const chunk = rn();
  const chLen = rn();
  const parts = rn();
  const pos = rn();
  const scan = rn();
  const seg = rn();
  const tn = rn();

  return [
    "-- obfuscated by dubuhub.vercel.app",
    "local " + tbl + "={" + ch.join(",") + "}",
    "local " + concat + "=table.concat",
    "local " + slen + "=string.len",
    "local " + schar + "=string.char",
    "local " + result + "={}",
    "for " + idx + "=1,#" + tbl + " do",
    "local " + chunk + "=" + tbl + "[" + idx + "]",
    "local " + chLen + "=" + slen + "(" + chunk + ")",
    "local " + parts + "={}",
    "local " + pos + "=1",
    "local " + scan + "=1",
    "while " + scan + "<=" + chLen + " do",
    "local " + seg + "=string.sub(" + chunk + "," + scan + "," + scan + "+2)",
    "local " + tn + "=tonumber(" + seg + ")",
    "if " + tn + " then",
    parts + "[" + pos + "]=" + schar + "(" + tn + ")",
    pos + "=" + pos + "+1",
    "end",
    scan + "=" + scan + "+3",
    "end",
    result + "[" + idx + "]=" + concat + "(" + parts + ")",
    "end",
    "loadstring(" + concat + "(" + result + "))()",
  ].join("\n");
}
