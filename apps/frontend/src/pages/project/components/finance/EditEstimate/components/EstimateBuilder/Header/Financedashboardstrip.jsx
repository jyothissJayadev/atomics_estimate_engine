import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  BarChart2,
  Activity,
  Shield,
  Layers,
} from "lucide-react";

// ─────────────────────────────────────────────
// PURE CALCULATION HELPERS
// ─────────────────────────────────────────────

/**
 * Pulls every numeric value from a phase that looks like a "total"
 * (covers both fixed 'total' columns and dynamic pricing_*_total pairs).
 */
const extractRowTotal = (phase, columns) => {
  return columns.reduce((sum, col) => {
    if (col.calculated || col.id === "total") {
      return sum + (Number(phase[col.id]) || 0);
    }
    return sum;
  }, 0);
};

const computeDashboardMetrics = (categories, budget, minMarginPct) => {
  // ── 1. Totals ──────────────────────────────
  let totalSell = 0;
  let totalCost = 0;

  // ── 2. Per-room totals ────────────────────
  const roomTotals = {};

  categories.forEach((cat) => {
    let catTotal = 0;
    (cat.phases || []).forEach((phase) => {
      const rowTotal = extractRowTotal(phase, cat.columns || []);
      catTotal += rowTotal;
      totalSell += rowTotal;

      // cost heuristic: if a cost column exists use it, else assume 72% of sell
      const costCols = (cat.columns || []).filter(
        (c) => c.id?.includes("cost") || c.name?.toLowerCase().includes("cost"),
      );
      if (costCols.length > 0) {
        costCols.forEach((c) => (totalCost += Number(phase[c.id]) || 0));
      } else {
        totalCost += rowTotal * 0.72;
      }
    });
    roomTotals[cat._id] = { name: cat.name, total: catTotal };
  });

  // ── 3. Budget utilization ─────────────────
  const budgetPct = budget > 0 ? Math.min((totalSell / budget) * 100, 150) : 0;
  const budgetRemaining = budget - totalSell;

  // ── 4. Room deviation ────────────────────
  // Expected: equal share per room (naïve baseline — override with prop later)
  const numRooms = categories.length || 1;
  const expectedSharePct = 100 / numRooms;

  const roomDeviations = Object.values(roomTotals).map((r) => {
    const actualPct = totalSell > 0 ? (r.total / totalSell) * 100 : 0;
    const deviation = actualPct - expectedSharePct;
    return {
      name: r.name,
      actualPct,
      expectedPct: expectedSharePct,
      deviation,
      total: r.total,
    };
  });

  // ── 5. Margin ────────────────────────────
  const marginAmt = totalSell - totalCost;
  const marginPct = totalSell > 0 ? (marginAmt / totalSell) * 100 : 0;
  const minMargin = minMarginPct ?? 18;
  const marginBuffer = marginPct - minMargin;

  // ── 6. Risk score (0–100) ─────────────────
  let riskScore = 0;

  // Budget overrun contribution (0–35)
  if (budgetPct > 100) riskScore += 35;
  else if (budgetPct > 90) riskScore += 20;
  else if (budgetPct > 80) riskScore += 8;

  // Margin tightness (0–30)
  if (marginBuffer < 0) riskScore += 30;
  else if (marginBuffer < 3) riskScore += 20;
  else if (marginBuffer < 6) riskScore += 8;

  // Room deviation (0–25)
  const maxDeviation = Math.max(...roomDeviations.map((r) => Math.abs(r.deviation)));
  if (maxDeviation > 20) riskScore += 25;
  else if (maxDeviation > 12) riskScore += 14;
  else if (maxDeviation > 6) riskScore += 5;

  // Category count / data density (0–10)
  const totalItems = categories.reduce((s, c) => s + (c.phases?.length || 0), 0);
  if (totalItems < 3) riskScore += 10; // sparse data = low confidence
  else if (totalItems < 8) riskScore += 4;

  const riskLabel =
    riskScore >= 55 ? "High" : riskScore >= 28 ? "Moderate" : "Low";

  return {
    totalSell,
    totalCost,
    marginAmt,
    marginPct,
    marginBuffer,
    minMargin,
    budget,
    budgetPct,
    budgetRemaining,
    roomDeviations,
    riskScore,
    riskLabel,
  };
};

