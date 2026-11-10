// Spots on the map the dragon can walk to, as x/y percentages of the map size
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

// The dragon starts in the middle of the map
d3.select("#pawn")
  .style("left", `${start.x}%`)
  .style("top", `${start.y}%`);

// Hops the dragon to one of the named spots in `locations`, e.g. moveToLocation("Duel", "naarDuel").
// duration is in ms, hopHeightPercent is how high the hop arcs as a % of the map height.
function moveToLocation(locationName, locationDirection, duration = 800, hopHeightPercent = 6) {
  const target = locations[locationName]?.[locationDirection];
  if (!target) {
    console.error(`Locatie '${locationName}' / '${locationDirection}' niet gevonden!`);
    return;
  }
  moveToCoordinates(target.x, target.y, duration, hopHeightPercent);
}

// Moves the dragon in a straight line to x/y (as % of the map) with a sine-shaped arc on top, which is the hop.
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

// The widgets are drawn in map pixels (the map image is 1536 px wide). This sets --map-scale
// so they grow and shrink with the map and stay inside their sandpit at any window size.
const MAP_IMAGE_WIDTH = 1536;
const stageEl = document.getElementById("stage");
function fitWidgetLayer() {
  stageEl.style.setProperty("--map-scale", stageEl.clientWidth / MAP_IMAGE_WIDTH);
}
fitWidgetLayer();
new ResizeObserver(fitWidgetLayer).observe(stageEl);