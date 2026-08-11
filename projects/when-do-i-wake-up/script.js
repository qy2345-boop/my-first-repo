const fmtDate = d3.timeFormat("%b %d");
const fmtFullDate = d3.timeFormat("%B %d, %Y");
const fmtMonth = d3.timeFormat("%B %Y");
const fmtMonthName = d3.timeFormat("%B");
const parseMonth = d3.timeParse("%Y-%m");
const tooltip = d3.select("#tooltip");
const details = d3.select("#details");
const investigateButton = d3.select("#investigate-night");
const agentResults = d3.select("#agent-results");
const agentChatForm = d3.select("#agent-chat-form");
const agentQuestion = d3.select("#agent-question");
const agentPrompts = d3.selectAll(".agent-prompt");
const nightScore = d3.select("#night-score");
const nightScoreNote = d3.select("#night-score-note");
const profileDuration = d3.select("#profile-duration");
const profileDurationNote = d3.select("#profile-duration-note");
const profileTiming = d3.select("#profile-timing");
const profileTimingNote = d3.select("#profile-timing-note");
const profileFragmentation = d3.select("#profile-fragmentation");
const profileFragmentationNote = d3.select("#profile-fragmentation-note");
const profileStages = d3.select("#profile-stages");
const profileStagesNote = d3.select("#profile-stages-note");
const profileActivity = d3.select("#profile-activity");
const profileActivityNote = d3.select("#profile-activity-note");
const profileWeather = d3.select("#profile-weather");
const profileWeatherNote = d3.select("#profile-weather-note");
let selectedNight = null;
let allSleepSummary = [];
let allSleepStages = [];
let allAwakenings = [];
const SLEEP_FUNCTION_URL = "https://us-central1-dark-kitchen-53278.cloudfunctions.net/investigateSleepNight";

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
  })),
  d3.csv("data/steps_q4_2025.csv", d => ({
    ...d,
    steps: +d.steps
  }))
]).then(([stages, summary, awakenings, monthly, steps]) => {
  allSleepSummary = summary;
  allSleepStages = stages;
  allAwakenings = awakenings;
  const stepsByDate = new Map(steps.map(d => [d.date, d.steps]));
  summary.forEach(d => {
    d.steps = stepsByDate.get(d.display_date) ?? null;
  });
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

function median(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  return d3.quantileSorted(clean, 0.5);
}

function circularHourDifference(a, b) {
  const diff = Math.abs(a - b) % 24;
  return Math.min(diff, 24 - diff);
}

function nearbyNights(selectedDate, radius = 3) {
  const index = allSleepSummary.findIndex(d => d.display_date === selectedDate);
  if (index === -1) return [];
  const start = Math.max(0, index - radius);
  const end = Math.min(allSleepSummary.length, index + radius + 1);
  return allSleepSummary.slice(start, end).filter(d => d.display_date !== selectedDate);
}

function calculateNightStability(d) {
  const nearby = nearbyNights(d.display_date, 3);
  if (!nearby.length) return null;

  const durationMedian = median(nearby.map(n => n.total_sleep_hours));
  const bedtimeMedian = median(nearby.map(n => n.sleep_start_clock));
  const awakeningMedian = median(nearby.map(n => n.awakening_count));
  const stageMedian = median(nearby.map(n => n.deep_minutes + n.rem_minutes));

  const durationScore = durationMedian == null
    ? 0
    : Math.max(0, 1 - Math.abs(d.total_sleep_hours - durationMedian) / 3);

  const timingScore = bedtimeMedian == null
    ? 0
    : Math.max(0, 1 - circularHourDifference(d.sleep_start_clock, bedtimeMedian) / 3);

  const fragmentationScore = awakeningMedian == null
    ? 0
    : Math.max(0, 1 - Math.abs(d.awakening_count - awakeningMedian) / 5);

  const selectedStages = d.deep_minutes + d.rem_minutes;
  const stageScore = stageMedian == null || stageMedian === 0
    ? 0
    : Math.max(0, 1 - Math.abs(selectedStages - stageMedian) / Math.max(stageMedian, 60));

  return Math.round(
    durationScore * 35 +
    timingScore * 25 +
    fragmentationScore * 25 +
    stageScore * 15
  );
}

function relativeLabel(value, baseline, unit = "") {
  if (baseline == null || !Number.isFinite(value) || !Number.isFinite(baseline)) {
    return "No nearby baseline";
  }
  const diff = value - baseline;
  if (Math.abs(diff) < 0.05) return "Close to nearby-night median";
  const direction = diff > 0 ? "above" : "below";
  return `${Math.abs(diff).toFixed(1)}${unit} ${direction} nearby-night median`;
}

// Mini-chart helper/drawing functions moved here for global access
function miniChartContext(d, radius = 2) {
  const index = allSleepSummary.findIndex(n => n.display_date === d.display_date);
  if (index === -1) return [];
  const start = Math.max(0, index - radius);
  const end = Math.min(allSleepSummary.length, index + radius + 1);
  return allSleepSummary.slice(start, end);
}

function clearMiniChart(selector) {
  d3.select(selector).selectAll("*").remove();
}

function showMiniTooltip(event, html) {
  tooltip
    .style("opacity", 1)
    .style("left", `${event.clientX}px`)
    .style("top", `${event.clientY}px`)
    .html(html);
}

function hideMiniTooltip() {
  tooltip.style("opacity", 0);
}

function drawStabilityChart(d) {
  const selector = "#stability-chart";
  clearMiniChart(selector);
  const score = calculateNightStability(d);
  if (score == null) return;

  const width = 260;
  const height = 72;
  const svg = d3.select(selector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleLinear().domain([0, 100]).range([0, width]);

  svg.append("line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", 38)
    .attr("y2", 38)
    .attr("stroke", "#cfc8bb")
    .attr("stroke-width", 8)
    .attr("stroke-linecap", "round");

  svg.append("line")
    .attr("x1", 0)
    .attr("x2", x(score))
    .attr("y1", 38)
    .attr("y2", 38)
    .attr("stroke", "#324f5d")
    .attr("stroke-width", 8)
    .attr("stroke-linecap", "round");

  [60, 80].forEach(value => {
    svg.append("line")
      .attr("x1", x(value))
      .attr("x2", x(value))
      .attr("y1", 29)
      .attr("y2", 47)
      .attr("stroke", "#817d77")
      .attr("stroke-width", 1);
  });
}

function drawDurationChart(d) {
  const selector = "#duration-chart";
  clearMiniChart(selector);
  const data = miniChartContext(d, 2);
  if (!data.length) return;

  const width = 280;
  const height = 92;
  const margin = {top: 8, right: 6, bottom: 18, left: 6};
  const svg = d3.select(selector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleBand()
    .domain(data.map(n => n.display_date))
    .range([margin.left, width - margin.right])
    .padding(.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, n => n.total_sleep_hours) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", n => x(n.display_date))
    .attr("y", n => y(n.total_sleep_hours))
    .attr("width", x.bandwidth())
    .attr("height", n => height - margin.bottom - y(n.total_sleep_hours))
    .attr("rx", 3)
    .attr("fill", n => n.display_date === d.display_date ? "#324f5d" : "#c7d2d4")
    .on("mousemove", (event, n) => {
      showMiniTooltip(event, `
        <strong>${fmtFullDate(n.display_date_obj)}</strong><br>
        ${n.total_sleep_hours.toFixed(1)} h sleep
      `);
    })
    .on("mouseleave", hideMiniTooltip);

  svg.selectAll("text")
    .data(data)
    .join("text")
    .attr("x", n => x(n.display_date) + x.bandwidth()/2)
    .attr("y", height - 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 8)
    .attr("fill", "#817d77")
    .text(n => d3.timeFormat("%m/%d")(n.display_date_obj));
}

function drawTimingChart(d) {
  const selector = "#timing-chart";
  clearMiniChart(selector);
  const data = miniChartContext(d, 2);
  if (!data.length) return;

  const width = 280;
  const height = 100;
  const margin = {top: 10, right: 8, bottom: 18, left: 8};
  const svg = d3.select(selector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const normalize = value => value < 12 ? value + 24 : value;
  const x = d3.scaleLinear().domain([18, 36]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(data.map(n => n.display_date)).range([margin.top, height - margin.bottom]).padding(.45);

  svg.selectAll("line.sleep-range")
    .data(data)
    .join("line")
    .attr("class", "sleep-range")
    .attr("x1", n => x(normalize(n.sleep_start_clock)))
    .attr("x2", n => x(normalize(n.sleep_end_clock)))
    .attr("y1", n => y(n.display_date) + y.bandwidth()/2)
    .attr("y2", n => y(n.display_date) + y.bandwidth()/2)
    .attr("stroke", n => n.display_date === d.display_date ? "#324f5d" : "#c7d2d4")
    .attr("stroke-width", n => n.display_date === d.display_date ? 7 : 5)
    .attr("stroke-linecap", "round")
    .on("mousemove", (event, n) => {
      showMiniTooltip(event, `
        <strong>${fmtFullDate(n.display_date_obj)}</strong><br>
        ${formatClock(n.sleep_start_clock)}–${formatClock(n.sleep_end_clock)}
      `);
    })
    .on("mouseleave", hideMiniTooltip);

  svg.selectAll("text.date")
    .data(data)
    .join("text")
    .attr("class", "date")
    .attr("x", margin.left)
    .attr("y", n => y(n.display_date) + y.bandwidth()/2 - 5)
    .attr("font-size", 7)
    .attr("fill", "#817d77")
    .text(n => d3.timeFormat("%m/%d")(n.display_date_obj));
}

function drawFragmentationChart(d) {
  const selector = "#fragmentation-chart";
  clearMiniChart(selector);
  const events = allAwakenings.filter(a =>
    a.display_date === d.display_date ||
    a.date === d.display_date ||
    a.session_id === d.session_id
  );

  const width = 280;
  const height = 84;
  const svg = d3.select(selector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const start = d.sleep_start_clock;
  const end = d.sleep_end_clock;
  const normalizeNightClock = value => value < start ? value + 24 : value;
  const normalizedEnd = normalizeNightClock(end);
  const x = d3.scaleLinear()
    .domain([start, normalizedEnd])
    .range([12, width - 12]);

  svg.append("line")
    .attr("x1", 12)
    .attr("x2", width - 12)
    .attr("y1", 42)
    .attr("y2", 42)
    .attr("stroke", "#c7d2d4")
    .attr("stroke-width", 3)
    .attr("stroke-linecap", "round");

  svg.selectAll("circle")
    .data(events)
    .join("circle")
    .attr("cx", a => x(normalizeNightClock(a.start_clock)))
    .attr("cy", 42)
    .attr("r", 5)
    .attr("fill", "#324f5d")
    .on("mousemove", (event, a) => {
      showMiniTooltip(event, `
        <strong>AWAKENING</strong><br>
        ${formatClock(a.start_clock)}–${formatClock(a.end_clock)}<br>
        ${Math.round(a.duration_minutes)} min
      `);
    })
    .on("mouseleave", hideMiniTooltip);

  svg.append("text")
    .attr("x", 12)
    .attr("y", 67)
    .attr("font-size", 7)
    .attr("fill", "#817d77")
    .text(formatClock(start));

  svg.append("text")
    .attr("x", width - 12)
    .attr("y", 67)
    .attr("text-anchor", "end")
    .attr("font-size", 7)
    .attr("fill", "#817d77")
    .text(formatClock(end));
}

function drawStagesChart(d) {
  const selector = "#stages-chart";
  clearMiniChart(selector);

  const core = Math.max(0, d.total_sleep_hours * 60 - d.deep_minutes - d.rem_minutes);
  const data = [
    {label: "Core", value: core, fill: "#b8c8cc"},
    {label: "REM", value: d.rem_minutes, fill: "#7f9da6"},
    {label: "Deep", value: d.deep_minutes, fill: "#324f5d"}
  ];
  const total = d3.sum(data, n => n.value) || 1;

  const width = 280;
  const height = 88;
  const svg = d3.select(selector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  let cursor = 0;
  data.forEach(segment => {
    const segmentWidth = width * segment.value / total;
    svg.append("rect")
      .attr("x", cursor)
      .attr("y", 22)
      .attr("width", segmentWidth)
      .attr("height", 22)
      .attr("fill", segment.fill)
      .on("mousemove", event => {
        showMiniTooltip(event, `
          <strong>${segment.label.toUpperCase()}</strong><br>
          ${Math.round(segment.value)} min
        `);
      })
      .on("mouseleave", hideMiniTooltip);
    cursor += segmentWidth;
  });

  const legend = svg.selectAll("g.legend-item")
    .data(data)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (n, i) => `translate(${i * 92},63)`);

  legend.append("circle")
    .attr("r", 3)
    .attr("fill", n => n.fill);

  legend.append("text")
    .attr("x", 7)
    .attr("y", 3)
    .attr("font-size", 7)
    .attr("fill", "#817d77")
    .text(n => `${n.label} ${Math.round(n.value)}m`);
}

function drawActivityChart(d) {
  const selector = "#activity-chart";
  clearMiniChart(selector);
  const data = miniChartContext(d, 2).filter(n => Number.isFinite(n.steps));
  if (!data.length) return;

  const width = 280;
  const height = 92;
  const margin = {top: 8, right: 6, bottom: 18, left: 6};
  const svg = d3.select(selector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const x = d3.scaleBand().domain(data.map(n => n.display_date)).range([margin.left, width - margin.right]).padding(.3);
  const y = d3.scaleLinear().domain([0, d3.max(data, n => n.steps) || 1]).nice().range([height - margin.bottom, margin.top]);

  svg.selectAll("rect")
    .data(data)
    .join("rect")
    .attr("x", n => x(n.display_date))
    .attr("y", n => y(n.steps))
    .attr("width", x.bandwidth())
    .attr("height", n => height - margin.bottom - y(n.steps))
    .attr("rx", 3)
    .attr("fill", n => n.display_date === d.display_date ? "#324f5d" : "#c7d2d4")
    .on("mousemove", (event, n) => {
      showMiniTooltip(event, `
        <strong>${fmtFullDate(n.display_date_obj)}</strong><br>
        ${d3.format(",")(n.steps)} steps
      `);
    })
    .on("mouseleave", hideMiniTooltip);

  svg.selectAll("text")
    .data(data)
    .join("text")
    .attr("x", n => x(n.display_date) + x.bandwidth()/2)
    .attr("y", height - 4)
    .attr("text-anchor", "middle")
    .attr("font-size", 8)
    .attr("fill", "#817d77")
    .text(n => d3.timeFormat("%m/%d")(n.display_date_obj));
}

function drawProfileMiniCharts(d) {
  drawStabilityChart(d);
  drawDurationChart(d);
  drawTimingChart(d);
  drawFragmentationChart(d);
  drawStagesChart(d);
  drawActivityChart(d);
}

function updateProfileCards(d) {
  const nearby = nearbyNights(d.display_date, 3);
  const durationMedian = median(nearby.map(n => n.total_sleep_hours));
  const bedtimeMedian = median(nearby.map(n => n.sleep_start_clock));
  const awakeningMedian = median(nearby.map(n => n.awakening_count));
  const stepsMedian = median(allSleepSummary.map(n => n.steps).filter(Number.isFinite));
  const score = calculateNightStability(d);
  drawProfileMiniCharts(d);

  nightScore.text(score == null ? "—" : score);
  nightScoreNote.text(
    score == null
      ? "Not enough nearby nights to calculate stability."
      : score >= 80
        ? "Highly consistent with nearby nights"
        : score >= 60
          ? "Moderately consistent with nearby nights"
          : "More variable than nearby nights"
  );

  profileDuration.text(`${d.total_sleep_hours.toFixed(1)} h`);
  profileDurationNote.text(relativeLabel(d.total_sleep_hours, durationMedian, " h"));

  profileTiming.text(`${formatClock(d.sleep_start_clock)} → ${formatClock(d.sleep_end_clock)}`);
  if (bedtimeMedian == null) {
    profileTimingNote.text("No nearby bedtime baseline");
  } else {
    const diff = circularHourDifference(d.sleep_start_clock, bedtimeMedian);
    profileTimingNote.text(
      diff < 0.15
        ? "Close to nearby bedtime"
        : `${diff.toFixed(1)} h from nearby bedtime median`
    );
  }

  profileFragmentation.text(`${d.awakening_count}`);
  profileFragmentationNote.text(
    awakeningMedian == null
      ? "No nearby awakening baseline"
      : `${d.awakening_count === 1 ? "awakening" : "awakenings"} · nearby median ${awakeningMedian.toFixed(1)}`
  );

  profileStages.text(`${Math.round(d.deep_minutes)} / ${Math.round(d.rem_minutes)} min`);
  profileStagesNote.text("Deep / REM sleep");

  profileActivity.text(d.steps == null ? "—" : d3.format(",")(d.steps));
  profileActivityNote.text(
    d.steps == null || stepsMedian == null
      ? "No daily activity baseline"
      : relativeLabel(d.steps, stepsMedian, " steps")
  );

  profileWeather.text(d.weather?.temperature_mean == null ? "—" : `${d.weather.temperature_mean.toFixed(1)}°C`);
  profileWeatherNote.text(
    d.weather
      ? [
          d.weather.humidity_mean == null ? null : `${Math.round(d.weather.humidity_mean)}% humidity`,
          d.weather.precipitation_sum == null ? null : `${d.weather.precipitation_sum.toFixed(1)} mm precipitation`
        ].filter(Boolean).join(" · ") || "Historical weather loaded"
      : "Loading Tianjin historical weather"
  );
}

function drawWeatherChart(weather) {
  const selector = "#weather-chart";
  clearMiniChart(selector);

  const data = (weather.hourly_temperature || [])
    .filter(d => Number.isFinite(d.temperature));

  if (!data.length) return;

  const width = 900;
  const height = 130;
  const margin = {top: 16, right: 16, bottom: 26, left: 16};

  const svg = d3.select(selector)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "none");

  const x = d3.scaleLinear()
    .domain([0, 23])
    .range([margin.left, width - margin.right]);

  const extent = d3.extent(data, d => d.temperature);
  const padding = Math.max(1, (extent[1] - extent[0]) * 0.25);
  const y = d3.scaleLinear()
    .domain([extent[0] - padding, extent[1] + padding])
    .range([height - margin.bottom, margin.top]);

  const area = d3.area()
    .x(d => x(d.hour))
    .y0(height - margin.bottom)
    .y1(d => y(d.temperature))
    .curve(d3.curveMonotoneX);

  const line = d3.line()
    .x(d => x(d.hour))
    .y(d => y(d.temperature))
    .curve(d3.curveMonotoneX);

  svg.append("path")
    .datum(data)
    .attr("d", area)
    .attr("fill", "rgba(142,170,179,.14)");

  svg.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(weather.temperature_mean))
    .attr("y2", y(weather.temperature_mean))
    .attr("stroke", "#cfc8bb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4 5");

  svg.append("path")
    .datum(data)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "#324f5d")
    .attr("stroke-width", 2.5)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round");

  svg.selectAll("circle.weather-point")
    .data(data)
    .join("circle")
    .attr("class", "weather-point")
    .attr("cx", d => x(d.hour))
    .attr("cy", d => y(d.temperature))
    .attr("r", 7)
    .attr("fill", "transparent")
    .on("mousemove", (event, d) => {
      showMiniTooltip(event, `
        <strong>${String(d.hour).padStart(2, "0")}:00</strong><br>
        ${d.temperature.toFixed(1)}°C
      `);
    })
    .on("mouseleave", hideMiniTooltip);

  [0, 6, 12, 18, 23].forEach(hour => {
    svg.append("text")
      .attr("x", x(hour))
      .attr("y", height - 6)
      .attr("text-anchor", hour === 0 ? "start" : hour === 23 ? "end" : "middle")
      .attr("font-size", 8)
      .attr("fill", "#817d77")
      .text(hour === 23 ? "24" : String(hour).padStart(2, "0"));
  });

  const minPoint = data.reduce((a, b) => a.temperature < b.temperature ? a : b);
  const maxPoint = data.reduce((a, b) => a.temperature > b.temperature ? a : b);

  [minPoint, maxPoint].forEach(point => {
    svg.append("circle")
      .attr("cx", x(point.hour))
      .attr("cy", y(point.temperature))
      .attr("r", 3.5)
      .attr("fill", "#324f5d");

    svg.append("text")
      .attr("x", x(point.hour))
      .attr("y", y(point.temperature) - 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 8)
      .attr("fill", "#324f5d")
      .text(`${point.temperature.toFixed(1)}°`);
  });
}

function updateWeatherCard(weather) {
  drawWeatherChart(weather);
  profileWeather.text(
    weather.temperature_mean == null ? "—" : `${weather.temperature_mean.toFixed(1)}°C`
  );
  profileWeatherNote.text(
    [
      weather.humidity_mean == null ? null : `${Math.round(weather.humidity_mean)}% humidity`,
      weather.precipitation_sum == null ? null : `${weather.precipitation_sum.toFixed(1)} mm precipitation`
    ].filter(Boolean).join(" · ") || "Historical weather loaded"
  );
}

async function loadWeatherForNight(d) {
  profileWeather.text("…");
  profileWeatherNote.text("Loading Tianjin historical weather");
  clearMiniChart("#weather-chart");

  try {
    const weather = await getHistoricalWeather(d.display_date);
    if (selectedNight?.display_date !== d.display_date) return;
    d.weather = weather;
    updateWeatherCard(weather);
  } catch (error) {
    console.error(error);
    if (selectedNight?.display_date !== d.display_date) return;
    profileWeather.text("—");
    profileWeatherNote.text("Weather unavailable for this date");
  }
}
function buildQuarterDataset() {
  return allSleepSummary.map(d => ({
    date: d.display_date,
    total_sleep_hours: d.total_sleep_hours,
    sleep_start: formatClock(d.sleep_start_clock),
    wake_time: formatClock(d.sleep_end_clock),
    awakening_count: d.awakening_count,
    longest_awakening_minutes: d.longest_awakening_minutes,
    deep_minutes: d.deep_minutes,
    rem_minutes: d.rem_minutes,
    awake_minutes: d.awake_minutes,
    steps: d.steps
  }));
}

function appendAgentMessage(role, text) {
  const message = agentResults
    .append("div")
    .attr("class", `agent-message agent-message-${role}`);

  message.append("p").text(text);
  const node = agentResults.node();
  if (node) node.scrollTop = node.scrollHeight;
}

async function askSleepAgent(question) {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return;

  appendAgentMessage("user", cleanQuestion);
  agentQuestion.property("value", "");
  investigateButton.property("disabled", true).text("Thinking…");

  const loadingMessage = agentResults
    .append("div")
    .attr("class", "agent-message agent-message-agent")
    .append("p")
    .text("Looking across your Q4 sleep data…");

  try {
    const response = await fetch(SLEEP_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: cleanQuestion,
        selectedDate: selectedNight?.display_date ?? null,
        selectedNight: selectedNight ? buildSleepPayload(selectedNight) : null,
        selectedWeather: selectedNight?.weather ?? null,
        dataset: buildQuarterDataset()
      })
    });

    if (!response.ok) {
      throw new Error(`Firebase request failed: ${response.status}`);
    }

    const result = await response.json();
    const answer = result.answer || result.analysis;
    if (!answer) {
      throw new Error(result.details || result.error || "No agent answer returned");
    }

    loadingMessage.text(answer);
  } catch (error) {
    console.error(error);
    loadingMessage.text(`I couldn't reach the sleep agent: ${error.message}`);
  } finally {
    investigateButton.property("disabled", false).text("Ask agent");
    const node = agentResults.node();
    if (node) node.scrollTop = node.scrollHeight;
  }
}

// Get historical weather for a given date (YYYY-MM-DD) in Tianjin
async function getHistoricalWeather(date) {
  const latitude = 39.3434;
  const longitude = 117.3616;
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");

  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set("daily", [
    "weather_code",
    "temperature_2m_mean",
    "temperature_2m_max",
    "temperature_2m_min",
    "relative_humidity_2m_mean",
    "precipitation_sum"
  ].join(","));
  url.searchParams.set("hourly", "temperature_2m");
  url.searchParams.set("timezone", "Asia/Shanghai");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const json = await response.json();
  const daily = json.daily;
  const hourlyTimes = json.hourly?.time || [];
  const hourlyTemperatures = json.hourly?.temperature_2m || [];
  const hourlyTemperature = hourlyTimes.map((time, index) => ({
    time,
    hour: new Date(time).getHours(),
    temperature: hourlyTemperatures[index]
  }));

  return {
    weather_code: daily.weather_code?.[0] ?? null,
    temperature_mean: daily.temperature_2m_mean?.[0] ?? null,
    temperature_max: daily.temperature_2m_max?.[0] ?? null,
    temperature_min: daily.temperature_2m_min?.[0] ?? null,
    humidity_mean: daily.relative_humidity_2m_mean?.[0] ?? null,
    precipitation_sum: daily.precipitation_sum?.[0] ?? null,
    hourly_temperature: hourlyTemperature
  };
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
          return;
        }

        tooltip.html(`
          <strong>${fmtFullDate(d.item.display_date_obj)}</strong><br>
          ${d.item.awakening_count} awakening${d.item.awakening_count === 1 ? "" : "s"}
        `);
      })
      .on("mouseleave", () => tooltip.style("opacity", 0))
      .on("click", function(event, d) {
        if (!d.item) return;

        selectedNight = d.item;
        updateProfileCards(selectedNight);
        loadWeatherForNight(selectedNight);
        agentResults.html("");
        appendAgentMessage(
          "system",
          `${fmtFullDate(selectedNight.display_date_obj)} selected. Ask about this night or your Q4 sleep patterns.`
        );

        container.selectAll(".day-cell")
          .classed("is-selected", false);

        d3.select(this)
          .classed("is-selected", true);

        showDetails(selectedNight);
      });

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
    <div class="metric"><span>Sleep start</span><strong>${formatClock(d.sleep_start_clock)}</strong></div>
    <div class="metric"><span>Wake time</span><strong>${formatClock(d.sleep_end_clock)}</strong></div>
    <div class="metric"><span>Steps</span><strong>${d.steps == null ? "—" : d3.format(",")(d.steps)}</strong></div>
    <div class="metric"><span>Longest awakening</span><strong>${Math.round(d.longest_awakening_minutes)} min</strong></div>
    <div class="metric"><span>Deep sleep</span><strong>${Math.round(d.deep_minutes)} min</strong></div>
    <div class="metric"><span>REM sleep</span><strong>${Math.round(d.rem_minutes)} min</strong></div>
  `);
}

function buildSleepPayload(d) {
  return {
    date: d.display_date,
    total_sleep_hours: d.total_sleep_hours,
    sleep_start: formatClock(d.sleep_start_clock),
    wake_time: formatClock(d.sleep_end_clock),
    awakening_count: d.awakening_count,
    longest_awakening_minutes: d.longest_awakening_minutes,
    deep_minutes: d.deep_minutes,
    rem_minutes: d.rem_minutes,
    awake_minutes: d.awake_minutes
  };
}

function getRecentSleepContext(selectedDate, daysEachSide = 3) {
  const selectedIndex = allSleepSummary.findIndex(d => d.display_date === selectedDate);
  if (selectedIndex === -1) return [];

  const start = Math.max(0, selectedIndex - daysEachSide);
  const end = Math.min(allSleepSummary.length, selectedIndex + daysEachSide + 1);

  return allSleepSummary
    .slice(start, end)
    .filter(d => d.display_date !== selectedDate)
    .map(buildSleepPayload);
}

agentChatForm.on("submit", event => {
  event.preventDefault();
  askSleepAgent(agentQuestion.property("value"));
});

agentPrompts.on("click", function() {
  const question = d3.select(this).attr("data-question");
  agentQuestion.property("value", question);
  askSleepAgent(question);
});
