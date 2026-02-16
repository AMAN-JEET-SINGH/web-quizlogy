'use client';

import { useState, useEffect, useMemo } from 'react';
import { countriesApi, AppCountry } from '@/lib/api';
import './countries.css';

export default function CountriesPage() {
  const [countries, setCountries] = useState<AppCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const fetchCountries = async () => {
    try {
      setLoading(true);
      const res = await countriesApi.getAll();
      setCountries(res.data || []);
    } catch (err: any) {
      setError('Failed to fetch countries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  const handleSeed = async () => {
    if (countries.length > 0 && !confirm('Countries already exist. This will add any missing default countries. Continue?')) return;
    setSeeding(true);
    setError('');
    setSuccess('');
    try {
      const res = await countriesApi.seed();
      setSuccess(res.message || 'Countries seeded successfully');
      setCountries(res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to seed countries');
    } finally {
      setSeeding(false);
    }
  };

  const handleToggleActive = async (country: AppCountry) => {
    try {
      await countriesApi.update(country.code, { isActive: !country.isActive });
      setCountries((prev) =>
        prev.map((c) => (c.code === country.code ? { ...c, isActive: !c.isActive } : c))
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to toggle status');
    }
  };

  const filtered = useMemo(() => {
    let list = countries;
    if (filter === 'active') list = list.filter((c) => c.isActive);
    if (filter === 'inactive') list = list.filter((c) => !c.isActive);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [countries, filter, search]);

  const activeCount = countries.filter((c) => c.isActive).length;
  const inactiveCount = countries.length - activeCount;

  return (
    <div className="countries-page">
      {/* Header */}
      <div className="countries-header">
        <div>
          <h2 className="countries-title">Manage Countries</h2>
          <p className="countries-subtitle">
            {countries.length} countries &middot; {activeCount} active &middot; {inactiveCount} inactive
          </p>
        </div>
        {countries.length === 0 && !loading && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="btn-seed"
          >
            {seeding ? 'Seeding...' : 'Seed All Countries'}
          </button>
        )}
      </div>

      {error && (
        <div className="countries-alert countries-alert-error">
          {error}
        </div>
      )}
      {success && (
        <div className="countries-alert countries-alert-success">
          {success}
        </div>
      )}

      {/* Search + Filter Bar */}
      {countries.length > 0 && (
        <div className="countries-filters">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code..."
            className="countries-search"
          />
          <div className="countries-filter-btns">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`countries-filter-btn ${filter === f ? 'active' : ''}`}
              >
                {f} {f === 'all' ? `(${countries.length})` : f === 'active' ? `(${activeCount})` : `(${inactiveCount})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="countries-loading">Loading countries...</p>
      ) : (
        <div className="countries-table-wrap">
          <table className="countries-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Code</th>
                <th>Name</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((country) => (
                <tr key={country.code}>
                  <td className="countries-td-flag">
                    {getFlagEmoji(country.code)}
                  </td>
                  <td className="countries-td-code">
                    {country.code}
                  </td>
                  <td>
                    {country.name}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleToggleActive(country)}
                      className={`countries-status-btn ${country.isActive ? 'active' : 'inactive'}`}
                    >
                      {country.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="countries-empty-row">
                    {countries.length === 0
                      ? 'No countries found. Click "Seed All Countries" to populate the list.'
                      : 'No countries match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > 0 && (
            <p className="countries-showing">
              Showing {filtered.length} of {countries.length} countries
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Convert ISO 3166-1 alpha-2 code to flag emoji */
function getFlagEmoji(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 0x1f1e6 - 65 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
