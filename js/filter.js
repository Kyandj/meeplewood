// Panels in the top-right corner of the map that show which filters are on.
// Each active filter gets its own wooden panel. They are joined into one strip that grows to the
// left from the corner, and the strip is empty when no filter is set.
// The season panel shows the season logo (a season counts as selected while its card is flipped),
// the year panel follows the year slider/dropdown and is hidden for "All", and the rest read from
// `filters` in script.js.

// line icons for the panels, drawn the same way as the ones in the info windows
const svgIcon = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const FILTER_ICONS = {
  year:       svgIcon('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4"/>'),
  playtime:   svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  complexity: svgIcon('<path d="M5 20v-6M12 20V8M19 20V4"/>'),
  category:   svgIcon('<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  mechanic:   svgIcon('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>'),
  difficulty: svgIcon('<path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20.1l1.4-6.3L3 9.5l6.4-.6z"/>'),
  family:     svgIcon('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  player:     svgIcon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'),
  location:   svgIcon('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>')
};

// Builds the list of panels to show, starting at the corner and working outwards.
// Each entry is { key, logo or icon, label, value }.
function activeFilters() {
  const list = [];

  const season = selectedSeason();
  if (season) list.push({ key: "season", logo: season.label.toLowerCase() });

  if (filters.years) {
    const years = [...filters.years].sort();
    list.push({
      key: "year", icon: FILTER_ICONS.year,
      label: years.length === 1 ? "YEAR" : "YEARS",
      value: years.length <= 3 ? years.join(", ") : years.length + " years"
    });
  }

  if (filters.complexityBins)
    list.push({ key: "stars", icon: FILTER_ICONS.difficulty, label: "DIFFICULTY", value: describeComplexityBins(filters.complexityBins) });

  if (filters.playTimeBuckets)
    list.push({ key: "playtime", icon: FILTER_ICONS.playtime, label: "PLAY TIME",
                value: describePlayTimes(filters.playTimeBuckets) });
  if (filters.minComplexity != null || filters.maxComplexity != null)
    list.push({ key: "complexity", icon: FILTER_ICONS.complexity, label: "COMPLEXITY",
                value: describeRange(filters.minComplexity, filters.maxComplexity) });
  if (filters.players) {
    const names = filters.players.map(id => playerInfo.get(id).name);
    list.push({ key: "players", icon: FILTER_ICONS.player, label: "PLAYERS", value: describeNames(names) });
  }
  if (filters.locations) {
    const names = filters.locations.map(id => locationNames.get(id));
    list.push({ key: "locations", icon: FILTER_ICONS.location, label: "LOCATION", value: describeNames(names) });
  }
  if (filters.categories) list.push({ key: "category", icon: FILTER_ICONS.category, label: "THEME",    value: describeNames(filters.categories) });
  if (filters.mechanics)  list.push({ key: "mechanic", icon: FILTER_ICONS.mechanic, label: "MECHANIC", value: describeNames(filters.mechanics) });
  if (filters.primaryFamily) list.push({ key: "family",   icon: FILTER_ICONS.family,   label: "FAMILY",   value: filters.primaryFamily });

  return list;
}

function updateFilterPanels() {
  const panels = d3.select("#filter-strip").selectAll(".filter-panel").data(activeFilters(), d => d.key);

  panels.exit().remove();
  const fresh = panels.enter().append("div").attr("class", "filter-panel wood"); // only newly created panels get the slide-in animation

  fresh.merge(panels).order().each(function (d) {
    const panel = d3.select(this);
    panel.selectAll("*").remove(); // wipe and redraw so the text always matches the current filter
    if (d.logo) {
      panel.append("img").attr("src", "img/logo-" + d.logo + ".svg").attr("alt", d.logo);
    } else {
      panel.append("span").attr("class", "fp-icon").html(d.icon);
      const text = panel.append("div").attr("class", "fp-text");
      text.append("span").attr("class", "fp-label").text(d.label);
      text.append("span").attr("class", "fp-value").text(d.value);
    }
  });
}

updateFilterPanels(); // no filters are on yet, so the strip starts out empty