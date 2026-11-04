// Opslag van jouw specifieke bordcoördinaten in percentages (x%, y%)
const locations = {
  Zandloper:   {naarZandloper:   { x: 11.7, y: 51.3 }},
  Kaarten:     {naarKaarten:     { x: 72.4, y: 25.6 },},
  Duel:        {naarDuel:        { x: 78.9, y: 82.1 },},
  Kompas:      {naarKompas:      { x: 27.3, y: 11.7 },},
  Midden:      {naarMidden:      { x: 55.3, y: 46.0 },},
  Dobbelsteen: {naarDobbelsteen: { x: 15.2, y: 70.0 },},
  Sorteerbak:  {naarSorteerbak:  { x: 60.4, y: 58.2 }}
};

const start = locations.Midden.naarMidden;

// Zet de pion op de startpositie bij het laden van de pagina
d3.select("#pawn")
  .style("left", `${start.x}%`)
  .style("top", `${start.y}%`);

/**
 * Beweegt de pion naar een specifieke locatie.
 * @param {string} locationName - Eerste niveau in 'locations' (bijv. "Duel")
 * @param {string} locationDirection - Tweede niveau in 'locations' (bijv. "naarDuel")
 * @param {number} duration - Duur van de sprong in ms (standaard 800ms)
 * @param {number} hopHeightPercent - Hoogte van de hop in % van de kaart (standaard 6%)
 */
function moveToLocation(locationName, locationDirection, duration = 800, hopHeightPercent = 6) {
  const target = locations[locationName]?.[locationDirection];
  if (!target) {
    console.error(`Locatie '${locationName}' / '${locationDirection}' niet gevonden!`);
    return;
  }
  moveToCoordinates(target.x, target.y, duration, hopHeightPercent);
}

/**
 * Beweegt de pion naar procentuele kaartcoördinaten met een hop.
 */
function moveToCoordinates(targetXPercent, targetYPercent, duration = 800, hopHeightPercent = 6) {
  const pawn = d3.select("#pawn");
  const startX = parseFloat(pawn.node().style.left);
  const startY = parseFloat(pawn.node().style.top);

  pawn.transition()
    .duration(duration)
    .ease(d3.easeCubicOut)
    .tween("hopAndMove", function() {
      const interpolateX = d3.interpolateNumber(startX, targetXPercent);
      const interpolateY = d3.interpolateNumber(startY, targetYPercent);

      return function(t) {
        const x = interpolateX(t);
        const linearY = interpolateY(t);
        const arcY = Math.sin(t * Math.PI) * hopHeightPercent;

        pawn.style("left", `${x}%`)
            .style("top", `${linearY - arcY}%`);
      };
    });
}

// Keep the season-card layer (drawn in map pixels, 1536 x 1024) scaled to the
// map's size on screen, so it stays inside the sandpit at any window size.
const MAP_IMAGE_WIDTH = 1536;
const stageEl = document.getElementById("stage");
function fitWidgetLayer() {
  stageEl.style.setProperty("--map-scale", stageEl.clientWidth / MAP_IMAGE_WIDTH);
}
fitWidgetLayer();
new ResizeObserver(fitWidgetLayer).observe(stageEl);
