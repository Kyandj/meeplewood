// The quick filter menu: a big wooden menu that opens from the stone circle in the middle of the map.
// It has a row of season buttons (same as flipping a season card) and one dropdown each for play time,
// complexity, players, location, theme and mechanic. In a dropdown you can search for a value and tick
// as many as you want.
// The menu only edits `filters` and then calls updateCards(), and the cards, star, stopwatch, filter
// panels and info windows all update from that.
// The right side of the menu shows live results for the current filters. The arrow button at the bottom
// of the map (windows.js) opens the info windows on both sides, and the cross closes the menu.
// "Clear all filters" resets every filter, including the year.

const dropdowns = [];     // all the dropdowns, so they can be redrawn and closed together
let seasonButtons = null; // the season buttons (All plus the four seasons)
let seasonCounts = null;  // the play counts shown inside the season buttons


// --- Building the menu (runs once, after the data has loaded) ---

// Adds 1 to the count for `key` in a Map, starting from 0
function addOne(counts, key) {
  counts.set(key, (counts.get(key) || 0) + 1);
}

// True for real, named players: not anonymous and not a bot
function isNamedPlayer(id) {
  const info = playerInfo.get(id);
  if (info.isAnonymous) return false;
  if (info.metaData && info.metaData.isNpc) return false; // some players have no metaData at all
  return true;
}

// Turns a Map of value -> number of plays into a dropdown list, most played first:
// [{ value: 4, label: "Bart", count: 581 }, ...]
function makeOptions(counts, nameOf) {
  const options = [];
  for (const [value, count] of counts) {
    options.push({ value: value, label: nameOf(value), count: count });
  }
  options.sort((a, b) => b.count - a.count);
  return options;
}

function setupQuickFilter() {
  // count how many of my plays each value shows up in (all years, no filters applied)
  const playerCounts = new Map();
  const locationCounts = new Map();
  const themeCounts = new Map();
  const mechanicCounts = new Map();
  const playTimeCounts = new Map();
  const complexityCounts = new Map();

  for (const play of allPlays) {
    if (play.ignored) continue;
    if (myResult(play, myId) === null) continue; // I wasn't in it

    if (play.locationRefId !== undefined) addOne(locationCounts, play.locationRefId); // one play has no location

    const seen = []; // some plays list a player twice, so each player is only counted once per play
    for (const score of play.playerScores) {
      const id = score.playerRefId;
      if (seen.includes(id)) continue;
      seen.push(id);
      if (id !== myId && isNamedPlayer(id)) addOne(playerCounts, id); // leave myself out, I'm in every play
    }

    const meta = gameMeta.get(play.gameRefId);
    if (meta === undefined) continue; // no shelf data for this game, so there is nothing more to count
    if (meta.playTime !== null) addOne(playTimeCounts, playTimeBucket(meta.playTime));
    addOne(complexityCounts, complexityBin(meta.complexity));
    for (const theme of meta.categories) addOne(themeCounts, theme);
    for (const mechanic of meta.mechanics) addOne(mechanicCounts, mechanic);
  }

  // build the option lists for the dropdowns
  const playerOptions = makeOptions(playerCounts, id => playerInfo.get(id).name);
  const locationOptions = makeOptions(locationCounts, id => locationNames.get(id));
  const themeOptions = makeOptions(themeCounts, name => name);
  const mechanicOptions = makeOptions(mechanicCounts, name => name);

  // play time and complexity keep a fixed order (short to long, light to heavy) instead of being sorted by count
  const playTimeOptions = [];
  for (const bucket of PLAYTIME_BUCKETS.concat(PLAYTIME_TWO_HOURS_PLUS)) {
    playTimeOptions.push({ value: bucket, label: playTimeBucketLabel(bucket), count: playTimeCounts.get(bucket) || 0 });
  }

  // the values are the bins of the complexity star (floor(complexity * 2), 0 = not rated)
  const complexityOptions = [
    { value: 0,  label: "Not rated" },
    { value: 2,  label: "1.0\u20131.4" },
    { value: 3,  label: "1.5\u20131.9" },
    { value: 4,  label: "2.0\u20132.4" },
    { value: 5,  label: "2.5\u20132.9" },
    { value: 6,  label: "3.0\u20133.4" },
    { value: 7,  label: "3.5\u20133.9" },
    { value: 8,  label: "4.0\u20134.4" },
    { value: 9,  label: "4.5\u20134.9" },
    { value: 10, label: "5.0" }
  ];
  for (const option of complexityOptions) option.count = complexityCounts.get(option.value) || 0;

  // the six dropdowns. Arguments: container, filter name, button text when nothing is ticked,
// noun for the "3 ... selected" text, search placeholder, options
  addDropdown("#qf-playtime .qf-dd",   "playTimeBuckets", "All play times",   "play times", "Search play time...", playTimeOptions);
  addDropdown("#qf-complexity .qf-dd", "complexityBins",  "All complexities", "ranges",     "Search complexity...", complexityOptions);
  addDropdown("#qf-players .qf-dd",    "players",         "All players",      "players",    "Search players...",   playerOptions);
  addDropdown("#qf-locations .qf-dd",  "locations",       "All locations",    "locations",  "Search locations...", locationOptions);
  addDropdown("#qf-themes .qf-dd",     "categories",      "All themes",       "themes",     "Search themes...",    themeOptions);
  addDropdown("#qf-mechanics .qf-dd",  "mechanics",       "All mechanics",    "mechanics",  "Search mechanics...", mechanicOptions);

  // the season buttons, in the same order as the seasons list in script.js
  const buttonData = [
    { label: "All",    icon: "",   season: null },
    { label: "Spring", icon: "🌸", season: seasons[0] },
    { label: "Summer", icon: "☀️", season: seasons[1] },
    { label: "Autumn", icon: "🍂", season: seasons[2] },
    { label: "Winter", icon: "❄️", season: seasons[3] }
  ];
  seasonButtons = d3.select("#qf-season .qf-pills").selectAll("button")
    .data(buttonData)
    .enter()
    .append("button")
    .attr("class", "qf-pill")
    .on("click", function (event, d) {
      setQuickSeason(d.season);
    });
  seasonButtons.append("span").text(d => d.icon);
  seasonButtons.append("span").text(d => d.label);
  seasonCounts = seasonButtons.append("span").attr("class", "qf-pill-count");
}


