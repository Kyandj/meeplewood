// The arrow button + the three info windows (most played games / most active
// players / most wins). They follow the same filters as the cards: the year
// controls, the hard-coded `filters`, and the season of the selected (flipped) card.

// Opens/closes "window mode": the cards (or the complexity star) shrink and move down, the windows slide in.
// The windows show the same information for both, always filtered by everything that is active (incl. the star).
function setCompact(on) {
  d3.select(".card-stack").classed("compact", on);
  d3.select("#star-popup").classed("compact", on);
  d3.select("#widget-layer").classed("windows-open", on);
  d3.select("#compact-toggle").attr("aria-expanded", on);
  if (on) updateWindows();
}

d3.select("#compact-toggle").on("click", function (event) {
  event.stopPropagation();
  setCompact(!d3.select("#widget-layer").classed("windows-open"));
});

// the season of the card that is flipped over = the selected season (null = none = all seasons).
// It is a filter like the year: it stays selected when the cards are closed, until you flip the card back.
function selectedSeason() {
  return seasons.find(s => d3.select(s.containerId).classed("flipped")) || null;
}

// biggest first; returns [{ name, value }]
function topList(counts, nameOf, limit) {
  return Array.from(counts, ([id, value]) => ({ name: nameOf(id), value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function updateWindows() {
  if (allPlays.length === 0) return; // data hasn't loaded yet

  const season = selectedSeason();
  const months = season ? new Set(season.months.map(m => m.num)) : null;

  const gamePlays = new Map();    // gameRefId -> plays
  const playerPlays = new Map();  // playerRefId -> plays
  const playerWins = new Map();   // playerRefId -> wins

  for (const play of allPlays) {
    if (play.ignored) continue;
    if (myResult(play, myId) === null) continue;                       // same plays as the cards
    if (!passesYear(play)) continue;
    if (!passesFilters(play.gameRefId, gameMeta)) continue;
    if (months && !months.has(Number(play.playDate.slice(5, 7)))) continue; // only the selected season

    gamePlays.set(play.gameRefId, (gamePlays.get(play.gameRefId) || 0) + 1);

    // a player can be listed twice in one play: count them once per play
    const perPlayer = new Map();
    for (const s of play.playerScores) perPlayer.set(s.playerRefId, perPlayer.get(s.playerRefId) || s.winner);
    for (const [pid, won] of perPlayer) {
      const info = playerInfo.get(pid);
      if (!info || info.isAnonymous || (info.metaData && info.metaData.isNpc)) continue; // no anonymous players or bots
      playerPlays.set(pid, (playerPlays.get(pid) || 0) + 1);
      if (won) playerWins.set(pid, (playerWins.get(pid) || 0) + 1);
    }
  }

  const playerName = id => playerInfo.get(id).name;
  const others = new Map([...playerPlays].filter(([pid]) => pid !== myId)); // you are in every play, so you'd always be #1

  const seasonScope = season
    ? season.label + " (" + season.months[0].name + " \u2013 " + season.months[2].name + ")"
    : "Across all seasons";
  const timeScope = filters.playTimeBucket == null
    ? "All play times"
    : playTimeBucketLabel(filters.playTimeBucket);
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
