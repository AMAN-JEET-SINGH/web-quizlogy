'use client';

import { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import { visitorsApi, VisitorIP, VisitorStats, Country, TrafficSources } from '@/lib/api';
import './visitors.css';

export default function VisitorsManagement() {
  const [visitors, setVisitors] = useState<VisitorIP[]>([]);
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSources | null>(null);
  const [showTrafficAnalytics, setShowTrafficAnalytics] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Filter states
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [os, setOs] = useState('');
  const [browser, setBrowser] = useState('');
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [showOriginFilter, setShowOriginFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('lastVisit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  
  // Detail modal state
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorIP | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deletingIp, setDeletingIp] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedIpAddresses, setSelectedIpAddresses] = useState<Set<string>>(new Set());
  const originFilterRef = useRef<HTMLDivElement>(null);

  // Close origin dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originFilterRef.current && !originFilterRef.current.contains(e.target as Node)) {
        setShowOriginFilter(false);
      }
    };
    if (showOriginFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOriginFilter]);

  // Column visibility state - all columns available by default
  const [visibleColumns, setVisibleColumns] = useState({
    expand: true,
    origin: true,
    ipAddress: true,
    country: true,
    countryCode: false,
    region: false,
    deviceType: true,
    os: true,
    browser: true,
    screenResolution: false,
    visitCount: true,
    clickCount: true,
    lastSessionClicks: false,
    lastVisitedPage: false,
    exitPage: false,
    firstVisit: false,
    lastVisit: true,
    timeStamp: false,
    // Header information fields
    cfConnectingIp: false,
    cfIpCountry: false,
    referer: false,
    secChUa: false,
    secChUaFullVersionList: false,
    secChUaPlatform: false,
    userAgent: false,
    xRealIp: false,
    xRequestedWith: false,
    actions: true,
  });

  useEffect(() => {
    fetchTrafficSources();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchVisitors();
    fetchStats();
    fetchCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, country, region, deviceType, os, browser, sortBy, sortOrder, selectedOrigins, dateFrom, dateTo]);

  const fetchVisitors = async () => {
    try {
      setLoading(true);
      const response = await visitorsApi.getAll({
        page,
        limit,
        search: search || undefined,
        country: country || undefined,
        region: region || undefined,
        deviceType: deviceType || undefined,
        os: os || undefined,
        browser: browser || undefined,
        origins: selectedOrigins.length > 0 ? selectedOrigins : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
      });
      setVisitors(response.data);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to fetch visitors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await visitorsApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchCountries = async () => {
    try {
      const response = await visitorsApi.getCountries();
      setCountries(response.countries);
    } catch (err) {
      console.error('Failed to fetch countries:', err);
    }
  };

  const fetchTrafficSources = async () => {
    try {
      const response = await visitorsApi.getTrafficSources();
      setTrafficSources(response.trafficSources);
    } catch (err) {
      console.error('Failed to fetch traffic sources:', err);
    }
  };

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const blob = await visitorsApi.exportCSV();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visitors_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Failed to export CSV');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setCountry('');
    setRegion('');
    setDeviceType('');
    setOs('');
    setBrowser('');
    setSelectedOrigins([]);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const toggleOrigin = (origin: string) => {
    setSelectedOrigins((prev) =>
      prev.includes(origin) ? prev.filter((o) => o !== origin) : [...prev, origin]
    );
    setPage(1);
  };

  const selectAllOrigins = () => {
    if (!trafficSources?.byOrigin?.length) return;
    setSelectedOrigins(trafficSources.byOrigin.map((item) => item.origin || 'Direct'));
    setPage(1);
  };

  const deselectAllOrigins = () => {
    setSelectedOrigins([]);
    setPage(1);
  };

  const hasActiveFilters = search || country || region || deviceType || os || browser || selectedOrigins.length > 0 || dateFrom || dateTo;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  const toggleSelect = (ipAddress: string) => {
    setSelectedIpAddresses((prev) => {
      const next = new Set(prev);
      if (next.has(ipAddress)) next.delete(ipAddress);
      else next.add(ipAddress);
      return next;
    });
  };

  const selectAll = () => setSelectedIpAddresses(new Set(visitors.map((v) => v.ipAddress)));
  const deselectAll = () => setSelectedIpAddresses(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIpAddresses.size === 0) {
      alert('Please select at least one visitor to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedIpAddresses.size} selected visitor(s)?`)) return;
    try {
      setLoading(true);
      for (const ip of selectedIpAddresses) {
        await visitorsApi.delete(ip);
      }
      setSelectedIpAddresses(new Set());
      fetchVisitors();
      fetchStats();
    } catch (err) {
      setError('Failed to delete selected visitors');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ipAddress: string) => {
    if (!window.confirm(`Are you sure you want to delete visitor ${ipAddress}?`)) {
      return;
    }
    
    try {
      setDeletingIp(ipAddress);
      const result = await visitorsApi.delete(ipAddress);
      // Refresh the list
      await fetchVisitors();
      await fetchStats();
      // Show success message
      if (result.status) {
        setError(null);
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to delete visitor';
      setError(errorMsg);
      console.error('Delete error:', err);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingIp(null);
    }
  };
  
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL visitor data? This action cannot be undone!')) {
      setShowClearConfirm(false);
      return;
    }
    
    try {
      await visitorsApi.clearAll();
      await fetchVisitors();
      await fetchStats();
      setShowClearConfirm(false);
      alert('All visitor data has been cleared');
    } catch (err) {
      alert('Failed to clear visitor data');
      console.error(err);
    }
  };
  
  const handleViewDetails = (visitor: VisitorIP) => {
    setSelectedVisitor(visitor);
    setShowDetailModal(true);
  };

  const toggleRowExpansion = (visitorId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(visitorId)) {
      newExpanded.delete(visitorId);
    } else {
      newExpanded.add(visitorId);
    }
    setExpandedRows(newExpanded);
  };

  const toggleColumnVisibility = (columnKey: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey as keyof typeof prev]
    }));
  };

  const getVisibleColumnCount = () => {
    return Object.values(visibleColumns).filter(v => v).length;
  };

  return (
    <div className="visitors-management">
      {/* Header Section */}
      <div className="visitors-header-card">
        <div className="header-content">
          <div className="header-title-section">
        <h1>Visitor IPs</h1>
            <p>
              {!loading && `${pagination.total.toLocaleString()} total visitors`}
            </p>
          </div>
          <div className="header-actions">
            <button 
              onClick={handleExportCSV}
              disabled={exporting}
              className="btn-export-csv"
              title="Export all visitors to CSV"
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
            {hasActiveFilters && (
              <button 
                onClick={clearFilters} 
                className="btn-clear-filters"
                title="Clear all filters"
              >
                <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Filters
              </button>
            )}
            <button 
              onClick={() => setShowClearConfirm(true)} 
              className="btn-clear-all"
              title="Clear all visitor data"
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All Data
            </button>
            <button 
              onClick={fetchVisitors} 
              className="btn-refresh"
              title="Refresh visitor list"
            >
              <svg className="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button 
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className={`btn-column-selector ${showColumnSelector ? 'active' : ''}`}
              title="Choose which columns to show in the table"
            >
              <svg className="btn-icon filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Table columns
            </button>
            {visitors.length > 0 && (
              <>
                <button onClick={selectedIpAddresses.size === visitors.length ? deselectAll : selectAll} className="btn-select-all">
                  {selectedIpAddresses.size === visitors.length ? 'Deselect All' : 'Select All'}
                </button>
                <button onClick={handleDeleteSelected} disabled={selectedIpAddresses.size === 0} className="btn-delete-selected">
                  Delete Selected {selectedIpAddresses.size > 0 ? `(${selectedIpAddresses.size})` : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards - muted, consistent with small labels and icons */}
      {stats && (
        <div className="visitors-stats">
          <div className="visitors-stat-card">
            <span className="visitors-stat-icon" aria-hidden>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </span>
            <div className="visitors-stat-body">
              <span className="visitors-stat-label">Total Visitors</span>
              <span className="visitors-stat-value">{stats.totalVisitors.toLocaleString()}</span>
            </div>
          </div>
          <div className="visitors-stat-card">
            <span className="visitors-stat-icon" aria-hidden>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </span>
            <div className="visitors-stat-body">
              <span className="visitors-stat-label">Total Visits</span>
              <span className="visitors-stat-value">{stats.totalVisits.toLocaleString()}</span>
            </div>
          </div>
          <div className="visitors-stat-card">
            <span className="visitors-stat-icon" aria-hidden>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
            </span>
            <div className="visitors-stat-body">
              <span className="visitors-stat-label">Total Clicks</span>
              <span className="visitors-stat-value">{stats.totalClicks.toLocaleString()}</span>
            </div>
          </div>
          <div className="visitors-stat-card">
            <span className="visitors-stat-icon" aria-hidden>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0h.5a2.5 2.5 0 002.5-2.5V8.935M12 20.065V18a2 2 0 00-2-2 2 2 0 00-2 2v2.065M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <div className="visitors-stat-body">
              <span className="visitors-stat-label">Unique Countries</span>
              <span className="visitors-stat-value">{stats.uniqueCountries.toLocaleString()}</span>
            </div>
          </div>
          <div className="visitors-stat-card">
            <span className="visitors-stat-icon" aria-hidden>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </span>
            <div className="visitors-stat-body">
              <span className="visitors-stat-label">Normal Browser</span>
              <span className="visitors-stat-value">{(trafficSources?.browserType?.normalBrowser ?? 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="visitors-stat-card">
            <span className="visitors-stat-icon" aria-hidden>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </span>
            <div className="visitors-stat-body">
              <span className="visitors-stat-label">Webview</span>
              <span className="visitors-stat-value">{(trafficSources?.browserType?.webview ?? 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Traffic Source Analytics */}
      {showTrafficAnalytics && trafficSources && (
        <div className="traffic-analytics-panel">
          <div className="traffic-analytics-header">
            <h2>Traffic Source Analytics</h2>
            <button
              onClick={() => setShowTrafficAnalytics(false)}
              className="close-btn"
            >
              ×
            </button>
          </div>
          
          {/* Browser Type Distribution */}
          <div className="traffic-section">
            <h3>Browser Type</h3>
            <div className="browser-type-grid">
              <div className="browser-type-card browser-type-normal">
                <div className="browser-type-label">Normal Browser</div>
                <div className="browser-type-value">{trafficSources.browserType.normalBrowser}</div>
              </div>
              <div className="browser-type-card browser-type-webview">
                <div className="browser-type-label">Webview</div>
                <div className="browser-type-value">{trafficSources.browserType.webview}</div>
              </div>
              <div className="browser-type-card browser-type-unknown">
                <div className="browser-type-label">Unknown</div>
                <div className="browser-type-value">{trafficSources.browserType.unknown}</div>
              </div>
            </div>
          </div>

          {/* Top Origins */}
          {trafficSources.byOrigin.length > 0 && (
            <div className="traffic-section">
              <h3>Top Traffic Sources (Origin)</h3>
              <div className="traffic-table-container">
                <table className="traffic-table">
                  <thead>
                    <tr>
                      <th>Origin</th>
                      <th className="text-right">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficSources.byOrigin.slice(0, 20).map((item, idx) => (
                      <tr key={idx}>
                        <td className="traffic-table-cell-url">{item.origin || 'Direct'}</td>
                        <td className="text-right traffic-table-cell-number">{item.visitorCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Referers */}
          {trafficSources.byReferer.length > 0 && (
            <div className="traffic-section">
              <h3>Top Referers</h3>
              <div className="traffic-table-container">
                <table className="traffic-table">
                  <thead>
                    <tr>
                      <th>Referer</th>
                      <th className="text-right">Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficSources.byReferer.slice(0, 20).map((item, idx) => (
                      <tr key={idx}>
                        <td className="traffic-table-cell-url">{item.referer || 'Direct'}</td>
                        <td className="text-right traffic-table-cell-number">{item.visitorCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search and Filters Section */}
      <div className="filters-container">
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search IP, Country, Page..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="">All Countries</option>
              {countries.map((c) => (
                <option key={c.countryCode} value={c.country}>
                  {c.country} ({c.countryCode})
                </option>
              ))}
          </select>
        </div>
        <div className="filter-group">
          <select
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="">All Regions</option>
            <option value="IND">India</option>
            <option value="ALL">All Other</option>
          </select>
        </div>
        <div className="filter-group">
          <select
            value={deviceType}
            onChange={(e) => {
              setDeviceType(e.target.value);
              setPage(1);
            }}
            className="filter-select"
          >
            <option value="">All Devices</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
            <option value="desktop">Desktop</option>
          </select>
        </div>
        <div className="filter-group">
          <input
            type="text"
            placeholder="Filter by OS..."
            value={os}
            onChange={(e) => {
              setOs(e.target.value);
              setPage(1);
            }}
            className="filter-input"
          />
        </div>
        <div className="filter-group">
          <input
            type="text"
            placeholder="Filter by Browser..."
            value={browser}
            onChange={(e) => {
              setBrowser(e.target.value);
              setPage(1);
            }}
            className="filter-input"
          />
        </div>
        <div className="filter-group visitor-date-filter-group">
          <label className="visitor-date-label">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="filter-input visitor-date-input"
          />
        </div>
        <div className="filter-group visitor-date-filter-group">
          <label className="visitor-date-label">To</label>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="filter-input visitor-date-input"
          />
        </div>
        <div className="filter-group origin-filter-wrapper" ref={originFilterRef}>
          <div className="origin-filter-row">
            <button
              type="button"
              onClick={() => setShowOriginFilter((v) => !v)}
              className={`origin-filter-trigger ${selectedOrigins.length > 0 ? 'has-selection' : ''}`}
              aria-expanded={showOriginFilter}
            >
              Origin {selectedOrigins.length > 0 ? `(${selectedOrigins.length} selected)` : ''}
            </button>
            <button
              type="button"
              onClick={() => { selectAllOrigins(); setShowOriginFilter(false); }}
              className="origin-select-all-btn"
              title="Select all origins"
            >
              Select all
            </button>
          </div>
          {showOriginFilter && (
            <div className="origin-filter-dropdown">
              <div className="origin-filter-actions">
                <button type="button" onClick={selectAllOrigins} className="origin-filter-link">
                  Select all
                </button>
                <span className="origin-filter-sep">|</span>
                <button type="button" onClick={deselectAllOrigins} className="origin-filter-link">
                  Deselect all
                </button>
              </div>
              <div className="origin-filter-list">
                {!trafficSources?.byOrigin?.length ? (
                  <div className="origin-filter-empty">Loading origins...</div>
                ) : (
                  trafficSources.byOrigin.map((item) => {
                    const value = item.origin || 'Direct';
                    return (
                      <label key={value} className="origin-filter-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedOrigins.includes(value)}
                          onChange={() => toggleOrigin(value)}
                        />
                        <span className="origin-filter-label" title={value}>
                          {value === 'Direct' ? 'Direct' : value}
                        </span>
                        <span className="origin-filter-count">({item.visitorCount})</span>
                      </label>
                    );
                  })
                )}
              </div>
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

      {/* Table columns filter */}
      {showColumnSelector && (
        <div className="column-selector-panel">
          <div className="column-selector-header">
            <h3>Table columns</h3>
            <button
              onClick={() => setShowColumnSelector(false)}
              className="close-btn"
            >
              ×
            </button>
          </div>
          <div className="column-selector-grid">
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.expand}
                onChange={() => toggleColumnVisibility('expand')}
              />
              <span>Expand</span>
            </label>
            <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.origin}
                  onChange={() => toggleColumnVisibility('origin')}
                />
                <span>Origin</span>
              </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.ipAddress}
                onChange={() => toggleColumnVisibility('ipAddress')}
              />
              <span>IP Address</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.country}
                onChange={() => toggleColumnVisibility('country')}
              />
              <span>Country</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.countryCode}
                onChange={() => toggleColumnVisibility('countryCode')}
              />
              <span>Country Code</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.region}
                onChange={() => toggleColumnVisibility('region')}
              />
              <span>Region</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.deviceType}
                onChange={() => toggleColumnVisibility('deviceType')}
              />
              <span>Device Type</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.os}
                onChange={() => toggleColumnVisibility('os')}
              />
              <span>OS</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.browser}
                onChange={() => toggleColumnVisibility('browser')}
              />
              <span>Browser</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.screenResolution}
                onChange={() => toggleColumnVisibility('screenResolution')}
              />
              <span>Screen Resolution</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.visitCount}
                onChange={() => toggleColumnVisibility('visitCount')}
              />
              <span>Visit Count</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.clickCount}
                onChange={() => toggleColumnVisibility('clickCount')}
              />
              <span>Click Count</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.lastSessionClicks}
                onChange={() => toggleColumnVisibility('lastSessionClicks')}
              />
              <span>Session Clicks</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.lastVisitedPage}
                onChange={() => toggleColumnVisibility('lastVisitedPage')}
              />
              <span>Last Visited Page</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.exitPage}
                onChange={() => toggleColumnVisibility('exitPage')}
              />
              <span>Exit Page</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.firstVisit}
                onChange={() => toggleColumnVisibility('firstVisit')}
              />
              <span>First Visit</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.lastVisit}
                onChange={() => toggleColumnVisibility('lastVisit')}
              />
              <span>Last Visit</span>
            </label>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.timeStamp}
                onChange={() => toggleColumnVisibility('timeStamp')}
              />
              <span>Time Stamp</span>
            </label>
          </div>
          
          {/* Header Information Fields */}
          <div className="column-selector-section">
            <h4 className="column-section-title">Header Information</h4>
            <div className="column-selector-grid">
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.cfConnectingIp}
                  onChange={() => toggleColumnVisibility('cfConnectingIp')}
                />
                <span>CF-Connecting-IP</span>
              </label>
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.cfIpCountry}
                  onChange={() => toggleColumnVisibility('cfIpCountry')}
                />
                <span>CF-IP-Country</span>
              </label>
              
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.referer}
                  onChange={() => toggleColumnVisibility('referer')}
                />
                <span>Referer</span>
              </label>
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.secChUa}
                  onChange={() => toggleColumnVisibility('secChUa')}
                />
                <span>Sec-CH-UA</span>
              </label>
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.secChUaFullVersionList}
                  onChange={() => toggleColumnVisibility('secChUaFullVersionList')}
                />
                <span>Sec-CH-UA-Full-Version</span>
              </label>
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.secChUaPlatform}
                  onChange={() => toggleColumnVisibility('secChUaPlatform')}
                />
                <span>Sec-CH-UA-Platform</span>
              </label>
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.userAgent}
                  onChange={() => toggleColumnVisibility('userAgent')}
                />
                <span>User-Agent</span>
              </label>
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.xRealIp}
                  onChange={() => toggleColumnVisibility('xRealIp')}
                />
                <span>X-Real-IP</span>
              </label>
              <label className="column-checkbox">
                <input
                  type="checkbox"
                  checked={visibleColumns.xRequestedWith}
                  onChange={() => toggleColumnVisibility('xRequestedWith')}
                />
                <span>X-Requested-With</span>
              </label>
            </div>
          </div>
          
          <div className="column-selector-grid" style={{ marginTop: '16px' }}>
            <label className="column-checkbox">
              <input
                type="checkbox"
                checked={visibleColumns.actions}
                onChange={() => toggleColumnVisibility('actions')}
              />
              <span>Actions</span>
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <div>Loading visitors...</div>
        </div>
      ) : (
        <>
          <div className="visitors-table-container">
            <table className="visitors-table">
              <thead>
                <tr>
                  <th className="visitors-th visitors-th-select">
                    <label className="table-checkbox-label">
                      <input
                        type="checkbox"
                        checked={visitors.length > 0 && selectedIpAddresses.size === visitors.length}
                        onChange={() => visitors.length > 0 && (selectedIpAddresses.size === visitors.length ? deselectAll() : selectAll())}
                      />
                    </label>
                  </th>
                  {visibleColumns.expand && <th className="visitors-th visitors-th-expand"></th>}
                  {visibleColumns.origin && (
                    <th 
                      onClick={() => handleSort('origin')} 
                      className="visitors-th visitors-th-sortable"
                    >
                      Origin {sortBy === 'origin' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  )}
                  {visibleColumns.ipAddress && (
                    <th onClick={() => handleSort('ipAddress')} className="visitors-th visitors-th-sortable">IP Address {sortBy === 'ipAddress' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.country && (
                    <th onClick={() => handleSort('country')} className="visitors-th visitors-th-sortable">Country {sortBy === 'country' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.countryCode && (
                    <th onClick={() => handleSort('countryCode')} className="visitors-th visitors-th-sortable">Country Code {sortBy === 'countryCode' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.region && (
                    <th onClick={() => handleSort('region')} className="visitors-th visitors-th-sortable">Region {sortBy === 'region' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.deviceType && (
                    <th onClick={() => handleSort('deviceType')} className="visitors-th visitors-th-sortable">Device {sortBy === 'deviceType' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.os && (
                    <th onClick={() => handleSort('os')} className="visitors-th visitors-th-sortable">OS {sortBy === 'os' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.browser && (
                    <th onClick={() => handleSort('browser')} className="visitors-th visitors-th-sortable">Browser {sortBy === 'browser' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.screenResolution && <th className="visitors-th">Screen</th>}
                  {visibleColumns.visitCount && (
                    <th onClick={() => handleSort('visitCount')} className="visitors-th visitors-th-sortable">Visits {sortBy === 'visitCount' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.clickCount && (
                    <th onClick={() => handleSort('clickCount')} className="visitors-th visitors-th-sortable">Clicks {sortBy === 'clickCount' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.lastSessionClicks && (
                    <th onClick={() => handleSort('lastSessionClicks')} className="visitors-th visitors-th-sortable">Session Clicks {sortBy === 'lastSessionClicks' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.lastVisitedPage && <th className="visitors-th">Last Page</th>}
                  {visibleColumns.exitPage && <th className="visitors-th">Exit Page</th>}
                  {visibleColumns.firstVisit && (
                    <th onClick={() => handleSort('firstVisit')} className="visitors-th visitors-th-sortable">First Visit {sortBy === 'firstVisit' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.lastVisit && (
                    <th onClick={() => handleSort('lastVisit')} className="visitors-th visitors-th-sortable">Last Visit {sortBy === 'lastVisit' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  )}
                  {visibleColumns.timeStamp && <th className="visitors-th">Time Stamp</th>}
                  {visibleColumns.cfConnectingIp && <th className="visitors-th">CF-Connecting-IP</th>}
                  {visibleColumns.cfIpCountry && <th className="visitors-th">CF-IP-Country</th>}
                  {visibleColumns.referer && <th className="visitors-th">Referer</th>}
                  {visibleColumns.secChUa && <th className="visitors-th">Sec-CH-UA</th>}
                  {visibleColumns.secChUaFullVersionList && <th className="visitors-th">Sec-CH-UA-Full</th>}
                  {visibleColumns.secChUaPlatform && <th className="visitors-th">Sec-CH-UA-Platform</th>}
                  {visibleColumns.userAgent && <th className="visitors-th">User-Agent</th>}
                  {visibleColumns.xRealIp && <th className="visitors-th">X-Real-IP</th>}
                  {visibleColumns.xRequestedWith && <th className="visitors-th">X-Requested-With</th>}
                  {visibleColumns.actions && <th className="visitors-th visitors-th-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visitors.length === 0 ? (
                  <tr>
                    <td colSpan={getVisibleColumnCount() + 1} className="visitors-td visitors-td-empty">
                      <div className="visitors-empty-inner">
                        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="visitors-empty-icon" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <div className="visitors-empty-title">No visitors found</div>
                        <div className="visitors-empty-hint">
                          {hasActiveFilters ? 'Try adjusting your filters' : 'No visitor data available'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visitors.map((visitor, index) => {
                    const isExpanded = expandedRows.has(visitor.id);
                    return (
                      <Fragment key={visitor.id}>
                        <tr className={`visitors-tr ${isExpanded ? 'visitors-tr-expanded' : ''}`}>
                          <td className="visitors-td visitors-td-select">
                            <label className="table-checkbox-label">
                              <input
                                type="checkbox"
                                checked={selectedIpAddresses.has(visitor.ipAddress)}
                                onChange={() => toggleSelect(visitor.ipAddress)}
                              />
                            </label>
                          </td>
                          {visibleColumns.expand && (
                            <td className="visitors-td visitors-td-expand">
                              <button
                                onClick={() => toggleRowExpansion(visitor.id)}
                                className="visitors-btn-expand"
                                title={isExpanded ? 'Collapse' : 'Expand'}
                                aria-expanded={isExpanded}
                              >
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={isExpanded ? 'visitors-expand-rotated' : ''}>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </td>
                          )}
                          {visibleColumns.origin && <td className="visitors-td visitors-td-origin">{visitor.origin || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.ipAddress && <td className="visitors-td visitors-td-ip">{visitor.ipAddress}</td>}
                          {visibleColumns.country && <td className="visitors-td">{visitor.country || <span className="visitors-na">Unknown</span>}</td>}
                          {visibleColumns.countryCode && <td className="visitors-td">{visitor.countryCode || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.region && (
                            <td className="visitors-td">
                              <span className={`visitors-badge visitors-badge-region ${visitor.region === 'IND' ? 'visitors-badge-ind' : ''}`}>
                                {visitor.region || 'ALL'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.deviceType && (
                            <td className="visitors-td">
                              <span className={`visitors-badge visitors-badge-device visitors-badge-${visitor.deviceType || 'unknown'}`}>
                                {visitor.deviceType || 'N/A'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.os && <td className="visitors-td">{visitor.os || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.browser && <td className="visitors-td">{visitor.browser || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.screenResolution && <td className="visitors-td visitors-td-small">{visitor.screenResolution || 'N/A'}</td>}
                          {visibleColumns.visitCount && <td className="visitors-td visitors-td-number">{visitor.visitCount}</td>}
                          {visibleColumns.clickCount && <td className="visitors-td visitors-td-number">{visitor.clickCount}</td>}
                          {visibleColumns.lastSessionClicks && <td className="visitors-td visitors-td-number">{visitor.lastSessionClicks}</td>}
                          {visibleColumns.lastVisitedPage && <td className="visitors-td visitors-td-truncate">{visitor.lastVisitedPage || 'N/A'}</td>}
                          {visibleColumns.exitPage && <td className="visitors-td visitors-td-truncate">{visitor.exitPage || 'N/A'}</td>}
                          {visibleColumns.firstVisit && <td className="visitors-td visitors-td-small">{formatDate(visitor.firstVisit)}</td>}
                          {visibleColumns.lastVisit && <td className="visitors-td visitors-td-small">{formatDate(visitor.lastVisit)}</td>}
                          {visibleColumns.timeStamp && <td className="visitors-td visitors-td-small">{formatDate(visitor.timeStamp)}</td>}
                          {visibleColumns.cfConnectingIp && <td className="visitors-td visitors-td-small">{visitor.cfConnectingIp || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.cfIpCountry && <td className="visitors-td visitors-td-small">{visitor.cfIpCountry || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.referer && <td className="visitors-td visitors-td-truncate visitors-td-mono">{visitor.referer || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.secChUa && <td className="visitors-td visitors-td-truncate">{visitor.secChUa || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.secChUaFullVersionList && <td className="visitors-td visitors-td-truncate">{visitor.secChUaFullVersionList || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.secChUaPlatform && <td className="visitors-td">{visitor.secChUaPlatform || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.userAgent && <td className="visitors-td visitors-td-truncate visitors-td-mono">{visitor.userAgent || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.xRealIp && <td className="visitors-td">{visitor.xRealIp || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.xRequestedWith && <td className="visitors-td">{visitor.xRequestedWith || <span className="visitors-na">N/A</span>}</td>}
                          {visibleColumns.actions && (
                            <td className="visitors-td visitors-td-actions">
                              <button 
                                onClick={() => handleDelete(visitor.ipAddress)}
                                disabled={deletingIp === visitor.ipAddress}
                                className="visitors-btn-delete"
                                title="Delete visitor"
                              >
                                {deletingIp === visitor.ipAddress ? (
                                  <svg style={{ animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24" width="14" height="14">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </td>
                          )}
                    </tr>
                        {isExpanded && (
                          <tr className="visitors-tr-detail" id={`detail-${visitor.id}`}>
                            <td colSpan={getVisibleColumnCount() + 1} className="visitors-td-detail">
                              <div className="p-6 bg-gray-50 space-y-4">
                                <div className="bg-white p-5 rounded-lg border border-gray-200">
                                  <h4 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300 uppercase tracking-wide">Basic Information</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">IP Address</span>
                                      <span className="text-sm text-gray-900 font-mono">{visitor.ipAddress}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Country</span>
                                      <span className="text-sm text-gray-900">{visitor.country || <span className="text-gray-400 italic">Unknown</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Country Code</span>
                                      <span className="text-sm text-gray-900">{visitor.countryCode || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Region</span>
                                      <span className={`px-2 py-1 text-xs font-semibold rounded-full w-fit ${visitor.region === 'IND' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {visitor.region || 'ALL'}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Device Type</span>
                                      <span className={`px-2 py-1 text-xs font-semibold rounded-full w-fit ${
                                        visitor.deviceType === 'mobile' ? 'bg-green-100 text-green-800' : 
                                        visitor.deviceType === 'tablet' ? 'bg-purple-100 text-purple-800' : 
                                        visitor.deviceType === 'desktop' ? 'bg-orange-100 text-orange-800' : 
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {visitor.deviceType || 'N/A'}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">OS</span>
                                      <span className="text-sm text-gray-900">{visitor.os || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Browser</span>
                                      <span className="text-sm text-gray-900">{visitor.browser || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Screen Resolution</span>
                                      <span className="text-sm text-gray-900">{visitor.screenResolution || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white p-5 rounded-lg border border-gray-200">
                                  <h4 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300 uppercase tracking-wide">Visit Statistics</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-col">
                                      <span className="text-xs text-gray-600 uppercase font-semibold tracking-wide mb-2">Visit Count</span>
                                      <span className="text-2xl font-bold text-blue-600">{visitor.visitCount}</span>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg border border-green-200 flex flex-col">
                                      <span className="text-xs text-gray-600 uppercase font-semibold tracking-wide mb-2">Total Clicks</span>
                                      <span className="text-2xl font-bold text-green-600">{visitor.clickCount}</span>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 flex flex-col">
                                      <span className="text-xs text-gray-600 uppercase font-semibold tracking-wide mb-2">Session Clicks</span>
                                      <span className="text-2xl font-bold text-purple-600">{visitor.lastSessionClicks}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white p-5 rounded-lg border border-gray-200">
                                  <h4 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300 uppercase tracking-wide">Page Information</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Last Visited Page</span>
                                      <span className="text-sm text-gray-900 font-mono break-all">{visitor.lastVisitedPage || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Exit Page</span>
                                      <span className="text-sm text-gray-900 font-mono break-all">{visitor.exitPage || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">First Visit</span>
                                      <span className="text-sm text-gray-900">{formatDate(visitor.firstVisit)}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Last Visit</span>
                                      <span className="text-sm text-gray-900">{formatDate(visitor.lastVisit)}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Time Stamp</span>
                                      <span className="text-sm text-gray-900">{formatDate(visitor.timeStamp)}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white p-5 rounded-lg border border-gray-200">
                                  <h4 className="text-base font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300 uppercase tracking-wide">Header Information</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">CF-Connecting-IP</span>
                                      <span className="text-sm text-gray-900 font-mono">{visitor.cfConnectingIp || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">CF-IP-Country</span>
                                      <span className="text-sm text-gray-900">{visitor.cfIpCountry || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Origin</span>
                                      <span className="text-sm text-gray-900 break-all">{visitor.origin || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Referer</span>
                                      <span className="text-sm text-gray-900 break-all">{visitor.referer || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">X-Real-IP</span>
                                      <span className="text-sm text-gray-900 font-mono">{visitor.xRealIp || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">X-Requested-With</span>
                                      <span className="text-sm text-gray-900">{visitor.xRequestedWith || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Sec-CH-UA-Platform</span>
                                      <span className="text-sm text-gray-900">{visitor.secChUaPlatform || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Sec-CH-UA</span>
                                      <span className="text-sm text-gray-900 break-all">{visitor.secChUa || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">Sec-CH-UA-Full-Version-List</span>
                                      <span className="text-sm text-gray-900 break-all">{visitor.secChUaFullVersionList || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 md:col-span-2">
                                      <span className="text-xs text-gray-500 uppercase font-semibold tracking-wide">User-Agent</span>
                                      <span className="text-sm text-gray-900 font-mono break-all bg-gray-50 p-2 rounded border">{visitor.userAgent || <span className="text-gray-400 italic">N/A</span>}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Detail Modal */}
      {showDetailModal && selectedVisitor && (
        <div 
          className="modal-overlay"
          onClick={() => setShowDetailModal(false)}
        >
          <div 
            className="modal-content visitor-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Visitor Details</h2>
                <p className="modal-subtitle">{selectedVisitor.ipAddress}</p>
              </div>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="modal-close-btn"
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Basic Information */}
              <div className="detail-section">
                <h3>Basic Information</h3>
                <div className="detail-grid">
                  <div className="detail-field">
                    <span className="detail-label">IP Address</span>
                    <span className="detail-value detail-value-mono">{selectedVisitor.ipAddress}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Country</span>
                    <span className="detail-value">{selectedVisitor.country || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Country Code</span>
                    <span className="detail-value">{selectedVisitor.countryCode || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Region</span>
                    <span className={`badge badge-${selectedVisitor.region === 'IND' ? 'blue' : 'gray'}`}>
                      {selectedVisitor.region || 'ALL'}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Device Type</span>
                    <span className="detail-value">{selectedVisitor.deviceType || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">OS</span>
                    <span className="detail-value">{selectedVisitor.os || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Browser</span>
                    <span className="detail-value">{selectedVisitor.browser || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Screen Resolution</span>
                    <span className="detail-value">{selectedVisitor.screenResolution || <span className="text-muted">N/A</span>}</span>
                  </div>
                </div>
              </div>

              {/* Visit Statistics */}
              <div className="detail-section">
                <h3>Visit Statistics</h3>
                <div className="stats-grid">
                  <div className="stat-item stat-item-blue">
                    <span className="detail-label">Visit Count</span>
                    <span className="stat-large-value">{selectedVisitor.visitCount}</span>
                  </div>
                  <div className="stat-item stat-item-green">
                    <span className="detail-label">Total Clicks</span>
                    <span className="stat-large-value">{selectedVisitor.clickCount}</span>
                  </div>
                  <div className="stat-item stat-item-purple">
                    <span className="detail-label">Session Clicks</span>
                    <span className="stat-large-value">{selectedVisitor.lastSessionClicks}</span>
                  </div>
                </div>
              </div>

              {/* Page Information */}
              <div className="detail-section">
                <h3>Page Information</h3>
                <div className="detail-grid">
                  <div className="detail-field detail-field-full">
                    <span className="detail-label">Last Visited Page</span>
                    <span className="detail-value detail-value-mono detail-value-break">{selectedVisitor.lastVisitedPage || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field detail-field-full">
                    <span className="detail-label">Exit Page</span>
                    <span className="detail-value detail-value-mono detail-value-break">{selectedVisitor.exitPage || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">First Visit</span>
                    <span className="detail-value">{formatDate(selectedVisitor.firstVisit)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Last Visit</span>
                    <span className="detail-value">{formatDate(selectedVisitor.lastVisit)}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Time Stamp</span>
                    <span className="detail-value">{formatDate(selectedVisitor.timeStamp)}</span>
                  </div>
                </div>
              </div>
              
              {/* Header Information */}
              <div className="detail-section">
                <h3>Header Information</h3>
                <div className="detail-grid">
                  <div className="detail-field">
                    <span className="detail-label">CF-Connecting-IP</span>
                    <span className="detail-value detail-value-mono">{selectedVisitor.cfConnectingIp || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">CF-IP-Country</span>
                    <span className="detail-value">{selectedVisitor.cfIpCountry || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field detail-field-full">
                    <span className="detail-label">Origin</span>
                    <span className="detail-value detail-value-break">{selectedVisitor.origin || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field detail-field-full">
                    <span className="detail-label">Referer</span>
                    <span className="detail-value detail-value-break">{selectedVisitor.referer || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">X-Real-IP</span>
                    <span className="detail-value detail-value-mono">{selectedVisitor.xRealIp || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">X-Requested-With</span>
                    <span className="detail-value">{selectedVisitor.xRequestedWith || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Sec-CH-UA-Platform</span>
                    <span className="detail-value">{selectedVisitor.secChUaPlatform || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field detail-field-full">
                    <span className="detail-label">Sec-CH-UA</span>
                    <span className="detail-value detail-value-break">{selectedVisitor.secChUa || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field detail-field-full">
                    <span className="detail-label">Sec-CH-UA-Full-Version-List</span>
                    <span className="detail-value detail-value-break">{selectedVisitor.secChUaFullVersionList || <span className="text-muted">N/A</span>}</span>
                  </div>
                  <div className="detail-field detail-field-full">
                    <span className="detail-label">User-Agent</span>
                    <span className="detail-value detail-value-mono detail-value-break detail-value-code">{selectedVisitor.userAgent || <span className="text-muted">N/A</span>}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div 
          className="modal-overlay"
          onClick={() => setShowClearConfirm(false)}
        >
          <div 
            className="modal-content confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-header">
              <div className="confirm-modal-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3>Clear All Visitor Data?</h3>
              </div>
            </div>
            <p className="confirm-modal-message">
              This will permanently delete <strong>ALL {pagination.total.toLocaleString()} visitor records</strong>. This action cannot be undone.
            </p>
            <div className="confirm-modal-actions">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="btn-confirm-delete"
              >
                Clear All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

