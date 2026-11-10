// The play time stopwatch. Clicking a marker filters on that play time, and the crown on top clears
// the filter and sends the hands back to the top.
// The long hand is the share of plays that fall in the selected play time, the short hand is the same
// for wins. Hovering a hand shows the 5 most recent plays or the top 3 opponents beaten.
const PLAYTIME_OPTIONS = [
  { minutes: 60, bucket: 60, label: "60", angle: 0, x: 220, y: 155 },
  { minutes: 120, bucket: PLAYTIME_TWO_HOURS_PLUS, label: "2h+", angle: 0, x: 300, y: 215 },
  { minutes: 15, bucket: 15, label: "15", angle: 90, x: 340, y: 265 },
  { minutes: 90, bucket: 90, label: "1½h", angle: 180, x: 220, y: 325 },
  { minutes: 30, bucket: 30, label: "30", angle: 180, x: 220, y: 385 },
  { minutes: 45, bucket: 45, label: "45", angle: 270, x: 100, y: 265 }
];

const PLAYTIME_CENTER = { x: 220, y: 265 };
const playtimeSvg = d3.select("#playtime-svg");
const playtimeWidget = d3.select("#playtime-widget");
let playtimeMinuteAngle = 0;
let playtimeHourAngle = 0;
let playtimeHoverTimer = null;
const {
  minute: playtimeHand,
  hour: playtimeHourHand,
  minutePath: playtimeHandPathSelection,
  hourPath: playtimeHourHandPathSelection,
  minuteHitArea: playtimeHandHitArea,
  hourHitArea: playtimeHourHandHitArea
} = drawPlaytimeStopwatch();

