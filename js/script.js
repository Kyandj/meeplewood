// The current filter state. null means "don't filter on this".
// Values can be set here by hand to narrow down which plays are counted, but most of them are filled in
// while the page runs, by the quick filter menu, the stopwatch, the star and the year controls.
// For the list filters a play matches when it has at least one of the listed values. Different filters
// are combined, so a play has to pass the play time and the theme and so on.
const filters = {
  playTimeBuckets: null, // play times to include, e.g. [30, 45]. Values are 15, 30, 45, 60, 90 or "two-hours-plus"
  minComplexity: null,   // BGG weight, from 1 (light) to 5 (heavy)
  maxComplexity: null,
  categories: null,      // themes from the Categories column of the shelf, e.g. ["Fantasy"]
  mechanics: null,       // mechanics from the shelf, e.g. ["Dice Rolling"]
  primaryFamily: null,   // a single family name, e.g. "Strategy Game"
  complexityBins: null,  // Set of fragments picked on the complexity star. A bin is floor(complexity * 2), 0 means unrated
  players: null,         // player ids, e.g. [4, 9]. Keeps plays that at least one of them took part in
  locations: null,       // location ids. Keeps plays that were played at one of these places
  years: null            // Set of years, e.g. new Set([2023, 2024]). Set by the year controls
};

const PLAYTIME_BUCKETS = [15, 30, 45, 60, 90];
const PLAYTIME_TWO_HOURS_PLUS = "two-hours-plus";

function playTimeBucket(minutes) {
  if (minutes >= 120) return PLAYTIME_TWO_HOURS_PLUS;
  return PLAYTIME_BUCKETS.reduce((nearest, bucket) =>
    Math.abs(minutes - bucket) <= Math.abs(minutes - nearest) ? bucket : nearest
  , PLAYTIME_BUCKETS[0]);
}

function playTimeBucketLabel(bucket) {
  if (bucket === PLAYTIME_TWO_HOURS_PLUS) return "2h+";
  if (bucket === 90) return "1½h";
  return bucket + " min";
}

// True if the play's date is in one of the selected years (or no years are selected). "2021-12-28" gives 2021.
function passesYear(play) {
  return !filters.years || filters.years.has(Number(play.playDate.slice(0, 4)));
}

// True if any item of `list` is also in `wanted`, e.g. hasAny(["Dice", "Fantasy"], ["Fantasy"]) is true
function hasAny(list, wanted) {
  for (const item of list) {
    if (wanted.includes(item)) return true;
  }
  return false;
}

// Checks the filters that are about the play itself rather than the game: the location and the players.
function passesPlayFilters(play) {
  if (filters.locations && !filters.locations.includes(play.locationRefId)) return false;

  if (filters.players) {
    const playerIds = play.playerScores.map(score => score.playerRefId);
    if (!hasAny(playerIds, filters.players)) return false;
  }
  return true;
}

// Turns the shelf's play time text into minutes. A range like "30 - 180" becomes its average (105), "25" becomes 25.
function parsePlayTime(value) {
  if (!value) return null;
  const parts = value.split("-").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return (parts[0] + parts[1]) / 2;
  }
  return isNaN(parts[0]) ? null : parts[0];
}

// Splits a comma separated shelf column into a list, e.g. "Dice,Fantasy" becomes ["Dice", "Fantasy"]
function splitList(value) {
  return value ? value.split(",").map(s => s.trim()) : [];
}

// Matches each game to its row on the shelf (both have the BGG id) and keeps only the fields the filters use.
function buildGameMeta(games, shelfRows) {
  const shelfById = new Map();
  for (const row of shelfRows) {
    shelfById.set(row["Game ID"].trim(), row);
  }

  const meta = new Map(); // gameRefId -> parsed shelf data
  for (const game of games) {
    const row = shelfById.get(String(game.bggId));
    if (!row) continue; // not on the shelf, so there is nothing to filter on
    meta.set(game.id, {
      playTime: parsePlayTime(row["Play Time"]),
      complexity: parseFloat(row["Complexity"]),
      categories: splitList(row["Categories"]),
      mechanics: splitList(row["Mechanics"]),
      primaryFamily: splitList(row["Primary Family"])
    });
  }
  return meta;
}

// Maps a complexity to its star fragment: 1.0-1.4 is 2, 1.5-1.9 is 3, ... 5.0 is 10. Unrated (0 or missing) is 0.
function complexityBin(c) {
  if (!(c > 0)) return 0;
  return Math.min(10, Math.max(2, Math.floor(c * 2 + 1e-9)));
}

