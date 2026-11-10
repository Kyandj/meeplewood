// Year controls at the bottom of the map: a slider for a single year (or "All" on its last stop)
// and a dropdown with checkboxes for picking several years. Only one of them is in charge at a time:
// moving the slider clears the checkboxes, and ticking a year takes over from the slider.
// Every change calls onChange with a Set of years, or null when all years are selected.
function setupYearControls(years, onChange) {
  const n = years.length;                  // one stop per year, plus a last one for "All"
  const labels = years.map(String).concat("All");
  const slider = document.getElementById("year-slider");
  const countEl = document.getElementById("year-count");
  const dropdown = document.querySelector(".year-dropdown");
  const checked = new Set();

  slider.min = 0;
  slider.max = n;
  slider.step = 1;
  slider.value = n;                        // starts on "All"

  // year labels under the slider, clicking one moves the slider there
  const ticks = d3.select("#year-ticks").style("--n", Math.max(n, 1));
  ticks.selectAll("span").data(labels).enter().append("span")
    .attr("class", "tick")
    .style("--i", (d, i) => i)
    .text(d => d)
    .on("click", (event, d) => moveSlider(labels.indexOf(d)));

  // one checkbox per year in the dropdown
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
    let selection = null;                                           // null means all years
    if (multi) selection = new Set(checked);
    else if (+slider.value < n) selection = new Set([years[+slider.value]]);

    slider.classList.toggle("multi", multi);                        // grey out the slider thumb while the checkboxes are in use
    countEl.textContent = checked.size + (checked.size === 1 ? " year" : " years");
    ticks.selectAll(".tick").classed("active", (d, i) => multi ? checked.has(years[i]) : i === +slider.value);
    onChange(selection);
  }

  // using the slider or the arrows clears any ticked years
  slider.addEventListener("input", function () {
    checked.clear();
    d3.selectAll("#year-list input").property("checked", false);
    update();
  });
  document.getElementById("year-prev").addEventListener("click", () => moveSlider(+slider.value - 1));
  document.getElementById("year-next").addEventListener("click", () => moveSlider(+slider.value + 1));

  // the button toggles the dropdown, a click anywhere outside closes it
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

  update(); // run once so the labels and the first onChange call match the starting "All" state
}