// Interactive playtime stopwatch. Selecting a marker filters to the nearest
// duration category; the crown clears that filter and returns the hand to the top.
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
  playtimeSvg.append("defs").append("filter").attr("id", "playtime-marker-shadow")
    .attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%")
    .append("feGaussianBlur").attr("stdDeviation", 5);
  playtimeSvg.append("title").text("Playtime filter");
  playtimeSvg.append("desc").text("Select a time marker to show games in the nearest duration category.");

  const add = (tag, attrs, parent = playtimeSvg) => {
    const node = parent.append(tag);
    for (const [key, value] of Object.entries(attrs)) node.attr(key, value);
    return node;
  };
  const circle = (className, r) => add("circle", { class: className, cx: PLAYTIME_CENTER.x, cy: PLAYTIME_CENTER.y, r });
  const crown = add("g", { class: "playtime-reset", role: "button", tabindex: 0, "aria-label": "Reset playtime filter to All" })
    .on("click", resetPlaytime).on("keydown", handlePlaytimeKey);

  add("ellipse", { class: "playtime-shadow", cx: 220, cy: 438, rx: 145, ry: 16 });
  add("rect", { class: "playtime-crown playtime-crown-stem", x: 199, y: 65, width: 42, height: 48, rx: 5 }, crown);
  add("rect", { class: "playtime-crown playtime-crown-cap", x: 174, y: 30, width: 92, height: 40, rx: 16 }, crown);
  add("path", { class: "playtime-knob-stem", d: "M332,148 L359,115" });
  add("rect", { class: "playtime-knob-base", x: 341, y: 88, width: 48, height: 26, rx: 12, transform: "rotate(38 365 101)" });
  add("rect", { class: "playtime-knob-cap", x: 347, y: 93, width: 36, height: 16, rx: 8, transform: "rotate(38 365 101)" });
  circle("playtime-case-shadow", 181);
  circle("playtime-bezel", 170);
  circle("playtime-dial", 151);
  circle("playtime-face", 142);

  playtimeSvg.selectAll(".playtime-tick").data(d3.range(12)).enter().append("line")
    .attr("class", i => `playtime-tick${i % 3 ? "" : " major"}`)
    .attr("x1", i => 220 + Math.sin(i * Math.PI / 6) * 112)
    .attr("y1", i => 265 - Math.cos(i * Math.PI / 6) * 112)
    .attr("x2", i => 220 + Math.sin(i * Math.PI / 6) * (i % 3 ? 125 : 133))
    .attr("y2", i => 265 - Math.cos(i * Math.PI / 6) * (i % 3 ? 125 : 133));

  const hand = (type, length, width, offset, hover) => {
    const group = add("g", { class: type === "hour" ? "playtime-hour-hand" : "playtime-hand", tabindex: 0, role: "button",
      "aria-label": `${type === "hour" ? "Wins" : "Plays"} in the selected playtime`,
      transform: `rotate(0 220 265)` })
      .on("mouseenter focus", () => showPlaytimeHover(hover)).on("mouseleave blur", hidePlaytimeHoverSoon);
    const hit = add("path", { class: "playtime-hand-hitarea", d: `M220,270 L220,${265 - length}` }, group);
    const path = add("path", { class: `playtime-${type}-hand-shape`, d: playtimeHandPath(length, width, offset) }, group);
    return { group, hit, path };
  };
  const hour = hand("hour", 78, 6, 10, "wins"), minute = hand("minute", 115, 8, 13, "plays");

  const markers = playtimeSvg.selectAll(".playtime-marker").data(PLAYTIME_OPTIONS).enter().append("g")
    .attr("class", "playtime-marker").attr("role", "button").attr("tabindex", 0)
    .attr("aria-label", d => d.bucket === PLAYTIME_TWO_HOURS_PLUS ? "Show games of 2 hours or longer" : `Show games closest to ${d.minutes} minutes`)
    .attr("transform", d => `translate(${d.x} ${d.y})`)
    .on("click", function (event, d) {
      event.stopPropagation();
      if (!playtimeWidget.classed("open")) openPlaytime();
      else selectPlaytime(d.bucket);
    }).on("keydown", handlePlaytimeKey);
  markers.append("circle").attr("class", "playtime-marker-glow").attr("r", d => d.minutes === 90 || d.minutes === 120 ? 25 : 29);
  markers.append("circle").attr("class", "playtime-marker-hit").attr("r", d => d.minutes === 90 || d.minutes === 120 ? 20 : 24);
  markers.append("text").attr("class", "playtime-marker-label").text(d => d.label);
  circle("playtime-hand-hub playtime-hand-hub-shadow", 20);
  circle("playtime-hand-hub playtime-hand-hub-center", 12);
  minute.hit.raise();
  hour.hit.raise();

  playtimeWidget.on("click", function () {
    if (!this.classList.contains("open")) openPlaytime();
  }).on("keydown", function (event) {
    if (!this.classList.contains("open") && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault(); openPlaytime();
    }
  });
  d3.select("#playtime-close").on("click", event => { event.stopPropagation(); closePlaytime(); });
  d3.select("#playtime-hover-card").on("mouseenter", () => clearTimeout(playtimeHoverTimer))
    .on("mouseleave", hidePlaytimeHoverSoon).on("click", event => event.stopPropagation());
  return { minute: minute.group, hour: hour.group, minutePath: minute.path, hourPath: hour.path, minuteHitArea: minute.hit, hourHitArea: hour.hit };
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
  d3.select("#widget-layer").classed("playtime-open", true);
  playtimeWidget.classed("open", true).attr("aria-expanded", "true");
}

