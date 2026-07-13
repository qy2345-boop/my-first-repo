const fmtDate = d3.timeFormat("%b %d");
const fmtFullDate = d3.timeFormat("%B %d, %Y");
const fmtMonth = d3.timeFormat("%B %Y");
const fmtMonthName = d3.timeFormat("%B");
const parseMonth = d3.timeParse("%Y-%m");
const tooltip = d3.select("#tooltip");
const details = d3.select("#details");

Promise.all([
  d3.csv("data/sleep_stages_q4_2025.csv", d => ({
    ...d,
    start_clock: +d.display_start_clock,
    end_clock: +d.display_end_clock,
    duration_minutes: +d.duration_minutes
  })),
  d3.csv("data/sleep_summary_q4_2025.csv", d => ({
    ...d,
    display_date_obj: new Date(d.display_date + "T12:00:00"),
    total_sleep_hours: +d.total_sleep_hours,
    deep_minutes: +d.deep_minutes,
    rem_minutes: +d.rem_minutes,
    awake_minutes: +d.awake_minutes,
    awakening_count: +d.awakening_count,
    longest_awakening_minutes: +d.longest_awakening_minutes,
    sleep_start_clock: +d.display_sleep_start_clock,
    sleep_end_clock: +d.display_sleep_end_clock
  })),
  d3.csv("data/awakening_events_q4_2025.csv", d => ({
    ...d,
    start_clock: +d.start_clock,
    end_clock: +d.end_clock,
    duration_minutes: +d.duration_minutes
  })),
  d3.csv("data/awakening_monthly_summary_q4_2025.csv", d => ({
    ...d,
    recorded_nights: +d.recorded_nights,
    total_awakenings: +d.total_awakenings,
    average_awakenings: +d.average_awakenings,
    most_common_wake_start: +d.most_common_wake_start,
    most_common_wake_end: +d.most_common_wake_end,
    longest_awakening_minutes: +d.longest_awakening_minutes
  }))
]).then(([stages, summary, awakenings, monthly]) => {
  const months = Array.from(new Set(summary.map(d => d.display_month))).sort();
  const select = d3.select("#month-select");

  select.selectAll("option")
    .data(months)
    .join("option")
    .attr("value", d => d)
    .text(d => fmtMonth(parseMonth(d)));

  const initial = "2025-11";
  select.property("value", initial);

  function update(month) {
    const monthSummary = summary.filter(d => d.display_month === month);
    const ids = new Set(monthSummary.map(d => d.session_id));
    const monthStages = stages.filter(d => ids.has(d.session_id));
    const monthAwakenings = awakenings.filter(d => d.month === month);
    const monthStats = monthly.find(d => d.month === month);

    drawTimeline(monthStages, monthSummary, monthAwakenings);
    updateMonthlySummary(monthStats);
  }

  select.on("change", e => update(e.target.value));
  update(initial);
  drawAllCalendars(summary, months);
});

function clockLabel(value) {
  const h24 = ((Math.round(value) % 24) + 24) % 24;
  if (h24 === 0) return "12 AM";
  if (h24 === 12) return "12 PM";
  return `${h24 > 12 ? h24 - 12 : h24} ${h24 >= 12 ? "PM" : "AM"}`;
}

function formatClock(value) {
  const normalized = ((value % 24) + 24) % 24;
  let h = Math.floor(normalized);
  let m = Math.round((normalized - h) * 60);
  if (m === 60) { h = (h + 1) % 24; m = 0; }
  const suffix = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${suffix}`;
}

function stageLabel(stage) {
  return stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : "—";
}

function drawTimeline(stages, summary, awakenings) {
  d3.select("#timeline").selectAll("*").remove();

  const ordered = [...summary].sort((a,b) => d3.ascending(a.display_date_obj, b.display_date_obj));
  const width = 1320;
  const margin = { top: 38, right: 120, bottom: 22, left: 90 };
  const rowHeight = 25;
  const height = margin.top + margin.bottom + ordered.length * rowHeight;

  const svg = d3.select("#timeline")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%");

  const x = d3.scaleLinear()
    .domain([12, 36])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .domain(ordered.map(d => d.session_id))
    .range([margin.top, height - margin.bottom])
    .paddingInner(.28);

  svg.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${margin.top})`)
    .call(
      d3.axisTop(x)
        .tickValues(d3.range(12, 37, 2))
        .tickFormat(clockLabel)
        .tickSize(-(height - margin.top - margin.bottom))
    )
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line").attr("stroke-opacity", .72));

  svg.append("g")
    .selectAll("text")
    .data(ordered)
    .join("text")
    .attr("class", "day-label")
    .attr("x", margin.left - 12)
    .attr("y", d => y(d.session_id) + y.bandwidth()/2 + 3)
    .attr("text-anchor", "end")
    .text(d => fmtDate(d.display_date_obj));

  svg.append("g")
    .selectAll("line")
    .data(ordered)
    .join("line")
    .attr("x1", d => x(d.sleep_start_clock))
    .attr("x2", d => x(d.sleep_end_clock))
    .attr("y1", d => y(d.session_id) + y.bandwidth()/2)
    .attr("y2", d => y(d.session_id) + y.bandwidth()/2)
    .attr("stroke", "#cfc8bb")
    .attr("stroke-width", .9);

  const stageSegment = stages.filter(d => ["rem","core","deep"].includes(d.stage));

  svg.append("g")
    .selectAll("line")
    .data(stageSegment)
    .join("line")
    .attr("x1", d => x(d.start_clock))
    .attr("x2", d => x(d.end_clock))
    .attr("y1", d => y(d.session_id) + y.bandwidth()/2)
    .attr("y2", d => y(d.session_id) + y.bandwidth()/2)
    .attr("stroke", d => d.stage === "deep" ? "#324f5d" : d.stage === "core" ? "#8eaab3" : "#d7e1e3")
    .attr("stroke-width", d => d.stage === "deep" ? 5 : d.stage === "core" ? 4 : 3)
    .attr("stroke-linecap", "butt")
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .style("left", `${event.clientX}px`)
        .style("top", `${event.clientY}px`)
        .html(`
          <strong>${d.stage.toUpperCase()}</strong><br>
          ${formatClock(d.start_clock)}–${formatClock(d.end_clock)}<br>
          ${Math.round(d.duration_minutes)} min
        `);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  svg.append("g")
    .selectAll("path")
    .data(awakenings)
    .join("path")
    .attr("d", d3.symbol().type(d3.symbolTriangle).size(34))
    .attr("transform", d => `translate(${x(d.start_clock)},${y(d.session_id) + y.bandwidth()/2})`)
    .attr("fill", "#111111")
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .style("left", `${event.clientX}px`)
        .style("top", `${event.clientY}px`)
        .html(`
          <strong>AWAKENING</strong><br>
          ${formatClock(d.start_clock)}–${formatClock(d.end_clock)}<br>
          ${Math.round(d.duration_minutes)} min<br>
          Previous stage: ${stageLabel(d.previous_stage)}
        `);
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  svg.append("g")
    .selectAll("text")
    .data(ordered)
    .join("text")
    .attr("x", width - margin.right + 16)
    .attr("y", d => y(d.session_id) + y.bandwidth()/2 + 3)
    .attr("fill", "#66635f")
    .attr("font-size", 10)
    .text(d => `${d.awakening_count} awakening${d.awakening_count === 1 ? "" : "s"}`);
}

