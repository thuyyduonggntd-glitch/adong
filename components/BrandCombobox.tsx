'use client';
import { useEffect, useRef, useState } from 'react';

type Brand = { id: string; name: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function BrandCombobox({ value, onChange }: Props) {
  const [brands, setBrands]   = useState<Brand[]>([]);
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState(value);
  const containerRef          = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/brands').then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setBrands(d);
    });
  }, []);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = brands.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (name: string) => {
    setQuery(name);
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          className="input text-sm pr-8"
          placeholder="브랜드 입력 또는 선택"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          onClick={() => setOpen((o) => !o)}
        >
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && brands.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors ${query === b.name ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700'}`}
                onMouseDown={() => handleSelect(b.name)}
              >
                {b.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2.5 text-sm text-slate-400 italic">
              일치하는 브랜드 없음 — 입력한 이름으로 등록됩니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}
