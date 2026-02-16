'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/adminContext';
import { adsenseApi } from '@/lib/api';
import ReportsNavbar from '@/components/ReportsNavbar';
import './invoice.css';

interface MonthlyEarning {
  monthKey: string;
  monthName: string;
  earnings: number;
  status: string; // 'none' | 'pending' | 'approved' | 'rejected'
  invoiceId: string | null;
}

export default function InvoicePage() {
  const { isAdmin, loading: authLoading, adminData } = useAdmin();
  const router = useRouter();
  const [monthlyData, setMonthlyData] = useState<MonthlyEarning[]>([]);
  const [carryforward, setCarryforward] = useState(0);
  const [revenueShare, setRevenueShare] = useState(100);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/auth/login');
    }
  }, [isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) {
      fetchMonthlyEarnings();
    }
  }, [isAdmin]);

  const fetchMonthlyEarnings = async () => {
    try {
      setLoading(true);
      const response = await adsenseApi.getMonthlyEarnings();
      setMonthlyData(response.data || []);
      setCarryforward(response.carryforward || 0);
      setRevenueShare(response.revenueShare || 100);
    } catch (err: any) {
      console.error('Error fetching monthly earnings:', err);
      setError('Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (monthKey: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number) => `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const getStatusBadge = (earning: MonthlyEarning) => {
    if (earning.status === 'approved') {
      return <span className="invoice-badge invoice-badge-approved">Payment Done</span>;
    }
    if (earning.status === 'pending') {
      return <span className="invoice-badge invoice-badge-pending">Pending Review</span>;
    }
    if (earning.status === 'rejected') {
      return <span className="invoice-badge invoice-badge-rejected">Rejected</span>;
    }
    return <span className="invoice-badge invoice-badge-carryforward">Carryforwarded</span>;
  };

  const isCarryforwarded = (earning: MonthlyEarning) => earning.status !== 'approved';

  const getCarryforwardTotal = (index: number): number | null => {
    const earning = monthlyData[index];
    if (!isCarryforwarded(earning)) return null;

    let total = 0;
    for (let i = index; i < monthlyData.length; i++) {
      if (isCarryforwarded(monthlyData[i])) {
        total += monthlyData[i].earnings;
      }
    }
    return total;
  };

  const handleDownloadSample = () => {
    const headers = ['Month', 'Gross Earnings (USD)', 'Revenue Share %', 'Net Earnings (USD)', 'Status'];
    const sampleRows = [
      ['January 2025', '$150.00', '70%', '$105.00', 'Carryforwarded'],
      ['February 2025', '$200.00', '70%', '$140.00', 'Carryforwarded'],
      ['March 2025', '$180.00', '70%', '$126.00', 'Payment Done'],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadInvoice = () => {
    setError(null);
    setSelectedFile(null);
    setShowConfirmModal(true);
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0] as File | undefined;
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
    };
    input.click();
  };

  const handleConfirmSubmit = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const carryforwardedMonths = monthlyData.filter(m => isCarryforwarded(m));
      if (carryforwardedMonths.length > 0) {
        const latest = carryforwardedMonths[0];
        const totalCarryforward = carryforwardedMonths.reduce((sum, m) => sum + m.earnings, 0);
        const netEarnings = latest.earnings * (revenueShare / 100);

        await adsenseApi.createInvoice({
          monthKey: latest.monthKey,
          monthName: latest.monthName,
          carryforward: totalCarryforward,
          grossEarnings: latest.earnings,
          deductions: latest.earnings - netEarnings,
          netEarnings,
          totalUSD: netEarnings,
          totalINR: netEarnings * 83,
        }, selectedFile);

        setUploadSuccess(`Invoice for ${latest.monthName} submitted successfully! It will be reviewed by the admin.`);
        setTimeout(() => setUploadSuccess(null), 5000);
        await fetchMonthlyEarnings();
      } else {
        setUploadSuccess(`Invoice "${selectedFile.name}" uploaded successfully! It will be reviewed by the admin.`);
        setTimeout(() => setUploadSuccess(null), 5000);
      }

      setShowConfirmModal(false);
      setSelectedFile(null);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload invoice. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Compute request summary for modal
  const carryforwardedMonths = monthlyData.filter(m => isCarryforwarded(m));
  const latestMonth = carryforwardedMonths.length > 0 ? carryforwardedMonths[0] : null;
  const totalCarryforwardAmount = carryforwardedMonths.reduce((sum, m) => sum + m.earnings, 0);
  const latestNetEarnings = latestMonth ? latestMonth.earnings * (revenueShare / 100) : 0;
  const hasPendingRequest = monthlyData.some(m => m.status === 'pending');

  const handleDownloadMonth = (earning: MonthlyEarning) => {
    const netAmount = earning.earnings * (revenueShare / 100);
    const headers = ['Month', 'Gross Earnings (USD)', 'Revenue Share %', 'Net Earnings (USD)', 'Status'];
    const row = [
      earning.monthName,
      `$${earning.earnings.toFixed(2)}`,
      `${revenueShare}%`,
      `$${netAmount.toFixed(2)}`,
      earning.status === 'approved' ? 'Payment Done' : 'Carryforwarded'
    ];

    const csvContent = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${earning.monthKey}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    if (monthlyData.length === 0) return;

    const headers = ['Month', 'Gross Earnings (USD)', 'Revenue Share %', 'Net Earnings (USD)', 'Status'];
    const rows = monthlyData.map(earning => {
      const netAmount = earning.earnings * (revenueShare / 100);
      return [
        earning.monthName,
        `$${earning.earnings.toFixed(2)}`,
        `${revenueShare}%`,
        `$${netAmount.toFixed(2)}`,
        earning.status === 'approved' ? 'Payment Done' : 'Carryforwarded'
      ].join(',');
    });

    const totalEarnings = monthlyData.reduce((sum, m) => sum + m.earnings, 0);
    rows.push(`TOTAL,$${totalEarnings.toFixed(2)},${revenueShare}%,$${(totalEarnings * revenueShare / 100).toFixed(2)},`);

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice-all-months.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="invoice-loading">
        <div className="invoice-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="invoice-loading">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <ReportsNavbar>
      <div className="invoice-content">
        {/* Info Box */}
        <div className="invoice-info-box">
          <p>All payments will be processed on a monthly consolidated basis, subject to the submission of a valid invoice and a minimum payout threshold of INR 5,000</p>
          <p>Payments to publishers based in India will be subject to a TDS deduction of up to 2%, in accordance with applicable tax regulations.</p>
          <p>For international publishers, the minimum payout threshold will be USD 250.</p>
        </div>

        {/* Revenue Share Banner */}
        {revenueShare < 100 && (
          <div className="invoice-revenue-banner">
            <div className="invoice-revenue-banner-icon">%</div>
            <div className="invoice-revenue-banner-text">
              <strong>Your Revenue Share</strong>
              <span>Earnings shown are your share after applying the revenue split</span>
            </div>
            <div className="invoice-revenue-banner-value">{revenueShare}%</div>
          </div>
        )}

        {/* Section Header */}
        <div className="invoice-section-header">
          <h2 className="invoice-section-title">Monthly invoicing amounts</h2>
          <div className="invoice-section-actions">
            <button onClick={handleDownloadSample} className="btn-download-sample">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Sample
            </button>
            <button
              onClick={handleUploadInvoice}
              className="btn-upload-invoice"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="invoice-btn-spinner"></span>
                  Uploading...
                </>
              ) : (
                <>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Invoice
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success Message */}
        {uploadSuccess && (
          <div className="invoice-success">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {uploadSuccess}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="invoice-error">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
            <button className="invoice-error-dismiss" onClick={() => setError(null)}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading state for data */}
        {loading ? (
          <div className="invoice-table-card">
            <div className="invoice-empty">
              <div className="invoice-spinner"></div>
              <p style={{ marginTop: 12 }}>Loading invoice data...</p>
            </div>
          </div>
        ) : (
          /* Invoice Table */
          <div className="invoice-table-card">
            {/* Table Header */}
            <div className="invoice-table-top-bar">
              <span className="invoice-table-count">
                {monthlyData.length} month{monthlyData.length !== 1 ? 's' : ''}
              </span>
              {monthlyData.length > 0 && (
                <button className="btn-download-all" onClick={handleDownloadAll}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export All
                </button>
              )}
            </div>

            <div className="invoice-table-header">
              <span>Monthly Invoice</span>
              <span>Download</span>
              <span>Amount</span>
            </div>

            {/* Rows */}
            {monthlyData.length === 0 ? (
              <div className="invoice-empty">
                <svg className="invoice-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3>No invoice data yet</h3>
                <p>Your monthly earnings will appear here once data is available.</p>
              </div>
            ) : (
              monthlyData.map((earning, index) => {
                const isExpanded = expandedRows.has(earning.monthKey);
                const cfTotal = getCarryforwardTotal(index);
                const isFirstCarryforward = isCarryforwarded(earning) && (index === 0 || !isCarryforwarded(monthlyData[index - 1]));

                return (
                  <div key={earning.monthKey} className="invoice-row">
                    <div className="invoice-row-main" onClick={() => toggleExpand(earning.monthKey)}>
                      {/* Month Info */}
                      <div className="invoice-month-info">
                        {isFirstCarryforward && cfTotal !== null && (
                          <div className="invoice-month-badges">
                            <span className="invoice-badge invoice-badge-total">
                              Total: {formatCurrency(cfTotal)}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="invoice-month-name">{earning.monthName}</span>
                          {getStatusBadge(earning)}
                        </div>
                      </div>

                      {/* Download */}
                      <div className="invoice-download-cell">
                        <button
                          className="btn-download"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadMonth(earning);
                          }}
                        >
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download
                        </button>
                      </div>

                      {/* Amount */}
                      <div className="invoice-amount-cell">
                        <span className="invoice-amount">{formatCurrency(earning.earnings)}</span>
                        <button className={`invoice-expand-btn ${isExpanded ? 'expanded' : ''}`}>
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="invoice-row-details">
                        <div className="invoice-details-grid">
                          <div className="invoice-detail-item">
                            <span className="invoice-detail-label">Month</span>
                            <span className="invoice-detail-value">{earning.monthName}</span>
                          </div>
                          <div className="invoice-detail-item">
                            <span className="invoice-detail-label">Gross Earnings</span>
                            <span className="invoice-detail-value">{formatCurrency(earning.earnings)}</span>
                          </div>
                          <div className="invoice-detail-item">
                            <span className="invoice-detail-label">Revenue Share</span>
                            <span className="invoice-detail-value">{revenueShare}%</span>
                          </div>
                          <div className="invoice-detail-item">
                            <span className="invoice-detail-label">Net Amount</span>
                            <span className="invoice-detail-value">{formatCurrency(earning.earnings * (revenueShare / 100))}</span>
                          </div>
                          <div className="invoice-detail-item">
                            <span className="invoice-detail-label">Status</span>
                            <span className="invoice-detail-value" style={{ color: earning.status === 'approved' ? '#16a34a' : earning.status === 'rejected' ? '#dc2626' : '#f59e0b' }}>
                              {earning.status === 'approved' ? 'Payment Done' : earning.status === 'rejected' ? 'Rejected' : earning.status === 'pending' ? 'Pending Review' : 'Carryforwarded'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Invoice Request Confirmation Modal */}
      {showConfirmModal && (
        <div className="invoice-modal-overlay" onClick={() => { if (!uploading) { setShowConfirmModal(false); setSelectedFile(null); } }}>
          <div className="invoice-modal" onClick={e => e.stopPropagation()}>
            <div className="invoice-modal-header">
              <h3>Submit Invoice Request</h3>
              <button
                className="invoice-modal-close"
                onClick={() => { if (!uploading) { setShowConfirmModal(false); setSelectedFile(null); } }}
              >
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="invoice-modal-body">
              {/* Warning */}
              <div className="invoice-modal-warning">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>You can only submit one invoice request per month. Please review the details below before submitting.</span>
              </div>

              {/* Request Summary */}
              {latestMonth ? (
                <div className="invoice-modal-summary">
                  <h4>Request Summary</h4>
                  <div className="invoice-modal-details">
                    <div className="invoice-modal-detail-row">
                      <span className="invoice-modal-label">Month</span>
                      <span className="invoice-modal-value">{latestMonth.monthName}</span>
                    </div>
                    <div className="invoice-modal-detail-row">
                      <span className="invoice-modal-label">Gross Earnings</span>
                      <span className="invoice-modal-value">{formatCurrency(latestMonth.earnings)}</span>
                    </div>
                    <div className="invoice-modal-detail-row">
                      <span className="invoice-modal-label">Revenue Share</span>
                      <span className="invoice-modal-value">{revenueShare}%</span>
                    </div>
                    <div className="invoice-modal-detail-row">
                      <span className="invoice-modal-label">Net Earnings</span>
                      <span className="invoice-modal-value" style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(latestNetEarnings)}</span>
                    </div>
                    {carryforwardedMonths.length > 1 && (
                      <div className="invoice-modal-detail-row">
                        <span className="invoice-modal-label">Carryforward Total ({carryforwardedMonths.length} months)</span>
                        <span className="invoice-modal-value" style={{ fontWeight: 700 }}>{formatCurrency(totalCarryforwardAmount)}</span>
                      </div>
                    )}
                    <div className="invoice-modal-detail-row">
                      <span className="invoice-modal-label">Approx. INR</span>
                      <span className="invoice-modal-value">&#8377;{(latestNetEarnings * 83).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="invoice-modal-summary">
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '12px 0' }}>No carryforwarded months to request for.</p>
                </div>
              )}

              {/* File Upload */}
              <div className="invoice-modal-upload">
                <h4>Attach Invoice File</h4>
                {selectedFile ? (
                  <div className="invoice-modal-file-selected">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="invoice-modal-file-info">
                      <span className="invoice-modal-file-name">{selectedFile.name}</span>
                      <span className="invoice-modal-file-size">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button className="invoice-modal-file-remove" onClick={() => setSelectedFile(null)}>
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button className="invoice-modal-file-btn" onClick={handleFileSelect}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="24" height="24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Click to select file</span>
                    <small>PDF, CSV, Excel, or Image (max 5MB)</small>
                  </button>
                )}
              </div>

              {error && (
                <div className="invoice-error" style={{ margin: '12px 0 0' }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
            </div>

            <div className="invoice-modal-footer">
              <button
                className="invoice-modal-cancel"
                onClick={() => { setShowConfirmModal(false); setSelectedFile(null); setError(null); }}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="invoice-modal-submit"
                onClick={handleConfirmSubmit}
                disabled={uploading || !selectedFile || !latestMonth || hasPendingRequest}
              >
                {uploading ? (
                  <>
                    <span className="invoice-btn-spinner"></span>
                    Submitting...
                  </>
                ) : hasPendingRequest ? (
                  'Request Already Pending'
                ) : (
                  <>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </ReportsNavbar>
  );
}