function drawPlaytimeStopwatch() {
  const defs = playtimeSvg.append("defs");
  const shadow = defs.append("filter")
    .attr("id", "playtime-marker-shadow")
    .attr("x", "-100%").attr("y", "-100%")
    .attr("width", "300%").attr("height", "300%");
  shadow.append("feGaussianBlur").attr("stdDeviation", 5);

  playtimeSvg.append("title").text("Playtime filter");
  playtimeSvg.append("desc").text("Select a time marker to show games in the nearest duration category.");

  playtimeSvg.append("ellipse")
    .attr("cx", PLAYTIME_CENTER.x).attr("cy", 438)
    .attr("rx", 145).attr("ry", 16)
    .attr("fill", "#3b2411").attr("opacity", 0.32);

  const crown = playtimeSvg.append("g")
    .attr("class", "playtime-reset")
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", "Reset playtime filter to All")
    .on("click", event => resetPlaytime(event))
    .on("keydown", handlePlaytimeKey);

  crown.append("rect")
    .attr("class", "playtime-crown")
    .attr("x", 199).attr("y", 65).attr("width", 42).attr("height", 48)
    .attr("rx", 5).attr("fill", "#d96700").attr("stroke", "#4b2108").attr("stroke-width", 9);
  crown.append("rect")
    .attr("class", "playtime-crown")
    .attr("x", 174).attr("y", 30).attr("width", 92).attr("height", 40)
    .attr("rx", 16).attr("fill", "#c95700").attr("stroke", "#4b2108").attr("stroke-width", 9);

  playtimeSvg.append("path")
    .attr("d", "M332,148 L359,115")
    .attr("fill", "none").attr("stroke", "#4b2108").attr("stroke-width", 16)
    .attr("stroke-linecap", "round");

  playtimeSvg.append("rect")
    .attr("x", 341).attr("y", 88).attr("width", 48).attr("height", 26)
    .attr("rx", 12).attr("transform", "rotate(38 365 101)")
    .attr("fill", "#4b2108");
  playtimeSvg.append("rect")
    .attr("x", 347).attr("y", 93).attr("width", 36).attr("height", 16)
    .attr("rx", 8).attr("transform", "rotate(38 365 101)")
    .attr("fill", "#c95700");

  playtimeSvg.append("circle")
    .attr("cx", PLAYTIME_CENTER.x).attr("cy", PLAYTIME_CENTER.y)
    .attr("r", 181).attr("fill", "#4b2108");
  playtimeSvg.append("circle")
    .attr("cx", PLAYTIME_CENTER.x).attr("cy", PLAYTIME_CENTER.y)
    .attr("r", 170).attr("fill", "#a94c00").attr("stroke", "#6a2c00").attr("stroke-width", 5);
  playtimeSvg.append("circle")
    .attr("cx", PLAYTIME_CENTER.x).attr("cy", PLAYTIME_CENTER.y)
    .attr("r", 151).attr("fill", "#ffcb28");
  playtimeSvg.append("circle")
    .attr("cx", PLAYTIME_CENTER.x).attr("cy", PLAYTIME_CENTER.y)
    .attr("r", 142).attr("fill", "#fff6df");

  const ticks = d3.range(12).map(index => ({
    angle: index * 30,
    major: index % 3 === 0
  }));
  playtimeSvg.selectAll(".playtime-tick")
    .data(ticks)
    .enter()
    .append("line")
    .attr("class", "playtime-tick")
    .attr("x1", d => PLAYTIME_CENTER.x + Math.sin(d.angle * Math.PI / 180) * 112)
    .attr("y1", d => PLAYTIME_CENTER.y - Math.cos(d.angle * Math.PI / 180) * 112)
    .attr("x2", d => PLAYTIME_CENTER.x + Math.sin(d.angle * Math.PI / 180) * (d.major ? 133 : 125))
    .attr("y2", d => PLAYTIME_CENTER.y - Math.cos(d.angle * Math.PI / 180) * (d.major ? 133 : 125))
    .attr("stroke", "#8d3f0b")
    .attr("stroke-width", d => d.major ? 8 : 5)
    .attr("stroke-linecap", "round");

  const hourHand = playtimeSvg.append("g")
    .attr("class", "playtime-hour-hand")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", "Wins in the selected playtime")
    .attr("transform", `rotate(0 ${PLAYTIME_CENTER.x} ${PLAYTIME_CENTER.y})`)
    .on("mouseenter focus", () => showPlaytimeHover("wins"))
    .on("mouseleave blur", hidePlaytimeHoverSoon);
  const hourHandHitArea = hourHand.append("path")
    .attr("class", "playtime-hand-hitarea")
    .attr("d", `M${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y + 5} L${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y - 78}`);
  const hourHandPath = hourHand.append("path")
    .attr("d", playtimeHandPath(78, 6, 10))
    .attr("fill", "#8d3f0b").attr("stroke", "#4b2108").attr("stroke-width", 3)
    .attr("stroke-linejoin", "round");

  const minuteHand = playtimeSvg.append("g")
    .attr("class", "playtime-hand")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", "Plays in the selected playtime")
    .attr("transform", `rotate(0 ${PLAYTIME_CENTER.x} ${PLAYTIME_CENTER.y})`)
    .on("mouseenter focus", () => showPlaytimeHover("plays"))
    .on("mouseleave blur", hidePlaytimeHoverSoon);
  const minuteHandHitArea = minuteHand.append("path")
    .attr("class", "playtime-hand-hitarea")
    .attr("d", `M${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y + 5} L${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y - 115}`);
  const minuteHandPath = minuteHand.append("path")
    .attr("d", playtimeHandPath(115, 8, 13))
    .attr("fill", "#a82418").attr("stroke", "#4b2108").attr("stroke-width", 4)
    .attr("stroke-linejoin", "round");

  const markers = playtimeSvg.selectAll(".playtime-marker")
    .data(PLAYTIME_OPTIONS)
    .enter()
    .append("g")
    .attr("class", "playtime-marker")
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("aria-label", d => d.bucket === PLAYTIME_TWO_HOURS_PLUS
      ? "Show games of 2 hours or longer"
      : `Show games closest to ${d.minutes} minutes`)
    .attr("transform", d => `translate(${d.x} ${d.y})`)
    .on("click", function (event, d) {
      event.stopPropagation();
      if (!playtimeWidget.classed("open")) {
        openPlaytime();
        return;
      }
      selectPlaytime(d.bucket);
    })
    .on("keydown", handlePlaytimeKey);

  markers.append("circle")
    .attr("class", "playtime-marker-glow")
    .attr("r", d => d.minutes === 90 || d.minutes === 120 ? 25 : 29)
    .attr("filter", "url(#playtime-marker-shadow)");
  markers.append("circle")
    .attr("r", d => d.minutes === 90 || d.minutes === 120 ? 20 : 24)
    .attr("fill", "transparent");
  markers.append("text")
    .attr("class", "playtime-marker-label")
    .text(d => d.label);

  playtimeSvg.append("circle")
    .attr("cx", PLAYTIME_CENTER.x).attr("cy", PLAYTIME_CENTER.y)
    .attr("class", "playtime-hand-hub")
    .attr("r", 20).attr("fill", "#4b2108");
  playtimeSvg.append("circle")
    .attr("cx", PLAYTIME_CENTER.x).attr("cy", PLAYTIME_CENTER.y)
    .attr("class", "playtime-hand-hub")
    .attr("r", 12).attr("fill", "#ffca22");

  minuteHandHitArea.raise();
  hourHandHitArea.raise();

  playtimeWidget
    .on("click", function () {
      if (!this.classList.contains("open")) openPlaytime();
    })
    .on("keydown", function (event) {
      if (!this.classList.contains("open") && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openPlaytime();
      }
    });

  d3.select("#playtime-close").on("click", function (event) {
    event.stopPropagation();
    closePlaytime();
  });

  d3.select("#playtime-hover-card")
    .on("mouseenter", () => clearTimeout(playtimeHoverTimer))
    .on("mouseleave", hidePlaytimeHoverSoon)
    .on("click", event => event.stopPropagation());

  return {
    minute: minuteHand,
    hour: hourHand,
    minutePath: minuteHandPath,
    hourPath: hourHandPath,
    minuteHitArea: minuteHandHitArea,
    hourHitArea: hourHandHitArea
  };
}

