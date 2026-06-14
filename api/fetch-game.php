<?php
// DubuHub - Fetch Game Info API
// Uses Roblox public APIs + DeepSeek AI for short description generation
//
// GET /api/fetch-game?id=PLACE_ID
//
// Returns JSON with: name, gameId, universeId, thumbUrl, description, creator, shortDesc

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$placeId = isset($_GET['id']) ? trim($_GET['id']) : '';

if (empty($placeId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing game ID. Usage: ?id=PLACE_ID']);
    exit;
}

if (!ctype_digit($placeId)) {
    http_response_code(400);
    echo json_encode(['error' => 'Game ID must be numeric']);
    exit;
}

// DeepSeek API key
$DEEPSEEK_KEY = 'sk-a098635ac7fb493b8bd3afed2626dbd7';

// --- Helper ---
function fetchUrl($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'DubuHub/1.0');
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    
    if ($error) return null;
    return json_decode($response, true);
}

// --- Helper: Generate short description using DeepSeek ---
function generateShortDesc($gameName, $description) {
    global $DEEPSEEK_KEY;
    
    // Use the game's own description if it's short enough
    $cleanDesc = trim(preg_replace('/\s+/', ' ', $description));
    if (strlen($cleanDesc) > 10 && strlen($cleanDesc) < 80) {
        return $cleanDesc;
    }
    
    $fullDesc = trim(preg_replace('/\s+/', ' ', $description));
    $prompt = "Summarize this Roblox game description into a short catchy one-liner (max 10 words): \"{$fullDesc}\". Only respond with the summary, nothing else.";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.deepseek.com/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $DEEPSEEK_KEY
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'model' => 'deepseek-chat',
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ],
        'max_tokens' => 30,
        'temperature' => 0.7
    ]));
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($httpCode === 200) {
        $json = json_decode($response, true);
        if ($json && isset($json['choices'][0]['message']['content'])) {
            $shortDesc = trim($json['choices'][0]['message']['content']);
            $shortDesc = preg_replace('/^["\']|["\']$/', '', $shortDesc);
            $shortDesc = preg_replace('/\s+/', ' ', $shortDesc);
            if (strlen($shortDesc) > 5 && strlen($shortDesc) < 100) {
                return $shortDesc;
            }
        }
    }
    
    // Fallback: truncate game description
    return generateFallbackDesc($description);
}

// --- Helper: Fallback - truncate game description to short form ---
function generateFallbackDesc($description) {
    $clean = trim(preg_replace('/\s+/', ' ', $description));
    if (strlen($clean) > 5) {
        if (strlen($clean) > 60) $clean = substr($clean, 0, 57) . '...';
        return $clean;
    }
    return 'Play this game now';
}

// --- Step 1: Get Universe ID from Place ID ---
$universeId = null;

$uniData = fetchUrl("https://apis.roblox.com/universes/v1/places/{$placeId}/universe");
if ($uniData && isset($uniData['universeId'])) {
    $universeId = $uniData['universeId'];
}

if (!$universeId) {
    http_response_code(404);
    echo json_encode(['error' => 'Could not find universe for this Game ID', 'placeId' => $placeId]);
    exit;
}

// --- Step 2: Get Game Details ---
$gameName = 'Unknown Game';
$description = '';
$creator = '';
$created = '';

$gameData = fetchUrl("https://games.roblox.com/v1/games?universeIds={$universeId}");
if ($gameData && isset($gameData['data'][0])) {
    $game = $gameData['data'][0];
    $gameName = $game['name'] ?? 'Unknown Game';
    $description = $game['description'] ?? '';
    $creator = $game['creator']['name'] ?? '';
    $created = $game['created'] ?? '';
}

// --- Step 3: Get Thumbnail ---
$thumbUrl = '';

$thumbData = fetchUrl("https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds={$universeId}&size=768x432&format=Webp&isCircular=false");
if ($thumbData && isset($thumbData['data'][0]['thumbnails'][0]['imageUrl'])) {
    $thumbUrl = $thumbData['data'][0]['thumbnails'][0]['imageUrl'];
}

// Fallback: place icon
if (empty($thumbUrl)) {
    $iconData = fetchUrl("https://thumbnails.roblox.com/v1/places/gameicons?placeIds={$placeId}&size=512x512&format=Png&isCircular=false");
    if ($iconData && isset($iconData['data'][0]['imageUrl'])) {
        $thumbUrl = $iconData['data'][0]['imageUrl'];
    }
}

// --- Step 4: Generate Short Description using AI ---
$shortDesc = generateShortDesc($gameName, $description);

// --- Response ---
echo json_encode([
    'name' => $gameName,
    'gameId' => $placeId,
    'universeId' => $universeId,
    'thumbUrl' => $thumbUrl,
    'description' => $description,
    'shortDesc' => $shortDesc,
    'creator' => $creator,
    'created' => $created
], JSON_PRETTY_PRINT);
