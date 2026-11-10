// The arrow button and the three info windows: most played games, most active players and most wins.
// The arrow sits at the bottom of the map while the quick filter menu is open. Pressing it slides the
// windows in on both sides and shrinks the menu (dropping its live results column, see style.css) so it
// fits between them. Press the arrow again, or the cross on the right window, to get the full menu back.
// The windows use the same filters as the cards (year, season and everything in the quick filter menu)
// and refresh whenever a filter changes.

function openWindows() {
  d3.select("#widget-layer").classed("windows-open", true);
  updateWindows();
}

function closeWindows() {
  d3.select("#widget-layer").classed("windows-open", false);
}

d3.select("#qf-arrow").on("click", function () {
  if (d3.select("#widget-layer").classed("windows-open")) closeWindows();
  else openWindows();
});

d3.select("#win-close").on("click", function (event) {
  event.stopPropagation();
  closeWindows();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeWindows(); });

// The season whose card is flipped over, or null when none is (which means all seasons).
// Like the year it works as a filter, so it stays selected when the cards are closed, until the card is flipped back.
function selectedSeason() {
  return seasons.find(s => d3.select(s.containerId).classed("flipped")) || null;
}

// Turns a Map of id -> count into the top `limit` entries as [{ name, value }], highest value first (ties go by name).
function topList(counts, nameOf, limit) {
  return Array.from(counts, ([id, value]) => ({ name: nameOf(id), value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function updateWindows() {
  if (allPlays.length === 0) return; // nothing to show until the data has loaded

  const season = selectedSeason();
  const months = season ? new Set(season.months.map(m => m.num)) : null;

  const gamePlays = new Map();    // plays per game
  const playerPlays = new Map();  // plays per player
  const playerWins = new Map();   // wins per player

  for (const play of allPlays) {
    if (play.ignored) continue;
    if (myResult(play, myId) === null) continue;                       // skip plays I wasn't in, same as the cards
    if (!passesYear(play)) continue;
    if (!passesPlayFilters(play)) continue;
    if (!passesFilters(play.gameRefId, gameMeta)) continue;
    if (months && !months.has(Number(play.playDate.slice(5, 7)))) continue; // outside the selected season

    gamePlays.set(play.gameRefId, (gamePlays.get(play.gameRefId) || 0) + 1);

    // a player can appear twice in one play, so count each player once per play
    const perPlayer = new Map();
    for (const s of play.playerScores) perPlayer.set(s.playerRefId, perPlayer.get(s.playerRefId) || s.winner);
    for (const [pid, won] of perPlayer) {
      const info = playerInfo.get(pid);
      if (!info || info.isAnonymous || (info.metaData && info.metaData.isNpc)) continue; // skip anonymous players and bots
      playerPlays.set(pid, (playerPlays.get(pid) || 0) + 1);
      if (won) playerWins.set(pid, (playerWins.get(pid) || 0) + 1);
    }
  }

  const playerName = id => playerInfo.get(id).name;
  const others = new Map([...playerPlays].filter(([pid]) => pid !== myId)); // leave myself out, I'm in every play and would always be first

  const seasonScope = season
    ? season.label + " (" + season.months[0].name + " \u2013 " + season.months[2].name + ")"
    : "Across all seasons";
  const timeScope = !filters.playTimeBuckets
    ? "All play times"
    : describePlayTimes(filters.playTimeBuckets);
  const scope = [seasonScope, describeYears(), timeScope].join(" \u00b7 ");

  fillWindow("#win-games",   scope, topList(gamePlays, id => gameNames.get(id) || "Unknown game", 10), "play", "plays");
  fillWindow("#win-players", scope + " \u00b7 besides you", topList(others, playerName, 3), "play", "plays");
  fillWindow("#win-wins",    scope, topList(playerWins, playerName, 3), "win", "wins");
}

function fillWindow(selector, subtitle, rows, one, many) {
  const win = d3.select(selector);
  win.select(".win-sub").text(subtitle);

  const list = win.select(".win-list");
  list.selectAll("li").remove();
  if (rows.length === 0) {
    list.append("li").attr("class", "win-empty").text("No plays for this selection");
    return;
  }

  const max = rows[0].value;
  const li = list.selectAll("li").data(rows).enter().append("li");
  li.append("span").attr("class", "win-rank").text((d, i) => i + 1);
  const body = li.append("div").attr("class", "win-body");
  const top = body.append("div").attr("class", "win-top");
  top.append("span").attr("class", "win-name").text(d => d.name);
  top.append("span").attr("class", "win-val").text(d => d.value + " " + (d.value === 1 ? one : many));
  body.append("div").attr("class", "win-bar").append("div")
    .style("width", "0%")
    .transition().duration(600)
    .style("width", d => (d.value / max * 100) + "%");
}