import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CloudDownload,
  Coins,
  Gauge,
  Heart,
  LayoutDashboard,
  MessageCircle,
  Moon,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Sun,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MetricKey = "views" | "fans" | "likes" | "favorites" | "coins" | "comments" | "danmaku" | "shares";
type RangeKey = "7D" | "30D" | "90D" | "ALL";
type PageKey = "overview" | "analytics" | "compare";

type Point = {
  date: string;
  dateLabel: string;
  views: number;
  fans: number;
  likes: number;
  favorites: number;
  coins: number;
  comments: number;
  danmaku: number;
  shares: number;
  deltaViews: number;
  deltaFans: number;
  deltaLikes: number;
  deltaFavorites: number;
  deltaCoins: number;
  deltaComments: number;
  deltaDanmaku: number;
  deltaShares: number;
  engagement: number;
  engagementRate: number;
};

type MetricMeta = { label: string; color: string; Icon: LucideIcon };
const metricMeta: Record<MetricKey, MetricMeta> = {
  views: { label: "播放量", color: "#fb7299", Icon: Play },
  fans: { label: "累计粉丝", color: "#8b6ce8", Icon: Users },
  likes: { label: "点赞", color: "#ef6f93", Icon: Heart },
  favorites: { label: "收藏", color: "#d99a2b", Icon: WalletCards },
  coins: { label: "硬币", color: "#aa7b3b", Icon: Coins },
  comments: { label: "评论", color: "#4c8dff", Icon: MessageCircle },
  danmaku: { label: "弹幕", color: "#42b7a5", Icon: Activity },
  shares: { label: "分享", color: "#8b6ce8", Icon: Share2 },
};
const metricKeys = Object.keys(metricMeta) as MetricKey[];
const numberFormatter = new Intl.NumberFormat("zh-CN");

