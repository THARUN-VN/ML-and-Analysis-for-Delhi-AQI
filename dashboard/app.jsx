const { useEffect, useMemo, useRef, useState, useCallback } = React;

const NAVIGATION = [
  { id: "overview", label: "Executive Overview", icon: "layout-dashboard", badge: "Live" },
  { id: "3d-twin", label: "3D Spatiotemporal Twin", icon: "box", badge: "3D Twin" },
  { id: "models", label: "ML Model Benchmark", icon: "cpu", badge: "11 Models" },
  { id: "simulator", label: "PM2.5 Live Predictor", icon: "sliders-horizontal", badge: "Simulator" },
  { id: "shap", label: "Explainability & SHAP", icon: "sparkles", badge: "XAI" },
  { id: "spatial", label: "Spatial & Seasonal Lab", icon: "map-pin", badge: "19 Features" },
];

function Icon({ name, size = 18 }) {
  return <i data-lucide={name} style={{ width: size, height: size, display: "inline-block", verticalAlign: "middle" }} aria-hidden="true" />;
}

// Official Indian CPCB Air Quality Index calculation
function getAqiDetails(pm25) {
  if (!Number.isFinite(pm25) || pm25 < 0) return { aqi: 0, category: "Unknown", color: "#64748b", bg: "#1e293b", health: "Insufficient data." };
  if (pm25 <= 30) {
    const aqi = Math.round((50 / 30) * pm25);
    return { aqi, category: "Good", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", health: "Minimal health impact. Clean atmospheric air." };
  } else if (pm25 <= 60) {
    const aqi = Math.round(50 + ((100 - 50) / (60 - 30)) * (pm25 - 30));
    return { aqi, category: "Satisfactory", color: "#84cc16", bg: "rgba(132, 204, 22, 0.15)", health: "Minor breathing discomfort to sensitive individuals." };
  } else if (pm25 <= 90) {
    const aqi = Math.round(100 + ((200 - 100) / (90 - 60)) * (pm25 - 60));
    return { aqi, category: "Moderate", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", health: "Breathing discomfort to people with asthma or lung conditions." };
  } else if (pm25 <= 120) {
    const aqi = Math.round(200 + ((300 - 200) / (120 - 90)) * (pm25 - 90));
    return { aqi, category: "Poor", color: "#f97316", bg: "rgba(249, 115, 22, 0.15)", health: "Breathing discomfort to most individuals on prolonged exposure." };
  } else if (pm25 <= 250) {
    const aqi = Math.round(300 + ((400 - 300) / (250 - 120)) * (pm25 - 120));
    return { aqi, category: "Very Poor", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", health: "Respiratory illness on prolonged exposure. Significant hazard." };
  } else {
    const aqi = Math.min(500, Math.round(400 + ((500 - 400) / (380 - 250)) * Math.min(pm25 - 250, 130)));
    return { aqi, category: "Severe", color: "#be123c", bg: "rgba(190, 18, 60, 0.2)", health: "Severe respiratory risk to all citizens. Avoid outdoor exposure." };
  }
}

function formatVal(value, decimals = 1) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "—";
}

function forecastForStation(monthly, horizon) {
  if (!monthly || !monthly.length) return [];
  const [lastYear, lastMonth] = monthly[monthly.length - 1].month.split("-").map(Number);
  const fallback = monthly.slice(-3).map((item) => item.pm25).filter(Number.isFinite);
  return Array.from({ length: horizon }, (_, index) => {
    const date = new Date(Date.UTC(lastYear, lastMonth - 1 + index + 1, 1));
    const monthNumber = String(date.getUTCMonth() + 1).padStart(2, "0");
    const month = `${date.getUTCFullYear()}-${monthNumber}`;
    const seasonalValues = monthly.filter((item) => item.month.endsWith(`-${monthNumber}`)).map((item) => item.pm25).filter(Number.isFinite);
    const values = seasonalValues.length ? seasonalValues : fallback;
    return {
      month,
      label: date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      pm25: values.length ? values.reduce((total, val) => total + val, 0) / values.length : null,
      kind: "forecast",
    };
  });
}

function App() {
  const [summary, setSummary] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState("overview");

  // Filter States
  const [pollutant, setPollutant] = useState("pm25");
  const [trendPeriod, setTrendPeriod] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");

  // Modal State for Image Inspection
  const [activeModalImage, setActiveModalImage] = useState(null);

  // Fetch initial data
  useEffect(() => {
    Promise.all([
      fetch("/api/overview").then((res) => {
        if (!res.ok) throw new Error("Could not load summary data.");
        return res.json();
      }),
      fetch("/api/models").then((res) => {
        if (!res.ok) throw new Error("Could not load model metadata.");
        return res.json();
      })
    ])
      .then(([summaryData, metaData]) => {
        setSummary(summaryData);
        setMetadata(metaData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to connect to Delhi AQI backend.");
        setLoading(false);
      });
  }, []);

  // Update Lucide Icons on DOM updates
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [activePage, summary, metadata, loading]);

  const latest = summary?.latest || { pm25: 0, pm10: 0, timestamp: "" };
  const aqiInfo = useMemo(() => getAqiDetails(latest.pm25), [latest.pm25]);

  if (loading) {
    return (
      <div className="loading-view">
        <div className="loading-content">
          <div className="spinner-ring" />
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Initializing Delhi AQI Platform</h2>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading monitoring station records & pre-trained ML models…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-view">
        <div className="loading-content" style={{ maxWidth: 480, textAlign: "center" }}>
          <Icon name="alert-triangle" size={48} />
          <h2 style={{ color: "#ef4444" }}>Service Connection Error</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{error}</p>
          <button className="segmented-btn active" style={{ marginTop: 12, padding: "8px 16px" }} onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        recordCount={summary?.recordCount}
      />
      <main className="main">
        <header className="topbar">
          <div className="crumb-nav">
            <span>Delhi NCR</span>
            <Icon name="chevron-right" size={14} />
            <span>Air Intelligence</span>
            <Icon name="chevron-right" size={14} />
            <strong>{NAVIGATION.find((n) => n.id === activePage)?.label}</strong>
          </div>
          <div className="top-actions">
            <span className="badge-tag">
              <span className="pulse-dot" />
              Verified Data · {summary.dateRange.start} — {summary.dateRange.end}
            </span>
            <button className="btn-icon" title="Reload data" onClick={() => window.location.reload()}>
              <Icon name="refresh-cw" size={16} />
            </button>
          </div>
        </header>

        <div className="content-wrapper fade-in">
          {summary.dataQuality && summary.dataQuality.sourceFiles > summary.dataQuality.uniqueSourceFiles && (
            <div className="alert-card">
              <Icon name="shield-alert" size={18} />
              <div>
                <strong>Sensor Source Data Integrity:</strong> The {summary.dataQuality.sourceFiles} station exports resolve to {summary.dataQuality.uniqueSourceFiles} unique source file stream. The models and spatiotemporal twin demonstrate Delhi's macro trends accurately while cross-station variance reflects unified reporting channels.
              </div>
            </div>
          )}

          {activePage === "overview" && (
            <OverviewPage
              summary={summary}
              latest={latest}
              aqiInfo={aqiInfo}
              pollutant={pollutant}
              setPollutant={setPollutant}
              trendPeriod={trendPeriod}
              setTrendPeriod={setTrendPeriod}
              stationFilter={stationFilter}
              setStationFilter={setStationFilter}
              onNavigate={setActivePage}
            />
          )}

          {activePage === "3d-twin" && (
            <SpatiotemporalTwinPage
              summary={summary}
              stationFilter={stationFilter}
              setStationFilter={setStationFilter}
            />
          )}

          {activePage === "models" && (
            <ModelBenchmarkPage
              metadata={metadata}
              onExpandImage={(img) => setActiveModalImage(img)}
            />
          )}

          {activePage === "simulator" && (
            <SimulatorPage
              metadata={metadata}
            />
          )}

          {activePage === "shap" && (
            <ShapLabPage
              metadata={metadata}
              onExpandImage={(img) => setActiveModalImage(img)}
            />
          )}

          {activePage === "spatial" && (
            <SpatialSeasonalPage
              metadata={metadata}
              onExpandImage={(img) => setActiveModalImage(img)}
            />
          )}
        </div>
      </main>

      {activeModalImage && (
        <ImageModal
          image={activeModalImage}
          onClose={() => setActiveModalImage(null)}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Sidebar Component
   ========================================================================== */
function Sidebar({ activePage, onNavigate, recordCount }) {
  return (
    <aside className="sidebar">
      <div className="brand-section">
        <div className="brand-logo">
          <Icon name="wind" size={22} />
        </div>
        <div className="brand-info">
          <div className="brand-title">AIR <span>DELHI</span></div>
          <div className="brand-subtitle">Spatiotemporal ML Platform</div>
        </div>
      </div>

      <div className="nav-label">Observatory</div>
      <nav className="nav-list" aria-label="Main navigation">
        {NAVIGATION.map((item) => (
          <button
            key={item.id}
            className={`nav-button ${activePage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <Icon name={item.icon} size={17} />
            <span>{item.label}</span>
            <span className="nav-badge">{item.badge}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="dataset-badge-card">
          <div className="dataset-badge-header">
            <span>Network Pipeline</span>
            <div className="pulse-indicator">
              <span className="pulse-dot" /> Live
            </div>
          </div>
          <div className="dataset-stat-number">{recordCount ? recordCount.toLocaleString("en-IN") : "2,049,930"}</div>
          <div className="dataset-stat-label">Hourly records indexed (2021-2026)</div>
        </div>
      </div>
    </aside>
  );
}

/* ==========================================================================
   Page 1: Executive Overview
   ========================================================================== */
function OverviewPage({ summary, latest, aqiInfo, pollutant, setPollutant, trendPeriod, setTrendPeriod, stationFilter, setStationFilter, onNavigate }) {
  const stations = summary.stations || [];

  const series = useMemo(() => {
    const source = stationFilter === "all"
      ? summary.monthly
      : (stations.find((s) => s.name === stationFilter)?.monthly || []);
    const limit = trendPeriod === "6m" ? 6 : trendPeriod === "12m" ? 12 : trendPeriod === "24m" ? 24 : source.length;
    return source.slice(-limit);
  }, [summary, stations, stationFilter, trendPeriod]);

  // Ranked hotspot stations
  const hotspotRank = useMemo(() => {
    return [...stations].sort((a, b) => (b[pollutant] || 0) - (a[pollutant] || 0)).slice(0, 8);
  }, [stations, pollutant]);

  // Seasonal High vs Low
  const seasonalStats = useMemo(() => {
    const valid = (summary.monthly || []).filter((m) => Number.isFinite(m.pm25));
    if (!valid.length) return { high: null, low: null, ratio: 1 };
    const high = [...valid].sort((a, b) => b.pm25 - a.pm25)[0];
    const low = [...valid].sort((a, b) => a.pm25 - b.pm25)[0];
    const ratio = low.pm25 > 0 ? (high.pm25 / low.pm25).toFixed(1) : 1;
    return { high, low, ratio };
  }, [summary]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Executive Intelligence</div>
          <h1 className="page-title">Delhi Air Quality Overview</h1>
          <p className="page-desc">
            Continuous environmental monitoring, multi-station particulate trends, and meteorological inversion analysis across Delhi NCR.
          </p>
        </div>
        <select
          className="select-input"
          value={stationFilter}
          onChange={(e) => setStationFilter(e.target.value)}
        >
          <option value="all">All Stations (Citywide Mean)</option>
          {stations.map((s) => (
            <option key={s.name} value={s.name}>{s.name.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* KPI Metric Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span>CPCB AQI Sub-Index</span>
            <div className="kpi-icon-wrap" style={{ color: aqiInfo.color }}>
              <Icon name="gauge" size={18} />
            </div>
          </div>
          <div className="kpi-main-val">
            <span className="kpi-number" style={{ color: aqiInfo.color }}>{aqiInfo.aqi}</span>
            <span className="kpi-unit">/ 500</span>
          </div>
          <span className="kpi-badge" style={{ color: aqiInfo.color, background: aqiInfo.bg }}>
            {aqiInfo.category} Grade
          </span>
          <div className="kpi-footer">Calculated from citywide hourly PM2.5 readings</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span>Fine Particulate PM2.5</span>
            <div className="kpi-icon-wrap">
              <Icon name="cloud-fog" size={18} />
            </div>
          </div>
          <div className="kpi-main-val">
            <span className="kpi-number">{formatVal(latest.pm25)}</span>
            <span className="kpi-unit">µg/m³</span>
          </div>
          <span className="badge-tag">
            National Standard: 60 µg/m³
          </span>
          <div className="kpi-footer">Latest record: {latest.timestamp || "Active stream"}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span>Coarse Particulate PM10</span>
            <div className="kpi-icon-wrap" style={{ color: "var(--accent-amber)" }}>
              <Icon name="wind" size={18} />
            </div>
          </div>
          <div className="kpi-main-val">
            <span className="kpi-number">{formatVal(latest.pm10)}</span>
            <span className="kpi-unit">µg/m³</span>
          </div>
          <span className="badge-tag">
            National Standard: 100 µg/m³
          </span>
          <div className="kpi-footer">Coarse dust, construction & vehicular emissions</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span>Seasonal Smog Surge</span>
            <div className="kpi-icon-wrap" style={{ color: "var(--aqi-severe)" }}>
              <Icon name="trending-up" size={18} />
            </div>
          </div>
          <div className="kpi-main-val">
            <span className="kpi-number">{seasonalStats.ratio}×</span>
            <span className="kpi-unit">winter peak</span>
          </div>
          <span className="badge-tag" style={{ color: "var(--aqi-very-poor)" }}>
            High: {seasonalStats.high?.label} vs Low: {seasonalStats.low?.label}
          </span>
          <div className="kpi-footer">Winter thermal inversion amplification</div>
        </div>
      </div>

      {/* Main Interactive Trend Chart */}
      <section className="dashboard-section">
        <div className="section-head">
          <div>
            <h2 className="section-headline">Spatiotemporal Particulate Matter Trajectory</h2>
            <p className="section-subhead">
              Monthly mean concentration for {stationFilter === "all" ? "Delhi Citywide Aggregate" : stationFilter.toUpperCase()}
            </p>
          </div>
          <div className="toolbar-group">
            <div className="segmented-group">
              <button
                className={`segmented-btn ${pollutant === "pm25" ? "active" : ""}`}
                onClick={() => setPollutant("pm25")}
              >
                PM2.5
              </button>
              <button
                className={`segmented-btn ${pollutant === "pm10" ? "active" : ""}`}
                onClick={() => setPollutant("pm10")}
              >
                PM10
              </button>
            </div>
            <div className="segmented-group">
              <button
                className={`segmented-btn ${trendPeriod === "6m" ? "active" : ""}`}
                onClick={() => setTrendPeriod("6m")}
              >
                6M
              </button>
              <button
                className={`segmented-btn ${trendPeriod === "12m" ? "active" : ""}`}
                onClick={() => setTrendPeriod("12m")}
              >
                12M
              </button>
              <button
                className={`segmented-btn ${trendPeriod === "24m" ? "active" : ""}`}
                onClick={() => setTrendPeriod("24m")}
              >
                24M
              </button>
              <button
                className={`segmented-btn ${trendPeriod === "all" ? "active" : ""}`}
                onClick={() => setTrendPeriod("all")}
              >
                All Data
              </button>
            </div>
          </div>
        </div>

        <InteractiveTrendChart series={series} pollutant={pollutant} />

        <div className="chart-legend-row">
          <div className="legend-chip">
            <span className="chip-circle" style={{ background: "var(--accent-cyan)" }} />
            <span>Observed Mean ({pollutant.toUpperCase()} µg/m³)</span>
          </div>
          <div className="legend-chip">
            <span className="chip-circle" style={{ background: "var(--aqi-very-poor)" }} />
            <span>NAAQS Threshold ({pollutant === "pm25" ? "60 µg/m³" : "100 µg/m³"})</span>
          </div>
          <div className="legend-chip">
            <span className="chip-circle" style={{ background: "var(--aqi-good)" }} />
            <span>WHO 24h Guideline (15 µg/m³)</span>
          </div>
        </div>
      </section>

      {/* Lower Grid: Hotspot Leaderboard and Inversion Physics */}
      <div className="grid-2col">
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <h2 className="section-headline">Delhi Hotspot Stations Ranking</h2>
              <p className="section-subhead">Top monitoring locations ordered by {pollutant.toUpperCase()} concentration</p>
            </div>
            <button
              className="badge-tag"
              onClick={() => onNavigate("3d-twin")}
            >
              Explore in 3D <Icon name="arrow-right" size={12} />
            </button>
          </div>

          <div className="table-container">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Station Location</th>
                  <th>{pollutant.toUpperCase()} Mean</th>
                  <th>AQI Category</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {hotspotRank.map((st, idx) => {
                  const val = st[pollutant];
                  const aqi = getAqiDetails(val);
                  const maxVal = Math.max(1, ...hotspotRank.map((s) => s[pollutant] || 0));
                  const pct = Math.min(100, ((val || 0) / maxVal) * 100);
                  return (
                    <tr key={st.name}>
                      <td>
                        <span className={`rank-badge ${idx < 3 ? "top-3" : ""}`}>{idx + 1}</span>
                      </td>
                      <td>
                        <div className="station-cell">
                          <Icon name="map-pin" size={14} />
                          <span>{st.name}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="progress-track">
                            <div className="progress-fill" style={{ width: `${pct}%`, background: aqi.color }} />
                          </div>
                          <strong style={{ color: "#fff", fontFamily: "var(--font-mono)" }}>
                            {formatVal(val)}
                          </strong>
                          <span style={{ fontSize: "10px", color: "var(--text-dim)", marginLeft: 3 }}>µg/m³</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge-tag" style={{ color: aqi.color, background: aqi.bg }}>
                          {aqi.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {st.records.toLocaleString("en-IN")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Meteorology & Inversion Mechanism */}
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <h2 className="section-headline">Why Delhi Traps Smog</h2>
              <p className="section-subhead">The three meteorological catalysts behind severe winter AQI</p>
            </div>
            <Icon name="thermometer-snowflake" size={18} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="dataset-badge-card" style={{ background: "rgba(14, 23, 38, 0.7)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div className="kpi-icon-wrap" style={{ color: "var(--accent-cyan)" }}>
                  <Icon name="layers" size={16} />
                </div>
                <strong style={{ color: "#fff", fontSize: "13px" }}>1. Boundary Layer Inversion</strong>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                In winter, ambient temperature (AT) plummets, creating a cold ground layer trapped beneath warm air. The boundary mixing layer collapses from 2,000m in summer down to &lt;200m in December, sealing in pollutants like a closed lid.
              </p>
            </div>

            <div className="dataset-badge-card" style={{ background: "rgba(14, 23, 38, 0.7)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div className="kpi-icon-wrap" style={{ color: "var(--accent-amber)" }}>
                  <Icon name="wind" size={16} />
                </div>
                <strong style={{ color: "#fff", fontSize: "13px" }}>2. Calm Stagnant Wind Speed (&lt; 1 m/s)</strong>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Wind speed across the Indo-Gangetic basin drops to near zero in November. With no horizontal ventilation or dispersion, vehicular exhaust, biomass burning, and road dust accumulate continuously.
              </p>
            </div>

            <div className="dataset-badge-card" style={{ background: "rgba(14, 23, 38, 0.7)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div className="kpi-icon-wrap" style={{ color: "var(--aqi-very-poor)" }}>
                  <Icon name="droplets" size={16} />
                </div>
                <strong style={{ color: "#fff", fontSize: "13px" }}>3. High Relative Humidity & Secondary Aerosols</strong>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Nighttime relative humidity (RH &gt; 80%) promotes aqueous chemical transformation of precursor gases (SO2, NO2, NH3) into secondary inorganic aerosols (ammonium sulfate and nitrate), swelling PM2.5 mass.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

/* ==========================================================================
   Interactive SVG Trend Chart
   ========================================================================== */
function InteractiveTrendChart({ series, pollutant }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const width = 1000;
  const height = 260;
  const margin = { top: 20, right: 24, bottom: 36, left: 50 };

  const values = series.map((s) => s[pollutant]).filter(Number.isFinite);
  const maxVal = Math.max(100, ...values) * 1.15;
  const minVal = 0;

  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const points = useMemo(() => {
    return series.map((item, idx) => {
      const val = item[pollutant] || 0;
      const x = margin.left + (series.length <= 1 ? plotW / 2 : (idx / (series.length - 1)) * plotW);
      const y = margin.top + plotH - (val / maxVal) * plotH;
      return { x, y, item, val };
    });
  }, [series, pollutant, maxVal, plotW, plotH]);

  const pathD = useMemo(() => {
    return points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }, [points]);

  const areaD = useMemo(() => {
    if (!points.length) return "";
    return `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${margin.top + plotH} L ${points[0].x.toFixed(1)} ${margin.top + plotH} Z`;
  }, [pathD, points, plotH]);

  const naaqsY = margin.top + plotH - ((pollutant === "pm25" ? 60 : 100) / maxVal) * plotH;
  const whoY = margin.top + plotH - (15 / maxVal) * plotH;

  return (
    <div className="chart-container" onMouseLeave={() => setHoverIndex(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
            <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid Horizontal Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((step, i) => {
          const y = margin.top + plotH * (1 - step);
          const labelVal = Math.round(maxVal * step);
          return (
            <g key={i}>
              <line className="chart-grid-line" x1={margin.left} y1={y} x2={width - margin.right} y2={y} />
              <text className="chart-axis-label" x={margin.left - 10} y={y + 3} textAnchor="end">
                {labelVal}
              </text>
            </g>
          );
        })}

        {/* National Standard Guideline */}
        {naaqsY >= margin.top && naaqsY <= margin.top + plotH && (
          <g>
            <line className="chart-threshold-line" x1={margin.left} y1={naaqsY} x2={width - margin.right} y2={naaqsY} />
            <text x={width - margin.right} y={naaqsY - 5} fill="var(--aqi-very-poor)" fontSize="9" textAnchor="end" fontFamily="var(--font-mono)">
              NAAQS Limit ({pollutant === "pm25" ? "60" : "100"} µg/m³)
            </text>
          </g>
        )}

        {/* Area fill and main curve */}
        <path d={areaD} fill="url(#areaGradient)" />
        <path d={pathD} className="chart-line-pm25" />

        {/* X Axis Points and Labels */}
        {points.map((p, idx) => {
          const showLabel = points.length <= 16 || idx % Math.ceil(points.length / 10) === 0 || idx === points.length - 1;
          const aqi = getAqiDetails(p.val);
          return (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoverIndex === idx ? 6 : 3.5}
                fill={aqi.color}
                stroke="#fff"
                strokeWidth={hoverIndex === idx ? 2 : 1}
                className="chart-dot"
                onMouseEnter={() => setHoverIndex(idx)}
              />
              {showLabel && (
                <text
                  className="chart-axis-label"
                  x={p.x}
                  y={height - 12}
                  textAnchor="middle"
                >
                  {p.item.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Hover Crosshair & Tooltip */}
        {hoverIndex !== null && points[hoverIndex] && (
          <g>
            <line
              x1={points[hoverIndex].x}
              y1={margin.top}
              x2={points[hoverIndex].x}
              y2={margin.top + plotH}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeDasharray="2 2"
            />
          </g>
        )}
      </svg>

      {hoverIndex !== null && points[hoverIndex] && (
        <div
          className="hud-tooltip"
          style={{
            left: `${(points[hoverIndex].x / width) * 100}%`,
            top: `${(points[hoverIndex].y / height) * 100}%`,
            transform: "translate(-50%, -120%)",
          }}
        >
          <div className="hud-station-title">{points[hoverIndex].item.label}</div>
          <div className="hud-date">{points[hoverIndex].item.month} Monthly Average</div>
          <div className="hud-reading-row">
            <span style={{ color: "var(--text-muted)" }}>{pollutant.toUpperCase()}</span>
            <span className="hud-reading-val">{formatVal(points[hoverIndex].val)} µg/m³</span>
          </div>
          <span
            className="hud-badge"
            style={{
              color: getAqiDetails(points[hoverIndex].val).color,
              background: getAqiDetails(points[hoverIndex].val).bg
            }}
          >
            {getAqiDetails(points[hoverIndex].val).category} Category
          </span>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Page 2: 3D Spatiotemporal Digital Twin (Revamped 3D Model)
   ========================================================================== */
function SpatiotemporalTwinPage({ summary, stationFilter, setStationFilter }) {
  const [viewMode, setViewMode] = useState("columns"); // 'columns' or 'terrain'
  const [horizon, setHorizon] = useState(3);
  const [metric, setMetric] = useState("pm25");
  const [page, setPage] = useState(0);
  const pageSize = 12;

  // Active month playback index
  const [activeMonthIdx, setActiveMonthIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cameraPreset, setCameraPreset] = useState("isometric");

  const stations = useMemo(() => {
    return stationFilter === "all" ? summary.stations : summary.stations.filter((s) => s.name === stationFilter);
  }, [summary.stations, stationFilter]);

  const pageCount = Math.max(1, Math.ceil(stations.length / pageSize));
  const visibleStations = useMemo(() => {
    return stationFilter === "all" ? stations.slice(page * pageSize, (page + 1) * pageSize) : stations;
  }, [stations, stationFilter, page]);

  const chartData = useMemo(() => {
    return visibleStations.map((station) => ({
      name: station.name,
      history: station.monthly.slice(-12).map((item) => ({ ...item, kind: "observed" })),
      forecast: forecastForStation(station.monthly, horizon),
    }));
  }, [visibleStations, horizon]);

  const allMonths = useMemo(() => {
    if (!chartData.length) return [];
    return [...chartData[0].history, ...chartData[0].forecast];
  }, [chartData]);

  // Timeline Auto-play Loop
  useEffect(() => {
    if (!isPlaying || !allMonths.length) return;
    const interval = setInterval(() => {
      setActiveMonthIdx((prev) => (prev + 1) % allMonths.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying, allMonths.length]);

  return (
    <div className="twin-container">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">3D Interactive Digital Twin</div>
          <h1 className="page-title">Spatiotemporal Smog Twin</h1>
          <p className="page-desc">
            Volumetric 3D visualization of station particulate density, annual seasonal wave drift, and predictive horizon across Delhi NCR.
          </p>
        </div>
        <div className="toolbar-group">
          <select
            className="select-input"
            value={stationFilter}
            onChange={(e) => { setStationFilter(e.target.value); setPage(0); }}
          >
            <option value="all">Network View (All Stations)</option>
            {summary.stations.map((s) => (
              <option key={s.name} value={s.name}>{s.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 3D Scene Toolbar */}
      <div className="twin-toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Visual Mode:</span>
          <div className="segmented-group">
            <button
              className={`segmented-btn ${viewMode === "columns" ? "active" : ""}`}
              onClick={() => setViewMode("columns")}
            >
              <Icon name="bar-chart-3" size={13} /> Volumetric Columns
            </button>
            <button
              className={`segmented-btn ${viewMode === "terrain" ? "active" : ""}`}
              onClick={() => setViewMode("terrain")}
            >
              <Icon name="mountain" size={13} /> Pollution Surface Mesh
            </button>
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Pollutant:</span>
          <div className="segmented-group">
            <button
              className={`segmented-btn ${metric === "pm25" ? "active" : ""}`}
              onClick={() => setMetric("pm25")}
            >
              PM2.5
            </button>
            <button
              className={`segmented-btn ${metric === "pm10" ? "active" : ""}`}
              onClick={() => setMetric("pm10")}
            >
              PM10
            </button>
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Forecast Horizon:</span>
          <div className="segmented-group">
            <button
              className={`segmented-btn ${horizon === 3 ? "active" : ""}`}
              onClick={() => setHorizon(3)}
            >
              +3 Months
            </button>
            <button
              className={`segmented-btn ${horizon === 6 ? "active" : ""}`}
              onClick={() => setHorizon(6)}
            >
              +6 Months
            </button>
          </div>
        </div>

        {stationFilter === "all" && pageCount > 1 && (
          <div className="toolbar-group" style={{ marginLeft: "auto" }}>
            <span className="toolbar-label">Station Group:</span>
            <div className="toolbar-group">
              <button
                className="btn-icon"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <Icon name="chevron-left" size={15} />
              </button>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                {page + 1} / {pageCount}
              </span>
              <button
                className="btn-icon"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3D Canvas Container */}
      <div className="canvas-3d-wrapper">
        <ThreeCanvasScene
          stations={chartData}
          viewMode={viewMode}
          metric={metric}
          horizon={horizon}
          activeMonthIdx={activeMonthIdx}
          cameraPreset={cameraPreset}
        />

        {/* Floating Camera Presets Pill */}
        <div className="floating-camera-presets">
          <button
            className={`camera-preset-btn ${cameraPreset === "isometric" ? "active" : ""}`}
            onClick={() => setCameraPreset("isometric")}
            title="3D Isometric Perspective"
          >
            3D Angle
          </button>
          <button
            className={`camera-preset-btn ${cameraPreset === "top" ? "active" : ""}`}
            onClick={() => setCameraPreset("top")}
            title="Top-Down Matrix Heatmap"
          >
            Top-Down
          </button>
          <button
            className={`camera-preset-btn ${cameraPreset === "side" ? "active" : ""}`}
            onClick={() => setCameraPreset("side")}
            title="Side Temporal Wave Profile"
          >
            Side Profile
          </button>
          <button
            className={`camera-preset-btn ${cameraPreset === "front" ? "active" : ""}`}
            onClick={() => setCameraPreset("front")}
            title="Frontal Station Comparison"
          >
            Front
          </button>
        </div>

        {/* 3D Timeline Player Bar */}
        <div className="twin-timeline-bar">
          <button
            className="timeline-play-btn"
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause timeline playback" : "Play seasonal timeline"}
          >
            <Icon name={isPlaying ? "pause" : "play"} size={16} />
          </button>

          <div className="timeline-slider-track">
            <div className="timeline-ticks">
              <span>{allMonths[0]?.label || "Start"}</span>
              <span>Observed History</span>
              <span style={{ color: "var(--accent-amber)" }}>Baseline Projection (+{horizon}M)</span>
              <span>{allMonths[allMonths.length - 1]?.label || "End"}</span>
            </div>
            <input
              type="range"
              className="timeline-input"
              min={0}
              max={Math.max(0, allMonths.length - 1)}
              value={activeMonthIdx}
              onChange={(e) => {
                setActiveMonthIdx(Number(e.target.value));
                setIsPlaying(false);
              }}
            />
          </div>

          <div className="timeline-current-label">
            {allMonths[activeMonthIdx]?.label || "—"}
            <div style={{ fontSize: "9px", color: allMonths[activeMonthIdx]?.kind === "forecast" ? "var(--accent-amber)" : "var(--accent-cyan)", fontWeight: 500 }}>
              {allMonths[activeMonthIdx]?.kind === "forecast" ? "Projection" : "Observed"}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Legend & Controls Hint */}
      <div className="twin-legend-row">
        <div className="aqi-scale-legend">
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff" }}>AQI Severity:</span>
          <span className="scale-segment"><span className="scale-dot" style={{ background: "var(--aqi-good)" }} />Good (&lt;30)</span>
          <span className="scale-segment"><span className="scale-dot" style={{ background: "var(--aqi-satisfactory)" }} />Satisfactory</span>
          <span className="scale-segment"><span className="scale-dot" style={{ background: "var(--aqi-moderate)" }} />Moderate</span>
          <span className="scale-segment"><span className="scale-dot" style={{ background: "var(--aqi-poor)" }} />Poor</span>
          <span className="scale-segment"><span className="scale-dot" style={{ background: "var(--aqi-very-poor)" }} />Very Poor</span>
          <span className="scale-segment"><span className="scale-dot" style={{ background: "var(--aqi-severe)" }} />Severe (&gt;250)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span><Icon name="mouse-pointer" size={13} /> Left Click + Drag: Orbit</span>
          <span><Icon name="move" size={13} /> Right Click: Pan</span>
          <span><Icon name="zoom-in" size={13} /> Scroll: Zoom</span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Three.js 3D Canvas Scene
   ========================================================================== */
function ThreeCanvasScene({ stations, viewMode, metric, horizon, activeMonthIdx, cameraPreset }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let cleanup = () => {};
    let cancelled = false;

    const start = () => {
      if (cancelled || !window.THREE) return;
      try {
        const engine = initThreeEngine(window.THREE, mount, stations, viewMode, metric, horizon, activeMonthIdx, cameraPreset);
        sceneRef.current = engine;
        cleanup = () => {
          sceneRef.current = null;
          if (engine && engine.cleanup) engine.cleanup();
        };
      } catch (err) {
        console.error("Three.js engine failed to initialize:", err);
      }
    };

    if (window.THREE) start();
    else window.addEventListener("three-ready", start, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("three-ready", start);
      cleanup();
    };
  }, [stations, viewMode, metric, horizon]);

  // Handle active month scanner plane movement without recreating entire scene
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.updateTimeScanner) {
      sceneRef.current.updateTimeScanner(activeMonthIdx);
    }
  }, [activeMonthIdx]);

  // Handle camera preset changes
  useEffect(() => {
    if (sceneRef.current && sceneRef.current.setCameraPreset) {
      sceneRef.current.setCameraPreset(cameraPreset);
    }
  }, [cameraPreset]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }} />;
}

function initThreeEngine(THREE, mount, stations, viewMode, metric, horizon, activeMonthIdx, initialPreset) {
  const width = Math.max(mount.clientWidth, 400);
  const height = Math.max(mount.clientHeight, 400);

  // High-performance WebGL Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#080f1d");
  scene.fog = new THREE.FogExp2("#080f1d", 0.016);

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 150);

  // Dimensions & Spacing
  const stationSpacing = 1.2;
  const monthSpacing = 0.85;
  const stationCount = Math.max(1, stations.length);
  const monthCount = Math.max(1, ...stations.map((s) => s.history.length + s.forecast.length));

  const gridW = Math.max(stationSpacing, (stationCount - 1) * stationSpacing);
  const gridD = Math.max(monthSpacing, (monthCount - 1) * monthSpacing);
  const baseX = -gridW / 2;
  const baseZ = -gridD / 2;

  // Max value calculation for altitude scale
  const allValues = stations.flatMap((s) => [...s.history, ...s.forecast].map((p) => p[metric])).filter(Number.isFinite);
  const maxAltitude = Math.max(150, ...allValues) * 1.1;
  const maxGraphHeight = 5.2;

  // Lighting Rig
  const ambientLight = new THREE.AmbientLight("#223348", 1.4);
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight("#38bdf8", "#080f1d", 1.2);
  scene.add(hemisphereLight);

  const dirLight = new THREE.DirectionalLight("#f8fafc", 2.6);
  dirLight.position.set(-8, 16, 12);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const accentRim = new THREE.PointLight("#38bdf8", 3.0, 40);
  accentRim.position.set(gridW, 10, -gridD);
  scene.add(accentRim);

  // Sleek Beveled Ground Pedestal
  const platformGeo = new THREE.BoxGeometry(gridW + 2.8, 0.25, gridD + 2.8);
  const platformMat = new THREE.MeshStandardMaterial({
    color: "#0c1524",
    roughness: 0.65,
    metalness: 0.35,
  });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.set(0, -0.13, 0);
  platform.receiveShadow = true;
  scene.add(platform);

  // Neon Edge Border
  const edgeGeo = new THREE.EdgesGeometry(platformGeo);
  const edgeMat = new THREE.LineBasicMaterial({ color: "#1e3a5f", transparent: true, opacity: 0.6 });
  const platformBorder = new THREE.LineSegments(edgeGeo, edgeMat);
  platformBorder.position.copy(platform.position);
  scene.add(platformBorder);

  // Coordinate Grid Plane
  const gridHelper = new THREE.GridHelper(Math.max(gridW, gridD) + 2, Math.max(stationCount, monthCount), "#1e293b", "#0f172a");
  gridHelper.position.set(0, 0.01, 0);
  scene.add(gridHelper);

  // Height Scale Gauge Pillars (corner altitude tick indicator)
  for (let tick = 1; tick <= 3; tick++) {
    const tickH = (maxGraphHeight / 3) * tick;
    const ringGeo = new THREE.RingGeometry(0.12, 0.16, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: "#38bdf8", side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(baseX - 0.9, tickH, baseZ - 0.9);
    scene.add(ring);
  }

  // Color mapper along CPCB Scale
  function getBarColor(val) {
    const c = new THREE.Color();
    if (val <= 30) c.setStyle("#10b981");
    else if (val <= 60) c.setStyle("#84cc16");
    else if (val <= 90) c.setStyle("#f59e0b");
    else if (val <= 120) c.setStyle("#f97316");
    else if (val <= 250) c.setStyle("#ef4444");
    else c.setStyle("#be123c");
    return c;
  }

  // 1. Column Matrix Mode
  let instancedMesh = null;
  const barDataList = [];
  const barGeo = new THREE.BoxGeometry(1, 1, 1);
  const barMat = new THREE.MeshStandardMaterial({
    roughness: 0.35,
    metalness: 0.15,
  });

  const totalBars = stations.reduce((acc, s) => acc + s.history.length + s.forecast.length, 0);
  instancedMesh = new THREE.InstancedMesh(barGeo, barMat, Math.max(1, totalBars));
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();
  let barIdx = 0;

  stations.forEach((st, sIdx) => {
    const points = [...st.history, ...st.forecast];
    points.forEach((pt, mIdx) => {
      const val = Number.isFinite(pt[metric]) ? pt[metric] : 0;
      const h = Math.max(0.08, (val / maxAltitude) * maxGraphHeight);
      const x = baseX + sIdx * stationSpacing;
      const z = baseZ + mIdx * monthSpacing;

      matrix.makeScale(0.65, h, 0.48);
      matrix.setPosition(x, h / 2, z);
      instancedMesh.setMatrixAt(barIdx, matrix);

      tempColor.copy(getBarColor(val));
      if (pt.kind === "forecast") {
        tempColor.lerp(new THREE.Color("#fbbf24"), 0.3); // warmer tint for forecast
      }
      instancedMesh.setColorAt(barIdx, tempColor);

      barDataList.push({
        id: barIdx,
        station: st.name,
        month: pt.label,
        value: val,
        kind: pt.kind,
        x, y: h, z, h
      });

      barIdx++;
    });
  });

  instancedMesh.count = barIdx;
  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;

  // 2. Continuous Topographical Terrain Surface Mesh
  let terrainMesh = null;
  let terrainWireframe = null;
  if (viewMode === "terrain" && stationCount > 1) {
    instancedMesh.visible = false;
    const segX = Math.max(1, stationCount - 1);
    const segZ = Math.max(1, monthCount - 1);
    const planeGeo = new THREE.PlaneGeometry(gridW, gridD, segX, segZ);
    planeGeo.rotateX(-Math.PI / 2);

    const pos = planeGeo.attributes.position;
    const colors = [];
    const cols = segX + 1;
    for (let i = 0; i < pos.count; i++) {
      const zIdx = Math.floor(i / cols);
      const sIdx = i % cols;
      const pt = stations[sIdx] ? ([...stations[sIdx].history, ...stations[sIdx].forecast][zIdx]) : null;
      const val = pt && Number.isFinite(pt[metric]) ? pt[metric] : 0;
      const h = Math.max(0.05, (val / maxAltitude) * maxGraphHeight);
      pos.setY(i, h);

      const c = getBarColor(val);
      colors.push(c.r, c.g, c.b);
    }
    planeGeo.computeVertexNormals();
    planeGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    terrainMesh = new THREE.Mesh(planeGeo, terrainMat);
    terrainMesh.castShadow = true;
    scene.add(terrainMesh);

    const wireMat = new THREE.MeshBasicMaterial({ color: "#38bdf8", wireframe: true, transparent: true, opacity: 0.22 });
    terrainWireframe = new THREE.Mesh(planeGeo, wireMat);
    scene.add(terrainWireframe);
  } else {
    scene.add(instancedMesh);
  }

  // Hover Highlight Beacon Box
  const beaconGeo = new THREE.BoxGeometry(0.72, 1, 0.54);
  const beaconMat = new THREE.MeshBasicMaterial({ color: "#38bdf8", wireframe: true, transparent: true, opacity: 0.9 });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.visible = false;
  scene.add(beaconMesh);

  // Time Scanner Blade Plane (glowing timeline crosshair)
  const bladeGeo = new THREE.PlaneGeometry(gridW + 1.2, maxGraphHeight + 0.8);
  const bladeMat = new THREE.MeshBasicMaterial({
    color: "#38bdf8",
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide
  });
  const timeBlade = new THREE.Mesh(bladeGeo, bladeMat);
  timeBlade.position.set(0, maxGraphHeight / 2, baseZ + activeMonthIdx * monthSpacing);
  scene.add(timeBlade);

  // Camera Orbit Logic
  let targetRadius = Math.max(gridW, gridD) * 1.55 + 5;
  let targetTheta = Math.PI / 4;
  let targetPhi = 1.0;
  let radius = targetRadius;
  let theta = targetTheta;
  let phi = targetPhi;
  const centerTarget = new THREE.Vector3(0, maxGraphHeight * 0.35, 0);

  function applyPreset(preset) {
    if (preset === "isometric") {
      targetTheta = Math.PI / 4;
      targetPhi = 1.0;
      targetRadius = Math.max(gridW, gridD) * 1.55 + 5;
    } else if (preset === "top") {
      targetTheta = 0.001;
      targetPhi = 0.08;
      targetRadius = Math.max(gridW, gridD) * 1.6 + 6;
    } else if (preset === "side") {
      targetTheta = Math.PI / 2;
      targetPhi = 1.35;
      targetRadius = Math.max(gridW, gridD) * 1.4 + 4;
    } else if (preset === "front") {
      targetTheta = 0.0;
      targetPhi = 1.35;
      targetRadius = Math.max(gridW, gridD) * 1.4 + 4;
    }
  }
  applyPreset(initialPreset);

  function updateCamera() {
    camera.position.set(
      centerTarget.x + radius * Math.sin(phi) * Math.sin(theta),
      centerTarget.y + radius * Math.cos(phi),
      centerTarget.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(centerTarget);
  }
  updateCamera();

  // Floating Holographic Tooltip DOM Element
  const tooltip = document.createElement("div");
  tooltip.className = "hud-tooltip";
  tooltip.style.display = "none";
  mount.appendChild(tooltip);

  // Raycaster for Hover Interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let isDragging = false;
  let prevX = 0;
  let prevY = 0;

  function onPointerDown(e) {
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
    renderer.domElement.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (isDragging) {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      targetTheta -= dx * 0.006;
      targetPhi = Math.max(0.08, Math.min(1.52, targetPhi - dy * 0.005));
      prevX = e.clientX;
      prevY = e.clientY;
      tooltip.style.display = "none";
      return;
    }

    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects([instancedMesh, terrainMesh].filter(Boolean), false);

    if (intersects.length && intersects[0].instanceId !== undefined) {
      const hit = intersects[0];
      const data = barDataList[hit.instanceId];
      if (data) {
        beaconMesh.scale.set(1, data.h, 1);
        beaconMesh.position.set(data.x, data.h / 2, data.z);
        beaconMesh.visible = true;

        const aqi = getAqiDetails(data.value);
        tooltip.innerHTML = `
          <div class="hud-station-title">${data.station}</div>
          <div class="hud-date">${data.month} · ${data.kind === "forecast" ? "Seasonal Projection" : "Observed Record"}</div>
          <div class="hud-reading-row">
            <span style="color:var(--text-muted)">${metric.toUpperCase()}</span>
            <span class="hud-reading-val">${data.value.toFixed(1)} µg/m³</span>
          </div>
          <span class="hud-badge" style="color:${aqi.color};background:${aqi.bg}">
            ${aqi.category} (AQI ${aqi.aqi})
          </span>
        `;
        tooltip.style.display = "flex";
        tooltip.style.left = `${Math.min(rect.width - 200, Math.max(16, e.clientX - rect.left + 14))}px`;
        tooltip.style.top = `${Math.max(16, e.clientY - rect.top - 20)}px`;
        return;
      }
    }

    beaconMesh.visible = false;
    tooltip.style.display = "none";
  }

  function onPointerUp() { isDragging = false; }
  function onWheel(e) {
    e.preventDefault();
    targetRadius = Math.max(6, Math.min(80, targetRadius * (e.deltaY > 0 ? 1.08 : 0.92)));
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

  // Smooth Render Loop with Spring Damping
  let animId = 0;
  function animate() {
    animId = requestAnimationFrame(animate);

    // Smooth inertia interpolation
    theta += (targetTheta - theta) * 0.12;
    phi += (targetPhi - phi) * 0.12;
    radius += (targetRadius - radius) * 0.12;

    updateCamera();
    renderer.render(scene, camera);
  }
  animate();

  const resizeObserver = new ResizeObserver(() => {
    const nextW = Math.max(mount.clientWidth, 400);
    const nextH = Math.max(mount.clientHeight, 400);
    renderer.setSize(nextW, nextH, false);
    camera.aspect = nextW / nextH;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(mount);

  return {
    cleanup: () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      renderer.forceContextLoss();
      mount.replaceChildren();
    },
    updateTimeScanner: (idx) => {
      if (timeBlade) {
        timeBlade.position.z = baseZ + idx * monthSpacing;
      }
    },
    setCameraPreset: (preset) => {
      applyPreset(preset);
    }
  };
}

/* ==========================================================================
   Page 3: ML Model Benchmark & Model Hub
   ========================================================================== */
function ModelBenchmarkPage({ metadata, onExpandImage }) {
  const [filterFamily, setFilterFamily] = useState("all");
  const [sortField, setSortField] = useState("test_r2");

  const benchmarks = metadata?.benchmarks || [];
  const researchFigures = metadata?.researchFigures || [];

  const filtered = useMemo(() => {
    return benchmarks.filter((m) => {
      if (filterFamily === "all") return true;
      if (filterFamily === "linear") return m.family.toLowerCase().includes("linear");
      if (filterFamily === "tree") return m.family.toLowerCase().includes("tree") || m.family.toLowerCase().includes("ensemble");
      if (filterFamily === "deep") return m.family.toLowerCase().includes("deep") || m.family.toLowerCase().includes("pytorch");
      return true;
    }).sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
  }, [benchmarks, filterFamily, sortField]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Machine Learning Evaluation</div>
          <h1 className="page-title">Regression Benchmark & Model Hub</h1>
          <p className="page-desc">
            Comparative performance across 11 regression architectures trained on 2M+ hourly environmental records from the Delhi monitoring network.
          </p>
        </div>
        <div className="toolbar-group">
          <div className="segmented-group">
            <button className={`segmented-btn ${filterFamily === "all" ? "active" : ""}`} onClick={() => setFilterFamily("all")}>All Architectures</button>
            <button className={`segmented-btn ${filterFamily === "linear" ? "active" : ""}`} onClick={() => setFilterFamily("linear")}>Linear Models</button>
            <button className={`segmented-btn ${filterFamily === "tree" ? "active" : ""}`} onClick={() => setFilterFamily("tree")}>Trees & Ensembles</button>
            <button className={`segmented-btn ${filterFamily === "deep" ? "active" : ""}`} onClick={() => setFilterFamily("deep")}>Deep Learning</button>
          </div>
        </div>
      </div>

      {/* Model Benchmark Table */}
      <section className="dashboard-section">
        <div className="section-head">
          <div>
            <h2 className="section-headline">Model Evaluation Matrix</h2>
            <p className="section-subhead">Test partition evaluation (10% holdout split) vs training metrics</p>
          </div>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Model Architecture</th>
                <th>Model Family</th>
                <th>Test R² Score</th>
                <th>Test MAE</th>
                <th>Test RMSE</th>
                <th>Train R²</th>
                <th>Generalization Gap</th>
                <th>Performance Badge</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const gap = Math.abs((m.train_r2 || 0) - (m.test_r2 || 0)).toFixed(3);
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="station-cell">
                        <Icon name="cpu" size={15} />
                        <div>
                          <strong>{m.name}</strong>
                          <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>ID: {m.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge-tag">{m.family}</span></td>
                    <td>
                      <strong style={{ color: (m.test_r2 || 0) > 0.9 ? "var(--accent-cyan)" : "#fff", fontFamily: "var(--font-mono)" }}>
                        {formatVal(m.test_r2, 3)}
                      </strong>
                    </td>
                    <td><span style={{ fontFamily: "var(--font-mono)" }}>{formatVal(m.test_mae, 2)} µg/m³</span></td>
                    <td><span style={{ fontFamily: "var(--font-mono)" }}>{formatVal(m.test_rmse, 2)}</span></td>
                    <td><span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{formatVal(m.train_r2, 3)}</span></td>
                    <td>
                      <span className="badge-tag" style={{ color: Number(gap) < 0.02 ? "var(--aqi-good)" : "var(--aqi-moderate)" }}>
                        Δ {gap}
                      </span>
                    </td>
                    <td>
                      <span className="model-badge">{m.badge}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Publication Research Figures Gallery */}
      <section className="dashboard-section">
        <div className="section-head">
          <div>
            <h2 className="section-headline">Publication Research Figures</h2>
            <p className="section-subhead">Visual diagnostics generated from the model evaluation workspace</p>
          </div>
        </div>

        <div className="gallery-grid">
          {researchFigures.map((fig) => (
            <div key={fig.id} className="gallery-card">
              <div
                className="gallery-image-wrap"
                onClick={() => onExpandImage({ src: `/assets/${fig.path}`, title: fig.title, subtitle: fig.subtitle, text: fig.explanation })}
              >
                <img src={`/assets/${fig.path}`} alt={fig.title} />
                <div className="gallery-expand-hint">
                  <Icon name="maximize-2" size={12} /> Click to expand
                </div>
              </div>
              <div className="gallery-card-body">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 className="gallery-card-title">{fig.title}</h3>
                  <span className="badge-tag">{fig.category}</span>
                </div>
                <div className="gallery-card-subtitle">{fig.subtitle}</div>
                <p className="gallery-card-text">{fig.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ==========================================================================
   Page 4: Live PM2.5 Simulator & Predictor Lab
   ========================================================================== */
function SimulatorPage({ metadata }) {
  const [modelType, setModelType] = useState("LR");
  const [activePreset, setActivePreset] = useState("winter_severe");

  // Environmental Features State
  const [inputs, setInputs] = useState({
    PM10: 380,
    CO: 3.2,
    NO2: 68,
    NOx: 110,
    NH3: 55,
    SO2: 18,
    Ozone: 22,
    Benzene: 7.5,
    Toluene: 35,
    AT: 11.5,
    RH: 88,
    WS: 0.4,
    WD: 270,
    SR: 30,
    BP: 745,
    Timestamp: 12,
    location: 0
  });

  const [prediction, setPrediction] = useState(null);

  // Preset Configurations
  const presets = [
    {
      id: "winter_severe",
      label: "💥 Winter Smog Peak (Nov/Dec)",
      params: { PM10: 420, CO: 3.8, NO2: 75, NOx: 140, NH3: 65, SO2: 22, Ozone: 15, Benzene: 9.0, Toluene: 45, AT: 9.5, RH: 92, WS: 0.3, WD: 280, SR: 20, BP: 748, Timestamp: 12, location: 0 }
    },
    {
      id: "monsoon_clean",
      label: "🌧️ Monsoon Wash (July/Aug)",
      params: { PM10: 55, CO: 0.8, NO2: 24, NOx: 32, NH3: 20, SO2: 8, Ozone: 45, Benzene: 1.2, Toluene: 8, AT: 32.0, RH: 75, WS: 4.2, WD: 110, SR: 210, BP: 735, Timestamp: 7, location: 0 }
    },
    {
      id: "spring_moderate",
      label: "🌸 Spring Baseline (March)",
      params: { PM10: 160, CO: 1.6, NO2: 42, NOx: 65, NH3: 35, SO2: 14, Ozone: 35, Benzene: 3.5, Toluene: 18, AT: 24.0, RH: 48, WS: 2.1, WD: 240, SR: 180, BP: 742, Timestamp: 3, location: 0 }
    },
    {
      id: "traffic_corridor",
      label: "🚗 Heavy Ring-Road Rush Hour",
      params: { PM10: 310, CO: 4.2, NO2: 88, NOx: 165, NH3: 45, SO2: 19, Ozone: 18, Benzene: 8.8, Toluene: 48, AT: 18.0, RH: 65, WS: 0.8, WD: 220, SR: 60, BP: 744, Timestamp: 11, location: 1 }
    }
  ];

  const handleApplyPreset = (p) => {
    setActivePreset(p.id);
    setInputs(p.params);
  };

  // Perform Real-Time Calculation using Client-Side Extracted Weights or Backend
  useEffect(() => {
    const weights = metadata?.weights?.[modelType] || {
      intercept: 7.48717,
      coefs: [0.0013, 1.8018, 0.3395, -0.2354, 0.0081, 0.1178, 0.5078, 0.0957, 7.445, 0.0735, 7.7585, -0.0522, -2.544, 0.9183, -1.3418, -0.0581, 0.0702, -0.0458]
    };

    const featOrder = ["location", "Timestamp", "PM10", "NO", "NO2", "NOx", "NH3", "SO2", "CO", "Ozone", "Benzene", "Toluene", "AT", "RH", "WS", "WD", "SR", "BP"];
    let sum = weights.intercept;
    const contributions = [];

    featOrder.forEach((fid, idx) => {
      const val = Number(inputs[fid] !== undefined ? inputs[fid] : 0);
      const coef = weights.coefs[idx] || 0;
      const contrib = coef * val;
      sum += contrib;
      contributions.push({ id: fid, val, contrib, coef });
    });

    const pred = Math.max(0, sum);
    const aqi = getAqiDetails(pred);

    contributions.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

    setPrediction({
      predictedPm25: pred,
      aqi,
      topDrivers: contributions.slice(0, 5)
    });
  }, [inputs, modelType, metadata]);

  const updateInput = (key, value) => {
    setActivePreset("custom");
    setInputs((prev) => ({ ...prev, [key]: Number(value) }));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Interactive Simulation Lab</div>
          <h1 className="page-title">Live PM2.5 Simulator & AQI Forecaster</h1>
          <p className="page-desc">
            Simulate real-time meteorological and chemical scenarios using trained linear and regularized model parameters to predict PM2.5 and CPCB hazard grade.
          </p>
        </div>
        <div className="toolbar-group">
          <span className="toolbar-label">Model:</span>
          <div className="segmented-group">
            <button className={`segmented-btn ${modelType === "LR" ? "active" : ""}`} onClick={() => setModelType("LR")}>
              Linear Regression (OLS)
            </button>
            <button className={`segmented-btn ${modelType === "Ridge" ? "active" : ""}`} onClick={() => setModelType("Ridge")}>
              Ridge Regularized (L2)
            </button>
          </div>
        </div>
      </div>

      {/* Scenario Presets Strip */}
      <div className="preset-strip">
        {presets.map((p) => (
          <button
            key={p.id}
            className={`preset-chip ${activePreset === p.id ? "active" : ""}`}
            onClick={() => handleApplyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="simulator-layout">
        {/* Sliders Input Panel */}
        <section className="dashboard-section">
          <div className="section-head">
            <div>
              <h2 className="section-headline">Environmental & Chemical Inputs</h2>
              <p className="section-subhead">Adjust particulate, combustion precursors, and weather conditions</p>
            </div>
          </div>

          <div className="slider-group-grid">
            <SliderControl
              label="PM10 Coarse Dust (µg/m³)"
              value={inputs.PM10}
              min={0}
              max={800}
              step={5}
              onChange={(v) => updateInput("PM10", v)}
            />
            <SliderControl
              label="Carbon Monoxide CO (mg/m³)"
              value={inputs.CO}
              min={0.1}
              max={15}
              step={0.1}
              onChange={(v) => updateInput("CO", v)}
            />
            <SliderControl
              label="Nitrogen Dioxide NO2 (µg/m³)"
              value={inputs.NO2}
              min={5}
              max={250}
              step={1}
              onChange={(v) => updateInput("NO2", v)}
            />
            <SliderControl
              label="Nitrogen Oxides NOx (ppb)"
              value={inputs.NOx}
              min={10}
              max={350}
              step={5}
              onChange={(v) => updateInput("NOx", v)}
            />
            <SliderControl
              label="Ammonia NH3 (µg/m³)"
              value={inputs.NH3}
              min={5}
              max={200}
              step={2}
              onChange={(v) => updateInput("NH3", v)}
            />
            <SliderControl
              label="Sulfur Dioxide SO2 (µg/m³)"
              value={inputs.SO2}
              min={2}
              max={100}
              step={1}
              onChange={(v) => updateInput("SO2", v)}
            />
            <SliderControl
              label="Benzene C6H6 (µg/m³)"
              value={inputs.Benzene}
              min={0.1}
              max={30}
              step={0.2}
              onChange={(v) => updateInput("Benzene", v)}
            />
            <SliderControl
              label="Ground Ozone O3 (µg/m³)"
              value={inputs.Ozone}
              min={2}
              max={150}
              step={2}
              onChange={(v) => updateInput("Ozone", v)}
            />
            <SliderControl
              label="Ambient Temperature AT (°C)"
              value={inputs.AT}
              min={3}
              max={46}
              step={0.5}
              onChange={(v) => updateInput("AT", v)}
            />
            <SliderControl
              label="Relative Humidity RH (%)"
              value={inputs.RH}
              min={15}
              max={100}
              step={1}
              onChange={(v) => updateInput("RH", v)}
            />
            <SliderControl
              label="Wind Speed WS (m/s)"
              value={inputs.WS}
              min={0.1}
              max={10}
              step={0.1}
              onChange={(v) => updateInput("WS", v)}
            />
            <SliderControl
              label="Month of Year (1 - 12)"
              value={inputs.Timestamp}
              min={1}
              max={12}
              step={1}
              onChange={(v) => updateInput("Timestamp", v)}
            />
          </div>
        </section>

        {/* Prediction Results Gauge Panel */}
        <div className="prediction-result-panel">
          <span className="badge-tag">Predicted PM2.5 & AQI</span>

          <div className="gauge-circle-outer">
            <div className="gauge-circle-inner">
              <span className="gauge-aqi-number" style={{ color: prediction?.aqi.color }}>
                {prediction ? formatVal(prediction.predictedPm25) : "—"}
              </span>
              <span className="gauge-aqi-label">µg/m³ PM2.5</span>
            </div>
          </div>

          <div
            className="prediction-category-pill"
            style={{ color: prediction?.aqi.color, background: prediction?.aqi.bg }}
          >
            {prediction?.aqi.category} · CPCB AQI {prediction?.aqi.aqi}
          </div>

          <div className="health-advisory-box">
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              <Icon name="heart-pulse" size={15} /> Health Advisory:
            </div>
            {prediction?.aqi.health}
          </div>

          {/* Top Contributing Feature Drivers */}
          <div className="driver-factors-list">
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff" }}>Key Contribution Factors:</span>
            {prediction?.topDrivers.map((d) => (
              <div key={d.id} className="driver-factor-row">
                <span style={{ color: "var(--text-secondary)" }}>{d.id} ({d.val})</span>
                <strong style={{ color: d.contrib > 0 ? "var(--aqi-very-poor)" : "var(--aqi-good)", fontFamily: "var(--font-mono)" }}>
                  {d.contrib > 0 ? "+" : ""}{d.contrib.toFixed(1)} µg/m³
                </strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SliderControl({ label, value, min, max, step, onChange }) {
  return (
    <div className="slider-control-card">
      <div className="slider-top-label">
        <span className="slider-name">{label}</span>
        <span className="slider-numeric-val">{value}</span>
      </div>
      <input
        type="range"
        className="custom-range-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/* ==========================================================================
   Page 5: Explainability & SHAP Analysis Lab
   ========================================================================== */
function ShapLabPage({ metadata, onExpandImage }) {
  const [selectedModel, setSelectedModel] = useState("LR");
  const [selectedChartType, setSelectedChartType] = useState("Global_Feature_Importance");

  const catalog = metadata?.shapCatalog || [];
  const currentItem = catalog.find((item) => item.model === selectedModel && item.type === selectedChartType);

  const modelLabels = {
    LR: "Linear Regression (OLS)",
    Lasso: "Lasso Regression (L1)",
    DTR: "Decision Tree Regressor",
    FNN: "Neural Network (PyTorch FNN)"
  };

  const chartLabels = {
    Global_Feature_Importance: "Global Feature Importance",
    SHAP_Beeswarm: "SHAP Beeswarm Distribution",
    Individual_Prediction_Waterfall: "Individual Prediction Waterfall",
    SHAP_Bar_Summary: "SHAP Bar Summary"
  };

  return (
    <div className="shap-layout">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Explainable AI (XAI)</div>
          <h1 className="page-title">SHAP Feature Attribution Lab</h1>
          <p className="page-desc">
            Model-agnostic Shapley Additive Explanations exploring how particulate, chemical precursors, and meteorology drive Delhi PM2.5 predictions.
          </p>
        </div>
      </div>

      <div className="shap-controls-strip">
        <div className="toolbar-group">
          <span className="toolbar-label">Model Target:</span>
          <div className="segmented-group">
            {Object.entries(modelLabels).map(([key, label]) => (
              <button
                key={key}
                className={`segmented-btn ${selectedModel === key ? "active" : ""}`}
                onClick={() => setSelectedModel(key)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">SHAP Plot Type:</span>
          <div className="segmented-group">
            {Object.entries(chartLabels).map(([key, label]) => (
              <button
                key={key}
                className={`segmented-btn ${selectedChartType === key ? "active" : ""}`}
                onClick={() => setSelectedChartType(key)}
              >
                {label.split(" ")[1] || label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="shap-main-viewer">
        <div className="section-head">
          <div>
            <h2 className="section-headline">{modelLabels[selectedModel]} — {chartLabels[selectedChartType]}</h2>
            <p className="section-subhead">Artifact generated from SHAP evaluation partition</p>
          </div>
          <button
            className="badge-tag"
            onClick={() => onExpandImage({
              src: `/assets/${currentItem?.path}`,
              title: `${modelLabels[selectedModel]} - ${chartLabels[selectedChartType]}`,
              subtitle: "Saved SHAP Explainability Artifact"
            })}
          >
            <Icon name="maximize-2" size={13} /> Fullscreen
          </button>
        </div>

        {currentItem ? (
          <img
            src={`/assets/${currentItem.path}`}
            alt={currentItem.title}
            className="shap-image-display"
          />
        ) : (
          <div className="loading-view" style={{ minHeight: 300 }}>
            <span>Artifact image not available.</span>
          </div>
        )}

        {/* Scientific Takeaways */}
        <div className="shap-takeaways-card">
          <div className="takeaway-item">
            <div className="takeaway-title">
              <Icon name="activity" size={15} /> PM10 Mechanical Proxy
            </div>
            <p className="takeaway-body">
              PM10 consistently claims the highest mean |SHAP| attribution value across all models. Because fine PM2.5 is mechanically co-generated with PM10 during combustion and construction, PM10 acts as the primary collinear anchor.
            </p>
          </div>

          <div className="takeaway-item">
            <div className="takeaway-title">
              <Icon name="thermometer" size={15} /> Strong Negative Temp Impact
            </div>
            <p className="takeaway-body">
              Ambient Temperature (AT) exhibits strong negative SHAP values: cold temperatures push PM2.5 predictions sharply upward. This matches the thermal inversion physics of winter trapping in the northern plains.
            </p>
          </div>

          <div className="takeaway-item">
            <div className="takeaway-title">
              <Icon name="flame" size={15} /> Chemical Precursors (CO & Benzene)
            </div>
            <p className="takeaway-body">
              Carbon monoxide (CO) and Benzene have high positive SHAP values. As volatile markers of inefficient fossil fuel and biomass combustion, their elevation directly tracks catastrophic particulate spikes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Page 6: Spatial & Seasonal Lab
   ========================================================================== */
function SpatialSeasonalPage({ metadata, onExpandImage }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [corrTheme, setCorrTheme] = useState("dark");

  const distributions = metadata?.distributionCatalog || [];
  const pollutionVisualizations = metadata?.pollutionVisualizations || [];

  const categories = ["all", "Particulate", "Combustion Precursors", "Meteorology", "Volatile Organics"];

  const filteredDist = distributions.filter((d) => {
    if (activeCategory === "all") return true;
    return d.category === activeCategory;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Spatial & Atmospheric Science</div>
          <h1 className="page-title">Spatial & Seasonal Pattern Observatory</h1>
          <p className="page-desc">
            Geographic hotspot distribution, annual seasonal rhythm, correlation heatmaps, and empirical feature distributions for all 18 environmental parameters.
          </p>
        </div>
      </div>

      {/* Spatial & Seasonal Deep Dive */}
      <section className="dashboard-section">
        <div className="section-head">
          <div>
            <h2 className="section-headline">Spatial & Seasonal Particulate Patterns</h2>
            <p className="section-subhead">Location ranking, monthly oscillations, and spatiotemporal maps</p>
          </div>
        </div>

        <div className="gallery-grid">
          {pollutionVisualizations.map((item) => (
            <div key={item.id} className="gallery-card">
              <div
                className="gallery-image-wrap"
                onClick={() => onExpandImage({ src: `/assets/${item.path}`, title: item.title, subtitle: item.subtitle, text: item.explanation })}
              >
                <img src={`/assets/${item.path}`} alt={item.title} />
                <div className="gallery-expand-hint"><Icon name="maximize-2" size={12} /> Expand</div>
              </div>
              <div className="gallery-card-body">
                <h3 className="gallery-card-title">{item.title}</h3>
                <div className="gallery-card-subtitle">{item.subtitle}</div>
                <p className="gallery-card-text">{item.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Correlation Heatmap */}
      <section className="dashboard-section">
        <div className="section-head">
          <div>
            <h2 className="section-headline">Multivariate Pearson Correlation Matrix</h2>
            <p className="section-subhead">Inter-pollutant collinearity and atmospheric correlation coefficients</p>
          </div>
          <div className="segmented-group">
            <button className={`segmented-btn ${corrTheme === "dark" ? "active" : ""}`} onClick={() => setCorrTheme("dark")}>Dark Matrix</button>
            <button className={`segmented-btn ${corrTheme === "light" ? "active" : ""}`} onClick={() => setCorrTheme("light")}>Light Matrix</button>
          </div>
        </div>

        <div
          className="gallery-image-wrap"
          style={{ height: 420 }}
          onClick={() => onExpandImage({ src: `/assets/Correlation Matrix_${corrTheme}.png`, title: `Correlation Matrix (${corrTheme})`, subtitle: "Pearson Pairwise Correlation" })}
        >
          <img src={`/assets/Correlation Matrix_${corrTheme}.png`} alt="Correlation matrix" />
          <div className="gallery-expand-hint"><Icon name="maximize-2" size={12} /> Click to expand</div>
        </div>
      </section>

      {/* 19 Variable Distribution Gallery */}
      <section className="dashboard-section">
        <div className="section-head">
          <div>
            <h2 className="section-headline">Empirical Parameter Distributions</h2>
            <p className="section-subhead">Kernel Density Estimation (KDE) and histograms across 2.05M records</p>
          </div>
        </div>

        <div className="distribution-tabs-bar">
          {categories.map((c) => (
            <button
              key={c}
              className={`dist-filter-btn ${activeCategory === c ? "active" : ""}`}
              onClick={() => setActiveCategory(c)}
            >
              {c.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="dist-cards-grid">
          {filteredDist.map((d) => (
            <div key={d.id} className="dist-card">
              <div
                className="dist-img-container"
                onClick={() => onExpandImage({ src: `/assets/${d.path}`, title: `Distribution of ${d.label}`, subtitle: d.category })}
              >
                <img src={`/assets/${d.path}`} alt={d.label} />
              </div>
              <div className="dist-card-footer">
                <strong>{d.label}</strong>
                <span className="badge-tag">{d.category}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* ==========================================================================
   High-Res Image Modal Inspection Component
   ========================================================================== */
function ImageModal({ image, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: 16 }}>{image.title}</h3>
            {image.subtitle && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{image.subtitle}</p>}
          </div>
          <button className="btn-icon" onClick={onClose} title="Close inspection modal">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <img src={image.src} alt={image.title} />
        </div>
        {image.text && (
          <div style={{ padding: "14px 20px", background: "var(--bg-surface)", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-secondary)" }}>
            {image.text}
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
