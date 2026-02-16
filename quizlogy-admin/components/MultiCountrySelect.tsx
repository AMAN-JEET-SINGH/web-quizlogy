'use client';

import { useState, useEffect, useRef } from 'react';
import { countriesApi, AppCountry } from '@/lib/api';

interface MultiCountrySelectProps {
  value: string[];
  onChange: (countries: string[]) => void;
  label?: string;
}

export default function MultiCountrySelect({ value, onChange, label = 'Countries' }: MultiCountrySelectProps) {
  const [countries, setCountries] = useState<AppCountry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    countriesApi.getAll().then((res) => {
      setCountries(res.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const isAll = value.length === 0 || (value.length === 1 && value[0] === 'ALL');

  const handleToggle = (code: string) => {
    if (code === 'ALL') {
      onChange(['ALL']);
      return;
    }

    let next = value.filter(c => c !== 'ALL');
    if (next.includes(code)) {
      next = next.filter(c => c !== code);
    } else {
      next = [...next, code];
    }

    if (next.length === 0) {
      onChange(['ALL']);
    } else {
      onChange(next);
    }
  };

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const displayText = isAll
    ? 'All Countries'
    : value.length === 1
      ? (countries.find(c => c.code === value[0])?.name || value[0])
      : `${value.length} countries selected`;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label className="form-label">{label}</label>}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '8px 12px',
          border: '1px solid var(--admin-border, #d1d5db)',
          borderRadius: '6px',
          cursor: 'pointer',
          background: 'var(--admin-input-bg, #fff)',
          color: 'var(--admin-text, #111827)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '38px',
          fontSize: '14px',
        }}
      >
        <span>{loading ? 'Loading...' : displayText}</span>
        <span style={{ fontSize: '10px' }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Selected tags */}
      {!isAll && value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
          {value.map(code => (
            <span
              key={code}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: 'var(--admin-accent, #6366f1)',
                color: '#fff',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            >
              {code}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleToggle(code); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '14px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--admin-card-bg, #fff)',
            border: '1px solid var(--admin-border, #d1d5db)',
            borderRadius: '6px',
            marginTop: '4px',
            maxHeight: '240px',
            overflow: 'auto',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ padding: '6px', borderBottom: '1px solid var(--admin-border, #d1d5db)' }}>
            <input
              type="text"
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--admin-border, #d1d5db)',
                borderRadius: '4px',
                fontSize: '13px',
                background: 'var(--admin-input-bg, #fff)',
                color: 'var(--admin-text, #111827)',
              }}
            />
          </div>

          {/* ALL option */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontWeight: isAll ? 600 : 400,
              background: isAll ? 'var(--admin-accent-light, #eef2ff)' : 'transparent',
              fontSize: '13px',
            }}
          >
            <input
              type="checkbox"
              checked={isAll}
              onChange={() => handleToggle('ALL')}
            />
            All Countries (Global)
          </label>

          {/* Country list */}
          {filtered.map(country => {
            const checked = !isAll && value.includes(country.code);
            return (
              <label
                key={country.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  background: checked ? 'var(--admin-accent-light, #eef2ff)' : 'transparent',
                  fontSize: '13px',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggle(country.code)}
                />
                <span>{country.name}</span>
                <span style={{ color: 'var(--admin-muted, #6b7280)', fontSize: '12px' }}>
                  ({country.code})
                </span>
              </label>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--admin-muted, #6b7280)', fontSize: '13px' }}>
              No countries found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