// ─────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────
const fmt = (val) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val || 0);

const fmtL = (val) => {
  if (Math.abs(val) >= 100000)
    return `₹${(val / 100000).toFixed(1)}L`;
  if (Math.abs(val) >= 1000)
    return `₹${(val / 1000).toFixed(0)}K`;
  return fmt(val);
};

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

const RiskConfig = {
  Low:      { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/25", dot: "bg-emerald-400", label: "Low Risk" },
  Moderate: { color: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/25",   dot: "bg-amber-400",   label: "Moderate" },
  High:     { color: "text-rose-400",    bg: "bg-rose-400/10",    border: "border-rose-400/25",    dot: "bg-rose-400",    label: "High Risk" },
};

const BudgetBar = ({ pct, remaining }) => {
  const color =
    pct >= 100 ? "from-amber-500 to-rose-500" :
    pct >= 88  ? "from-yellow-400 to-amber-500" :
                 "from-emerald-400 to-teal-500";
  const trackColor =
    pct >= 100 ? "bg-rose-950/60" :
    pct >= 88  ? "bg-amber-950/40" :
                 "bg-emerald-950/40";

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
          Budget Utilization
        </span>
        <span
          className={`text-[10px] font-bold font-mono ${
            pct >= 100 ? "text-rose-400" : pct >= 88 ? "text-amber-400" : "text-emerald-400"
          }`}
        >
          {pct.toFixed(1)}%
        </span>
      </div>

      <div className={`h-2.5 rounded-full ${trackColor} overflow-hidden relative`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 ease-out relative`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        >
          <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
        </div>
        {/* Budget limit marker */}
        <div className="absolute right-0 top-0 h-full w-px bg-white/30" />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-slate-500 font-mono">
          {fmtL(pct * 0.01 * (pct > 0 ? (pct / pct) : 1))}
        </span>
        <span
          className={`text-[9px] font-semibold ${
            remaining < 0 ? "text-rose-400" : remaining < 50000 ? "text-amber-400" : "text-slate-400"
          }`}
        >
          {remaining < 0
            ? `Over by ${fmtL(Math.abs(remaining))}`
            : `${fmtL(remaining)} remaining`}
        </span>
      </div>
    </div>
  );
};

const RoomHeatmap = ({ roomDeviations }) => {
  if (!roomDeviations?.length)
    return <div className="text-[9px] text-slate-500 italic">No sections yet</div>;

  const maxDev = Math.max(...roomDeviations.map((r) => Math.abs(r.deviation)), 1);

  return (
    <div className="space-y-2">
      {roomDeviations.map((room, i) => {
        const abs = Math.abs(room.deviation);
        const isOver = room.deviation > 0;
        const severity = abs > 15 ? "high" : abs > 8 ? "mid" : "ok";
        const barColor =
          severity === "high" ? "bg-rose-500" :
          severity === "mid"  ? "bg-amber-400" :
                                "bg-emerald-400";
        const badgeColor =
          severity === "high" ? "text-rose-400" :
          severity === "mid"  ? "text-amber-400" :
                                "text-emerald-400";

        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className="text-[9px] text-slate-400 font-medium truncate flex-shrink-0"
              style={{ width: "64px" }}
              title={room.name}
            >
              {room.name.length > 9 ? room.name.slice(0, 8) + "…" : room.name}
            </div>
            <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor} transition-all duration-500`}
                style={{ width: `${Math.min((abs / maxDev) * 100, 100)}%` }}
              />
            </div>
            <div
              className={`text-[9px] font-bold font-mono w-9 text-right flex-shrink-0 ${badgeColor}`}
            >
              {isOver ? "+" : ""}{room.deviation.toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MarginGauge = ({ marginPct, minMargin, marginBuffer }) => {
  // SVG arc gauge  
  const radius = 38;
  const cx = 50; const cy = 50;
  const strokeWidth = 8;
  const startAngle = -200; // degrees from 3-o-clock, going clockwise
  const sweepAngle = 220;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const describeArc = (pct) => {
    const end = startAngle + sweepAngle * Math.min(pct / 100, 1);
    const startRad = toRad(startAngle);
    const endRad = toRad(end);
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const large = sweepAngle * Math.min(pct / 100, 1) > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  // Normalise marginPct to 0–60 range for gauge visual
  const gaugeScale = Math.min(Math.max(marginPct, 0), 60);
  const gaugePct = (gaugeScale / 60) * 100;

  const trackColor = "#1e293b";
  const fillColor =
    marginBuffer < 0 ? "#ef4444" :
    marginBuffer < 4 ? "#f59e0b" :
                       "#22c55e";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 70" className="w-24 h-auto overflow-visible">
        {/* Track */}
        <path
          d={describeArc(100)}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Min threshold marker */}
        <path
          d={describeArc((minMargin / 60) * 100)}
          fill="none"
          stroke="#64748b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="2 999"
        />
        {/* Fill */}
        <path
          d={describeArc(gaugePct)}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${fillColor}80)` }}
        />
        {/* Center value */}
        <text
          x={cx} y={cy + 6}
          textAnchor="middle"
          fontSize="14"
          fontWeight="800"
          fill="white"
          fontFamily="monospace"
        >
          {marginPct.toFixed(0)}%
        </text>
        <text
          x={cx} y={cy + 17}
          textAnchor="middle"
          fontSize="6"
          fill="#64748b"
          fontWeight="600"
        >
          MARGIN
        </text>
      </svg>
      <span
        className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full mt-1 ${
          marginBuffer < 0
            ? "bg-rose-500/15 text-rose-400 border border-rose-500/25"
            : marginBuffer < 4
            ? "bg-amber-500/15 text-amber-400 border border-amber-500/25"
            : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
        }`}
      >
        {marginBuffer < 0 ? "Below Min" : marginBuffer < 4 ? "Near Min" : "Healthy"}
      </span>
      <span className="text-[8px] text-slate-600 mt-1">
        Min required: {minMargin}%
      </span>
    </div>
  );
};

const RiskMeter = ({ riskScore, riskLabel, roomDeviations, marginBuffer, budgetPct }) => {
  const cfg = RiskConfig[riskLabel] || RiskConfig.Low;

  const factors = [
    {
      label: "Budget pressure",
      ok: budgetPct < 88,
      detail: budgetPct >= 100
        ? `Over budget by ${(budgetPct - 100).toFixed(0)}%`
        : `${budgetPct.toFixed(0)}% utilised`,
    },
    {
      label: "Margin safety",
      ok: marginBuffer >= 4,
      detail:
        marginBuffer < 0
          ? `${Math.abs(marginBuffer).toFixed(1)}% below minimum`
          : `${marginBuffer.toFixed(1)}% above minimum`,
    },
    {
      label: "Room balance",
      ok: !roomDeviations.some((r) => Math.abs(r.deviation) > 15),
      detail: (() => {
        const worst = roomDeviations.sort(
          (a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)
        )[0];
        if (!worst) return "Balanced";
        return `${worst.name} deviates ${worst.deviation > 0 ? "+" : ""}${worst.deviation.toFixed(0)}%`;
      })(),
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border self-start ${cfg.bg} ${cfg.border}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      <div className="space-y-1.5">
        {factors.map((f, i) => (
          <div key={i} className="flex items-start gap-2">
            {f.ok ? (
              <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <div className="text-[9px] font-semibold text-slate-400">{f.label}</div>
              <div className={`text-[9px] ${f.ok ? "text-slate-500" : "text-amber-300"}`}>
                {f.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// COLLAPSED STRIP METRICS
// ─────────────────────────────────────────────
const StripMetric = ({ label, value, status }) => {
  const color =
    status === "ok"   ? "text-emerald-400" :
    status === "warn" ? "text-amber-400"   :
    status === "bad"  ? "text-rose-400"    :
                        "text-slate-200";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-slate-500 font-medium tracking-wide uppercase hidden sm:block">
        {label}
      </span>
      <span className={`text-[11px] font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

/**
 * FinanceDashboardStrip
 *
 * Props:
 *   estimateData   — the top-level estimateData object from EstimateBuilder
 *   budget         — optional number (project budget in INR), defaults to 0
 *   minMarginPct   — optional number (minimum acceptable margin %), defaults to 18
 *   isEditMode     — bool, hides strip in edit mode if desired
 *   viewMode       — 'editing' | 'preview'
 */
export const FinanceDashboardStrip = ({
  estimateData,
  budget = 0,
  minMarginPct = 18,
  isEditMode = false,
  viewMode = "editing",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const metrics = useMemo(
    () => computeDashboardMetrics(
      estimateData?.categories || [],
      budget,
      minMarginPct,
    ),
    [estimateData, budget, minMarginPct],
  );

  const {
    totalSell,
    marginPct,
    marginBuffer,
    budgetPct,
    budgetRemaining,
    roomDeviations,
    riskLabel,
    minMargin,
  } = metrics;

  const riskCfg = RiskConfig[riskLabel] || RiskConfig.Low;

  // Budget status
  const budgetStatus =
    budgetPct >= 100 ? "bad" :
    budgetPct >= 88  ? "warn" :
                       "ok";

  // Margin status
  const marginStatus =
    marginBuffer < 0 ? "bad" :
    marginBuffer < 4 ? "warn" :
                       "ok";

  // Risk status
  const riskStatus =
    riskLabel === "High"     ? "bad" :
    riskLabel === "Moderate" ? "warn" :
                               "ok";

  // Don't show during preview mode or edit mode
  if (viewMode === "preview" || isEditMode) return null;

  return (
    <div className="font-sans">
      {/* ── COLLAPSED STRIP ─────────────────────────────────── */}
      <div
        className="bg-slate-900/95 border-b border-slate-700/60 
                   px-5 h-9 flex items-center gap-4 cursor-pointer
                   hover:bg-slate-800/95 transition-colors group"
        onClick={() => setIsExpanded((v) => !v)}
      >
        {/* Icon + label */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Activity size={13} className="text-slate-400 group-hover:text-slate-300 transition-colors" />
          <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-slate-500 group-hover:text-slate-400 transition-colors hidden md:block">
            Finance
          </span>
        </div>

        <div className="w-px h-4 bg-slate-700" />

        {/* Metrics row */}
        <div className="flex items-center gap-4 flex-1 overflow-hidden">
          {budget > 0 && (
            <>
              <StripMetric
                label="Budget"
                value={`${budgetPct.toFixed(0)}%`}
                status={budgetStatus}
              />
              <div className="w-px h-3.5 bg-slate-700/60" />
            </>
          )}
          <StripMetric
            label="Margin"
            value={`${marginPct.toFixed(0)}%`}
            status={marginStatus}
          />
          <div className="w-px h-3.5 bg-slate-700/60" />
          <StripMetric
            label="Risk"
            value={riskLabel}
            status={riskStatus}
          />
          <div className="w-px h-3.5 bg-slate-700/60" />
          <StripMetric
            label="Total"
            value={fmtL(totalSell)}
            status="neutral"
          />

          {/* Room warning pill — shows only if a room is heavily deviated */}
          {roomDeviations.some((r) => Math.abs(r.deviation) > 15) && (
            <div className="ml-1 hidden lg:flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 rounded-full px-2 py-0.5">
              <AlertTriangle size={9} className="text-rose-400" />
              <span className="text-[8px] text-rose-400 font-semibold">
                {roomDeviations
                  .filter((r) => Math.abs(r.deviation) > 15)
                  .map((r) => r.name)
                  .join(", ")}{" "}
                heavy
              </span>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[8px] text-slate-600 group-hover:text-slate-500 uppercase tracking-wider hidden sm:block transition-colors">
            {isExpanded ? "Collapse" : "Expand"}
          </span>
          {isExpanded ? (
            <ChevronUp size={13} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
          ) : (
            <ChevronDown size={13} className="text-slate-500 group-hover:text-slate-400 transition-colors" />
          )}
        </div>
      </div>

      {/* ── EXPANDED DASHBOARD ──────────────────────────────── */}
      {isExpanded && (
        <div
          className="bg-slate-900/97 backdrop-blur-md border-b-2 border-slate-700/40
                     animate-in slide-in-from-top-2 duration-200"
        >
          {/* Header bar inside expanded */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-orange-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                Decision Dashboard
              </span>
              <span className="text-[8px] bg-orange-500/15 text-orange-400 border border-orange-500/25 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Live
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-[8px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
            >
              <ChevronUp size={11} /> Close
            </button>
          </div>

          {/* 4-block grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y lg:divide-y-0 divide-slate-800">

            {/* ── BLOCK 1: Budget ── */}
            <div className="p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-sky-500/10 rounded-md border border-sky-500/15">
                  <Layers size={12} className="text-sky-400" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Budget
                </span>
              </div>
              {budget > 0 ? (
                <>
                  <BudgetBar pct={budgetPct} remaining={budgetRemaining} />
                  {/* Insight chip */}
                  {budgetPct > 88 && (
                    <div className="mt-3 flex items-start gap-1.5 bg-amber-500/8 border border-amber-500/18 rounded-md px-2.5 py-2">
                      <Zap size={10} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[8.5px] text-amber-300/80 leading-relaxed">
                        {budgetPct >= 100
                          ? `Over budget — review high-cost line items`
                          : `${(100 - budgetPct).toFixed(0)}% headroom left — monitor closely`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[9px] text-slate-600 italic mt-2">
                  No project budget set.<br />
                  <span className="text-sky-500 not-italic cursor-default">Add budget in project settings</span>
                </div>
              )}
            </div>

            {/* ── BLOCK 2: Room Heatmap ── */}
            <div className="p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-violet-500/10 rounded-md border border-violet-500/15">
                  <BarChart2 size={12} className="text-violet-400" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Room Allocation
                </span>
              </div>
              <RoomHeatmap roomDeviations={roomDeviations} />
              {roomDeviations.length > 0 && (
                <div className="mt-2 text-[8px] text-slate-600">
                  Expected equal share: {(100 / (roomDeviations.length || 1)).toFixed(0)}% per room
                </div>
              )}
            </div>

            {/* ── BLOCK 3: Margin Gauge ── */}
            <div className="p-4 lg:p-5 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3 self-start">
                <div className="p-1.5 bg-emerald-500/10 rounded-md border border-emerald-500/15">
                  <TrendingUp size={12} className="text-emerald-400" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Margin Health
                </span>
              </div>
              <MarginGauge
                marginPct={marginPct}
                minMargin={minMargin}
                marginBuffer={marginBuffer}
              />
              {marginBuffer < 6 && marginBuffer >= 0 && (
                <div className="mt-3 flex items-start gap-1.5 bg-amber-500/8 border border-amber-500/18 rounded-md px-2.5 py-2 w-full">
                  <Zap size={10} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <span className="text-[8.5px] text-amber-300/80 leading-relaxed">
                    Margin only {marginBuffer.toFixed(1)}% above minimum
                  </span>
                </div>
              )}
            </div>

            {/* ── BLOCK 4: Risk Meter ── */}
            <div className="p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-rose-500/10 rounded-md border border-rose-500/15">
                  <Shield size={12} className="text-rose-400" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  Risk Assessment
                </span>
              </div>
              <RiskMeter
                riskScore={metrics.riskScore}
                riskLabel={riskLabel}
                roomDeviations={roomDeviations}
                marginBuffer={marginBuffer}
                budgetPct={budgetPct}
              />
            </div>
          </div>

          {/* Footer totals row */}
          <div className="border-t border-slate-800 px-5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div>
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">Total Sell</span>
                <div className="text-[11px] font-bold text-white font-mono">{fmt(metrics.totalSell)}</div>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">Est. Cost</span>
                <div className="text-[11px] font-bold text-slate-300 font-mono">{fmt(metrics.totalCost)}</div>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="text-[8px] text-slate-600 uppercase tracking-wider">Gross Margin</span>
                <div className={`text-[11px] font-bold font-mono ${
                  marginBuffer < 0 ? "text-rose-400" : marginBuffer < 4 ? "text-amber-400" : "text-emerald-400"
                }`}>{fmt(metrics.marginAmt)}</div>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 text-[9px] font-semibold ${riskCfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${riskCfg.dot}`} />
              {riskLabel} Risk · Score {metrics.riskScore}/100
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceDashboardStrip;