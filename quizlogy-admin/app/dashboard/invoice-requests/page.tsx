'use client';

import { useState, useEffect } from 'react';
import { adsenseApi, InvoiceRequest } from '@/lib/api';
import { useAdmin } from '@/lib/adminContext';
import { useRouter } from 'next/navigation';
import './invoice-requests.css';

export default function InvoiceRequestsPage() {
  const { adminData, loading } = useAdmin();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRequest[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Redirect non-super admins
  useEffect(() => {
    if (!loading && adminData && !adminData.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [loading, adminData, router]);

  // Load invoice requests
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        setLoadingInvoices(true);
        const response = await adsenseApi.getInvoices();
        if (response.status) {
          setInvoices(response.data);
        }
      } catch (error) {
        console.error('Error loading invoices:', error);
      } finally {
        setLoadingInvoices(false);
      }
    };

    if (adminData?.isSuperAdmin) {
      loadInvoices();
    }
  }, [adminData]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await adsenseApi.updateInvoiceStatus(id, 'approved');
      if (response.status) {
        setInvoices(prev => prev.map(inv =>
          inv.id === id ? response.data : inv
        ));
      }
    } catch (error) {
      console.error('Error approving invoice:', error);
      alert('Failed to approve invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await adsenseApi.updateInvoiceStatus(id, 'rejected', rejectionNote);
      if (response.status) {
        setInvoices(prev => prev.map(inv =>
          inv.id === id ? response.data : inv
        ));
        setShowRejectModal(null);
        setRejectionNote('');
      }
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      alert('Failed to reject invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice request?')) return;

    setProcessingId(id);
    try {
      const response = await adsenseApi.deleteInvoice(id);
      if (response.status) {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  const pendingCount = invoices.filter(inv => inv.status === 'pending').length;

  if (loading || !adminData?.isSuperAdmin) {
    return (
      <div className="invoice-requests-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="invoice-requests-page">
      <div className="page-header">
        <h1>Invoice Requests</h1>
        {pendingCount > 0 && (
          <span className="pending-badge">{pendingCount} pending</span>
        )}
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({invoices.length})
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({invoices.filter(i => i.status === 'pending').length})
        </button>
        <button
          className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
          onClick={() => setFilter('approved')}
        >
          Approved ({invoices.filter(i => i.status === 'approved').length})
        </button>
        <button
          className={`filter-btn ${filter === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilter('rejected')}
        >
          Rejected ({invoices.filter(i => i.status === 'rejected').length})
        </button>
      </div>

      {loadingInvoices ? (
        <div className="loading">Loading invoice requests...</div>
      ) : filteredInvoices.length === 0 ? (
        <div className="empty-state">
          <p>No invoice requests found</p>
        </div>
      ) : (
        <div className="invoices-grid">
          {filteredInvoices.map((invoice) => (
            <div key={invoice.id} className={`invoice-card status-${invoice.status}`}>
              <div className="invoice-header">
                <div>
                  <h3>{invoice.monthName}</h3>
                  <p className="admin-name">From: {invoice.adminUsername}</p>
                </div>
                <span className={`status-badge ${invoice.status}`}>
                  {invoice.status === 'pending' && '⏳ Pending'}
                  {invoice.status === 'approved' && '✅ Approved'}
                  {invoice.status === 'rejected' && '❌ Rejected'}
                </span>
              </div>

              <div className="invoice-details">
                <div className="detail-row">
                  <span>Carryforward:</span>
                  <span>${invoice.carryforward.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span>Gross Earnings:</span>
                  <span className="positive">${invoice.grossEarnings.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span>Deductions:</span>
                  <span className="negative">-${invoice.deductions.toFixed(2)}</span>
                </div>
                <div className="detail-row">
                  <span>Net Earnings:</span>
                  <span>${invoice.netEarnings.toFixed(2)}</span>
                </div>
                <div className="detail-row total">
                  <span>Total (USD):</span>
                  <span>${invoice.totalUSD.toFixed(2)}</span>
                </div>
                <div className="detail-row total inr">
                  <span>Total (INR):</span>
                  <span>₹{invoice.totalINR.toFixed(2)}</span>
                </div>
              </div>

              {invoice.filePath && (
                <div className="invoice-file-section">
                  <a
                    href={adsenseApi.getInvoiceFileUrl(invoice.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-view-file"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View File
                  </a>
                </div>
              )}

              <div className="invoice-meta">
                <p>Requested: {new Date(invoice.requestedAt).toLocaleDateString()}</p>
                {invoice.processedAt && (
                  <p>Processed: {new Date(invoice.processedAt).toLocaleDateString()} by {invoice.processedBy}</p>
                )}
                {invoice.rejectionNote && (
                  <p className="rejection-note">Reason: {invoice.rejectionNote}</p>
                )}
              </div>

              {invoice.status === 'pending' && (
                <div className="invoice-actions">
                  <button
                    className="btn-approve"
                    onClick={() => handleApprove(invoice.id)}
                    disabled={processingId === invoice.id}
                  >
                    {processingId === invoice.id ? 'Processing...' : '✓ Approve'}
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => setShowRejectModal(invoice.id)}
                    disabled={processingId === invoice.id}
                  >
                    ✕ Reject
                  </button>
                </div>
              )}

              {invoice.status !== 'pending' && (
                <div className="invoice-actions">
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(invoice.id)}
                    disabled={processingId === invoice.id}
                  >
                    {processingId === invoice.id ? 'Deleting...' : '🗑 Delete'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Reject Invoice Request</h3>
            <p>Please provide a reason for rejection (optional):</p>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
            />
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowRejectModal(null);
                  setRejectionNote('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-reject"
                onClick={() => handleReject(showRejectModal)}
                disabled={processingId === showRejectModal}
              >
                {processingId === showRejectModal ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