function closePlaytime() {
  clearTimeout(playtimeHoverTimer);
  d3.select("#playtime-hover-card").classed("visible", false);
  d3.select("#widget-layer").classed("playtime-hover-visible", false);
  d3.select("#widget-layer").classed("playtime-windows-open", false);
  d3.select("#playtime-toggle").attr("aria-expanded", "false");
  playtimeWidget.classed("open", false).attr("aria-expanded", "false");
  d3.select("#widget-layer").classed("playtime-open", false);
}

d3.select("#playtime-toggle").on("click", function (event) {
  event.stopPropagation();
  const open = !d3.select("#widget-layer").classed("playtime-windows-open");
  d3.select("#widget-layer").classed("playtime-windows-open", open);
  d3.select(this)
    .attr("aria-expanded", open)
    .attr("aria-label", open ? "Hide playtime data" : "Show playtime data");
  if (open) updateWindows();
});

function selectPlaytime(bucket) {
  filters.playTimeBucket = bucket;
  updateCards();
}

function resetPlaytime(event) {
  if (event) event.stopPropagation();
  filters.playTimeBucket = null;
  updateCards();
}

function updatePlaytime() {
  const stats = getPlaytimeStats();
  const selected = PLAYTIME_OPTIONS.find(option => option.bucket === filters.playTimeBucket);
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
    .classed("selected", option => selected === option);

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
    if (won === null || !passesYear(play)) continue;
    if (months && !months.has(Number(play.playDate.slice(5, 7)))) continue;
    if (!passesFilters(play.gameRefId, gameMeta, false, true)) continue;

    stats.totalPlays++;
    if (won) stats.totalWins++;

    const meta = gameMeta.get(play.gameRefId);
    const inPeriod = filters.playTimeBucket == null
      || (meta && meta.playTime != null && playTimeBucket(meta.playTime) === filters.playTimeBucket);
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
  d3.select("#widget-layer").classed("playtime-hover-visible", true);
  const isPlays = kind === "plays";
  const period = filters.playTimeBucket == null ? "all times" : playTimeBucketLabel(filters.playTimeBucket);
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
    d3.select("#widget-layer").classed("playtime-hover-visible", false);
  }, 350);
}
