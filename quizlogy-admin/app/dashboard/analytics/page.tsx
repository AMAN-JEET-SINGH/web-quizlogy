'use client';

import { useState, useEffect, useRef } from 'react';
import { visitorsApi } from '@/lib/api';
import './analytics.css';

// Browser colors for pie chart - distinct and in descending-visibility order
const BROWSER_COLORS = [
  '#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0',
  '#00BCD4', '#FF5722', '#795548', '#607D8B', '#E91E63',
];

const DEVICE_COLORS = ['#4285F4', '#34A853', '#FBBC04', '#6B7280'];

const OS_COLORS = [
  '#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0',
  '#00BCD4', '#FF5722', '#795548', '#607D8B',
];

type FilterMode = 'one' | 'multiple' | 'all';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    newUsers: number;
    activeUsers: number;
    totalUsers: number;
    bounceRate: number;
    avgSessionDuration: number;
    avgPageViews: number;
    viewsPerSession: number;
    browserDistribution: Array<{ browser: string; count: number }>;
    deviceDistribution: Array<{ device: string; count: number }>;
    osDistribution: Array<{ os: string; count: number }>;
    tableData: Array<{
      hostname: string;
      deviceCategory: string;
      totalUsers: number;
      newUsers: number;
      bounceRate: number;
      avgSessionDuration: number;
      totalUsersPercent: number;
    }>;
  } | null>(null);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [countries, setCountries] = useState<Array<{ country: string; countryCode: string }>>([]);
  const [origins, setOrigins] = useState<Array<{ origin: string; visitorCount: number }>>([]);
  const [countryMode, setCountryMode] = useState<FilterMode>('all');
  const [originMode, setOriginMode] = useState<FilterMode>('all');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState<{ chart: string; index: number } | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    visitorsApi.getCountries().then(r => setCountries(r.countries || []));
    visitorsApi.getTrafficSources().then(r => {
      const byOrigin = r.trafficSources?.byOrigin || [];
      setOrigins(byOrigin.map((o: { origin: string; visitorCount: number }) => ({
        origin: o.origin || 'Direct',
        visitorCount: o.visitorCount || 0,
      })));
    });
  }, []);

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedCountries, selectedOrigins]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const countriesParam = countryMode === 'all' ? undefined : selectedCountries;
      const originsParam = originMode === 'all' ? undefined : selectedOrigins;
      const res = await visitorsApi.getAnalyticsFull({
        startDate,
        endDate,
        countries: countriesParam,
        origins: originsParam,
      });
      setData(res.data);
    } catch (err) {
      setError('Failed to fetch analytics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setShowCountryDropdown(false);
      if (originRef.current && !originRef.current.contains(e.target as Node)) setShowOriginDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCountry = (c: string) => {
    setSelectedCountries(prev => {
      if (countryMode === 'one') return prev.includes(c) ? [] : [c];
      return prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c];
    });
  };
  const selectAllCountries = () => setSelectedCountries(countries.map(c => c.country));
  const deselectAllCountries = () => setSelectedCountries([]);

  const toggleOrigin = (o: string) => {
    setSelectedOrigins(prev => {
      if (originMode === 'one') return prev.includes(o) ? [] : [o];
      return prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o];
    });
  };
  const selectAllOrigins = () => setSelectedOrigins(origins.map(o => o.origin));
  const deselectAllOrigins = () => setSelectedOrigins([]);

  // Pie chart helpers
  const buildPieSegments = (items: Array<{ count: number }>) => {
    const total = items.reduce((s, i) => s + i.count, 0);
    let current = 0;
    return items.map((item, i) => {
      const pct = total > 0 ? (item.count / total) * 100 : 0;
      const start = current;
      current += pct;
      return { start, end: current, pct, value: item.count };
    });
  };

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  return (
    <div className="analytics-page analytics-page-ga">
      <div className="analytics-header">
        <div className="header-title-section">
          <h1>Analytics Dashboard</h1>
          <p>Google Analytics-style metrics and charts</p>
        </div>
        <div className="header-actions">
          <button onClick={fetchAnalytics} className="btn-refresh">
            <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="analytics-filters-card">
        <h3>Filters</h3>
        <div className="analytics-filters-grid">
          <div className="filter-field">
            <label>Date range</label>
            <div className="filter-date-range">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="filter-date-sep">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="filter-field filter-multi-select" ref={countryRef}>
            <label>Country</label>
            <div className="filter-mode-buttons">
              <button
                className={countryMode === 'one' ? 'active' : ''}
                onClick={() => setCountryMode('one')}
              >One</button>
              <button
                className={countryMode === 'multiple' ? 'active' : ''}
                onClick={() => setCountryMode('multiple')}
              >Multiple</button>
              <button
                className={countryMode === 'all' ? 'active' : ''}
                onClick={() => { setCountryMode('all'); setSelectedCountries([]); }}
              >All</button>
            </div>
            {(countryMode === 'one' || countryMode === 'multiple') && (
              <div className="filter-dropdown-wrap">
                <button
                  type="button"
                  className="filter-trigger"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                >
                  {selectedCountries.length === 0
                    ? 'Select country' + (countryMode === 'multiple' ? '(s)' : '')
                    : countryMode === 'one'
                      ? selectedCountries[0]
                      : `${selectedCountries.length} selected`}
                </button>
                {showCountryDropdown && (
                  <div className="filter-dropdown">
                    <div className="filter-dropdown-actions">
                      <button type="button" onClick={selectAllCountries}>Select all</button>
                      <button type="button" onClick={deselectAllCountries}>Deselect all</button>
                    </div>
                    <div className="filter-dropdown-list">
                      {countries.map(c => (
                        <label key={c.countryCode} className="filter-checkbox">
                          <input
                            type={countryMode === 'one' ? 'radio' : 'checkbox'}
                            name="country-select"
                            checked={selectedCountries.includes(c.country)}
                            onChange={() => toggleCountry(c.country)}
                          />
                          <span>{c.country} ({c.countryCode})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="filter-field filter-multi-select" ref={originRef}>
            <label>Origin</label>
            <div className="filter-mode-buttons">
              <button
                className={originMode === 'one' ? 'active' : ''}
                onClick={() => setOriginMode('one')}
              >One</button>
              <button
                className={originMode === 'multiple' ? 'active' : ''}
                onClick={() => setOriginMode('multiple')}
              >Multiple</button>
              <button
                className={originMode === 'all' ? 'active' : ''}
                onClick={() => { setOriginMode('all'); setSelectedOrigins([]); }}
              >All</button>
            </div>
            {(originMode === 'one' || originMode === 'multiple') && (
              <div className="filter-dropdown-wrap">
                <button
                  type="button"
                  className="filter-trigger"
                  onClick={() => setShowOriginDropdown(!showOriginDropdown)}
                >
                  {selectedOrigins.length === 0
                    ? 'Select origin' + (originMode === 'multiple' ? '(s)' : '')
                    : originMode === 'one'
                      ? (selectedOrigins[0] === 'Direct' ? 'Direct' : selectedOrigins[0])
                      : `${selectedOrigins.length} selected`}
                </button>
                {showOriginDropdown && (
                  <div className="filter-dropdown">
                    <div className="filter-dropdown-actions">
                      <button type="button" onClick={selectAllOrigins}>Select all</button>
                      <button type="button" onClick={deselectAllOrigins}>Deselect all</button>
                    </div>
                    <div className="filter-dropdown-list">
                      {origins.map(o => (
                        <label key={o.origin} className="filter-checkbox">
                          <input
                            type={originMode === 'one' ? 'radio' : 'checkbox'}
                            name="origin-select"
                            checked={selectedOrigins.includes(o.origin)}
                            onChange={() => toggleOrigin(o.origin)}
                          />
                          <span title={o.origin}>{o.origin === 'Direct' ? 'Direct' : o.origin}</span>
                          <span className="filter-count">({o.visitorCount})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <div>Loading analytics...</div>
        </div>
      ) : data ? (
        <>
          {/* Metric cards */}
          <div className="analytics-metrics-grid">
            <div className="metric-card">
              <div className="metric-label">New users</div>
              <div className="metric-value">{data.newUsers.toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Active users</div>
              <div className="metric-value">{data.activeUsers.toLocaleString()}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Bounce rate</div>
              <div className="metric-value">{data.bounceRate.toFixed(1)}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg. session duration</div>
              <div className="metric-value">{formatDuration(data.avgSessionDuration)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg. page views</div>
              <div className="metric-value">{data.avgPageViews.toFixed(1)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Views per session</div>
              <div className="metric-value">{data.viewsPerSession.toFixed(1)}</div>
            </div>
          </div>

          {/* Charts row */}
          <div className="analytics-charts-row">
            {/* Browser by views - Pie chart */}
            <div className="chart-card">
              <h3>Browser by views</h3>
              <div className="pie-chart-wrap">
                <div className="pie-chart-container">
                  <svg viewBox="0 0 100 100" className="pie-svg">
                    {buildPieSegments(data.browserDistribution).map((seg, i) => {
                      const degStart = (seg.start / 100) * 360 - 90;
                      const degEnd = (seg.end / 100) * 360 - 90;
                      const largeArc = seg.pct > 50 ? 1 : 0;
                      const x1 = 50 + 40 * Math.cos((degStart * Math.PI) / 180);
                      const y1 = 50 + 40 * Math.sin((degStart * Math.PI) / 180);
                      const x2 = 50 + 40 * Math.cos((degEnd * Math.PI) / 180);
                      const y2 = 50 + 40 * Math.sin((degEnd * Math.PI) / 180);
                      const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      const isHovered = hoveredSlice?.chart === 'browser' && hoveredSlice?.index === i;
                      return (
                        <path
                          key={i}
                          d={path}
                          fill={BROWSER_COLORS[i % BROWSER_COLORS.length]}
                          className={`pie-slice ${isHovered ? 'hovered' : ''}`}
                          onMouseEnter={() => setHoveredSlice({ chart: 'browser', index: i })}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <title>{data.browserDistribution[i].browser}: {seg.value}</title>
                        </path>
                      );
                    })}
                  </svg>
                  <div className="pie-center">
                    <span className="pie-total">{data.totalUsers}</span>
                    <span className="pie-label">Total</span>
                  </div>
                </div>
                <div className="pie-legend">
                  {data.browserDistribution.map((b, i) => {
                    const isHovered = hoveredSlice?.chart === 'browser' && hoveredSlice?.index === i;
                    return (
                      <div
                        key={i}
                        className={`pie-legend-item ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredSlice({ chart: 'browser', index: i })}
                        onMouseLeave={() => setHoveredSlice(null)}
                      >
                        <span className="pie-legend-color" style={{ background: BROWSER_COLORS[i % BROWSER_COLORS.length] }} />
                        <span className="pie-legend-label">{b.browser}</span>
                        <span className="pie-legend-value">{b.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {hoveredSlice?.chart === 'browser' && data.browserDistribution[hoveredSlice.index] && (
                <div className="pie-tooltip">
                  {data.browserDistribution[hoveredSlice.index].browser}: {data.browserDistribution[hoveredSlice.index].count}
                </div>
              )}
            </div>

            {/* Device category by views - Pie chart */}
            <div className="chart-card">
              <h3>Device category by views</h3>
              <div className="pie-chart-wrap">
                <div className="pie-chart-container">
                  <svg viewBox="0 0 100 100" className="pie-svg">
                    {buildPieSegments(data.deviceDistribution).map((seg, i) => {
                      const degStart = (seg.start / 100) * 360 - 90;
                      const degEnd = (seg.end / 100) * 360 - 90;
                      const largeArc = seg.pct > 50 ? 1 : 0;
                      const x1 = 50 + 40 * Math.cos((degStart * Math.PI) / 180);
                      const y1 = 50 + 40 * Math.sin((degStart * Math.PI) / 180);
                      const x2 = 50 + 40 * Math.cos((degEnd * Math.PI) / 180);
                      const y2 = 50 + 40 * Math.sin((degEnd * Math.PI) / 180);
                      const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                      const isHovered = hoveredSlice?.chart === 'device' && hoveredSlice?.index === i;
                      return (
                        <path
                          key={i}
                          d={path}
                          fill={DEVICE_COLORS[i % DEVICE_COLORS.length]}
                          className={`pie-slice ${isHovered ? 'hovered' : ''}`}
                          onMouseEnter={() => setHoveredSlice({ chart: 'device', index: i })}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <title>{data.deviceDistribution[i].device}: {seg.value}</title>
                        </path>
                      );
                    })}
                  </svg>
                  <div className="pie-center">
                    <span className="pie-total">{data.totalUsers}</span>
                    <span className="pie-label">Total</span>
                  </div>
                </div>
                <div className="pie-legend">
                  {data.deviceDistribution.map((d, i) => {
                    const isHovered = hoveredSlice?.chart === 'device' && hoveredSlice?.index === i;
                    return (
                      <div
                        key={i}
                        className={`pie-legend-item ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredSlice({ chart: 'device', index: i })}
                        onMouseLeave={() => setHoveredSlice(null)}
                      >
                        <span className="pie-legend-color" style={{ background: DEVICE_COLORS[i % DEVICE_COLORS.length] }} />
                        <span className="pie-legend-label">{d.device}</span>
                        <span className="pie-legend-value">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {hoveredSlice?.chart === 'device' && data.deviceDistribution[hoveredSlice.index] && (
                <div className="pie-tooltip">
                  {data.deviceDistribution[hoveredSlice.index].device}: {data.deviceDistribution[hoveredSlice.index].count}
                </div>
              )}
            </div>
          </div>

          {/* Histogram - Users by OS */}
          <div className="chart-card chart-card-full">
            <h3>Users by operating system</h3>
            <div className="histogram-wrap">
              {data.osDistribution.length === 0 ? (
                <div className="no-data-message">No OS data available</div>
              ) : (
                <div className="histogram-bars">
                  {data.osDistribution.map((os, i) => {
                    const max = Math.max(...data.osDistribution.map(o => o.count), 1);
                    const h = (os.count / max) * 100;
                    const isHovered = hoveredBar === i;
                    return (
                      <div
                        key={i}
                        className={`histogram-bar-wrap ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        <div
                          className="histogram-bar"
                          style={{
                            height: `${h}%`,
                            background: OS_COLORS[i % OS_COLORS.length],
                          }}
                          title={`${os.os}: ${os.count}`}
                        >
                          {isHovered && <span className="histogram-bar-value">{os.count}</span>}
                        </div>
                        <div className="histogram-label" title={os.os}>{os.os}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Google Analytics table */}
          <div className="table-section ga-table-section">
            <h3>Traffic overview</h3>
            <div className="ga-table-container">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>Device category</th>
                    <th className="text-right">Total users</th>
                    <th className="text-right">New users</th>
                    <th className="text-right">Bounce rate</th>
                    <th className="text-right">Avg. session</th>
                    <th className="text-right">Total users %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tableData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="ga-table-empty">No data</td>
                    </tr>
                  ) : (
                    data.tableData.map((row, i) => (
                      <tr key={i}>
                        <td className="ga-cell-hostname" title={row.hostname}>{row.hostname}</td>
                        <td>{row.deviceCategory}</td>
                        <td className="text-right">{row.totalUsers.toLocaleString()}</td>
                        <td className="text-right">{row.newUsers.toLocaleString()}</td>
                        <td className="text-right">{row.bounceRate.toFixed(1)}%</td>
                        <td className="text-right">{formatDuration(row.avgSessionDuration)}</td>
                        <td className="text-right">{row.totalUsersPercent.toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