// Does this game pass every filter that is currently set?
// ignoreStar leaves out the star's own selection (the star needs that to count every fragment).
// ignorePlayTime leaves out the play time filter (the stopwatch needs that to count every play time).
function passesFilters(gameRefId, gameMeta, ignoreStar, ignorePlayTime) {
  const useStar = filters.complexityBins && !ignoreStar;
  const usePlayTime = filters.playTimeBuckets && !ignorePlayTime;
  const active = usePlayTime
    || filters.minComplexity != null || filters.maxComplexity != null
    || filters.categories || filters.mechanics || filters.primaryFamily || useStar;
  if (!active) return true; // no filters are on at all

  const meta = gameMeta.get(gameRefId);
  if (!meta) return false; // no shelf data, so the game can't match

  if (usePlayTime
      && (meta.playTime == null || !filters.playTimeBuckets.includes(playTimeBucket(meta.playTime)))) return false;
  if (filters.minComplexity != null && (isNaN(meta.complexity) || meta.complexity < filters.minComplexity)) return false;
  if (filters.maxComplexity != null && (isNaN(meta.complexity) || meta.complexity > filters.maxComplexity)) return false;
  if (filters.categories && !hasAny(meta.categories, filters.categories)) return false;
  if (filters.mechanics && !hasAny(meta.mechanics, filters.mechanics)) return false;
  if (filters.primaryFamily && !meta.primaryFamily.includes(filters.primaryFamily)) return false;
  if (useStar && !filters.complexityBins.has(complexityBin(meta.complexity))) return false;

  return true;
}

// The four seasons: which months each one covers, plus its card container and svg file
const seasons = [
  { containerId: "#chart-spring", svgFile: "img/spring-rect.svg", label: "Spring",
    months: [{ num: 3, name: "March" }, { num: 4, name: "April" }, { num: 5, name: "May" }] },
  { containerId: "#chart-summer", svgFile: "img/summer-rect.svg", label: "Summer",
    months: [{ num: 6, name: "June" }, { num: 7, name: "July" }, { num: 8, name: "August" }] },
  { containerId: "#chart-autumn", svgFile: "img/autumn-rect.svg", label: "Autumn",
    months: [{ num: 9, name: "September" }, { num: 10, name: "October" }, { num: 11, name: "November" }] },
  { containerId: "#chart-winter", svgFile: "img/winter-rect.svg", label: "Winter",
    months: [{ num: 12, name: "December" }, { num: 1, name: "January" }, { num: 2, name: "February" }] }
];

// Returns null if I wasn't in the play, otherwise true or false for whether I won it
function myResult(play, myId) {
  const mine = play.playerScores.filter(s => s.playerRefId === myId);
  if (mine.length === 0) return null; // not my play
  return mine.some(s => s.winner);
}

// Counts plays and wins per month of one season, and per game. It has to run for all four seasons
// before any card is drawn, because the wooden sign shows whichever season has the most plays.
function computeSeasonStats(season, plays, myId, gameMeta) {
  let played = 0;
  const gameCounts = new Map(); // per game: { played, won }
  for (const month of season.months) {
    month.played = 0;
    month.won = 0;
  }
  for (const play of plays) {
    if (play.ignored) continue;
    const won = myResult(play, myId);
    if (won === null) continue; // I wasn't in it
    if (!passesYear(play)) continue; // year not selected
    if (!passesPlayFilters(play)) continue; // other players or another location
    if (!passesFilters(play.gameRefId, gameMeta)) continue; // game filtered out

    const playMonth = Number(play.playDate.slice(5, 7)); // "2021-12-28" gives 12
    const month = season.months.find(m => m.num === playMonth);
    if (!month) continue;

    month.played++;
    if (won) month.won++;
    played++;
    const gameStats = gameCounts.get(play.gameRefId) || { played: 0, won: 0 };
    gameStats.played++;
    if (won) gameStats.won++;
    gameCounts.set(play.gameRefId, gameStats);
  }
  return { played, gameCounts };
}

// Opens the popup that lists every game behind a season's total, with plays, wins and losses for each
function openGamePopup(title, gameCounts, gameNames) {
  const games = Array.from(gameCounts, ([gameRefId, stats]) => ({
    name: gameNames.get(gameRefId) || "Unknown game",
    played: stats.played,
    won: stats.won,
    lost: stats.played - stats.won
  })).sort((a, b) => b.played - a.played);

  d3.select("#popup-title").text(title);
  d3.select("#popup-search").property("value", ""); // reset the search box

  const list = d3.select("#popup-list");
  list.selectAll("li").remove();
  const items = list.selectAll("li").data(games).enter().append("li");
  items.append("span").attr("class", "game-name").text(g => g.name);
  items.append("span").attr("class", "game-stats").html(g =>
    `${g.played}/<span class="won">${g.won}</span>/<span class="lost">${g.lost}</span>`
  );

  d3.select("#game-list-popup").classed("visible", true);
}