// --- One dropdown ---
// A dropdown is a button, a pop-up (search box, list of values and a clear button) and chips
// under the button for the ticked values.

function addDropdown(where, filterName, allText, noun, searchHint, options) {
  const box = d3.select(where);

  // the button that opens the pop-up
  const button = box.append("button").attr("class", "qf-dd-btn");
  const buttonText = button.append("span").attr("class", "qf-dd-text");
  button.append("span").text("\u25BE"); // down arrow

  // the pop-up with the search box, the list and the clear button
  const popup = box.append("div").attr("class", "qf-dd-pop");
  const input = popup.append("input").attr("class", "qf-dd-search").attr("type", "text").attr("placeholder", searchHint);
  const list = popup.append("ul").attr("class", "qf-dd-list");
  const clearButton = popup.append("button").attr("class", "qf-dd-clear").text("Clear this filter");

  // one row per value in the list: tick box, name and play count
  const items = list.selectAll("li").data(options).enter().append("li").attr("class", "qf-opt");
  items.append("span").attr("class", "qf-box");
  items.append("span").attr("class", "qf-opt-label").text(d => d.label);
  items.append("span").attr("class", "qf-opt-count").text(d => d.count);

  // chips for the ticked values
  const chips = box.append("div").attr("class", "qf-chips");

  // keep everything about this dropdown together for the functions below
  const dd = {
    filterName: filterName,
    allText: allText,
    noun: noun,
    options: options,
    box: box,
    button: button,
    buttonText: buttonText,
    input: input,
    items: items,
    chips: chips
  };
  dropdowns.push(dd);

  // event handlers
  button.on("click", function () {
    const wasOpen = box.classed("open");
    closeAllDropdowns();                 // only one pop-up open at a time
    if (!wasOpen) {
      box.classed("open", true);
      input.node().value = "";           // clear the search box...
      showMatches(dd);                   // ...and show every value again
      input.node().focus();
    }
  });
  input.on("input", function () {
    showMatches(dd);
  });
  items.on("click", function (event, d) {
    toggleValue(dd, d.value);
  });
  clearButton.on("click", function () {
    saveSelected(dd.filterName, []);
  });
}