function playtimeHandPath(length, halfWidth, baseOffset) {
  const baseY = PLAYTIME_CENTER.y + baseOffset;
  const tipY = PLAYTIME_CENTER.y - 20 - length;
  return `M${PLAYTIME_CENTER.x - halfWidth},${baseY} L${PLAYTIME_CENTER.x},${tipY} L${PLAYTIME_CENTER.x + halfWidth},${baseY} Z`;
}

function handlePlaytimeKey(event, option) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  if (option && option.minutes != null) {
    if (!playtimeWidget.classed("open")) {
      openPlaytime();
      return;
    }
    selectPlaytime(option.bucket);
  }
  else resetPlaytime();
}

function openPlaytime() {
  setExpanded(false);
  closeStar();
  closeMiddle(); // the quick filter menu and the info windows never share the screen with the stopwatch
  d3.select("#widget-layer").classed("playtime-open", true);
  playtimeWidget.classed("open", true).attr("aria-expanded", "true");
}

function closePlaytime() {
  clearTimeout(playtimeHoverTimer);
  d3.select("#playtime-hover-card").classed("visible", false);
  playtimeWidget.classed("open", false).attr("aria-expanded", "false");
  d3.select("#widget-layer").classed("playtime-open", false);
}

function selectPlaytime(bucket) {
  filters.playTimeBuckets = [bucket];
  updateCards();
}

function resetPlaytime(event) {
  if (event) event.stopPropagation();
  filters.playTimeBuckets = null;
  updateCards();
}

function updatePlaytime() {
  const stats = getPlaytimeStats();
  // the hands only point at a marker when exactly one play time is picked, with several (from the quick filter menu) they stay at the top
  let onlyBucket = null;
  if (filters.playTimeBuckets && filters.playTimeBuckets.length === 1) onlyBucket = filters.playTimeBuckets[0];
  const selected = PLAYTIME_OPTIONS.find(option => option.bucket === onlyBucket);
  const minuteTarget = selected ? selected.angle : 0;
  const hourTarget = selected ? selected.minutes / 60 * 30 : 30;
  const shortestTurn = (target, current) => {
    let turn = ((target - current + 540) % 360) - 180;
    if (turn === -180) turn = 180;
    return current + turn;
  };
  const minuteEnd = shortestTurn(minuteTarget, playtimeMinuteAngle);
  const hourEnd = shortestTurn(hourTarget, playtimeHourAngle);

  playtimeHand.interrupt().transition()
    .duration(650)
    .ease(d3.easeCubicInOut)
    .attrTween("transform", function () {
      const interpolate = d3.interpolateNumber(playtimeMinuteAngle, minuteEnd);
      return t => {
        playtimeMinuteAngle = interpolate(t);
        return `rotate(${playtimeMinuteAngle} ${PLAYTIME_CENTER.x} ${PLAYTIME_CENTER.y})`;
      };
    })
    .on("end", () => { playtimeMinuteAngle = minuteTarget; });
  playtimeHourHand.interrupt().transition()
    .duration(650)
    .ease(d3.easeCubicInOut)
    .attrTween("transform", function () {
      const interpolate = d3.interpolateNumber(playtimeHourAngle, hourEnd);
      return t => {
        playtimeHourAngle = interpolate(t);
        return `rotate(${playtimeHourAngle} ${PLAYTIME_CENTER.x} ${PLAYTIME_CENTER.y})`;
      };
    })
    .on("end", () => { playtimeHourAngle = hourTarget; });

  playtimeSvg.selectAll(".playtime-marker")
    .classed("selected", option => filters.playTimeBuckets !== null && filters.playTimeBuckets.includes(option.bucket));

  const playRatio = stats.totalPlays ? stats.selectedPlays / stats.totalPlays : 0;
  const winRatio = stats.totalWins ? stats.selectedWins / stats.totalWins : 0;
  const playLength = Math.max(36, 105 * playRatio);
  const winLength = Math.max(28, 66 * winRatio);
  playtimeHandPathForStats(playLength, winLength);

  playtimeHand.attr("aria-label", `${stats.selectedPlays} plays in the selected playtime; hover for the 5 most recent`);
  playtimeHourHand.attr("aria-label", `${stats.selectedWins} wins in the selected playtime; hover for your top 3 opponents`);
  if (d3.select("#playtime-hover-card").classed("visible")) {
    showPlaytimeHover(d3.select("#playtime-hover-card").attr("data-kind"));
  }
}

