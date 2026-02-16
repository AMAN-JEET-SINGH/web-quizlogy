'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/adminContext';
import { adsenseApi, OverviewData } from '@/lib/api';
import './overview.css';

const PERIOD_CONFIG = [
  {
    key: 'today' as const,
    label: 'Today so Far',
    comparison: 'vs yesterday',
    note: 'This may be up to 3 hours behind actual data',
  },
  {
    key: 'yesterday' as const,
    label: 'Yesterday',
    comparison: 'vs day before yesterday',
  },
  {
    key: 'last7Days' as const,
    label: 'Last 7 Days',
    comparison: 'vs previous 7 days',
  },
  {
    key: 'thisMonth' as const,
    label: 'This Month',
    comparison: 'vs same period last month',
  },
  {
    key: 'lastMonth' as const,
    label: 'Last Month',
    comparison: 'vs month before last',
  },
];

function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDateRange(periodKey: string): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = formatDateStr(today);

  switch (periodKey) {
    case 'today':
      return { start: todayStr, end: todayStr };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: formatDateStr(yesterday), end: formatDateStr(yesterday) };
    }
    case 'last7Days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: formatDateStr(start), end: todayStr };
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: formatDateStr(start), end: todayStr };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatDateStr(start), end: formatDateStr(end) };
    }
    default:
      return { start: todayStr, end: todayStr };
  }
}

function formatNumber(val: number): string {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toLocaleString();
}

export default function OverviewPage() {
  const { isAdmin, loading: authLoading } = useAdmin();
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      adsenseApi.getOverview()
        .then(setData)
        .catch((err) => setError(err.response?.data?.error || err.message))
        .finally(() => setLoading(false));
    }
  }, [authLoading, isAdmin]);

  if (authLoading || loading) {
    return (
      <div className="ov-loading">
        <div className="ov-spinner" />
        <p>Loading overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ov-error">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="48" height="48">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3>Failed to load overview</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
  const formatDelta = (delta: number) => `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;

  const handleCardClick = (periodKey: string) => {
    const range = getDateRange(periodKey);
    router.push(`/reports?start=${range.start}&end=${range.end}`);
  };

  return (
    <div className="ov-page">
      {data.lastSynced && (
        <div className="ov-synced-badge">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Last synced: {new Date(data.lastSynced).toLocaleString()}
        </div>
      )}

      <div className="ov-grid">
        {PERIOD_CONFIG.map((period) => {
          const periodData = data[period.key];
          const isPositive = periodData.delta >= 0;

          return (
            <div
              key={period.key}
              className="ov-card ov-card-clickable"
              onClick={() => handleCardClick(period.key)}
            >
              <div className="ov-card-top">
                <div className="ov-card-label">{period.label}</div>
                <svg className="ov-card-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div className="ov-card-earnings">
                {formatCurrency(periodData.earnings)}
              </div>
              <div className={`ov-card-delta ${isPositive ? 'profit' : 'loss'}`}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                  {isPositive ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  )}
                </svg>
                {formatDelta(periodData.delta)}
              </div>
              <div className="ov-card-comparison">{period.comparison}</div>

              {/* Metrics Row */}
              <div className="ov-card-metrics">
                <div className="ov-metric">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>{formatNumber(periodData.pageViews ?? 0)}</span>
                </div>
                <div className="ov-metric">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{formatNumber(periodData.impressions ?? 0)}</span>
                </div>
                <div className="ov-metric">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                  </svg>
                  <span>{formatNumber(periodData.clicks ?? 0)}</span>
                </div>
              </div>

              {period.note && (
                <div className="ov-card-note">{period.note}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
