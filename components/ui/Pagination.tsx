'use client';

export default function Pagination({ page, totalPages, onChange, summary }: {
  page: number; totalPages: number; onChange: (p: number) => void;
  summary?: string;
}) {
  if (totalPages <= 1 && !summary) return null;

  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      {summary && <span className="text-xs text-slate-400">{summary}</span>}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
            className="px-2.5 py-1 rounded border border-slate-200 text-sm text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary-400">‹</button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-2.5 py-1 rounded border border-slate-200 text-sm text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary-400">›</button>
        </div>
      )}
    </div>
  );
}
