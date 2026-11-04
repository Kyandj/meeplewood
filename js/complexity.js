// ===== The complexity star =====
// A pop-up with 10 fragments, clockwise from the top. Big fragments are x.0 - x.4, small ones x.5 - x.9:
//   top 1.0-1.4 | small 1.5-1.9 | 2.0-2.4 | small 2.5-2.9 | 3.0-3.4 | small 3.5-3.9 | 4.0-4.4 | small 4.5-4.9 | 5.0 | small = unrated (0)
// Click fragments to filter on them (several at once), click the centre circle to select everything again.
//   dark yellow fill = how many of your plays are in that range (4% of the plays = 4% of the way to the tip)
//   green dotted line = how many of those you won (same scale); on every fragment that is not see-through
//   The small star in the sandpit is a copy of the big one and always shows the same state (fills, selection).
// The numbers follow the other filters (year, play time, ...) but not the star's own selection.

const STAR = { R_BIG: 353, R_SMALL: 262, R0: 44, HUB_R: 36, HUB_STROKE: 16 }; // design units (the svg is 780 x 780); R0 = edge of the centre circle
const STAR_FRAGMENTS = [
  { bin: 2,  angle: 0,   big: true,  label: "1.0\u20131.4" },
  { bin: 3,  angle: 36,  big: false, label: "1.5\u20131.9" },
  { bin: 4,  angle: 72,  big: true,  label: "2.0\u20132.4" },
  { bin: 5,  angle: 108, big: false, label: "2.5\u20132.9" },
  { bin: 6,  angle: 144, big: true,  label: "3.0\u20133.4" },
  { bin: 7,  angle: 180, big: false, label: "3.5\u20133.9" },
  { bin: 8,  angle: 216, big: true,  label: "4.0\u20134.4" },
  { bin: 9,  angle: 252, big: false, label: "4.5\u20134.9" },
  { bin: 10, angle: 288, big: true,  label: "5.0" },
  { bin: 0,  angle: 324, big: false, label: "unrated" }
];
const selectedBins = new Set();

// outline of one fragment pointing straight up (it gets rotated into place)
function starPolygon(big) {
  const pts = big
    ? [[-21, -46], [-54, -118], [0, -STAR.R_BIG],   [54, -118], [21, -46]]
    : [[-9, -47],  [-26, -100], [0, -STAR.R_SMALL], [26, -100], [9, -47]];
  return "M" + pts.map(p => p.join(",")).join("L") + "Z";
}
const fragLength = f => (f.big ? STAR.R_BIG : STAR.R_SMALL) - STAR.R0;

// "1.0-2.4, 3.5-3.9, unrated" for the filter panel (neighbouring fragments are merged)
function describeComplexityBins(bins) {
  const parts = [];
  const rated = [...bins].filter(b => b >= 2).sort((a, b) => a - b);
  for (let i = 0; i < rated.length; ) {
    let j = i;
    while (j + 1 < rated.length && rated[j + 1] === rated[j] + 1) j++;
    const lo = rated[i] / 2, hi = rated[j] === 10 ? 5 : rated[j] / 2 + 0.4;
    parts.push(lo === hi ? lo.toFixed(1) : lo.toFixed(1) + "\u2013" + hi.toFixed(1));
    i = j + 1;
  }
  if (bins.has(0)) parts.push("unrated");
  return parts.join(", ");
}

// ---- build a star ----
// Built twice: the big pop-up and the small star in the sandpit are the same drawing (and always show the same
// state: fills, selection, ...). The layers are drawn one after the other (all colours, all fills, all green
// lines, all outlines, the centre), so a fragment's colour never paints over another fragment's outline.
const rotateOf = f => "rotate(" + f.angle + ")";

function buildStar(svg, prefix, interactive) {
  const defs = svg.append("defs");
  const root = svg.append("g").attr("class", "star-root");
  const layer = name => root.append("g").attr("class", "layer-" + name);
  const perFragment = (g, tag) => g.selectAll(tag).data(STAR_FRAGMENTS).enter().append(tag);

  STAR_FRAGMENTS.forEach((f, i) => {
    defs.append("clipPath").attr("id", prefix + "-shape-" + i).append("path").attr("d", starPolygon(f.big));  // the fragment's shape
    defs.append("clipPath").attr("id", prefix + "-fill-" + i).append("rect")                                  // the part that is filled (grows from the centre)
      .attr("class", "fill-rect").attr("x", -150).attr("width", 300).attr("y", -STAR.R0).attr("height", 0);
  });

  const bases = perFragment(layer("bases"), "path").attr("class", "base")
    .attr("d", f => starPolygon(f.big)).attr("transform", rotateOf);

  const fills = perFragment(layer("fills"), "g").attr("transform", rotateOf)
    .append("path").attr("class", "fill").attr("d", f => starPolygon(f.big))
    .attr("clip-path", (f, i) => "url(#" + prefix + "-fill-" + i + ")");

  const wons = perFragment(layer("won"), "g").attr("transform", rotateOf)
    .append("g").attr("clip-path", (f, i) => "url(#" + prefix + "-shape-" + i + ")")
    .append("line").attr("class", "won")
    .attr("x1", -150).attr("x2", 150).attr("y1", -STAR.R0).attr("y2", -STAR.R0);

  perFragment(layer("lines"), "path").attr("class", "outline")
    .attr("d", f => starPolygon(f.big)).attr("transform", rotateOf);

  const hub = root.append("circle").attr("class", "star-hub").attr("r", STAR.HUB_R);

  if (interactive) {   // only the big star can be clicked
    bases.on("click", function (event, f) {
      if (selectedBins.has(f.bin)) selectedBins.delete(f.bin); else selectedBins.add(f.bin);
      applyStarSelection();
    });
    bases.append("title");
    hub.on("click", function () { selectedBins.clear(); applyStarSelection(); })
      .append("title").text("All plays (clear the selection)");
  }
  return { prefix, bases, fills, wons };
}

