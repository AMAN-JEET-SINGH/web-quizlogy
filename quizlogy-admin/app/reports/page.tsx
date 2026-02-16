'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  adsenseApi,
  AdSenseAccount,
  AdSenseDetailedReport,
  AdSenseDetailedRow,
  AdSenseAdUnit,
  AdSensePayment,
  AdSenseSite,
} from '@/lib/api';
import { useAdmin } from '@/lib/adminContext';
import './revenue.css';

// ── Helpers ──

function formatCurrency(val: number): string {
  return '$' + val.toFixed(2);
}

function formatNumber(val: number): string {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toLocaleString();
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function todayStr(): string {
  return formatDate(new Date());
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

function monthStart(): string {
  const d = new Date();
  return formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function weekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return formatDate(new Date(d.setDate(diff)));
}

type SortKey = 'DATE' | 'COUNTRY_NAME' | 'DOMAIN_NAME' | 'PAGE_VIEWS' | 'PAGE_VIEWS_RPM' | 'IMPRESSIONS' | 'IMPRESSIONS_RPM' | 'CLICKS' | 'ESTIMATED_EARNINGS';
type SortDir = 'asc' | 'desc';
type PeriodTab = 'day' | 'week' | 'month';
type ChartMetric = 'earnings' | 'impressions' | 'pageViews' | 'rpm';

// ── SVG Icons ──

function IconRefresh() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconTrending() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconCursor() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IconRevenue() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

// ── MultiSelect Dropdown ──

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const allSelected = selected.size === options.length;

  function toggleAll() {
    onChange(allSelected ? new Set() : new Set(options));
  }

  function toggle(item: string) {
    const next = new Set(selected);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    onChange(next);
  }

  const displayText = allSelected
    ? `All ${label}`
    : selected.size === 0
      ? `No ${label}`
      : `${selected.size} of ${options.length} ${label}`;

  return (
    <div className="rv-dropdown" ref={ref}>
      <button className="rv-dropdown-btn" onClick={() => setOpen(!open)} type="button">
        {displayText}
        <span className={`rv-dropdown-arrow ${open ? 'open' : ''}`}>&#9662;</span>
      </button>
      {open && (
        <div className="rv-dropdown-menu">
          <label className="rv-dropdown-item rv-dropdown-toggle-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
          </label>
          <div className="rv-dropdown-divider" />
          {options.map(opt => (
            <label key={opt} className="rv-dropdown-item">
              <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Smooth Area Chart ──

function AreaChart({
  data,
  labels,
  height = 280,
  color = '#6366f1',
  valueFormatter = (v: number) => v.toLocaleString(),
  lineLabel,
}: {
  data: number[];
  labels: string[];
  height?: number;
  color?: string;
  valueFormatter?: (v: number) => string;
  lineLabel?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const chartId = useRef(`chart-${Math.random().toString(36).slice(2, 8)}`).current;

  if (data.length === 0) {
    return <div className="rv-chart-empty">No data available</div>;
  }

  const maxVal = Math.max(...data.filter(v => v > 0), 1) * 1.12;
  const minVal = 0;
  const padding = { left: 60, right: 24, top: 24, bottom: 44 };
  const graphWidth = Math.max(600, data.length * 50);
  const graphHeight = height - padding.top - padding.bottom;

  const getX = (index: number) =>
    padding.left + (index / (data.length - 1 || 1)) * (graphWidth - padding.left - padding.right);
  const getY = (value: number) =>
    padding.top + graphHeight - ((value - minVal) / (maxVal - minVal || 1)) * graphHeight;

  // Build smooth curve (Catmull-Rom to Bezier)
  const points = data.map((value, index) => ({ x: getX(index), y: getY(value) }));

  let smoothPath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    smoothPath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const areaPath = `${smoothPath} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z`;

  const yAxisSteps = 5;
  const yLabels = Array.from({ length: yAxisSteps + 1 }, (_, i) => {
    const value = minVal + ((maxVal - minVal) / yAxisSteps) * (yAxisSteps - i);
    return { value, y: padding.top + (i / yAxisSteps) * graphHeight };
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div className="rv-chart-body" onMouseMove={handleMouseMove}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${graphWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={`grad-${chartId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {yLabels.map((label, i) => (
            <g key={i}>
              <line
                x1={padding.left}
                y1={label.y}
                x2={graphWidth - padding.right}
                y2={label.y}
                stroke="var(--rv-border, #e5e7eb)"
                strokeWidth="1"
                strokeDasharray={i === yLabels.length - 1 ? '0' : '3,3'}
                opacity="0.7"
              />
              <text
                x={padding.left - 10}
                y={label.y + 4}
                fontSize="10"
                fill="var(--rv-text-muted, #94a3b8)"
                textAnchor="end"
                fontFamily="var(--rv-font)"
              >
                {valueFormatter(label.value)}
              </text>
            </g>
          ))}

          {/* Gradient area fill */}
          <path d={areaPath} fill={`url(#grad-${chartId})`} />

          {/* Smooth line */}
          <path
            d={smoothPath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Vertical hover line */}
          {hoveredIndex !== null && (
            <line
              x1={getX(hoveredIndex)}
              y1={padding.top}
              x2={getX(hoveredIndex)}
              y2={padding.top + graphHeight}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.4"
            />
          )}

          {/* Data points */}
          {data.map((value, index) => {
            const x = getX(index);
            const y = getY(value);
            const isHovered = hoveredIndex === index;
            return (
              <g key={index}>
                {/* Larger invisible hit area */}
                <circle
                  cx={x}
                  cy={y}
                  r={20}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{ cursor: 'pointer' }}
                />
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 0}
                  fill={color}
                  stroke="var(--rv-card, white)"
                  strokeWidth="2"
                  style={{ transition: 'r 0.15s ease' }}
                  pointerEvents="none"
                />
              </g>
            );
          })}

          {/* X-axis labels */}
          {labels.map((label, index) => {
            const x = getX(index);
            const showEvery = Math.max(1, Math.floor(labels.length / 8));
            if (index % showEvery !== 0 && index !== labels.length - 1) return null;
            return (
              <text
                key={index}
                x={x}
                y={height - 12}
                fontSize="10"
                fill="var(--rv-text-muted, #94a3b8)"
                textAnchor="middle"
                fontFamily="var(--rv-font)"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      {lineLabel && (
        <div className="rv-chart-legend">
          <span className="rv-chart-legend-item">
            <span className="rv-chart-legend-dot" style={{ background: color }} />
            {lineLabel}
          </span>
        </div>
      )}

      {/* Floating Tooltip */}
      {hoveredIndex !== null && (
        <div
          className="rv-chart-tooltip"
          style={{ left: mousePos.x + 16, top: mousePos.y - 10 }}
        >
          <div className="rv-chart-tooltip-inner">
            <div className="rv-chart-tooltip-date">{labels[hoveredIndex]}</div>
            <div className="rv-chart-tooltip-row">
              <span className="rv-chart-tooltip-dot" style={{ background: color }} />
              <span className="rv-chart-tooltip-name">{lineLabel || 'Value'}</span>
              <span className="rv-chart-tooltip-val">{valueFormatter(data[hoveredIndex])}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── KPI Card ──

function KPICard({
  icon,
  label,
  value,
  iconClass,
  featured = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  iconClass: string;
  featured?: boolean;
}) {
  return (
    <div className={`rv-kpi-card ${featured ? 'rv-kpi-featured' : ''}`}>
      <div className={`rv-kpi-icon ${iconClass}`}>{icon}</div>
      <div className="rv-kpi-content">
        <span className="rv-kpi-label">{label}</span>
        <span className="rv-kpi-value" key={value}>{value}</span>
      </div>
    </div>
  );
}

// ── Main Component ──

function ReportsPageContent() {
  const { adminData } = useAdmin();
  const isSuperAdmin = adminData?.isSuperAdmin ?? false;
  const searchParams = useSearchParams();

  // Read URL params for date pre-filtering (from overview card clicks)
  const urlStart = searchParams.get('start');
  const urlEnd = searchParams.get('end');
  const urlDomains = searchParams.get('domains');

  // Period & date state
  const [periodTab, setPeriodTab] = useState<PeriodTab>('day');
  const [startDate, setStartDate] = useState(urlStart || monthStart());
  const [endDate, setEndDate] = useState(urlEnd || todayStr());
  const [appliedStart, setAppliedStart] = useState(urlStart || monthStart());
  const [appliedEnd, setAppliedEnd] = useState(urlEnd || todayStr());

  // Data state
  const [account, setAccount] = useState<AdSenseAccount | null>(null);
  const [detailedReport, setDetailedReport] = useState<AdSenseDetailedReport | null>(null);
  const [adUnits, setAdUnits] = useState<AdSenseAdUnit[]>([]);
  const [payments, setPayments] = useState<AdSensePayment[]>([]);
  const [sites, setSites] = useState<AdSenseSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Filter state
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('DATE');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Chart state
  const [chartMetric, setChartMetric] = useState<ChartMetric>('earnings');

  // Table state
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  const lastReportId = useRef<string | null>(null);

  // Apply period tab
  function applyPeriod(tab: PeriodTab) {
    setPeriodTab(tab);
    const today = todayStr();
    let s = today;
    switch (tab) {
      case 'day': s = daysAgo(6); break;
      case 'week': s = weekStart(); break;
      case 'month': s = monthStart(); break;
    }
    setStartDate(s);
    setEndDate(today);
    setAppliedStart(s);
    setAppliedEnd(today);
  }

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [accountData, reportData, adUnitsData, paymentsData, sitesData, syncStatus] = await Promise.all([
        adsenseApi.getAccount().catch(() => null),
        adsenseApi.getDetailedReport(appliedStart, appliedEnd),
        adsenseApi.getAdUnits().catch(() => []),
        adsenseApi.getPayments().catch(() => []),
        adsenseApi.getSites().catch(() => []),
        adsenseApi.getSyncStatus().catch(() => null),
      ]);

      setAccount(accountData);
      setDetailedReport(reportData);
      setAdUnits(adUnitsData);
      setPayments(paymentsData);
      setSites(sitesData);
      if (syncStatus?.lastSynced) {
        setLastSyncTime(syncStatus.lastSynced);
      }

      const reportId = `${appliedStart}_${appliedEnd}`;
      if (reportData && reportId !== lastReportId.current) {
        const isFirstLoad = lastReportId.current === null;
        lastReportId.current = reportId;
        // If domains param is in URL on initial load, pre-select only those domains
        if (isFirstLoad && urlDomains) {
          const domainList = urlDomains.split(',').map(d => d.trim()).filter(Boolean);
          const validDomains = domainList.filter(d => reportData.domains.includes(d));
          setSelectedDomains(new Set(validDomains.length > 0 ? validDomains : reportData.domains));
        } else {
          setSelectedDomains(new Set(reportData.domains));
        }
        setSelectedCountries(new Set(reportData.countries));
      }
    } catch (err: any) {
      console.error('AdSense load error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedStart, appliedEnd, urlDomains]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => loadData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Filtering ──
  const filteredRows = useMemo(() => {
    if (!detailedReport) return [];
    return detailedReport.rows.filter(row => {
      if (selectedDomains.size > 0 && !selectedDomains.has(row.DOMAIN_NAME)) return false;
      if (selectedCountries.size > 0 && !selectedCountries.has(row.COUNTRY_NAME)) return false;
      return true;
    });
  }, [detailedReport, selectedDomains, selectedCountries]);

  const filteredTotals = useMemo(() => {
    let earnings = 0, pageViews = 0, impressions = 0, clicks = 0, pageViewsRpmSum = 0, impressionsRpmSum = 0;
    filteredRows.forEach(r => {
      earnings += r.ESTIMATED_EARNINGS || 0;
      pageViews += r.PAGE_VIEWS || 0;
      impressions += r.IMPRESSIONS || 0;
      clicks += r.CLICKS || 0;
      pageViewsRpmSum += r.PAGE_VIEWS_RPM || 0;
      impressionsRpmSum += r.IMPRESSIONS_RPM || 0;
    });
    const count = filteredRows.length || 1;
    return {
      earnings,
      pageViews,
      impressions,
      clicks,
      avgPageViewsRpm: pageViewsRpmSum / count,
      avgImpressionsRpm: impressionsRpmSum / count,
    };
  }, [filteredRows]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal) || 0;
      const bNum = Number(bVal) || 0;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return sorted;
  }, [filteredRows, sortKey, sortDir]);

  // Search-filtered rows
  const searchedRows = useMemo(() => {
    if (!tableSearch.trim()) return sortedRows;
    const q = tableSearch.toLowerCase();
    return sortedRows.filter(row =>
      row.DATE?.toLowerCase().includes(q) ||
      row.COUNTRY_NAME?.toLowerCase().includes(q) ||
      row.DOMAIN_NAME?.toLowerCase().includes(q)
    );
  }, [sortedRows, tableSearch]);

  // Paginated rows
  const totalPages = Math.ceil(searchedRows.length / PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return searchedRows.slice(start, start + PAGE_SIZE);
  }, [searchedRows, currentPage]);

  // Reset page on search change
  useEffect(() => { setCurrentPage(1); }, [tableSearch]);

  // ── Chart data ──
  const chartData = useMemo(() => {
    const earningsMap = new Map<string, number>();
    const impressionsMap = new Map<string, number>();
    const pageViewsMap = new Map<string, number>();
    const rpmMap = new Map<string, { sum: number; count: number }>();

    filteredRows.forEach(r => {
      const date = r.DATE || '';
      earningsMap.set(date, (earningsMap.get(date) || 0) + (r.ESTIMATED_EARNINGS || 0));
      impressionsMap.set(date, (impressionsMap.get(date) || 0) + (r.IMPRESSIONS || 0));
      pageViewsMap.set(date, (pageViewsMap.get(date) || 0) + (r.PAGE_VIEWS || 0));
      const existing = rpmMap.get(date) || { sum: 0, count: 0 };
      rpmMap.set(date, { sum: existing.sum + (r.IMPRESSIONS_RPM || 0), count: existing.count + 1 });
    });

    const dates = Array.from(earningsMap.keys()).sort();
    return {
      dates,
      labels: dates,
      earnings: dates.map(d => earningsMap.get(d) || 0),
      impressions: dates.map(d => impressionsMap.get(d) || 0),
      pageViews: dates.map(d => pageViewsMap.get(d) || 0),
      rpm: dates.map(d => {
        const data = rpmMap.get(d);
        return data ? data.sum / data.count : 0;
      }),
    };
  }, [filteredRows]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setCurrentPage(1);
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  function applyDates() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }



  const handleRefresh = () => loadData(true);

  const handleExport = () => {
    if (sortedRows.length === 0) {
      alert('No data to export');
      return;
    }
    const headers = ['Date', 'Country', 'Domain', 'Page Views', 'Page RPM', 'Impressions', 'Imp. RPM', 'Clicks', 'Est. Revenue'];
    const csvRows = sortedRows.map(row => [
      `="${row.DATE}"`, row.COUNTRY_NAME, row.DOMAIN_NAME,
      row.PAGE_VIEWS, row.PAGE_VIEWS_RPM.toFixed(2), row.IMPRESSIONS,
      row.IMPRESSIONS_RPM.toFixed(2), row.CLICKS, row.ESTIMATED_EARNINGS.toFixed(2)
    ]);
    csvRows.push([
      'TOTALS', '', '', filteredTotals.pageViews, filteredTotals.avgPageViewsRpm.toFixed(2),
      filteredTotals.impressions, filteredTotals.avgImpressionsRpm.toFixed(2),
      filteredTotals.clicks, filteredTotals.earnings.toFixed(2)
    ]);
    const escapeCSV = (value: any): string => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...csvRows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue-report-${appliedStart}-to-${appliedEnd}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Chart metric config
  const chartConfig: Record<ChartMetric, { data: number[]; color: string; label: string; formatter: (v: number) => string }> = {
    earnings: { data: chartData.earnings, color: '#6366f1', label: 'Revenue', formatter: formatCurrency },
    impressions: { data: chartData.impressions, color: '#3b82f6', label: 'Impressions', formatter: formatNumber },
    pageViews: { data: chartData.pageViews, color: '#8b5cf6', label: 'Page Views', formatter: formatNumber },
    rpm: { data: chartData.rpm, color: '#ec4899', label: 'Avg RPM', formatter: formatCurrency },
  };

  const activeChart = chartConfig[chartMetric];



  // ── Render ──

  if (loading) {
    return (
      <div className="rv-page">
        <div className="rv-loading">
          <div className="rv-loading-spinner" />
          Loading analytics data...
        </div>
      </div>
    );
  }

  if (error && !detailedReport) {
    return (
      <div className="rv-page">
        <div className="rv-error">
          <span>Failed to load data</span>
          <span style={{ fontSize: 13, opacity: 0.7 }}>{error}</span>
        </div>
      </div>
    );
  }

  const lastFetchedDisplay = lastSyncTime
    ? new Date(lastSyncTime).toLocaleString()
    : detailedReport?.lastFetched
      ? new Date(detailedReport.lastFetched).toLocaleString()
      : null;

  return (
    <div className="rv-page">
      {/* ── Header Bar ── */}
      <div className="rv-header">
        <div className="rv-header-left">
          {lastFetchedDisplay && (
            <div className="rv-sync-badge">
              <span className="rv-sync-dot" />
              Last synced: {lastFetchedDisplay}
            </div>
          )}
          <span className="rv-auto-badge">Auto-sync</span>
        </div>
        <button
          className={`rv-refresh-btn ${refreshing ? 'rv-spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <IconRefresh />
          {refreshing ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="rv-filters">
        <div className="rv-filter-group">
          <label className="rv-filter-label">From</label>
          <input
            type="date"
            className="rv-date-input"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className="rv-filter-group">
          <label className="rv-filter-label">To</label>
          <input
            type="date"
            className="rv-date-input"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <button
          className="rv-apply-btn"
          onClick={applyDates}
          disabled={startDate === appliedStart && endDate === appliedEnd}
        >
          Apply
        </button>


        {detailedReport && (
          <>
            <MultiSelectDropdown label="Subdomains" options={detailedReport.domains} selected={selectedDomains} onChange={setSelectedDomains} />
            <MultiSelectDropdown label="Countries" options={detailedReport.countries} selected={selectedCountries} onChange={setSelectedCountries} />
          </>
        )}
      </div>

      {/* ── Account Bar (Super Admin) ── */}
      {isSuperAdmin && account && (
        <div className="rv-account-bar">
          <span className="rv-account-name">{account.name || 'AdSense Account'}</span>
          <span className="rv-account-id">{account.publisherId || ''}</span>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="rv-kpi-grid">
        <KPICard
          icon={<IconEye />}
          iconClass="rv-kpi-icon-impressions"
          label="Impressions"
          value={formatNumber(filteredTotals.impressions)}
        />
        <KPICard
          icon={<IconDollar />}
          iconClass="rv-kpi-icon-rpm"
          label="Impression RPM"
          value={formatCurrency(filteredTotals.avgImpressionsRpm)}
        />
        <KPICard
          icon={<IconFile />}
          iconClass="rv-kpi-icon-pageviews"
          label="Page Views"
          value={formatNumber(filteredTotals.pageViews)}
        />
        <KPICard
          icon={<IconTrending />}
          iconClass="rv-kpi-icon-pagerpn"
          label="Page RPM"
          value={formatCurrency(filteredTotals.avgPageViewsRpm)}
        />
        <KPICard
          icon={<IconCursor />}
          iconClass="rv-kpi-icon-clicks"
          label="Clicks"
          value={formatNumber(filteredTotals.clicks)}
        />
        <KPICard
          icon={<IconRevenue />}
          iconClass="rv-kpi-icon-revenue"
          label="Total Revenue"
          value={formatCurrency(filteredTotals.earnings)}
          featured
        />
      </div>

      {/* ── In-Hand Revenue (Limited Admin) ── */}
      {!isSuperAdmin && adminData && adminData.adsenseInHandRevenue > 0 && (
        <div className="rv-inhand-card">
          <div className="rv-inhand-icon">&#128176;</div>
          <div>
            <div className="rv-inhand-value">{formatCurrency(adminData.adsenseInHandRevenue)}</div>
            <div className="rv-inhand-label">In-Hand Revenue (Pre-set)</div>
          </div>
        </div>
      )}

      {/* ── Chart Section ── */}
      <div className="rv-chart-card">
        <div className="rv-chart-header">
          <h2 className="rv-chart-title">Revenue &amp; Performance Overview</h2>
          <div className="rv-chart-controls">
            {/* Metric Toggle */}
            <div className="rv-tab-group">
              {([
                { key: 'earnings' as ChartMetric, label: 'Revenue' },
                { key: 'impressions' as ChartMetric, label: 'Impressions' },
                { key: 'pageViews' as ChartMetric, label: 'Page Views' },
                { key: 'rpm' as ChartMetric, label: 'RPM' },
              ]).map(m => (
                <button
                  key={m.key}
                  className={`rv-tab-btn ${chartMetric === m.key ? 'active' : ''}`}
                  onClick={() => setChartMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Period Toggle */}
            <div className="rv-tab-group">
              {(['day', 'week', 'month'] as PeriodTab[]).map(tab => (
                <button
                  key={tab}
                  className={`rv-tab-btn ${periodTab === tab ? 'active' : ''}`}
                  onClick={() => applyPeriod(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AreaChart
          data={activeChart.data}
          labels={chartData.labels}
          color={activeChart.color}
          valueFormatter={activeChart.formatter}
          lineLabel={activeChart.label}
        />
      </div>

      {/* ── Detailed Report Table ── */}
      <div className="rv-table-section">
        <div className="rv-table-header">
          <h2 className="rv-table-title">
            Detailed Report
            <span className="rv-table-count">{searchedRows.length} entries</span>
          </h2>
          <div className="rv-table-actions">
            <input
              type="text"
              className="rv-search-input"
              placeholder="Search date, country, domain..."
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
            />
            <button className="rv-export-btn" onClick={handleExport} title="Export as CSV">
              <IconDownload />
              Export CSV
            </button>
          </div>
        </div>

        {searchedRows.length === 0 ? (
          <div className="rv-empty">No data matches the current filters</div>
        ) : (
          <>
            <div className="rv-table-scroll">
              <table className="rv-table">
                <thead>
                  <tr>
                    {([
                      { key: 'DATE' as SortKey, label: 'Date', cls: '' },
                      { key: 'COUNTRY_NAME' as SortKey, label: 'Country', cls: '' },
                      { key: 'DOMAIN_NAME' as SortKey, label: 'Domain', cls: '' },
                      { key: 'PAGE_VIEWS' as SortKey, label: 'Page Views', cls: 'num' },
                      { key: 'PAGE_VIEWS_RPM' as SortKey, label: 'Page RPM', cls: 'num' },
                      { key: 'IMPRESSIONS' as SortKey, label: 'Impressions', cls: 'num' },
                      { key: 'IMPRESSIONS_RPM' as SortKey, label: 'Imp. RPM', cls: 'num' },
                      { key: 'CLICKS' as SortKey, label: 'Clicks', cls: 'num' },
                      { key: 'ESTIMATED_EARNINGS' as SortKey, label: 'Revenue', cls: 'num' },
                    ]).map(col => (
                      <th
                        key={col.key}
                        className={`${col.cls} sortable`}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}{sortIndicator(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, i) => (
                    <tr key={i}>
                      <td>{row.DATE}</td>
                      <td>{row.COUNTRY_NAME}</td>
                      <td>{row.DOMAIN_NAME}</td>
                      <td className="num">{formatNumber(row.PAGE_VIEWS)}</td>
                      <td className="num">{formatCurrency(row.PAGE_VIEWS_RPM)}</td>
                      <td className="num">{formatNumber(row.IMPRESSIONS)}</td>
                      <td className="num">{formatCurrency(row.IMPRESSIONS_RPM)}</td>
                      <td className="num">{formatNumber(row.CLICKS)}</td>
                      <td className="num">{formatCurrency(row.ESTIMATED_EARNINGS)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="rv-totals-row">
                    <td colSpan={3}><strong>Totals</strong></td>
                    <td className="num"><strong>{formatNumber(filteredTotals.pageViews)}</strong></td>
                    <td className="num"><strong>{formatCurrency(filteredTotals.avgPageViewsRpm)}</strong></td>
                    <td className="num"><strong>{formatNumber(filteredTotals.impressions)}</strong></td>
                    <td className="num"><strong>{formatCurrency(filteredTotals.avgImpressionsRpm)}</strong></td>
                    <td className="num"><strong>{formatNumber(filteredTotals.clicks)}</strong></td>
                    <td className="num"><strong>{formatCurrency(filteredTotals.earnings)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="rv-table-footer">
                <span>
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, searchedRows.length)} of {searchedRows.length}
                </span>
                <div className="rv-pagination">
                  <button
                    className="rv-page-btn"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`rv-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    className="rv-page-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Ad Units (Super Admin) ── */}
      {isSuperAdmin && (
        <div className="rv-table-section">
          <div className="rv-table-header">
            <h2 className="rv-table-title">Ad Units Performance <span className="rv-table-count">30 Days</span></h2>
          </div>
          {adUnits.length === 0 ? (
            <div className="rv-empty">No ad units data available</div>
          ) : (
            <div className="rv-table-scroll">
              <table className="rv-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th className="num">Earnings</th>
                    <th className="num">Clicks</th>
                    <th className="num">Impressions</th>
                    <th className="num">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {adUnits.map((unit, i) => (
                    <tr key={i}>
                      <td>{unit.name}</td>
                      <td>
                        <span className={`rv-state-badge ${unit.state?.toLowerCase() || 'active'}`}>
                          {unit.type}
                        </span>
                      </td>
                      <td className="num">{formatCurrency(unit.earnings)}</td>
                      <td className="num">{unit.clicks.toLocaleString()}</td>
                      <td className="num">{unit.impressions.toLocaleString()}</td>
                      <td className="num">{unit.ctr.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Payment History (Super Admin) ── */}
      {isSuperAdmin && (
        <div className="rv-table-section">
          <div className="rv-table-header">
            <h2 className="rv-table-title">Payment History</h2>
          </div>
          {payments.length === 0 ? (
            <div className="rv-empty">No payment history available</div>
          ) : (
            <div className="rv-table-scroll">
              <table className="rv-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, i) => (
                    <tr key={i}>
                      <td>{payment.date}</td>
                      <td className="num">{payment.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sites (Super Admin) ── */}
      {isSuperAdmin && (
        <div className="rv-table-section">
          <div className="rv-table-header">
            <h2 className="rv-table-title">Sites</h2>
          </div>
          {sites.length === 0 ? (
            <div className="rv-empty">No sites data available</div>
          ) : (
            <div className="rv-table-scroll">
              <table className="rv-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>State</th>
                    <th>Auto Ads</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site, i) => (
                    <tr key={i}>
                      <td>{site.domain}</td>
                      <td>
                        <span className={`rv-state-badge ${site.state?.toLowerCase().replace(/_/g, '-') || 'active'}`}>
                          {site.state?.replace(/_/g, ' ') || 'Unknown'}
                        </span>
                      </td>
                      <td>{site.autoAdsEnabled ? 'Enabled' : 'Disabled'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="rv-page">
        <div className="rv-loading">
          <div className="rv-loading-spinner" />
          Loading analytics data...
        </div>
      </div>
    }>
      <ReportsPageContent />
    </Suspense>
  );
}