function getPlaytimeStats() {
  const season = selectedSeason();
  const months = season ? new Set(season.months.map(month => month.num)) : null;
  const stats = {
    totalPlays: 0,
    totalWins: 0,
    selectedPlays: 0,
    selectedWins: 0,
    recentPlays: [],
    winsAgainst: new Map()
  };

  for (const play of allPlays) {
    if (play.ignored) continue;
    const won = myResult(play, myId);
    if (won === null || !passesYear(play) || !passesPlayFilters(play)) continue;
    if (months && !months.has(Number(play.playDate.slice(5, 7)))) continue;
    if (!passesFilters(play.gameRefId, gameMeta, false, true)) continue;

    stats.totalPlays++;
    if (won) stats.totalWins++;

    const meta = gameMeta.get(play.gameRefId);
    const inPeriod = !filters.playTimeBuckets
      || (meta && meta.playTime != null && filters.playTimeBuckets.includes(playTimeBucket(meta.playTime)));
    if (!inPeriod) continue;

    stats.selectedPlays++;
    stats.recentPlays.push(play);
    if (!won) continue;
    stats.selectedWins++;

    const opponents = new Set();
    for (const score of play.playerScores) {
      if (score.playerRefId === myId || score.winner || opponents.has(score.playerRefId)) continue;
      const info = playerInfo.get(score.playerRefId);
      if (!info || info.isAnonymous || (info.metaData && info.metaData.isNpc)) continue;
      opponents.add(score.playerRefId);
      stats.winsAgainst.set(score.playerRefId, (stats.winsAgainst.get(score.playerRefId) || 0) + 1);
    }
  }

  stats.recentPlays.sort((a, b) =>
    b.playDate.localeCompare(a.playDate) || (b.entryDate || "").localeCompare(a.entryDate || "")
  );
  return stats;
}

function playtimeHandPathForStats(playLength, winLength) {
  playtimeHandPathSelection.attr("d", playtimeHandPath(playLength, 8, 13));
  playtimeHourHandPathSelection.attr("d", playtimeHandPath(winLength, 6, 10));
  playtimeHandHitArea.attr("d", `M${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y + 5} L${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y - 20 - playLength}`);
  playtimeHourHandHitArea.attr("d", `M${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y + 5} L${PLAYTIME_CENTER.x},${PLAYTIME_CENTER.y - 20 - winLength}`);
}

function showPlaytimeHover(kind) {
  if (kind !== "plays" && kind !== "wins") return;
  clearTimeout(playtimeHoverTimer);
  const stats = getPlaytimeStats();
  const card = d3.select("#playtime-hover-card")
    .attr("data-kind", kind)
    .classed("visible", true);
  const isPlays = kind === "plays";
  const period = !filters.playTimeBuckets ? "all times" : describePlayTimes(filters.playTimeBuckets);
  d3.select("#playtime-hover-title").text(isPlays ? "MOST RECENT PLAYS" : "WINS AGAINST");
  d3.select("#playtime-hover-count").text(isPlays
    ? `${stats.selectedPlays} plays \u00b7 ${period}`
    : `${stats.selectedWins} wins \u00b7 ${period}`);

  const rows = isPlays
    ? stats.recentPlays.slice(0, 5).map(play => ({
        name: gameNames.get(play.gameRefId) || "Unknown game",
        detail: play.playDate
      }))
    : topList(stats.winsAgainst, id => playerInfo.get(id).name, 3).map(player => ({
        name: player.name,
        detail: player.value + (player.value === 1 ? " win" : " wins")
      }));

  const list = d3.select("#playtime-hover-list");
  list.selectAll("li").remove();
  list.selectAll("li").data(rows).enter().append("li")
    .each(function (row, index) {
      const item = d3.select(this);
      item.append("span").attr("class", "playtime-hover-rank").text(index + 1);
      item.append("span").attr("class", "playtime-hover-name").text(row.name);
      item.append("span").attr("class", "playtime-hover-detail").text(row.detail);
    });
  if (rows.length === 0) {
    list.append("li").attr("class", "playtime-hover-empty")
      .text(isPlays ? "No plays in this selection" : "No wins in this selection");
  }
}

function hidePlaytimeHoverSoon() {
  clearTimeout(playtimeHoverTimer);
  playtimeHoverTimer = setTimeout(() => {
    d3.select("#playtime-hover-card").classed("visible", false);
  }, 350);
}