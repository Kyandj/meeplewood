// ----- FILTERS -----
// Change any value below to narrow down which plays are counted.
// Leave a value as null to not filter on it.
const filters = {
  playTimeBucket: null, // nearest supported duration, or "over-120"; null = all times
  minComplexity: null,  // BGG weight, 1 (light) to 5 (heavy)
  maxComplexity: null,
  category: null,       // must match a value from the shelf's Categories column exactly, e.g. "Fantasy"
  mechanic: null,       // e.g. "Dice Rolling"
  primaryFamily: null,  // e.g. "Strategy Game"
  complexityBins: null, // a Set of star fragments (set by the complexity star); null = no selection. Bin = floor(complexity x 2), 0 = unrated
  years: null           // a Set of years, e.g. new Set([2023, 2024]); null = all years (set by the year controls)
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

// Was this play logged in one of the selected years? ("2021-12-28" -> 2021)
function passesYear(play) {
  return !filters.years || filters.years.has(Number(play.playDate.slice(0, 4)));
}

// "30 - 180" -> 105 (the average), "25" -> 25
function parsePlayTime(value) {
  if (!value) return null;
  const parts = value.split("-").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return (parts[0] + parts[1]) / 2;
  }
  return isNaN(parts[0]) ? null : parts[0];
}

// "Dice,Fantasy,Exploration" -> ["Dice", "Fantasy", "Exploration"]
function splitList(value) {
  return value ? value.split(",").map(s => s.trim()) : [];
}

