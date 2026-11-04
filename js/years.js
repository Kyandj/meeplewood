// Year controls at the bottom of the map:
//   - wooden slider: ONE year, or "All" (the last stop)
//   - dropdown: tick SEVERAL years
// The two take turns: touching the slider clears the ticks, ticking a year
// takes over from the slider. Whatever changes is reported through onChange(),
// with a Set of years, or null for "all years".
function setupYearControls(years, onChange) {
  const n = years.length;                  // the slider has n + 1 stops: every year, then "All"
  const labels = years.map(String).concat("All");
  const slider = document.getElementById("year-slider");
  const countEl = document.getElementById("year-count");
  const dropdown = document.querySelector(".year-dropdown");
  const checked = new Set();

  slider.min = 0;
  slider.max = n;
  slider.step = 1;
  slider.value = n;                        // start on "All"

  // tick labels under the slider (click one to jump there)
  const ticks = d3.select("#year-ticks").style("--n", Math.max(n, 1));
  ticks.selectAll("span").data(labels).enter().append("span")
    .attr("class", "tick")
    .style("--i", (d, i) => i)
    .text(d => d)
    .on("click", (event, d) => moveSlider(labels.indexOf(d)));

  // dropdown list: one checkbox per year
  const items = d3.select("#year-list").selectAll("label").data(years).enter().append("label");
  items.append("input").attr("type", "checkbox").attr("value", d => d).on("change", function () {
    if (this.checked) checked.add(+this.value); else checked.delete(+this.value);
    update();
  });
  items.append("span").text(d => d);

  function moveSlider(index) {
    slider.value = Math.max(0, Math.min(n, index));
    slider.dispatchEvent(new Event("input"));
  }

  function update() {
    const multi = checked.size > 0;
    let selection = null;                                           // null = all years
    if (multi) selection = new Set(checked);
    else if (+slider.value < n) selection = new Set([years[+slider.value]]);

    slider.classList.toggle("multi", multi);                        // greys the thumb while the ticks are in charge
    countEl.textContent = checked.size + (checked.size === 1 ? " year" : " years");
    ticks.selectAll(".tick").classed("active", (d, i) => multi ? checked.has(years[i]) : i === +slider.value);
    onChange(selection);
  }

  // slider (and arrows) take over from the ticks
  slider.addEventListener("input", function () {
    checked.clear();
    d3.selectAll("#year-list input").property("checked", false);
    update();
  });
  document.getElementById("year-prev").addEventListener("click", () => moveSlider(+slider.value - 1));
  document.getElementById("year-next").addEventListener("click", () => moveSlider(+slider.value + 1));

  // open/close the dropdown; clicking anywhere else closes it
  const button = document.getElementById("year-dropdown-btn");
  button.addEventListener("click", function () {
    const open = dropdown.classList.toggle("open");
    button.setAttribute("aria-expanded", open);
  });
  document.addEventListener("click", function (event) {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("open");
      button.setAttribute("aria-expanded", false);
    }
  }, true);

  update(); // sets the labels/highlight for the starting state ("All") and reports it once
}