function formatNumber(value: number) { return numberFormatter.format(Math.round(value)); }
function formatCompact(value: number) {
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 1 : 2)}万`;
  return formatNumber(value);
}
function formatPercent(value: number) { return `${value.toFixed(2)}%`; }
function deltaKey(metric: MetricKey): keyof Point { return `delta${metric[0].toUpperCase()}${metric.slice(1)}` as keyof Point; }
function getRange(data: Point[], range: RangeKey) {
  if (range === "ALL") return data;
  return data.slice(-(range === "7D" ? 7 : range === "30D" ? 30 : 90));
}

function parseCsv(csv: string): Point[] {
  const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = lines.shift()?.split(",") ?? [];
  const col = (name: string) => headers.indexOf(name);
  const raw = lines.map((line) => line.split(",")).filter((cells) => cells.length === headers.length && cells[col("时间")] !== "历史累计").map((cells) => ({
    date: cells[col("时间")], views: Number(cells[col("播放量")]), fans: Number(cells[col("累计粉丝")]), likes: Number(cells[col("点赞")]), favorites: Number(cells[col("收藏")]), coins: Number(cells[col("硬币")]), comments: Number(cells[col("评论")]), danmaku: Number(cells[col("弹幕")]), shares: Number(cells[col("分享")]),
  })).filter((row) => row.date && Object.values(row).every((value) => !Number.isNaN(value)));
  return raw.sort((a, b) => a.date.localeCompare(b.date)).map((row, index, rows) => {
    const previous = rows[index - 1];
    const diff = (metric: MetricKey) => previous ? row[metric] - previous[metric] : 0;
    const engagement = row.likes + row.favorites + row.coins + row.comments + row.danmaku + row.shares;
    return { ...row, dateLabel: row.date.slice(5).replace("/", "."), deltaViews: diff("views"), deltaFans: diff("fans"), deltaLikes: diff("likes"), deltaFavorites: diff("favorites"), deltaCoins: diff("coins"), deltaComments: diff("comments"), deltaDanmaku: diff("danmaku"), deltaShares: diff("shares"), engagement, engagementRate: row.views ? engagement / row.views * 100 : 0 };
  });
}

function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const positive = value >= 0;
  return <span className={`delta ${positive ? "positive" : "negative"}`}>{positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(value).toFixed(1)}{suffix}</span>;
}

function TooltipCard({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><span className="tooltip-date">{label}</span>{payload.filter((item) => item.value !== undefined).map((item) => <div className="tooltip-row" key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{formatNumber(item.value)}</strong></div>)}</div>;
}

function PanelHeading({ icon, eyebrow, title, extra }: { icon: React.ReactNode; eyebrow: string; title: string; extra?: React.ReactNode }) {
  return <div className="panel-heading"><div className="heading-title"><span className="heading-icon">{icon}</span><div><span>{eyebrow}</span><h2>{title}</h2></div></div>{extra}</div>;
}

function App() {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<RangeKey>("30D");
  const [metric, setMetric] = useState<MetricKey>("views");
  const [mode, setMode] = useState<"cumulative" | "daily">("cumulative");
  const [page, setPage] = useState<PageKey>("overview");
  const [dark, setDark] = useState(false);

  useEffect(() => { fetch("/data/历史累计数据趋势.csv").then((response) => { if (!response.ok) throw new Error("CSV 加载失败"); return response.text(); }).then((csv) => setData(parseCsv(csv))).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false)); }, []);

  const visible = useMemo(() => getRange(data, range), [data, range]);
  const latest = visible.at(-1);
  const first = visible[0];
  const previous = useMemo(() => { if (!first) return []; const index = data.findIndex((row) => row.date === first.date); return data.slice(Math.max(0, index - visible.length), index); }, [data, first, visible.length]);
  const periodDays = visible.length;
  const rangeLabel = range === "ALL" ? "全部历史" : `最近 ${range.replace("D", " 天")}`;

  const cards = useMemo(() => { if (!first || !latest) return []; return (["views", "fans", "likes", "favorites"] as MetricKey[]).map((key) => { const currentDelta = latest[key] - first[key]; const previousDelta = previous.length ? previous.at(-1)![key] - previous[0][key] : currentDelta; return { key, current: latest[key], delta: currentDelta, change: previousDelta ? (currentDelta - previousDelta) / Math.abs(previousDelta) * 100 : 0 }; }); }, [first, latest, previous]);
  const chartData = useMemo(() => visible.map((row) => ({ ...row, primary: mode === "cumulative" ? row[metric] : Number(row[deltaKey(metric)]), secondary: mode === "cumulative" ? row.deltaViews : row.engagement })), [metric, mode, visible]);
  const topDays = useMemo(() => [...visible].sort((a, b) => b.deltaViews - a.deltaViews).slice(0, 3), [visible]);
  const interactions = useMemo(() => { if (!first || !latest) return []; return metricKeys.filter((key) => !["views", "fans"].includes(key)).map((key) => ({ key, delta: latest[key] - first[key], ratio: latest.views ? latest[key] / latest.views * 100 : 0 })); }, [first, latest]);
  const activeMeta = metricMeta[metric];

  if (loading) return <div className="loading-screen"><div className="loading-orb" /><p>正在读取数据脉搏…</p></div>;
  if (error || !latest || !first) return <div className="loading-screen"><CircleHelp size={28} /><h1>数据暂时不可用</h1><p>{error || "CSV 中没有可展示的日级记录"}</p></div>;

  return <div className={`dashboard-shell ${dark ? "dark" : ""}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={19} /></div><div><strong>Video Pulse</strong><span>Bilibili 数据脉搏</span></div></div>
      <div className="workspace-switcher"><div className="avatar">V</div><div><strong>我的创作空间</strong><span>累计趋势数据</span></div><ChevronDown size={15} /></div>
      <nav className="side-nav"><p className="nav-caption">工作台</p>{(["overview", "analytics", "compare"] as PageKey[]).map((item) => { const labels: Record<PageKey, string> = { overview: "总览", analytics: "指标分析", compare: "时间对比" }; const icons: Record<PageKey, LucideIcon> = { overview: LayoutDashboard, analytics: BarChart3, compare: CalendarDays }; const Icon = icons[item]; return <button className={`nav-item ${page === item ? "active" : ""}`} key={item} onClick={() => setPage(item)}><Icon size={17} /><span>{labels[item]}</span>{page === item && <i />}</button>; })}<p className="nav-caption lower">设置</p><button className="nav-item"><Settings2 size={17} /><span>数据源</span></button><button className="nav-item"><CircleHelp size={17} /><span>使用说明</span></button></nav>
      <div className="sidebar-bottom"><div className="sync-card"><div className="sync-icon"><RefreshCw size={15} /></div><div><strong>数据已同步</strong><span>2026/10/08 更新</span></div><Check size={15} /></div><button className="profile-row"><div className="profile-avatar">Y</div><div><strong>Creator</strong><span>个人工作台</span></div><b>···</b></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb"><span>工作台</span><i>/</i><strong>{page === "overview" ? "总览" : page === "analytics" ? "指标分析" : "时间对比"}</strong></div><div className="topbar-actions"><button className="icon-button"><Search size={17} /></button><button className="icon-button" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="export-button"><CloudDownload size={16} />导出摘要</button></div></header>
      <div className="content-wrap">
        <section className="hero-row"><div><div className="eyebrow"><Sparkles size={13} /> CREATOR PERFORMANCE</div><h1>{page === "overview" ? "内容表现" : page === "analytics" ? "指标分析" : "时间对比"}</h1><p>{page === "overview" ? "过去 30 天，你的内容正在稳定获得更多关注。" : page === "analytics" ? "把每一种互动拆开看，找到真正驱动增长的信号。" : "用两个时间窗口，观察账号表现的变化速度。"}</p></div><div className="hero-controls"><div className="date-pill"><CalendarDays size={16} /><span>{rangeLabel}</span><ChevronDown size={14} /></div><div className="segmented">{(["7D", "30D", "90D", "ALL"] as RangeKey[]).map((item) => <button className={range === item ? "selected" : ""} key={item} onClick={() => setRange(item)}>{item === "ALL" ? "全部" : item.replace("D", "天")}</button>)}</div></div></section>
        {page === "overview" && <Overview data={data} visible={visible} first={first} latest={latest} cards={cards} chartData={chartData} interactions={interactions} topDays={topDays} metric={metric} setMetric={setMetric} mode={mode} setMode={setMode} activeMeta={activeMeta} />}
        {page === "analytics" && <Analytics data={visible} metric={metric} setMetric={setMetric} />}
        {page === "compare" && <Compare data={data} range={range} />}
        <footer className="page-footer"><span>数据源：历史累计数据趋势.csv</span><span>共 {data.length} 条日级记录 · 最后更新 {latest.date.replaceAll("/", ".")}</span><span className="footer-status"><i /> 数据正常</span></footer>
      </div>
    </main>
  </div>;
}