function updateMonthlySummary(d) {
  d3.select("#summary-month").text(fmtMonth(parseMonth(d.month)));
  d3.select("#common-window").text(
    `${formatClock(d.most_common_wake_start)}–${formatClock(d.most_common_wake_end)}`
  );
  d3.select("#average-awakenings").text(d.average_awakenings.toFixed(1));
  d3.select("#previous-stage").text(stageLabel(d.most_common_previous_stage));
  d3.select("#longest-awakening").text(`${Math.round(d.longest_awakening_minutes)} min`);
}

function drawAllCalendars(summary, months) {
  const maxCount = d3.max(summary, d => d.awakening_count) || 1;
  const color = d3.scaleLinear()
    .domain([0, maxCount / 2, maxCount])
    .range(["#e6ecec", "#8eaab3", "#324f5d"]);

  const container = d3.select("#all-calendars");

  const cards = container.selectAll(".month-card")
    .data(months)
    .join("section")
    .attr("class", "month-card");

  cards.append("h3")
    .text(d => fmtMonth(parseMonth(d)));

  cards.each(function(month) {
    const rows = summary.filter(d => d.display_month === month);
    const byDate = new Map(rows.map(d => [d.display_date, d]));
    const monthDate = parseMonth(month);
    const startDay = monthDate.getDay();
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0).getDate();

    const grid = d3.select(this).append("div").attr("class", "month-grid");
    const weekdays = ["S","M","T","W","T","F","S"];

    grid.selectAll(".weekday")
      .data(weekdays)
      .join("div")
      .attr("class", "weekday")
      .text(d => d);

    const cells = [];
    for (let i=0; i<startDay; i++) cells.push({blank:true});
    for (let day=1; day<=daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2,"0")}`;
      cells.push({date, day, item: byDate.get(date)});
    }

    const day = grid.selectAll(".day-cell")
      .data(cells)
      .join("div")
      .attr("class", d => `day-cell${d.item ? " has-data" : " no-data"}`)
      .style("visibility", d => d.blank ? "hidden" : "visible")
      .style("background", d => d.item ? color(d.item.awakening_count) : null)
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .style("left", `${event.clientX}px`)
          .style("top", `${event.clientY}px`);

        if (!d.item) {
          tooltip.html(`<strong>${d.date}</strong><br>No sleep record`);
          details.html(`
            <p class="details-kicker">SELECTED NIGHT</p>
            <p class="details-empty">No sleep record for this date.</p>
          `);
          return;
        }

        tooltip.html(`
          <strong>${fmtFullDate(d.item.display_date_obj)}</strong><br>
          ${d.item.awakening_count} awakening${d.item.awakening_count === 1 ? "" : "s"}
        `);
        showDetails(d.item);
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));

    day.filter(d => !d.blank)
      .append("span")
      .attr("class", "day-num")
      .text(d => d.day);
  });
}

function showDetails(d) {
  const month = fmtMonthName(d.display_date_obj);
  const dayYear = d3.timeFormat("%d, %Y")(d.display_date_obj);

  details.html(`
    <p class="details-kicker">SELECTED NIGHT</p>
    <p class="selected-date"><span>${month}</span><span>${dayYear}</span></p>
    <p class="wake-count"><strong>${d.awakening_count}</strong><span>awakening${d.awakening_count === 1 ? "" : "s"}</span></p>
    <div class="metric"><span>Total sleep</span><strong>${d.total_sleep_hours.toFixed(1)} h</strong></div>
    <div class="metric"><span>Longest awakening</span><strong>${Math.round(d.longest_awakening_minutes)} min</strong></div>
    <div class="metric"><span>Deep sleep</span><strong>${Math.round(d.deep_minutes)} min</strong></div>
    <div class="metric"><span>REM sleep</span><strong>${Math.round(d.rem_minutes)} min</strong></div>
  `);
}
