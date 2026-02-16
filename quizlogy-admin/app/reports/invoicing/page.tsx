'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/lib/adminContext';
import '../reports.css';

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  period: string;
}

export default function InvoicingPage() {
  const { adminData } = useAdmin();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulated invoice data - replace with actual API call
    const mockInvoices: Invoice[] = [
      {
        id: '1',
        invoiceNumber: 'INV-2024-001',
        date: '2024-01-31',
        amount: 1250.00,
        status: 'paid',
        period: 'January 2024',
      },
      {
        id: '2',
        invoiceNumber: 'INV-2024-002',
        date: '2024-02-29',
        amount: 1480.50,
        status: 'paid',
        period: 'February 2024',
      },
      {
        id: '3',
        invoiceNumber: 'INV-2024-003',
        date: '2024-03-31',
        amount: 1620.75,
        status: 'pending',
        period: 'March 2024',
      },
    ];

    setTimeout(() => {
      setInvoices(mockInvoices);
      setLoading(false);
    }, 500);
  }, []);

  const formatCurrency = (val: number) => '$' + val.toFixed(2);

  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalPending = invoices
    .filter(inv => inv.status === 'pending')
    .reduce((sum, inv) => sum + inv.amount, 0);

  const getStatusBadge = (status: Invoice['status']) => {
    const classes = {
      paid: 'users-badge active',
      pending: 'users-badge inactive',
      overdue: 'users-badge inactive',
    };
    return <span className={classes[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  if (loading) {
    return (
      <div className="reports-loading">
        <p>Loading invoices...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="reports-page-header">
        <h1 className="reports-page-title">Invoicing</h1>
        <p className="reports-page-subtitle">View and manage your revenue invoices</p>
      </div>

      {/* Stats Cards */}
      <div className="invoicing-stats">
        <div className="invoicing-stat-card">
          <div className="invoicing-stat-value">{invoices.length}</div>
          <div className="invoicing-stat-label">Total Invoices</div>
        </div>
        <div className="invoicing-stat-card success">
          <div className="invoicing-stat-value">{formatCurrency(totalPaid)}</div>
          <div className="invoicing-stat-label">Total Paid</div>
        </div>
        <div className="invoicing-stat-card warning">
          <div className="invoicing-stat-value">{formatCurrency(totalPending)}</div>
          <div className="invoicing-stat-label">Pending</div>
        </div>
        <div className="invoicing-stat-card">
          <div className="invoicing-stat-value">{formatCurrency(totalPaid + totalPending)}</div>
          <div className="invoicing-stat-label">All Time Revenue</div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="reports-card">
        <div className="reports-card-header">
          <h2 className="reports-card-title">Invoice History</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="reports-empty">
            <svg className="reports-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3>No invoices yet</h3>
            <p>Your invoices will appear here once generated.</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Period</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice.id}>
                  <td><strong>{invoice.invoiceNumber}</strong></td>
                  <td>{invoice.period}</td>
                  <td>{new Date(invoice.date).toLocaleDateString()}</td>
                  <td><strong>{formatCurrency(invoice.amount)}</strong></td>
                  <td>{getStatusBadge(invoice.status)}</td>
                  <td>
                    <button
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Download PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
