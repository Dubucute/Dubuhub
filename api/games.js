// DubuHub Games Database
// This file is shared between index.html and admin.html

// Returns a promise that resolves to the games object
async function loadGamesData() {
  var games = {};

  try {
    var res = await fetch('api/games.json');
    if (res.ok) {
      var json = await res.json();
      games = json;
    }
  } catch(e) {}

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
  try {
    var res = await fetch('api/top3.json');
    if (res.ok) {
      var json = await res.json();
      if (json.top3 && Array.isArray(json.top3)) return json.top3;
      return json;
    }
  } catch(e) {}
  // fallback: check localStorage (set by admin)
  try {
    var saved = localStorage.getItem('dubuhub_top3');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return ['', '', ''];
}
