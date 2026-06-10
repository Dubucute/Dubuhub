// DubuHub Games Database
// This file is shared between index.html and admin.html

// Special IDs used in the paste API for persistent storage
var GAMES_PASTE_ID = '_dubuhub_games_config_';
var TOP3_PASTE_ID = '_dubuhub_top3_config_';

// Returns a promise that resolves to the games object
async function loadGamesData() {
  var games = {};

  // Try the paste API first (persistent server-side storage - synced across all users)
  try {
    var res = await fetch('/api/paste?id=' + GAMES_PASTE_ID + '&raw=true');
    if (res.ok) {
      var text = await res.text();
      try {
        var parsed = JSON.parse(text);
        if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          games = parsed;
        }
      } catch(e) {}
    }
  } catch(e) {}

  // Fallback to static file
  if (Object.keys(games).length === 0) {
    try {
      var res = await fetch('/admin/games.json');
      if (res.ok) {
        var json = await res.json();
        games = json;
      }
    } catch(e) {}
  }

  // Merge any localStorage overrides on top
  try {
    var saved = localStorage.getItem('dubuhub_games');
    if (saved) {
      var parsed = JSON.parse(saved);
      for (var k in parsed) {
        games[k] = parsed[k];
      }
    }
  } catch(e) {}

  return games;
}

// Load top3 - returns array of 3 keys (or empty)
async function loadTop3Data() {
  // Try the paste API first (persistent server-side storage - synced across all users)
  try {
    var res = await fetch('/api/paste?id=' + TOP3_PASTE_ID + '&raw=true');
    if (res.ok) {
      var text = await res.text();
      try {
        var data = JSON.parse(text);
        if (data.top3 && Array.isArray(data.top3)) return data.top3;
      } catch(e) {}
    }
  } catch(e) {}
  // Fallback to static file
  try {
    var res = await fetch('/admin/top3.json');
    if (res.ok) {
      var json = await res.json();
      if (json.top3 && Array.isArray(json.top3)) return json.top3;
      return json;
    }
  } catch(e) {}
  // Last fallback: check localStorage (set by admin)
  try {
    var saved = localStorage.getItem('dubuhub_top3');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return ['', '', ''];
}