// Hides the values that don't contain the text from the search box
function showMatches(dd) {
  const text = dd.input.node().value.toLowerCase();
  dd.items.style("display", function (d) {
    if (d.label.toLowerCase().includes(text)) return "flex";
    return "none";
  });
}

function closeAllDropdowns() {
  for (const dd of dropdowns) {
    dd.box.classed("open", false);
  }
}

// The ticked values of a filter as a list. complexityBins is a Set and the other filters are
// arrays, so Array.from makes a fresh array from either.
function getSelected(filterName) {
  const value = filters[filterName];
  if (value === null) return [];
  return Array.from(value);
}

// Saves the ticked values in the filter and refreshes everything. An empty list becomes null (no filter).
function saveSelected(filterName, values) {
  if (filterName === "complexityBins") {
    setStarSelection(values); // the star has its own selection, so go through it to keep the two in sync
  } else {
    if (values.length === 0) filters[filterName] = null;
    else filters[filterName] = values;
    updateCards();
  }
}

// Ticks a value that isn't ticked yet, or unticks it if it is
function toggleValue(dd, value) {
  const selected = getSelected(dd.filterName);
  if (selected.includes(value)) {
    selected.splice(selected.indexOf(value), 1); // untick
  } else {
    selected.push(value);                        // tick
  }
  saveSelected(dd.filterName, selected);
}

// Redraws one dropdown from the current filter: the ticks, the button text and the chips
function drawDropdown(dd) {
  const selected = getSelected(dd.filterName);
  const picked = dd.options.filter(option => selected.includes(option.value)); // the options that are ticked

  // tick marks in the list
  dd.items.classed("selected", d => selected.includes(d.value));

  // button text: the "all" text, the one picked label, or a count
  if (picked.length === 0) {
    dd.buttonText.text(dd.allText);
  } else if (picked.length === 1) {
    dd.buttonText.text(picked[0].label);
  } else {
    dd.buttonText.text(picked.length + " " + dd.noun + " selected");
  }
  dd.button.classed("active", picked.length > 0);

  // chips: wipe and redraw them, like the filter panels do
  dd.chips.selectAll("*").remove();
  const chip = dd.chips.selectAll(".qf-chip").data(picked).enter().append("span").attr("class", "qf-chip");
  chip.append("span").text(d => d.label);
  chip.append("button")
    .text("\u00d7")
    .on("click", function (event, d) {
      toggleValue(dd, d.value);
    });
}


// --- Season ---
// Picking a season flips its card and flips the other cards back. The filter itself is read from selectedSeason().
function setQuickSeason(season) {
  d3.selectAll(".card-outer").classed("flipped", false);
  if (season !== null) d3.select(season.containerId).classed("flipped", true);
  updateCards();
}


// --- Live results (the right side of the menu) ---
// Counts what is left after all active filters, the year included. These are the same plays as in updateWindows.
function quickStats() {
  const season = selectedSeason();
  const months = season ? new Set(season.months.map(m => m.num)) : null;

  let total = 0;
  const games = new Set();
  const wins = new Map();
  const plays = [];

  for (const play of allPlays) {
    if (play.ignored) continue;
    if (myResult(play, myId) === null) continue;
    if (!passesYear(play)) continue;
    if (!passesPlayFilters(play)) continue;
    if (!passesFilters(play.gameRefId, gameMeta)) continue;
    if (months && !months.has(Number(play.playDate.slice(5, 7)))) continue;

    total++;
    games.add(play.gameRefId);
    plays.push(play);

    const winners = []; // a winner is only counted once per play
    for (const score of play.playerScores) {
      const id = score.playerRefId;
      if (score.winner && !winners.includes(id) && isNamedPlayer(id)) {
        winners.push(id);
        addOne(wins, id);
      }
    }
  }

  plays.sort((a, b) => b.playDate.localeCompare(a.playDate)); // newest first
  return {
    total: total,
    games: games.size,
    leader: topList(wins, id => playerInfo.get(id).name, 1), // the player with the most wins as a one item list, empty if nobody won
    recent: plays.slice(0, 4)
  };
}

