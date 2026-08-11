const fmtDate = d3.timeFormat("%b %d");
const fmtFullDate = d3.timeFormat("%B %d, %Y");
const fmtMonth = d3.timeFormat("%B %Y");
const fmtMonthName = d3.timeFormat("%B");
const parseMonth = d3.timeParse("%Y-%m");
const tooltip = d3.select("#tooltip");
const details = d3.select("#details");
const investigateButton = d3.select("#investigate-night");
const agentResults = d3.select("#agent-results");
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

function updateProfileCards(d) {
  const nearby = nearbyNights(d.display_date, 3);
  const durationMedian = median(nearby.map(n => n.total_sleep_hours));
  const bedtimeMedian = median(nearby.map(n => n.sleep_start_clock));
  const awakeningMedian = median(nearby.map(n => n.awakening_count));
  const stepsMedian = median(allSleepSummary.map(n => n.steps).filter(Number.isFinite));
  const score = calculateNightStability(d);

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

  profileWeather.text("—");
  profileWeatherNote.text("Run investigation to load Tianjin weather");
}

function updateWeatherCard(weather) {
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
  url.searchParams.set("timezone", "Asia/Shanghai");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed: ${response.status}`);
  }

  const json = await response.json();
  const daily = json.daily;

  return {
    weather_code: daily.weather_code?.[0] ?? null,
    temperature_mean: daily.temperature_2m_mean?.[0] ?? null,
    temperature_max: daily.temperature_2m_max?.[0] ?? null,
    temperature_min: daily.temperature_2m_min?.[0] ?? null,
    humidity_mean: daily.relative_humidity_2m_mean?.[0] ?? null,
    precipitation_sum: daily.precipitation_sum?.[0] ?? null
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
        investigateButton.property("disabled", false);
        agentResults.html(`
          <p><strong>${fmtFullDate(selectedNight.display_date_obj)}</strong> selected.</p>
          <p>Ready to investigate this night.</p>
        `);

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

investigateButton.on("click", async () => {
  if (!selectedNight) return;

  investigateButton.property("disabled", true).text("Checking context…");
  agentResults.html(`
    <p class="agent-kicker">INVESTIGATING</p>
    <p><strong>${fmtFullDate(selectedNight.display_date_obj)}</strong></p>
    <p>Loading historical weather for Tianjin...</p>
  `);

  try {
    const weather = await getHistoricalWeather(selectedNight.display_date);
    selectedNight.weather = weather;
    updateWeatherCard(weather);

    agentResults.html(`
      <p class="agent-kicker">CONTACTING FIREBASE</p>
      <p><strong>${fmtFullDate(selectedNight.display_date_obj)}</strong></p>
      <p>Sending the selected night to the sleep investigation backend...</p>
    `);

    const response = await fetch(SLEEP_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        date: selectedNight.display_date,
        sleep: buildSleepPayload(selectedNight),
        activity: {
          steps: selectedNight.steps
        },
        weather,
        recentSleep: getRecentSleepContext(selectedNight.display_date)
      })
    });

    if (!response.ok) {
      throw new Error(`Firebase request failed: ${response.status}`);
    }

    const firebaseResult = await response.json();

    if (!firebaseResult.analysis) {
      throw new Error(firebaseResult.details || firebaseResult.error || "No agent analysis returned");
    }

    agentResults.html(`
      <p class="agent-kicker">AGENT ANALYSIS</p>
      <p><strong>${fmtFullDate(selectedNight.display_date_obj)}</strong></p>
      <p>
        ${selectedNight.total_sleep_hours.toFixed(1)} hours of sleep ·
        ${selectedNight.awakening_count} awakening${selectedNight.awakening_count === 1 ? "" : "s"} ·
        ${selectedNight.steps == null ? "No step data" : `${d3.format(",")(selectedNight.steps)} steps`}
      </p>
      <div class="agent-analysis">${firebaseResult.analysis.replace(/\n/g, "<br>")}</div>
    `);
  } catch (error) {
    console.error(error);
    agentResults.html(`
      <p class="agent-kicker">CONNECTION ERROR</p>
      <p>${error.message}</p>
    `);
  } finally {
    investigateButton.property("disabled", false).text("Investigate this night");
  }
});
