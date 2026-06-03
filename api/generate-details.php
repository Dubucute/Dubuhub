<?php
// DubuHub - AI Details Generator
// Uses DeepSeek AI to parse game descriptions into tabs + features
//
// POST /api/generate-details
// Body: { "text": "BBQ Automation (Main Tab)\nAuto Cook..." }
//
// Returns JSON: { "tabs": [{"name": "Main Tab", "feats": ["Auto Cook", "Auto Plate", ...]}, ...] }

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$text = trim($input['text'] ?? '');

if (empty($text)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing text']);
    exit;
}

$DEEPSEEK_KEY = 'sk-ec8ae5dda82043858525ae9f6216798f';

$prompt = <<<PROMPT
Parse the following game script description into tabs and features. 

Rules:
- Each **bold heading** (like "BBQ Automation") is a tab name. If there's no explicit heading, use "Main Tab".
- Under each heading, each bullet point or paragraph starter (like "Auto Cook (Perfect)", "Auto Plate") is a feature.
- Features should be concise (max 15 words) but descriptive.
- Return ONLY valid JSON in this exact format, no other text:
{
  "tabs": [
    {
      "name": "Tab Name",
      "feats": ["Feature 1 description", "Feature 2 description"]
    }
  ]
}

Here is the description to parse:

{$text}
PROMPT;

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.deepseek.com/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $DEEPSEEK_KEY
]);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'model' => 'deepseek-chat',
    'messages' => [
        ['role' => 'system', 'content' => 'You are a JSON-only response bot. You always respond with valid JSON and nothing else.'],
        ['role' => 'user', 'content' => $prompt]
    ],
    'max_tokens' => 2000,
    'temperature' => 0.3
]));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($httpCode !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'AI service failed', 'tabs' => fallbackParse($text)]);
    exit;
}

$json = json_decode($response, true);
$content = $json['choices'][0]['message']['content'] ?? '';

// Try to extract JSON from the response
$result = json_decode($content, true);
if (!$result || !isset($result['tabs'])) {
    // Try to find JSON in the response
    preg_match('/\{.*"tabs".*\}/s', $content, $matches);
    if ($matches) {
        $result = json_decode($matches[0], true);
    }
}

if (!$result || !isset($result['tabs']) || !count($result['tabs'])) {
    $result = fallbackParse($text);
}

echo json_encode($result, JSON_PRETTY_PRINT);

// --- Fallback parser if AI fails ---
function fallbackParse($text) {
    $lines = explode("\n", $text);
    $tabs = [];
    $currentTab = null;
    $currentFeats = [];
    
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;
        
        // Check if line looks like a heading (ends with ":" or is in parentheses with "Tab")
        if (preg_match('/^[A-Z][A-Za-z\s]+(Tab|:)/', $line)) {
            if ($currentTab !== null) {
                $tabs[] = ['name' => $currentTab, 'feats' => $currentFeats];
            }
            $currentTab = trim(preg_replace('/[\(:].*$/', '', $line));
            $currentFeats = [];
        } else {
            // It's a feature line
            $line = preg_replace('/^[-*•]\s*/', '', $line);
            if ($currentTab === null) $currentTab = 'Main Tab';
            if (strlen($line) > 5) $currentFeats[] = $line;
        }
    }
    
    if ($currentTab !== null) {
        $tabs[] = ['name' => $currentTab, 'feats' => $currentFeats];
    }
    
    if (!count($tabs)) {
        $tabs[] = ['name' => 'Main Tab', 'feats' => ['Feature coming soon']];
    }
    
    return ['tabs' => $tabs];
}