// Link every game to its row on the shelf (both use the same BGG id) and
// pull out only the fields the filters need.
function buildGameMeta(games, shelfRows) {
  const shelfById = new Map();
  for (const row of shelfRows) {
    shelfById.set(row["Game ID"].trim(), row);
  }

  const meta = new Map(); // gameRefId -> parsed metadata
  for (const game of games) {
    const row = shelfById.get(String(game.bggId));
    if (!row) continue; // this game isn't on the shelf, so there's nothing to filter on
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

// Does this play's game satisfy every filter that is currently set?
// Which star fragment does a complexity belong to? 1.0-1.4 -> 2, 1.5-1.9 -> 3, ... 5.0 -> 10; 0 or missing (unrated) -> 0
function complexityBin(c) {
  if (!(c > 0)) return 0;
  return Math.min(10, Math.max(2, Math.floor(c * 2 + 1e-9)));
}

// ignoreStar: leave the star's own selection out (the star needs this to count every fragment)
function passesFilters(gameRefId, gameMeta, ignoreStar, ignorePlayTime) {
  const useStar = filters.complexityBins && !ignoreStar;
  const usePlayTime = filters.playTimeBucket != null && !ignorePlayTime;
  const active = usePlayTime
    || filters.minComplexity != null || filters.maxComplexity != null
    || filters.category || filters.mechanic || filters.primaryFamily || useStar;
  if (!active) return true; // nothing is being filtered on

  const meta = gameMeta.get(gameRefId);
  if (!meta) return false; // no shelf data for this game, so it can't be checked

  if (usePlayTime
      && (meta.playTime == null || playTimeBucket(meta.playTime) !== filters.playTimeBucket)) return false;
  if (filters.minComplexity != null && (isNaN(meta.complexity) || meta.complexity < filters.minComplexity)) return false;
  if (filters.maxComplexity != null && (isNaN(meta.complexity) || meta.complexity > filters.maxComplexity)) return false;
  if (filters.category && !meta.categories.includes(filters.category)) return false;
  if (filters.mechanic && !meta.mechanics.includes(filters.mechanic)) return false;
  if (filters.primaryFamily && !meta.primaryFamily.includes(filters.primaryFamily)) return false;
  if (useStar && !filters.complexityBins.has(complexityBin(meta.complexity))) return false;

  return true;
}

// Which months belong to each season, and which files/containers go with it
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

// Was this play played by "me", and if so, did I win it?
function myResult(play, myId) {
  const mine = play.playerScores.filter(s => s.playerRefId === myId);
  if (mine.length === 0) return null; // I wasn't in this play, don't count it
  return mine.some(s => s.winner);
}

// Count played/won/lost per month of this season, and per game.
// This has to run for EVERY season before any card is drawn, because the
// wooden sign needs to know which season has the highest total.
function computeSeasonStats(season, plays, myId, gameMeta) {
  let played = 0;
  const gameCounts = new Map(); // gameRefId -> { played, won }
  for (const month of season.months) {
    month.played = 0;
    month.won = 0;
  }
  for (const play of plays) {
    if (play.ignored) continue;
    const won = myResult(play, myId);
    if (won === null) continue; // not one of my plays
    if (!passesYear(play)) continue; // logged in a year that isn't selected
    if (!passesFilters(play.gameRefId, gameMeta)) continue; // filtered out

    const playMonth = Number(play.playDate.slice(5, 7)); // "2021-12-28" -> 12
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

// Show the small popup listing which games (and how many times) make up a season's total
function openGamePopup(title, gameCounts, gameNames) {
  const games = Array.from(gameCounts, ([gameRefId, stats]) => ({
    name: gameNames.get(gameRefId) || "Unknown game",
    played: stats.played,
    won: stats.won,
    lost: stats.played - stats.won
  })).sort((a, b) => b.played - a.played);

  d3.select("#popup-title").text(title);
  d3.select("#popup-search").property("value", ""); // clear any search from the last time it was open

  const list = d3.select("#popup-list");
  list.selectAll("li").remove();
  const items = list.selectAll("li").data(games).enter().append("li");
  items.append("span").attr("class", "game-name").text(g => g.name);
  items.append("span").attr("class", "game-stats").html(g =>
    `${g.played}/<span class="won">${g.won}</span>/<span class="lost">${g.lost}</span>`
  );

  d3.select("#game-list-popup").classed("visible", true);
}

// Hide any game whose name doesn't contain what's typed in the search box
d3.select("#popup-search").on("input", function () {
  const query = this.value.toLowerCase();
  d3.selectAll("#popup-list li").style("display", function () {
    const name = d3.select(this).select(".game-name").text().toLowerCase();
    return name.includes(query) ? "" : "none";
  });
});

// Open the widget up / shrink it back to the mini stack. While it is open the
// whole layer is lifted above the pawn so the big cards are never covered by it.
function setExpanded(open) {
  if (open) {
    closeStar(); // the cards and the complexity star never share the screen
    closePlaytime();
  }
  d3.select(".card-stack").classed("expanded", open);
  d3.select("#widget-layer").classed("open", open);
  if (!open) setCompact(false); // closing the cards also closes the windows (a flipped card stays selected, though)
}

d3.select("#stack-shrink").on("click", function (event) {
  event.stopPropagation();
  setExpanded(false);
});

// Clicking the close button, or the dark backdrop itself, hides the popup again
d3.select("#popup-close").on("click", () => d3.select("#game-list-popup").classed("visible", false));
d3.select("#game-list-popup").on("click", function (event) {
  if (event.target.id === "game-list-popup") d3.select(this).classed("visible", false);
});

// Shared by the update functions below (filled in once the data has loaded)
let allPlays = [], gameMeta = new Map(), gameNames = new Map(), playerInfo = new Map(), myId = null;

// 1. load the play data and the gameshelf once
Promise.all([
  d3.json("cleaned-data/data_cleaned.JSON"),
  d3.csv("cleaned-data/games_gameshelf_cleaned.csv")
]).then(function ([data, shelfRaw]) {
  // the shelf's column names have a leading space ("Game ID, Name, ..."), trim them
  const shelf = shelfRaw.map(row => {
    const clean = {};
    for (const key in row) clean[key.trim()] = row[key];
    return clean;
  });

  allPlays = data.plays;
  gameMeta = buildGameMeta(data.games, shelf);
  gameNames = new Map(data.games.map(g => [g.id, g.name || g.bggName]));
  myId = data.userInfo.meRefId; // playerRefId of the person this tracker is for
  playerInfo = new Map(data.players.map(p => [p.id, p])); // for the player names in the info windows

  // the years on the slider/dropdown: from my first play to my last (or this year, if later)
  const playYears = allPlays
    .filter(p => !p.ignored && myResult(p, myId) !== null)
    .map(p => Number(p.playDate.slice(0, 4)));
  const years = d3.range(d3.min(playYears), Math.max(d3.max(playYears), new Date().getFullYear()) + 1);

  for (const season of seasons) buildSeasonCard(season);

  setupYearControls(years, function (selectedYears) {
    filters.years = selectedYears; // a Set of years, or null for all
    updateCards();
  });  // (setupYearControls reports the starting "All" itself, which draws the cards the first time)
});

// Short text for the plaque: "all years", "2023" or "3 years"
function describeYears() {
  if (!filters.years) return "all years";
  return filters.years.size === 1 ? String([...filters.years][0]) : filters.years.size + " years";
}

// "30\u201390", "\u2265 2" or "\u2264 4" -- used by the filter panels in the top-right corner
function describeRange(lo, hi) {
  if (lo != null && hi != null) return lo + "\u2013" + hi;
  return lo != null ? "\u2265 " + lo : "\u2264 " + hi;
}

// 2. recount everything with the current filters and redraw all four cards
function updateCards() {
  // how many (filtered) plays I took part in, in total
  let totalMine = 0;
  for (const play of allPlays) {
    if (play.ignored) continue;
    if (myResult(play, myId) === null) continue;
    if (!passesYear(play)) continue;
    if (!passesFilters(play.gameRefId, gameMeta)) continue;
    totalMine++;
  }

  // work out every season's totals FIRST, so we know which one is "most played"
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
}

// Built once per card: click behaviour, and loading the season's SVG onto the front face
function buildSeasonCard(season) {
  const container = d3.select(season.containerId);

  // While the widget is still the small stack, clicking any card just opens it
  // up into the full view (and the dragon walks over to the cards). Once it's
  // open, clicking a card flips it (every other card flips back first, so
  // only one is ever showing its back at a time).
  container.on("click", function (event) {
    event.stopPropagation();
    const stack = d3.select(".card-stack");

    if (!stack.classed("expanded")) {
      setExpanded(true);
      moveToLocation("Kaarten", "naarKaarten"); // the dragon walks over to the cards (was the Kaarten button)
      return; // this click only opened the widget, it didn't pick a card
    }

    const wasFlipped = container.classed("flipped");
    d3.selectAll(".card-outer").classed("flipped", false);
    container.classed("flipped", !wasFlipped);
    updateWindows();      // the windows follow the selected season
    updateFilterPanels(); // so do the filter panels
    updateStar();         // and the numbers in the complexity star
    updatePlaytime();     // and the stopwatch totals
  });

  // load this season's SVG and put it on the front face; updateSeasonCard waits for this
  season.ready = d3.xml(season.svgFile).then(function (svg) {
    const front = container.select(".card-front");
    front.node().append(svg.documentElement);

    // read the position and size of the card from the background rectangle
    const bgRect = front.select("#bg-rect");
    season.cardTop = parseFloat(bgRect.attr("y"));
    season.cardHeight = parseFloat(bgRect.attr("height"));
    season.cardBottom = season.cardTop + season.cardHeight;
    season.front = front;

    // the ground starts empty, at the bottom of the card
    front.select("#ground").attr("transform", "translate(0," + season.cardBottom + ")");
  });
}

// Run on every filter change: new text on the back, new number and ground height on the front
function updateSeasonCard(season, totalMine) {
  const seasonPlayed = season.stats.played;

  // build the text on the back of the card
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
      event.stopPropagation(); // don't let the click reach the card and flip it
      openGamePopup(season.label + " \u2014 games played", season.stats.gameCounts, gameNames);
    });

  // turn the percentage into a height and move the ground up to that height
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
