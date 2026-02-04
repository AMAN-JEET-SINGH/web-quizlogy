'use client';

import { useState, useEffect } from 'react';
import { usersApi, User } from '@/lib/api';
import './users.css';

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [search, setSearch] = useState('');
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.getAll({
        page,
        limit,
        search: search || undefined,
      });
      setUsers(response.data);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setPage(1);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="users-management">
      <div className="users-header">
        <h1>Users Management</h1>
        <button onClick={fetchUsers} className="refresh-btn">
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by name, email, mobile, city, country..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="filter-input"
          />
        </div>
        <button onClick={clearFilters} className="clear-filters-btn">
          Clear Filters
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading users...</div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile No</th>
                <th>WhatsApp No</th>
                <th>Address</th>
                <th>City</th>
                <th>Country</th>
                <th>Postal Code</th>
                <th>Coins</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={10} className="no-data">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-name-cell">
                        {user.picture ? (
                          <img 
                            src={user.picture} 
                            alt={user.name} 
                            className="user-avatar"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="user-avatar-placeholder">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span>{user.name}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.profile?.mobileNo || 'N/A'}</td>
                    <td>{user.profile?.whatsappNo || 'N/A'}</td>
                    <td className="address-cell">
                      {user.profile?.address || 'N/A'}
                    </td>
                    <td>{user.profile?.city || 'N/A'}</td>
                    <td>{user.profile?.country || 'N/A'}</td>
                    <td>{user.profile?.postalCode || 'N/A'}</td>
                    <td>{user.coins || 0}</td>
                    <td>{formatDate(user.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total users)
          </span>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
