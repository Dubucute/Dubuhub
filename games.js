// DubuHub Games Database
// This file is shared between index.html and admin.html

// Returns a promise that resolves to the games object
async function loadGamesData() {
  var games = {};

  // Try the API first (persistent server-side storage)
  try {
    var res = await fetch('/api/games');
    if (res.ok) {
      var json = await res.json();
      if (typeof json === 'object' && Object.keys(json).length > 0) {
        games = json;
      }
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

// Load top3.json - returns array of 3 keys (or empty)
async function loadTop3Data() {
  // Try the API first (persistent server-side storage)
  try {
    var res = await fetch('/api/top3');
    if (res.ok) {
      var json = await res.json();
      if (json.top3 && Array.isArray(json.top3)) return json.top3;
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