function Overview({ data, visible, first, latest, cards, chartData, interactions, topDays, metric, setMetric, mode, setMode, activeMeta }: { data: Point[]; visible: Point[]; first: Point; latest: Point; cards: Array<{ key: MetricKey; current: number; delta: number; change: number }>; chartData: Array<Point & { primary: number; secondary: number }>; interactions: Array<{ key: MetricKey; delta: number; ratio: number }>; topDays: Point[]; metric: MetricKey; setMetric: (key: MetricKey) => void; mode: "cumulative" | "daily"; setMode: (value: "cumulative" | "daily") => void; activeMeta: MetricMeta }) {
  const activeIcon = activeMeta.Icon;
  const growthDays = visible.filter((row) => row.deltaViews > 0).length;
  const score = Math.round(growthDays / visible.length * 100);
  return <>
    <section className="metric-grid">{cards.map((card, index) => { const meta = metricMeta[card.key]; const Icon = meta.Icon; return <motion.div className="metric-card" key={card.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}><div className="metric-card-top"><span className="metric-icon" style={{ color: meta.color, background: `${meta.color}18` }}><Icon size={17} /></span><span className="card-menu">···</span></div><span className="metric-label">{meta.label}</span><strong className="metric-value">{formatCompact(card.current)}</strong><div className="metric-footer"><Delta value={card.change} suffix="%" /><span>较前一周期 · 新增 {formatCompact(card.delta)}</span></div></motion.div>; })}</section>
    <section className="main-grid"><div className="panel trend-panel"><PanelHeading icon={<Gauge size={17} />} eyebrow="MOMENTUM" title="播放趋势" extra={<div className="chart-mode"><button className={mode === "cumulative" ? "active" : ""} onClick={() => setMode("cumulative")}>累计值</button><button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")}>日增量</button></div>} /><div className="chart-legend-row"><div className="selected-metric"><span className="legend-dot" style={{ background: activeMeta.color }} /><strong>{mode === "cumulative" ? activeMeta.label : `日增${activeMeta.label}`}</strong><small>{mode === "cumulative" ? formatNumber(latest[metric]) : `+${formatNumber(latest[deltaKey(metric)] as number)}`} 最新</small></div><div className="metric-pills">{(["views", "fans", "likes"] as MetricKey[]).map((key) => <button className={metric === key ? "active" : ""} key={key} onClick={() => setMetric(key)}>{metricMeta[key].label}</button>)}</div></div><div className="chart-large"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}><defs><linearGradient id="pulse-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={activeMeta.color} stopOpacity={.25} /><stop offset="100%" stopColor={activeMeta.color} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 4" /><XAxis dataKey="dateLabel" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} minTickGap={30} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={formatCompact} width={50} /><YAxis yAxisId="secondary" orientation="right" hide /><Tooltip content={<TooltipCard />} /><Area type="monotone" dataKey="primary" name={mode === "cumulative" ? activeMeta.label : `日增${activeMeta.label}`} fill="url(#pulse-fill)" stroke={activeMeta.color} strokeWidth={2.6} dot={false} activeDot={{ r: 5, fill: activeMeta.color, stroke: "var(--panel)", strokeWidth: 3 }} /><Line type="monotone" dataKey="secondary" name={mode === "cumulative" ? "每日播放增量" : "互动总量"} stroke="var(--blue)" strokeWidth={1.5} strokeDasharray="4 5" yAxisId="secondary" dot={false} /></ComposedChart></ResponsiveContainer></div><div className="chart-footnote"><span><i className="pink-dot" />主趋势</span><span><i className="blue-line" />辅助趋势</span><span className="data-note">数据截止 {latest.date.replaceAll("/", ".")}</span></div></div>
      <div className="panel pulse-panel"><PanelHeading icon={<Sparkles size={17} />} eyebrow="SIGNAL" title="近期脉搏" extra={<span className="panel-caption">{visible.length} 日窗口</span>} /><div className="pulse-score"><div><span>活跃度</span><strong>{score}</strong><small>/ 100</small></div><div className="score-ring"><svg viewBox="0 0 100 100"><circle className="ring-track" cx="50" cy="50" r="41" /><circle className="ring-value" cx="50" cy="50" r="41" pathLength="100" style={{ strokeDashoffset: 100 - score }} /></svg><Activity size={17} /></div></div><div className="signal-list"><div><span className="signal-icon green"><ArrowUpRight size={15} /></span><p><strong>播放保持增长</strong><small>{growthDays} / {visible.length} 天有新增</small></p></div><div><span className="signal-icon pink"><Heart size={15} /></span><p><strong>互动率 {formatPercent(latest.engagementRate)}</strong><small>互动累计 {formatNumber(latest.engagement)}</small></p></div><div><span className="signal-icon purple"><Users size={15} /></span><p><strong>粉丝增长较慢</strong><small>当前窗口新增 {latest.fans - first.fans} 位</small></p></div></div></div></section>
    <section className="bottom-grid"><div className="panel interaction-panel"><PanelHeading icon={<Heart size={17} />} eyebrow="ENGAGEMENT MIX" title="互动构成" extra={<span className="panel-caption">累计数据参考比例</span>} /><div className="interaction-list">{interactions.map((row) => { const meta = metricMeta[row.key]; return <div className="interaction-row" key={row.key}><div className="interaction-name"><span className="interaction-dot" style={{ background: meta.color }} /><strong>{meta.label}</strong></div><div className="bar-track"><motion.div className="bar-fill" initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(3, row.ratio * 1000))}%` }} transition={{ duration: .8, delay: .12 }} style={{ background: meta.color }} /></div><strong className="interaction-rate">{formatPercent(row.ratio)}</strong><span className="interaction-delta">+{formatNumber(row.delta)}</span></div>; })}</div></div><div className="panel peak-panel"><PanelHeading icon={<Activity size={17} />} eyebrow="PEAK DAYS" title="增长高峰" extra={<span className="panel-caption">按播放增量</span>} /><div className="peak-list">{topDays.map((day, index) => <div className="peak-row" key={day.date}><span className={`peak-rank rank-${index + 1}`}>0{index + 1}</span><div><strong>{day.date.replaceAll("/", ".")}</strong><small>播放增长 · 互动 {formatNumber(day.engagement)}</small></div><b>+{formatNumber(day.deltaViews)}</b></div>)}</div><div className="peak-tip"><Sparkles size={15} /><span>这些日期值得回看当时发布或外部传播的内容。</span></div></div></section>
  </>;
}

function Analytics({ data, metric, setMetric }: { data: Point[]; metric: MetricKey; setMetric: (key: MetricKey) => void }) {
  const selected = metricMeta[metric];
  const latest = data.at(-1)!;
  const first = data[0];
  return <motion.section className="analytics-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="analytics-header"><div><span className="eyebrow">METRIC EXPLORER</span><h2>把增长拆成每一个动作</h2><p>选择任意真实字段，查看它在当前时间范围中的表现。</p></div><div className="metric-select"><selected.Icon size={17} style={{ color: selected.color }} /><select value={metric} onChange={(event) => setMetric(event.target.value as MetricKey)}>{metricKeys.map((key) => <option value={key} key={key}>{metricMeta[key].label}</option>)}</select><ChevronDown size={14} /></div></div><div className="analysis-cards">{metricKeys.map((key) => { const meta = metricMeta[key]; const Icon = meta.Icon; return <button className={`analysis-card ${key === metric ? "selected" : ""}`} key={key} onClick={() => setMetric(key)}><span className="analysis-card-icon" style={{ background: `${meta.color}18`, color: meta.color }}><Icon size={16} /></span><span>{meta.label}</span><strong>{formatCompact(latest[key])}</strong><small>+{formatNumber(latest[key] - first[key])} · {formatPercent(latest.views ? latest[key] / latest.views * 100 : 0)}</small></button>; })}</div><div className="panel analytics-table-panel"><PanelHeading icon={<BarChart3 size={17} />} eyebrow="BREAKDOWN" title={`${selected.label} 数据拆解`} extra={<span className="panel-caption">当前窗口每日记录</span>} /><div className="table-wrap"><table><thead><tr><th>日期</th><th>累计{selected.label}</th><th>当日新增</th><th>累计播放量</th><th>参考比例</th></tr></thead><tbody>{data.slice(-14).reverse().map((row) => <tr key={row.date}><td>{row.date.replaceAll("/", ".")}</td><td className="strong-cell">{formatNumber(row[metric])}</td><td className={(row[deltaKey(metric)] as number) > 0 ? "up-cell" : "muted-cell"}>{(row[deltaKey(metric)] as number) > 0 ? "+" : ""}{formatNumber(row[deltaKey(metric)] as number)}</td><td>{formatNumber(row.views)}</td><td>{formatPercent(row.views ? row[metric] / row.views * 100 : 0)}</td></tr>)}</tbody></table></div></div></motion.section>;
}

function Compare({ data, range }: { data: Point[]; range: RangeKey }) {
  const current = getRange(data, range);
  const previous = data.slice(Math.max(0, data.length - current.length * 2), data.length - current.length);
  const currentFirst = current[0]; const currentLast = current.at(-1)!; const previousFirst = previous[0] ?? currentFirst; const previousLast = previous.at(-1) ?? currentFirst;
  return <motion.section className="compare-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="compare-heading"><div><span className="eyebrow">PERIOD COMPARISON</span><h2>这一段时间，表现变快了吗？</h2><p>当前窗口与前一个同长度窗口的真实累计增量对比。</p></div><div className="compare-legend"><span><i className="legend-current" />当前周期</span><span><i className="legend-previous" />上一周期</span></div></div><div className="compare-grid">{metricKeys.map((key) => { const meta = metricMeta[key]; const currentDelta = currentLast[key] - currentFirst[key]; const previousDelta = previousLast[key] - previousFirst[key]; const change = previousDelta ? (currentDelta - previousDelta) / Math.abs(previousDelta) * 100 : 0; const Icon = meta.Icon; return <div className="compare-card" key={key}><div className="compare-card-title"><span className="metric-icon" style={{ color: meta.color, background: `${meta.color}18` }}><Icon size={16} /></span><strong>{meta.label}</strong></div><div className="compare-values"><div><small>当前</small><b>{currentDelta >= 0 ? "+" : ""}{formatCompact(currentDelta)}</b></div><div><small>上一周期</small><b className="previous-value">{previousDelta >= 0 ? "+" : ""}{formatCompact(previousDelta)}</b></div></div><div className="compare-bar"><span style={{ width: `${Math.min(100, Math.max(6, Math.abs(currentDelta) / Math.max(1, Math.abs(previousDelta || currentDelta)) * 48))}%`, background: meta.color }} /><span style={{ width: `${Math.min(100, Math.max(5, Math.abs(previousDelta) / Math.max(1, Math.abs(currentDelta || previousDelta)) * 48))}%` }} /></div><div className="compare-change"><Delta value={change} suffix="%" /><span>周期变化</span></div></div>; })}</div><div className="panel compare-summary"><PanelHeading icon={<Sparkles size={17} />} eyebrow="READOUT" title="对比摘要" /><div className="summary-grid"><div><span>当前周期</span><strong>{current[0]?.date.replaceAll("/", ".")} — {currentLast.date.replaceAll("/", ".")}</strong></div><div><span>上一周期</span><strong>{previous[0]?.date.replaceAll("/", ".") ?? "—"} — {previousLast.date.replaceAll("/", ".")}</strong></div><div><span>播放变化</span><strong className="pink-text">{currentLast.views - currentFirst.views >= 0 ? "+" : ""}{formatNumber(currentLast.views - currentFirst.views)}</strong></div></div></div></motion.section>;
}

export default App;
