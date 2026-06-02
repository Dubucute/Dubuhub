// Lua Obfuscator - Dubuhub
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
    if (req.headers["content-type"]?.includes("application/json")) {
      code = req.body?.code || req.body?.content || "";
    } else {
      code = req.body || "";
    }
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

function r(l) {
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "_";
  for (let i = 0; i < l; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

function obfuscateLua(src) {
  // Encode as \xxx\xxx\xxx... with 3-digit decimals
  let enc = "";
  for (let i = 0; i < src.length; i++)
    enc += "\\" + src.charCodeAt(i).toString().padStart(3, "0");

  // Split into random chunks
  const nc = 3 + Math.floor(Math.random() * 4);
  const cs = Math.ceil(enc.length / nc);
  const ch = [];
  for (let i = 0; i < enc.length; i += cs) ch.push(enc.slice(i, i + cs));

  // Variable names (all unique)
  const T = r(10);     // table holding chunks
  const A = r(8);      // for loop index 1
  const B = r(8);      // for loop index 2
  const G = r(10);     // getter function
  const C = r(9);      // table.concat
  const L = r(7);      // string.len
  const H = r(7);      // string.char
  const R = r(8);      // result table
  const I = r(5);      // chunk index
  const K = r(6);      // current chunk string
  const N = r(5);      // length of chunk
  const P = r(6);      // parts table
  const Q = r(5);      // position in parts
  const S = r(6);      // scan position
  const U = r(6);      // 3-char segment
  const V = r(6);      // tonumber value

  // Shuffle pairs
  const pairs = [];
  for (let i = 0; i < 4 + Math.floor(Math.random() * 6); i++) {
    const a = 1 + Math.floor(Math.random() * ch.length);
    let b = 1 + Math.floor(Math.random() * ch.length);
    while (b === a) b = 1 + Math.floor(Math.random() * ch.length);
    pairs.push("{" + a + "," + b + "}");
  }

  return [
    '--[[ v1.0.0 https://dubuhub.vercel.app/obfuscator ]]',
    "return(function(...)local " + T + "={" + ch.map(c => '"' + c + '"').join(";") + "}",
    "for " + A + "," + B + " in ipairs({" + pairs.join(",") + "}) do",
    "while " + B + "[1]<" + B + "[2] do",
    T + "[" + A + "]," + T + "[" + B + "]," + A + "," + B + "=" + T + "[" + B + "]," + T + "[" + A + "]," + A + "+1," + B + "-1",
    "end end end",
    "local function " + G + "(" + A + ")return " + T + "[" + A + "]end",
    "local " + C + "=table.concat",
    "local " + L + "=string.len",
    "local " + H + "=string.char",
    "local " + R + "={}",
    "for " + I + "=1,#" + T + " do",
    "local " + K + "=" + T + "[" + I + "]",
    "local " + N + "=" + L + "(" + K + ")",
    "local " + P + "={}",
    "local " + Q + "=1",
    "local " + S + "=1",
    "while " + S + "<=" + N + " do",
    "local " + U + "=string.sub(" + K + "," + S + "," + S + "+2)",
    "local " + V + "=tonumber(" + U + ")",
    "if " + V + " then",
    P + "[" + Q + "]=" + H + "(" + V + ")",
    Q + "=" + Q + "+1",
    "end",
    S + "=" + S + "+3",
    "end",
    R + "[" + I + "]=" + C + "(" + P + ")",
    "end",
    "return loadstring(" + C + "(" + R + "))()",
    "end)(...)",
  ].join("\n");
}
