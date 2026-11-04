// Filter panels in the top-right corner of the map.
// Every ACTIVE filter gets its own wooden panel, and the panels are joined into one strip that
// starts in the corner and grows to the left. With no filter active there is nothing to show.
//   season   -> the season logo (a season is "selected" while its card is flipped)
//   year     -> the year(s) from the slider / dropdown (not shown for "All")
//   the rest -> the hard-coded `filters` at the top of script.js (play time, complexity, ...)

// small line icons for the panels (same style as the info windows)
const svgIcon = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const FILTER_ICONS = {
  year:       svgIcon('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4"/>'),
  playtime:   svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  complexity: svgIcon('<path d="M5 20v-6M12 20V8M19 20V4"/>'),
  category:   svgIcon('<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  mechanic:   svgIcon('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>'),
  difficulty: svgIcon('<path d="M12 3l2.6 5.9 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20.1l1.4-6.3L3 9.5l6.4-.6z"/>'),
  family:     svgIcon('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>')
};

// the list of panels to show, in order from the corner outwards: [{ key, logo | icon, label, value }]
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

  if (filters.playTimeBucket != null)
    list.push({ key: "playtime", icon: FILTER_ICONS.playtime, label: "PLAY TIME",
                value: playTimeBucketLabel(filters.playTimeBucket) });
  if (filters.minComplexity != null || filters.maxComplexity != null)
    list.push({ key: "complexity", icon: FILTER_ICONS.complexity, label: "COMPLEXITY",
                value: describeRange(filters.minComplexity, filters.maxComplexity) });
  if (filters.category)      list.push({ key: "category", icon: FILTER_ICONS.category, label: "CATEGORY", value: filters.category });
  if (filters.mechanic)      list.push({ key: "mechanic", icon: FILTER_ICONS.mechanic, label: "MECHANIC", value: filters.mechanic });
  if (filters.primaryFamily) list.push({ key: "family",   icon: FILTER_ICONS.family,   label: "FAMILY",   value: filters.primaryFamily });

  return list;
}

function updateFilterPanels() {
  const panels = d3.select("#filter-strip").selectAll(".filter-panel").data(activeFilters(), d => d.key);

  panels.exit().remove();
  const fresh = panels.enter().append("div").attr("class", "filter-panel wood"); // only new panels slide in

  fresh.merge(panels).order().each(function (d) {
    const panel = d3.select(this);
    panel.selectAll("*").remove(); // rebuilt every time, so a changed value is always up to date
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

updateFilterPanels(); // nothing is active yet, so this starts out empty
