// The complexity star: a pop-up with 10 fragments, arranged clockwise starting at the top. The large
// fragments cover x.0 to x.4 and the small ones between them cover x.5 to x.9, so the order is 1.0-1.4,
// 1.5-1.9, 2.0-2.4, 2.5-2.9, 3.0-3.4, 3.5-3.9, 4.0-4.4, 4.5-4.9, 5.0 and finally a small one for unrated games.
// Clicking fragments filters on them (you can pick several), clicking the centre circle clears the selection.
// The dark yellow fill grows from the centre towards the tip in proportion to the share of plays in that
// range (4% of the plays fills 4% of the length). The dotted green line is the same for the plays you won,
// and it is shown on every fragment that isn't faded out.
// The small star in the sandpit is a second copy of the big one and always shows the same state.
// The counts follow the other filters (year, play time, ...) but not the star's own selection.

const STAR = { R_BIG: 353, R_SMALL: 262, R0: 44, HUB_R: 36, HUB_STROKE: 16 }; // sizes in svg units (the svg is 780 x 780). R0 is where the centre circle ends and the fragments start
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

// Path for one fragment pointing straight up. Each fragment is rotated into place when it is drawn.
function starPolygon(big) {
  const pts = big
    ? [[-21, -46], [-54, -118], [0, -STAR.R_BIG],   [54, -118], [21, -46]]
    : [[-9, -47],  [-26, -100], [0, -STAR.R_SMALL], [26, -100], [9, -47]];
  return "M" + pts.map(p => p.join(",")).join("L") + "Z";
}
const fragLength = f => (f.big ? STAR.R_BIG : STAR.R_SMALL) - STAR.R0;

// Text for the filter panel, e.g. "1.0-2.4, 3.5-3.9, unrated". Fragments next to each other are merged into one range.
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

// Draws a star into the given svg. It is called twice, once for the big pop-up and once for the small copy
// in the sandpit, and only the big one (interactive = true) reacts to clicks. The prefix keeps the clip-path
// ids of the two copies apart.
// The drawing is built in layers (base colours, fills, green lines, outlines, centre) instead of one
// fragment at a time, so a fragment's colour can never paint over its neighbour's outline.
const rotateOf = f => "rotate(" + f.angle + ")";

function buildStar(svg, prefix, interactive) {
  const defs = svg.append("defs");
  const root = svg.append("g").attr("class", "star-root");
  const layer = name => root.append("g").attr("class", "layer-" + name);
  const perFragment = (g, tag) => g.selectAll(tag).data(STAR_FRAGMENTS).enter().append(tag);

  STAR_FRAGMENTS.forEach((f, i) => {
    defs.append("clipPath").attr("id", prefix + "-shape-" + i).append("path").attr("d", starPolygon(f.big));  // clips to the fragment's outline
    defs.append("clipPath").attr("id", prefix + "-fill-" + i).append("rect")                                  // clips to the filled part, which grows outwards from the centre
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

  if (interactive) {   // only the big star is clickable
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
const pinStar = buildStar(d3.select("#star-pin svg"), "pin", false);   // the small copy in the bottom-left sandpit
const allStars = [bigStar, pinStar];

// Counts plays and wins per fragment (bin) for my plays that pass all the other filters (year, season,
// play time, ...). Plays whose game has no shelf data can't be placed in a fragment, so they are skipped.
function starStats() {
  const season = selectedSeason(); // null when no card is flipped
  const months = season ? new Set(season.months.map(m => m.num)) : null;
  const plays = new Map(), wins = new Map();
  let total = 0;
  for (const play of allPlays) {
    if (play.ignored) continue;
    const won = myResult(play, myId);
    if (won === null) continue;
    if (!passesYear(play)) continue;
    if (!passesPlayFilters(play)) continue;
    if (months && !months.has(Number(play.playDate.slice(5, 7)))) continue;
    if (!passesFilters(play.gameRefId, gameMeta, true)) continue; // true leaves out the star's own selection, otherwise every unselected fragment would count as 0
    const meta = gameMeta.get(play.gameRefId);
    if (!meta) continue;
    const bin = complexityBin(meta.complexity);
    total++;
    plays.set(bin, (plays.get(bin) || 0) + 1);
    if (won) wins.set(bin, (wins.get(bin) || 0) + 1);
  }
  return { total, plays, wins };
}

// Redraws the fills, green lines and selection look of both stars. Called from updateCards.
function updateStar() {
  if (allPlays.length === 0) return;
  const { total, plays, wins } = starStats();
  const hasSelection = selectedBins.size > 0;

  for (const star of allStars) {
    // selected fragments stay solid, the others fade out (both the light and the dark yellow)
    star.bases.each(function (f) {
      const n = plays.get(f.bin) || 0, w = wins.get(f.bin) || 0;
      const selected = selectedBins.has(f.bin);
      const base = d3.select(this).classed("selected", selected).classed("dim", hasSelection && !selected);
      base.select("title").text(f.label + " \u00b7 " + n + " plays (" + Math.round((total ? n / total : 0) * 100) + "%) \u00b7 " + w + " won");
    });

    // dark fill: the share of plays in this range, measured from the centre circle out to the tip
    star.fills.each(function (f, i) {
      d3.select(this).classed("dim", hasSelection && !selectedBins.has(f.bin)); // fades the same way as the light yellow
      const length = (total ? (plays.get(f.bin) || 0) / total : 0) * fragLength(f);
      d3.select("#" + star.prefix + "-fill-" + i + " .fill-rect").transition().duration(600)
        .attr("y", -(STAR.R0 + length)).attr("height", length);
    });

    // green dotted line: the share of plays I won, on the same scale as the fill. Hidden on faded fragments and when there are no wins
    star.wons.each(function (f, i) {
      const w = wins.get(f.bin) || 0;
      const y = -(STAR.R0 + (total ? w / total : 0) * fragLength(f));
      d3.select(this).classed("show", w > 0 && (!hasSelection || selectedBins.has(f.bin)))
        .transition().duration(600).attr("y1", y).attr("y2", y);
    });
  }
}

// The selection changed: store it as a filter and refresh everything that depends on the filters.
function applyStarSelection() {
  filters.complexityBins = selectedBins.size ? new Set(selectedBins) : null;
  updateCards();
}

// Used by the quick filter menu to set the selection to exactly these fragments. An empty list clears it.
function setStarSelection(bins) {
  selectedBins.clear();
  for (const bin of bins) selectedBins.add(bin);
  applyStarSelection();
}

function openStar() {
  setExpanded(false); // only one widget is open at a time, so close the others first
  closePlaytime();
  closeMiddle();      // the quick filter menu and the info windows
  d3.select("#star-popup").classed("open", true);
  d3.select("#widget-layer").classed("star-open", true);
  updateStar();
}
function closeStar() {
  d3.select("#star-popup").classed("open", false);
  d3.select("#widget-layer").classed("star-open", false);
}
d3.select("#star-pin").on("click", function (event) {
  event.stopPropagation();
  if (d3.select("#star-popup").classed("open")) { closeStar(); return; }
  openStar();
  moveToLocation("Dobbelsteen", "naarDobbelsteen"); // the dragon walks to the star's sandpit
});
d3.select("#star-close").on("click", closeStar);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeStar(); });