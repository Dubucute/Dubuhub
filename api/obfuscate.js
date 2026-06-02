// Lua Obfuscator API for Dubuhub
// POST /api/obfuscate  JSON: { "code": "..." }
// Returns: { "success": true, "obfuscated": "...", "originalLength": N, "obfuscatedLength": N }

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
  },
};

const ENCRYPTION_KEY = 0x5A;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let code = '';

  try {
    if (req.headers['content-type']?.includes('application/json')) {
      code = req.body?.code || req.body?.content || '';
    } else {
      code = req.body || '';
    }
  } catch (e) {
    code = '';
  }

  if (!code || code.trim().length === 0) {
    return res.status(400).json({ error: 'Code is required' });
  }

  try {
    const obfuscated = obfuscateLua(code);

    return res.status(200).json({
      success: true,
      original: code,
      obfuscated,
      originalLength: code.length,
      obfuscatedLength: obfuscated.length
    });
  } catch (err) {
    return res.status(500).json({ error: 'Obfuscation failed: ' + err.message });
  }
}

// ============================================================
// Lua Obfuscation Engine
// ============================================================

function obfuscateLua(source) {
  // Strip comments first
  let cleaned = source
    .replace(/--\[\[[\s\S]*?\]\]/g, '')
    .replace(/--\[=*\[[\s\S]*?\]=*\]/g, '')
    .replace(/--.*$/gm, '');

  // Generate random variable names
  const varNames = [];
  const usedNames = new Set();
  
  function randomName() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let name;
    do {
      let len = 6 + Math.floor(Math.random() * 4);
      name = '_';
      for (let i = 0; i < len; i++) {
        name += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (usedNames.has(name));
    usedNames.add(name);
    return name;
  }

  // Encode the entire script into a byte array
  const bytes = [];
  for (let i = 0; i < cleaned.length; i++) {
    bytes.push(cleaned.charCodeAt(i));
  }

  // Generate encryption key bytes
  const keyBytes = [];
  for (let i = 0; i < bytes.length; i++) {
    keyBytes.push(Math.floor(Math.random() * 256));
  }

  // XOR encrypt with random key
  const encrypted = [];
  for (let i = 0; i < bytes.length; i++) {
    encrypted.push(bytes[i] ^ keyBytes[i]);
  }

  const keyArr = arrayToString(keyBytes);
  const encryptedArr = arrayToString(encrypted);
  const len = bytes.length;

  // Choose a random decryption method
  const methods = ['basic', 'chunked', 'reverse'];
  const method = methods[Math.floor(Math.random() * methods.length)];

  let decryptFunc;
  switch (method) {
    case 'chunked':
      decryptFunc = generateChunkedDecrypt(encryptedArr, keyArr, len);
      break;
    case 'reverse':
      decryptFunc = generateReverseDecrypt(encryptedArr, keyArr, len);
      break;
    default:
      decryptFunc = generateBasicDecrypt(encryptedArr, keyArr, len);
  }

  // Build final obfuscated output
  const output = `-- Dubuhub Obfuscator v1.0\n-- https://dubuhub.vercel.app/obfuscator\n\n${decryptFunc}\n\n${generateLoader()}`;

  return output;
}

function arrayToString(arr) {
  let result = '{';
  for (let i = 0; i < arr.length; i++) {
    if (i > 0) result += ',';
    result += arr[i].toString();
  }
  result += '}';
  return result;
}

function generateBasicDecrypt(encryptedArr, keyArr, len) {
  const fnName = randomName();
  const eName = randomName();
  const kName = randomName();
  const lName = randomName();
  const resultName = randomName();
  const iName = randomName();

  return `local ${fnName} = function(${eName}, ${kName}, ${lName})
  local ${resultName} = {}
  for ${iName} = 1, ${lName} do
    ${resultName}[${iName}] = string.char(${eName}[${iName}] ~ ${kName}[${iName}])
  end
  return table.concat(${resultName})
end

local ${randomName()} = loadstring(${fnName}(${encryptedArr}, ${keyArr}, ${len}))()`;
}

function generateChunkedDecrypt(encryptedArr, keyArr, len) {
  const fnName = randomName();
  const eName = randomName();
  const kName = randomName();
  const lName = randomName();
  const resultName = randomName();
  const chunkSizeName = randomName();
  const iName = randomName();
  const chunkName = randomName();
  const decodedName = randomName();

  const chunkSize = 50 + Math.floor(Math.random() * 100);

  return `local ${fnName} = function(${eName}, ${kName}, ${lName})
  local ${resultName} = {}
  local ${chunkSizeName} = ${chunkSize}
  local ${decodedName}
  
  for ${iName} = 1, ${lName}, ${chunkSizeName} do
    ${decodedName} = {}
    for ${chunkName} = ${iName}, math.min(${iName} + ${chunkSizeName} - 1, ${lName}) do
      ${decodedName}[#${decodedName} + 1] = string.char(${eName}[${chunkName}] ~ ${kName}[${chunkName}])
    end
    ${resultName}[#${resultName} + 1] = table.concat(${decodedName})
  end
  
  return table.concat(${resultName})
end

local ${randomName()} = loadstring(${fnName}(${encryptedArr}, ${keyArr}, ${len}))()`;
}

function generateReverseDecrypt(encryptedArr, keyArr, len) {
  const fnName = randomName();
  const eName = randomName();
  const kName = randomName();
  const lName = randomName();
  const resultName = randomName();
  const iName = randomName();
  const revKey = randomName();
  const revEnc = randomName();

  // Reverse the arrays for extra obfuscation
  const revEncrypted = JSON.parse(encryptedArr.replace(/{/g, '[').replace(/}/g, ']')).reverse();
  const revKeyArr = JSON.parse(keyArr.replace(/{/g, '[').replace(/}/g, ']')).reverse();
  const revEncStr = arrayToString(revEncrypted);
  const revKeyStr = arrayToString(revKeyArr);

  return `local ${revKey} = ${revKeyStr}
local ${revEnc} = ${revEncStr}

local ${fnName} = function(${eName}, ${kName}, ${lName})
  local ${resultName} = {}
  for ${iName} = ${lName}, 1, -1 do
    ${resultName}[#${resultName} + 1] = string.char(${eName}[${iName}] ~ ${kName}[${iName}])
  end
  return table.concat(${resultName})
end

local ${randomName()} = loadstring(${fnName}(${revEnc}, ${revKey}, ${len}))()`;
}

function generateLoader() {
  const names = [];
  for (let i = 0; i < 5; i++) {
    names.push(randomName());
  }
  
  // Return the loaded chunk or just execute it
  return `if ${names[0]} then
  ${names[1]} = ${names[0]}
  ${names[2]} = ${names[1]}()
  if ${names[2]} then
    ${names[2]}()
  end
end

-- Generated by Dubuhub Obfuscator
-- https://dubuhub.vercel.app/obfuscator`;
}

function randomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let name = '_';
  const len = 6 + Math.floor(Math.random() * 6);
  for (let i = 0; i < len; i++) {
    name += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return name;
}