// Filters the popup list as you type: games whose name doesn't contain the text are hidden
d3.select("#popup-search").on("input", function () {
  const query = this.value.toLowerCase();
  d3.selectAll("#popup-list li").style("display", function () {
    const name = d3.select(this).select(".game-name").text().toLowerCase();
    return name.includes(query) ? "" : "none";
  });
});

// Opens the cards to full size or shrinks them back to the small stack. While open, the whole
// layer is lifted above the dragon so the big cards are never covered by it.
function setExpanded(open) {
  if (open) {
    closeStar(); // the cards are never open together with the star, stopwatch, quick filter menu or info windows
    closePlaytime();
    closeMiddle(); // the quick filter menu and the info windows
  }
  d3.select(".card-stack").classed("expanded", open);
  d3.select("#widget-layer").classed("open", open);
}

d3.select("#stack-shrink").on("click", function (event) {
  event.stopPropagation();
  setExpanded(false);
});

// the close button, or a click on the dark backdrop, closes the popup
d3.select("#popup-close").on("click", () => d3.select("#game-list-popup").classed("visible", false));
d3.select("#game-list-popup").on("click", function (event) {
  if (event.target.id === "game-list-popup") d3.select(this).classed("visible", false);
});

// Tidies up the raw data after loading: cuts play dates down to the day and unifies the names for home
function cleanJsonData(data) {
  // keep only the YYYY-MM-DD part of each play date
  const dateRegex = /^(\d{4}-\d{2}-\d{2})/;
  if (data.plays) {
    data.plays.forEach(play => {
      if (play.playDate) {
        const match = play.playDate.match(dateRegex);
        if (match) {
          play.playDate = match[1];
        }
      }
    });
  }

  // the different spellings of home all become "Home"
  const homeAliases = ["H.", "Home", "home"];
  if (data.locations) {
    data.locations.forEach(loc => {
      if (loc.name && homeAliases.includes(loc.name.trim())) {
        loc.name = "Home";
      }
    });
  }
  
  return data;
}

// Data shared by the functions below. Stays empty until the files have loaded.
let allPlays = [], gameMeta = new Map(), gameNames = new Map(), playerInfo = new Map(), locationNames = new Map(), myId = null;

// Load the play data and the shelf csv once, then clean them up
Promise.all([
  d3.json("cleaned-data/data_cleaned.JSON"),
  d3.csv("cleaned-data/games_gameshelf_cleaned.csv")
]).then(function ([rawData, shelfRaw]) {
  
  // tidy up the play data
  const data = cleanJsonData(rawData);

  // trim stray spaces from the shelf's column names
  const shelf = shelfRaw.map(row => {
    const clean = {};
    for (const key in row) clean[key.trim()] = row[key];
    return clean;
  });

  allPlays = data.plays;
  gameMeta = buildGameMeta(data.games, shelf);
  gameNames = new Map(data.games.map(g => [g.id, g.name || g.bggName]));
  myId = data.userInfo.meRefId; // player id of the person this data belongs to
  playerInfo = new Map(data.players.map(p => [p.id, p])); // player id -> player, used for the names in the info windows
  locationNames = new Map(data.locations.map(l => [l.id, l.name])); // location id -> name, used by the quick filter menu

  // years for the slider and dropdown: from my first play up to the latest play or the current year
  const playYears = allPlays
    .filter(p => !p.ignored && myResult(p, myId) !== null)
    .map(p => Number(p.playDate.slice(0, 4)));
  const years = d3.range(d3.min(playYears), Math.max(d3.max(playYears), new Date().getFullYear()) + 1);

  for (const season of seasons) buildSeasonCard(season);

  setupQuickFilter(); // fills the quick filter dropdowns from the data

  setupYearControls(years, function (selectedYears) {
    filters.years = selectedYears; // Set of years, or null for all years
    updateCards();
  }); // setupYearControls calls this once with "All" to start, which draws the cards for the first time
});

// Short text for a list of names in the filter panels: "Bart", "Bart, Tom" or "5 selected"
function describeNames(names) {
  if (names.length <= 2) return names.join(", ");
  return names.length + " selected";
}

// Play times as text, e.g. [15, 30] becomes "15 min, 30 min"
function describePlayTimes(buckets) {
  return describeNames(buckets.map(playTimeBucketLabel));
}

// The year selection as short text for the plaque: "all years", "2023" or "3 years"
function describeYears() {
  if (!filters.years) return "all years";
  return filters.years.size === 1 ? String([...filters.years][0]) : filters.years.size + " years";
}