const bigStar = buildStar(d3.select("#star-svg"), "big", true);
const pinStar = buildStar(d3.select("#star-pin svg"), "pin", false);   // the star in the bottom-left sandpit
const allStars = [bigStar, pinStar];

// ---- numbers ----
// plays per fragment among my plays that pass the OTHER filters (year, the selected season, play time, ...); plays without shelf data can't be placed, so they are left out
function starStats() {
  const season = selectedSeason(); // the flipped card, if any
  const months = season ? new Set(season.months.map(m => m.num)) : null;
  const plays = new Map(), wins = new Map();
  let total = 0;
  for (const play of allPlays) {
    if (play.ignored) continue;
    const won = myResult(play, myId);
    if (won === null) continue;
    if (!passesYear(play)) continue;
    if (months && !months.has(Number(play.playDate.slice(5, 7)))) continue;
    if (!passesFilters(play.gameRefId, gameMeta, true)) continue; // true = ignore the star's own selection
    const meta = gameMeta.get(play.gameRefId);
    if (!meta) continue;
    const bin = complexityBin(meta.complexity);
    total++;
    plays.set(bin, (plays.get(bin) || 0) + 1);
    if (won) wins.set(bin, (wins.get(bin) || 0) + 1);
  }
  return { total, plays, wins };
}

// redraw fills, green lines and the selection look of BOTH stars (called from updateCards)
function updateStar() {
  if (allPlays.length === 0) return;
  const { total, plays, wins } = starStats();
  const hasSelection = selectedBins.size > 0;

  for (const star of allStars) {
    // selection look: selected fragments stay solid, the others turn see-through (light AND dark yellow)
    star.bases.each(function (f) {
      const n = plays.get(f.bin) || 0, w = wins.get(f.bin) || 0;
      const selected = selectedBins.has(f.bin);
      const base = d3.select(this).classed("selected", selected).classed("dim", hasSelection && !selected);
      base.select("title").text(f.label + " \u00b7 " + n + " plays (" + Math.round((total ? n / total : 0) * 100) + "%) \u00b7 " + w + " won");
    });

    // dark fill: the share of plays in this range, from the edge of the centre circle towards the tip
    star.fills.each(function (f, i) {
      d3.select(this).classed("dim", hasSelection && !selectedBins.has(f.bin)); // see-through exactly like the light yellow
      const length = (total ? (plays.get(f.bin) || 0) / total : 0) * fragLength(f);
      d3.select("#" + star.prefix + "-fill-" + i + " .fill-rect").transition().duration(600)
        .attr("y", -(STAR.R0 + length)).attr("height", length);
    });

    // green dotted line: the share of plays you won, same scale. Shown on every fragment that is not see-through
    star.wons.each(function (f, i) {
      const w = wins.get(f.bin) || 0;
      const y = -(STAR.R0 + (total ? w / total : 0) * fragLength(f));
      d3.select(this).classed("show", w > 0 && (!hasSelection || selectedBins.has(f.bin)))
        .transition().duration(600).attr("y1", y).attr("y2", y);
    });
  }
}

// the selection changed: recount the cards, windows, filter panels (and this star) with the new filter
function applyStarSelection() {
  filters.complexityBins = selectedBins.size ? new Set(selectedBins) : null;
  updateCards();
}

// ---- open / close ----
function openStar() {
  setExpanded(false); // the cards and the star never share the screen
  closePlaytime();
  d3.select("#star-popup").classed("open", true);
  d3.select("#widget-layer").classed("star-open", true);
  updateStar();
}
function closeStar() {
  d3.select("#star-popup").classed("open", false);
  d3.select("#widget-layer").classed("star-open", false);
  setCompact(false); // the info windows slide away with it
}
d3.select("#star-pin").on("click", function (event) {
  event.stopPropagation();
  if (d3.select("#star-popup").classed("open")) { closeStar(); return; }
  openStar();
  moveToLocation("Dobbelsteen", "naarDobbelsteen"); // the dragon walks over to the star's sandpit
});
d3.select("#star-close").on("click", closeStar);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeStar(); });