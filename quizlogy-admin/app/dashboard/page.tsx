// Dashboard page - displays analytics and statistics for admin users
'use client';

import { useState, useEffect } from 'react';
import { analyticsApi, AnalyticsData } from '@/lib/api';
import './dashboard-home.css';

type TimeRange = '1d' | '7d' | '30d' | '1y' | 'all';

export default function DashboardHome() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await analyticsApi.getAnalytics(timeRange);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-home">
        <div className="loading-state">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="dashboard-home">
        <div className="error-state">Failed to load analytics</div>
      </div>
    );
  }

  // Use daily data for histogram (visitors count per period)
  const dailyData = analytics.visitorGrowth?.dailyData || analytics.visitorGrowth?.data || [];
  const labels = analytics.visitorGrowth?.labels || [];
  
  const maxHistogramValue = dailyData.length > 0 
    ? Math.max(...dailyData.filter((v: number) => v > 0), 1) * 1.1 
    : 100;
  
  const graphHeight = 200;
  const graphWidth = Math.max(800, dailyData.length * 40);
  const padding = 60;
  const barGap = 2;

  // Pie chart data for registered vs unregistered users
  const registeredUsers = analytics.registeredUsers || 0;
  const unregisteredUsers = analytics.unregisteredUsers || 0;
  const pieData = [
    { label: 'Registered Users', value: registeredUsers, color: '#374151' },
    { label: 'Unregistered Users', value: unregisteredUsers, color: '#6b7280' },
  ];
  const totalPie = pieData.reduce((sum, item) => sum + item.value, 0);
  const pieRadius = 60;
  const pieCenterX = 80;
  const pieCenterY = 80;

  return (
    <div className="dashboard-home">
      <h1 className="dashboard-title">Dashboard</h1>

      {/* Top Row - Key Metrics */}
      <div className="metrics-row">
        <div className="metric-card large">
          <div className="metric-label">TOTAL USERS</div>
          <div className="metric-value">{analytics.totalUsers.toLocaleString()}</div>
        </div>
        <div className="metric-card large">
          <div className="metric-label">REGISTERED USERS</div>
          <div className="metric-value">{analytics.registeredUsers.toLocaleString()}</div>
        </div>
        <div className="metric-card large">
          <div className="metric-label">TOTAL VISITORS</div>
          <div className="metric-value">{analytics.totalVisitors.toLocaleString()}</div>
        </div>
      </div>

      {/* Device Distribution Section */}
      <div className="device-distribution-section">
        <h2 className="section-title">DEVICE DISTRIBUTION</h2>
        <div className="device-stats-grid">
          <div className="device-stat-card mobile">
            <div className="device-icon">📱</div>
            <div className="device-info">
              <div className="device-label">Mobile</div>
              <div className="device-value">{analytics.deviceDistribution?.mobile || 0}</div>
            </div>
          </div>
          <div className="device-stat-card tablet">
            <div className="device-icon">📱</div>
            <div className="device-info">
              <div className="device-label">Tablet</div>
              <div className="device-value">{analytics.deviceDistribution?.tablet || 0}</div>
            </div>
          </div>
          <div className="device-stat-card desktop">
            <div className="device-icon">💻</div>
            <div className="device-info">
              <div className="device-label">Desktop</div>
              <div className="device-value">{analytics.deviceDistribution?.desktop || 0}</div>
            </div>
          </div>
        </div>
        
        {/* OS and Browser Distribution */}
        <div className="distribution-charts">
          <div className="distribution-chart">
            <h3 className="chart-title">Top Operating Systems</h3>
            <div className="distribution-list">
              {analytics.osDistribution && analytics.osDistribution.length > 0 ? (
                analytics.osDistribution.slice(0, 5).map((item, index) => (
                  <div key={index} className="distribution-item">
                    <div className="distribution-label">{item.os}</div>
                    <div className="distribution-bar-container">
                      <div 
                        className="distribution-bar" 
                        style={{ 
                          width: `${(item.count / (analytics.osDistribution[0]?.count || 1)) * 100}%`,
                          backgroundColor: '#374151'
                        }}
                      ></div>
                    </div>
                    <div className="distribution-value">{item.count}</div>
                  </div>
                ))
              ) : (
                <div className="no-data-text">No OS data available</div>
              )}
            </div>
          </div>
          
          <div className="distribution-chart">
            <h3 className="chart-title">Top Browsers</h3>
            <div className="distribution-list">
              {analytics.browserDistribution && analytics.browserDistribution.length > 0 ? (
                analytics.browserDistribution.slice(0, 5).map((item, index) => (
                  <div key={index} className="distribution-item">
                    <div className="distribution-label">{item.browser}</div>
                    <div className="distribution-bar-container">
                      <div 
                        className="distribution-bar" 
                        style={{ 
                          width: `${(item.count / (analytics.browserDistribution[0]?.count || 1)) * 100}%`,
                          backgroundColor: '#6b7280'
                        }}
                      ></div>
                    </div>
                    <div className="distribution-value">{item.count}</div>
                  </div>
                ))
              ) : (
                <div className="no-data-text">No browser data available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row - Overview and Graph */}
      <div className="bottom-row">
        {/* Overview Section with Pie Chart */}
        <div className="overview-section">
          <h2 className="section-title">USER BREAKDOWN</h2>
          <div className="pie-chart-container">
            <svg width="160" height="160" viewBox="0 0 160 160" className="pie-chart">
              {(() => {
                let currentAngle = -90; // Start from top
                return pieData.map((item, index) => {
                  const percentage = totalPie > 0 ? (item.value / totalPie) * 100 : 0;
                  const angle = (percentage / 100) * 360;
                  const startAngle = currentAngle;
                  const endAngle = currentAngle + angle;
                  
                  // Calculate arc path
                  const startAngleRad = (startAngle * Math.PI) / 180;
                  const endAngleRad = (endAngle * Math.PI) / 180;
                  const x1 = pieCenterX + pieRadius * Math.cos(startAngleRad);
                  const y1 = pieCenterY + pieRadius * Math.sin(startAngleRad);
                  const x2 = pieCenterX + pieRadius * Math.cos(endAngleRad);
                  const y2 = pieCenterY + pieRadius * Math.sin(endAngleRad);
                  const largeArcFlag = angle > 180 ? 1 : 0;
                  
                  const pathData = [
                    `M ${pieCenterX} ${pieCenterY}`,
                    `L ${x1} ${y1}`,
                    `A ${pieRadius} ${pieRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                    'Z',
                  ].join(' ');
                  
                  currentAngle += angle;
                  
                  return (
                    <path
                      key={index}
                      d={pathData}
                      fill={item.color}
                      stroke="white"
                      strokeWidth="2"
                    />
                  );
                });
              })()}
              {/* Center circle for donut effect (optional) */}
              <circle
                cx={pieCenterX}
                cy={pieCenterY}
                r={pieRadius * 0.5}
                fill="white"
              />
              <text
                x={pieCenterX}
                y={pieCenterY - 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="600"
                fill="#333"
              >
                {totalPie.toLocaleString()}
              </text>
              <text
                x={pieCenterX}
                y={pieCenterY + 10}
                textAnchor="middle"
                fontSize="10"
                fill="#666"
              >
                Total
              </text>
            </svg>
            <div className="pie-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#374151' }}></div>
                <div className="legend-text">
                  <div className="legend-label">Registered Users</div>
                  <div className="legend-value">{registeredUsers.toLocaleString()}</div>
                </div>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#6b7280' }}></div>
                <div className="legend-text">
                  <div className="legend-label">Unregistered Users</div>
                  <div className="legend-value">{unregisteredUsers.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="overview-cards">
            <div className="overview-card">
              <div className="overview-value">{analytics.totalGames.toLocaleString()}</div>
              <div className="overview-label">Total Games</div>
              <div className="overview-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="#374151" strokeWidth="2" fill="none"/>
                  <circle cx="12" cy="20" r="3" fill="#374151"/>
                  <circle cx="20" cy="20" r="3" fill="#374151"/>
                  <circle cx="28" cy="20" r="3" fill="#374151"/>
                </svg>
              </div>
            </div>
            <div className="overview-card">
              <div className="overview-value">{analytics.contestAttempted.toLocaleString()}</div>
              <div className="overview-label">Contest attempted</div>
              <div className="overview-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="8" y="8" width="24" height="24" rx="2" stroke="#374151" strokeWidth="2" fill="none"/>
                  <rect x="12" y="12" width="16" height="16" rx="1" fill="#374151" opacity="0.2"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Visitors Histogram Section */}
        <div className="users-graph-section">
          <div className="graph-header">
            <h2 className="section-title">VISITORS BY PERIOD (Histogram)</h2>
            <div className="time-range-filters">
              <button
                className={`time-range-btn ${timeRange === '1d' ? 'active' : ''}`}
                onClick={() => setTimeRange('1d')}
              >
                1 Day
              </button>
              <button
                className={`time-range-btn ${timeRange === '7d' ? 'active' : ''}`}
                onClick={() => setTimeRange('7d')}
              >
                1 Week
              </button>
              <button
                className={`time-range-btn ${timeRange === '30d' ? 'active' : ''}`}
                onClick={() => setTimeRange('30d')}
              >
                1 Month
              </button>
              <button
                className={`time-range-btn ${timeRange === '1y' ? 'active' : ''}`}
                onClick={() => setTimeRange('1y')}
              >
                1 Year
              </button>
              <button
                className={`time-range-btn ${timeRange === 'all' ? 'active' : ''}`}
                onClick={() => setTimeRange('all')}
              >
                All Time
              </button>
            </div>
          </div>
          <div className="graph-container">
            <svg width="100%" height={graphHeight + 60} className="users-graph histogram-chart" viewBox={`0 0 ${Math.min(graphWidth + padding * 2, 1200)} ${graphHeight + 60}`} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="histogramGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#374151" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#374151" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* Y-axis labels and grid lines */}
              <g className="y-axis">
                {[0, 1, 2, 3].map((i) => {
                  const value = Math.round((maxHistogramValue / 3) * (3 - i));
                  const y = 20 + (graphHeight / 3) * i;
                  return (
                    <g key={i}>
                      <text
                        x="5"
                        y={y + 5}
                        className="axis-label"
                        textAnchor="start"
                      >
                        {value.toLocaleString()}
                      </text>
                      <line
                        x1={padding}
                        y1={y}
                        x2={Math.min(graphWidth, 1000) + padding}
                        y2={y}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />
                    </g>
                  );
                })}
              </g>

              {/* Histogram bars */}
              <g className="histogram-area" transform={`translate(${padding}, 20)`}>
                {dailyData.length === 0 ? (
                  <text
                    x={Math.min(graphWidth, 1000) / 2}
                    y={graphHeight / 2}
                    textAnchor="middle"
                    className="axis-label"
                    fill="#9ca3af"
                  >
                    No data available
                  </text>
                ) : (
                  (() => {
                    const barCount = dailyData.length;
                    const availableWidth = Math.min(graphWidth, 1000);
                    const totalBarWidth = availableWidth - (barCount - 1) * barGap;
                    const barWidth = Math.max(4, (totalBarWidth / barCount) - barGap);
                    
                    return dailyData.map((value: number, index: number) => {
                      const x = index * (barWidth + barGap);
                      const normalizedValue = maxHistogramValue > 0 ? value / maxHistogramValue : 0;
                      const barHeight = Math.max(2, normalizedValue * graphHeight);
                      const y = graphHeight - barHeight;
                      
                      return (
                        <g key={index}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill="url(#histogramGradient)"
                            stroke="#374151"
                            strokeWidth="1"
                            rx="2"
                          />
                        </g>
                      );
                    });
                  })()
                )}
              </g>
              
              {/* X-axis labels */}
              {labels.length > 0 && (
                <g className="x-axis" transform={`translate(${padding}, ${graphHeight + 35})`}>
                  {labels.map((label: string, index: number) => {
                    const barCount = dailyData.length || 1;
                    const availableWidth = Math.min(graphWidth, 1000);
                    const totalBarWidth = availableWidth - (barCount - 1) * barGap;
                    const barWidth = Math.max(4, (totalBarWidth / barCount) - barGap);
                    const x = index * (barWidth + barGap) + barWidth / 2;
                    const showEvery = Math.max(1, Math.floor(labels.length / 12));
                    const showLabel = index % showEvery === 0 || index === labels.length - 1;
                    return showLabel ? (
                      <text
                        key={index}
                        x={x}
                        y="12"
                        className="axis-label"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#6b7280"
                      >
                        {label}
                      </text>
                    ) : null;
                  })}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