// A range as text for the filter panels, e.g. "30–90", "≥ 2" or "≤ 4"
function describeRange(lo, hi) {
  if (lo != null && hi != null) return lo + "\u2013" + hi;
  return lo != null ? "\u2265 " + lo : "\u2264 " + hi;
}

// Recounts everything with the current filters, redraws the four cards and refreshes the other widgets
function updateCards() {
  // total number of my plays that pass the filters
  let totalMine = 0;
  for (const play of allPlays) {
    if (play.ignored) continue;
    if (myResult(play, myId) === null) continue;
    if (!passesYear(play)) continue;
    if (!passesPlayFilters(play)) continue;
    if (!passesFilters(play.gameRefId, gameMeta)) continue;
    totalMine++;
  }

  // the season totals have to be worked out before drawing, to know which season has the most plays
  for (const season of seasons) {
    season.stats = computeSeasonStats(season, allPlays, myId, gameMeta);
  }

  d3.selectAll(".card-outer").classed("most-played", false);
  if (totalMine === 0) {
    d3.select("#plaque-season").text("\u2014");
    d3.select("#plaque-caption").text("no games \u00b7 " + describeYears());
  } else {
    const mostPlayed = seasons.reduce((a, b) => (b.stats.played > a.stats.played ? b : a));
    d3.select(mostPlayed.containerId).classed("most-played", true);
    d3.select("#plaque-season").text(mostPlayed.label);
    d3.select("#plaque-caption").text(mostPlayed.stats.played + " games \u00b7 " + describeYears());
  }

  for (const season of seasons) updateSeasonCard(season, totalMine);
  updateWindows();
  updateFilterPanels();
  updateStar();
  updatePlaytime();
  updateQuickFilter();
}

// Runs once per card: sets up the click handler and loads the season's svg onto the front face
function buildSeasonCard(season) {
  const container = d3.select(season.containerId);

  // On the small stack a click opens the cards to full size and the dragon walks over to them.
  // Once they are open, a click flips that card and flips all the others back, so only one
  // shows its back at a time.
  container.on("click", function (event) {
    event.stopPropagation();
    const stack = d3.select(".card-stack");

    if (!stack.classed("expanded")) {
      setExpanded(true);
      moveToLocation("Kaarten", "naarKaarten"); // the dragon walks over to the cards
      return; // this click only opened the cards, it doesn't flip one
    }

    const wasFlipped = container.classed("flipped");
    d3.selectAll(".card-outer").classed("flipped", false);
    container.classed("flipped", !wasFlipped);
    updateFilterPanels(); // the season panel follows the flipped card (the windows refresh when they open)
    updateStar();         // the star's numbers depend on the season too
    updatePlaytime();     // and so do the stopwatch totals
  });

  // load the season's svg onto the front face. season.ready lets updateSeasonCard wait until it is there
  season.ready = d3.xml(season.svgFile).then(function (svg) {
    const front = container.select(".card-front");
    front.node().append(svg.documentElement);

    // take the card's position and size from the background rect in the svg
    const bgRect = front.select("#bg-rect");
    season.cardTop = parseFloat(bgRect.attr("y"));
    season.cardHeight = parseFloat(bgRect.attr("height"));
    season.cardBottom = season.cardTop + season.cardHeight;
    season.front = front;

    // start with the ground at the bottom of the card (empty)
    front.select("#ground").attr("transform", "translate(0," + season.cardBottom + ")");
  });
}

// Runs on every filter change: rewrites the text on the back and updates the number and ground height on the front
function updateSeasonCard(season, totalMine) {
  const seasonPlayed = season.stats.played;

  // rebuild the text on the back of the card
  const back = d3.select(season.containerId).select(".card-back");
  back.selectAll("*").remove();
  for (const month of season.months) {
    const lost = month.played - month.won;
    back.append("p")
      .html(`<strong>${month.name}:</strong> ${month.played}/`
          + `<span class="won">${month.won}</span>/`
          + `<span class="lost">${lost}</span>`);
  }
  back.append("p")
    .attr("class", "total")
    .text("Total played: " + seasonPlayed)
    .on("click", function (event) {
      event.stopPropagation(); // keep the click from reaching the card and flipping it
      openGamePopup(season.label + " \u2014 games played", season.stats.gameCounts, gameNames);
    });

  // the ground rises in proportion to this season's share of all plays
  const percentage = totalMine > 0 ? (seasonPlayed / totalMine) * 100 : 0;
  season.ready.then(function () {
    season.front.select("#season-count").text(seasonPlayed);
    const scale = d3.scaleLinear().domain([0, 100]).range([0, season.cardHeight]);
    season.front.select("#ground")
      .transition()
      .duration(800)
      .attr("transform", "translate(0," + (season.cardBottom - scale(percentage)) + ")");
  });
}