// Redraws the whole menu from the current filters. Called at the end of updateCards and when the menu opens.
function updateQuickFilter() {
  if (allPlays.length === 0) return; // data not loaded yet

  // season buttons: highlight the chosen one and show how many plays each season has
  const chosenSeason = selectedSeason();
  let allSeasons = 0;
  for (const season of seasons) allSeasons += season.stats.played;
  seasonButtons.classed("active", d => d.season === chosenSeason);
  seasonCounts.text(function (d) {
    if (d.season === null) return allSeasons;
    return d.season.stats.played;
  });

  // redraw every dropdown
  for (const dd of dropdowns) drawDropdown(dd);

  // count how many of the 8 filters are on: the 7 in this menu plus the year
  let active = 0;
  if (filters.years !== null) active++;
  if (chosenSeason !== null) active++;
  if (filters.playTimeBuckets !== null) active++;
  if (filters.complexityBins !== null) active++;
  if (filters.players !== null) active++;
  if (filters.locations !== null) active++;
  if (filters.categories !== null) active++;
  if (filters.mechanics !== null) active++;
  d3.select("#qf-active").text(active + "/8 active");
  d3.select("#qf-clear").property("disabled", active === 0);

  // the live results on the right
  const stats = quickStats();
  d3.select("#qf-total").text(stats.total);
  d3.select("#qf-games").text(stats.games);
  if (stats.leader.length > 0) {
    d3.select("#qf-leader").text(stats.leader[0].name);
    d3.select("#qf-leader-sub").text(stats.leader[0].value + " wins");
  } else {
    d3.select("#qf-leader").text("\u2014");
    d3.select("#qf-leader-sub").text("no wins");
  }

  // the most recent plays, redrawn from scratch
  d3.select("#qf-recent").selectAll("li").remove();
  const rows = d3.select("#qf-recent").selectAll("li").data(stats.recent).enter().append("li");
  rows.append("span").attr("class", "qf-r-name").text(play => gameNames.get(play.gameRefId));
  rows.append("span").attr("class", "qf-r-date").text(play => play.playDate);
  d3.select("#qf-empty").style("display", stats.total === 0 ? "block" : "none");
}

// Resets every filter to "all", the year included
function clearAllFilters() {
  filters.playTimeBuckets = null;
  filters.players = null;
  filters.locations = null;
  filters.categories = null;
  filters.mechanics = null;
  d3.selectAll(".card-outer").classed("flipped", false); // unflipping the cards clears the season

  // the year: move the slider to its last stop, "All". years.js listens for that, so it unticks the
  // year dropdown and sets filters.years to null on its own
  const slider = document.getElementById("year-slider");
  slider.value = slider.max;
  slider.dispatchEvent(new Event("input"));

  setStarSelection([]); // clear the complexity selection, which also redraws everything
}


// --- Opening and closing ---
// The menu is never open together with the cards, the star, the stopwatch or the info windows.

function openQuickFilter() {
  setExpanded(false); // close the cards
  closeStar();
  closePlaytime();
  closeWindows();
  d3.select("#widget-layer").classed("quick-open", true);
  updateQuickFilter();
}

function closeQuickFilter() {
  closeAllDropdowns();
  d3.select("#widget-layer").classed("quick-open", false);
}

// Closes what opens from the middle of the map: the menu and the info windows.
// The cards, the star and the stopwatch call this when they open.
function closeMiddle() {
  closeQuickFilter();
  closeWindows();
}

// the stone circle in the middle of the map opens the menu
d3.select("#middle-btn").on("click", function (event) {
  event.stopPropagation();
  if (allPlays.length === 0) return; // data not loaded yet
  openQuickFilter();
  moveToLocation("Midden", "naarMidden"); // the dragon walks to the middle
});

d3.select("#qf-close").on("click", closeQuickFilter);
d3.select("#qf-clear").on("click", clearAllFilters);
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") closeQuickFilter();
});

// a click outside a dropdown closes its pop-up
document.addEventListener("click", function (event) {
  if (!event.target.closest(".qf-dd")) closeAllDropdowns();
});