'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 50;

// KST = UTC+9. datetime-local input은 로컬 시간 기준이므로 KST 오프셋 적용
const KST_OFFSET = 9 * 60; // minutes

function toKSTInputValue(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET * 60_000);
  return kst.toISOString().slice(0, 16);
}
function nowKSTInputValue(): string {
  return toKSTInputValue(new Date());
}
// datetime-local 값(KST 기준) → UTC Date
function kstInputToUTC(val: string): Date {
  const localMs = new Date(val).getTime();
  return new Date(localMs - KST_OFFSET * 60_000);
}

type RecipientType = 'all' | 'selected' | 'country';

type NoticeRow = {
  id: string;
  type: 'MANUAL' | 'SALE' | 'CARRYOVER';
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  recipientType: string;
  recipientIds: string[];
  recipientCountries: string[];
  scheduledAt: string | null;
  expiresAt: string | null;
  seenCount: number;
};

const typeLabel: Record<NoticeRow['type'], string> = { MANUAL: '공지', SALE: '세일', CARRYOVER: '이월' };
const typeStyle: Record<NoticeRow['type'], string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  SALE: 'bg-red-50 text-red-600',
  CARRYOVER: 'bg-amber-50 text-amber-600',
};

function noticeStatus(n: NoticeRow): 'scheduled' | 'live' | 'ended' | 'hidden' {
  if (!n.isActive) return 'hidden';
  const now = Date.now();
  if (n.expiresAt && new Date(n.expiresAt).getTime() < now) return 'ended';
  if (n.scheduledAt && new Date(n.scheduledAt).getTime() > now) return 'scheduled';
  return 'live';
}

const statusBadge: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-600',
  live:      'bg-green-50 text-green-700',
  ended:     'bg-slate-100 text-slate-500',
  hidden:    'bg-red-50 text-red-400',
};
const statusLabel: Record<string, string> = {
  scheduled: '예약',
  live:      '노출 중',
  ended:     '종료',
  hidden:    '비노출',
};

function recipientLabel(n: NoticeRow): string {
  if (n.recipientType === 'all') return '전체';
  if (n.recipientType === 'country') return `국가 ${n.recipientCountries.length}개`;
  return `${n.recipientIds.length}명 선택`;
}

// ──────────────────────────────────────────
// Readers Modal
// ──────────────────────────────────────────
function ReadersModal({ noticeId, noticeTitle, onClose, isAdmin }: {
  noticeId: string; noticeTitle: string; onClose: () => void; isAdmin: boolean;
}) {
  const [tab, setTab]         = useState<'confirmed' | 'pending'>('confirmed');
  const [rows, setRows]       = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback((t: 'confirmed' | 'pending', p: number) => {
    setLoading(true);
    fetch(`/api/notices/${noticeId}/readers?tab=${t}&page=${p}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotal(d.total ?? 0); setTotalPages(d.totalPages ?? 1); setLoading(false); })
      .catch(() => setLoading(false));
  }, [noticeId]);

  useEffect(() => { load(tab, page); }, [load, tab, page]);

  const switchTab = (t: 'confirmed' | 'pending') => { setTab(t); setPage(1); };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-slate-800 truncate mr-4">{noticeTitle}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex border-b px-5">
          {(['confirmed', 'pending'] as const).map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              className={`py-2.5 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t === 'confirmed' ? '확인 완료' : '미확인'} {tab === t && total > 0 && `(${total})`}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center py-8 text-slate-400 text-sm">로딩 중...</p>
          ) : rows.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">없음</p>
          ) : (
            <div className="space-y-1">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-sm">
                  <span className="font-mono text-slate-600">{r.userId}</span>
                  {isAdmin && r.name && <span className="text-xs text-slate-500 truncate ml-2">{r.shopName || r.name}</span>}
                  {tab === 'confirmed' && r.seenAt && (
                    <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                      {new Date(r.seenAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="border-t px-4 py-2">
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
        <div className="px-5 py-3 border-t text-xs text-slate-400">총 {total}명</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// User ID 검색 (선택 회원용)
// ──────────────────────────────────────────
function UserSearch({ selectedIds, onToggle }: {
  selectedIds: string[]; onToggle: (id: string) => void;
}) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/users?search=${encodeURIComponent(query.trim())}&role=USER&limit=20`)
        .then((r) => r.json())
        .then((d) => {
          const arr = Array.isArray(d) ? d : (d.users ?? []);
          setResults(arr.map((u: any) => ({ id: u.id, label: u.id })));
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-2">
      <input
        className="input w-full text-sm"
        placeholder="ID로 검색..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searching && <p className="text-xs text-slate-400">검색 중...</p>}
      {results.length > 0 && (
        <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
          {results.map((u) => (
            <button key={u.id} type="button" onClick={() => onToggle(u.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 ${selectedIds.includes(u.id) ? 'bg-primary-50' : ''}`}>
              <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-white text-xs ${selectedIds.includes(u.id) ? 'bg-primary-600 border-primary-600' : 'border-slate-300'}`}>
                {selectedIds.includes(u.id) && '✓'}
              </span>
              <span className="font-mono">{u.id}</span>
            </button>
          ))}
        </div>
      )}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full">
              <span className="font-mono">{id.slice(0, 8)}…</span>
              <button type="button" onClick={() => onToggle(id)} className="hover:text-primary-900">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────
export default function AdminNoticesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const adminUser = role === 'ADMIN';

  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);

  // Form state
  const [title, setTitle]           = useState('');
  const [content, setContent]       = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('all');
  const [selectedIds, setSelectedIds]     = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresAt, setExpiresAt]     = useState('');
  const [countries, setCountries]     = useState<{ country: string; count: number }[]>([]);
  const [preview, setPreview]         = useState<{ count: number; ids: any[] } | null>(null);
  const [previewing, setPreviewing]   = useState(false);
  const [showPreviewIds, setShowPreviewIds] = useState(false);

  // Readers modal
  const [readersNotice, setReadersNotice] = useState<NoticeRow | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/notices')
      .then((r) => r.json())
      .then((d) => { setNotices(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/notices/countries')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCountries(d))
      .catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  useEffect(() => { setPage((p) => Math.min(p, totalPages)); }, [totalPages]);
  const paged = notices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleId = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleCountry = (c: string) =>
    setSelectedCountries((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const fetchPreview = async () => {
    setPreviewing(true); setPreview(null); setShowPreviewIds(false);
    const body =
      recipientType === 'all'      ? { recipientType: 'all' } :
      recipientType === 'selected' ? { recipientType: 'selected', recipientIds: selectedIds } :
      { recipientType: 'country', recipientCountries: selectedCountries };
    const res = await fetch('/api/notices/recipient-preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) { const d = await res.json(); setPreview(d); }
    setPreviewing(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (recipientType === 'selected' && selectedIds.length === 0) { setError('수신 회원을 선택해주세요.'); return; }
    if (recipientType === 'country' && selectedCountries.length === 0) { setError('국가를 선택해주세요.'); return; }
    if (scheduledAt && expiresAt && kstInputToUTC(scheduledAt) >= kstInputToUTC(expiresAt)) {
      setError('종료 시간이 시작 시간보다 늦어야 합니다.'); return;
    }
    setSaving(true);
    const res = await fetch('/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, content,
        recipientType,
        recipientIds: recipientType === 'selected' ? selectedIds : [],
        recipientCountries: recipientType === 'country' ? selectedCountries : [],
        scheduledAt: scheduledAt ? kstInputToUTC(scheduledAt).toISOString() : null,
        expiresAt:   expiresAt   ? kstInputToUTC(expiresAt).toISOString()   : null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || '오류'); return; }
    const newNotice = await res.json();
    setNotices((prev) => [newNotice, ...prev]);
    setTitle(''); setContent('');
    setRecipientType('all'); setSelectedIds([]); setSelectedCountries([]);
    setScheduledAt(''); setExpiresAt(''); setPreview(null);
  };

  const toggleActive = async (notice: NoticeRow) => {
    const res = await fetch(`/api/notices/${notice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !notice.isActive }),
    });
    const updated = await res.json();
    setNotices((prev) => prev.map((n) => n.id === notice.id ? { ...n, ...updated } : n));
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 알림을 삭제하시겠습니까?`)) return;
    await fetch(`/api/notices/${id}`, { method: 'DELETE' });
    setNotices((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">공지 알림 관리</h1>
      <p className="text-sm text-slate-500 mb-6">
        세일/이월 상품이 등록되면 자동으로 팝업 알림이 생성됩니다. 여기서는 직접 공지를 작성하거나, 알림 노출 여부를 관리할 수 있습니다.
      </p>

      {/* 작성 폼 */}
      <div className="card p-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">새 공지 작성</h2>
        <form onSubmit={handleAdd} className="space-y-5">
          <div>
            <label className="block text-xs text-slate-500 mb-1">제목 *</label>
            <input className="input w-full text-sm" placeholder="예: 배송 지연 안내"
              value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">내용 *</label>
            <textarea className="input w-full text-sm resize-none" rows={3}
              placeholder="회원에게 팝업으로 노출할 내용을 입력하세요"
              value={content} onChange={(e) => setContent(e.target.value)} required />
          </div>

          {/* 수신 대상 */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">수신 대상</label>
            <div className="flex flex-wrap gap-4 mb-3">
              {(['all', 'selected', 'country'] as RecipientType[]).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                  <input type="radio" name="recipientType" value={t} checked={recipientType === t}
                    onChange={() => { setRecipientType(t); setPreview(null); }}
                    className="text-primary-600" />
                  <span>{t === 'all' ? '전체 회원' : t === 'selected' ? '선택 회원' : '국가별'}</span>
                </label>
              ))}
            </div>

            {recipientType === 'selected' && (
              <div className="border rounded-lg p-3 bg-slate-50">
                <p className="text-xs text-slate-500 mb-2">ID로 회원을 검색하여 선택하세요</p>
                <UserSearch selectedIds={selectedIds} onToggle={toggleId} />
              </div>
            )}

            {recipientType === 'country' && (
              <div className="border rounded-lg p-3 bg-slate-50">
                <p className="text-xs text-slate-500 mb-2">국가를 선택하세요 (복수 선택 가능)</p>
                {countries.length === 0 ? (
                  <p className="text-xs text-slate-400">국가 정보를 불러오는 중...</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {countries.map(({ country, count }) => (
                      <label key={country} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input type="checkbox" checked={selectedCountries.includes(country)}
                          onChange={() => { toggleCountry(country); setPreview(null); }}
                          className="w-3.5 h-3.5 rounded text-primary-600" />
                        <span className="text-sm">{country}</span>
                        <span className="text-xs text-slate-400">({count})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 수신 인원 미리보기 */}
            <div className="mt-3 flex items-center gap-3">
              <button type="button" onClick={fetchPreview} disabled={previewing}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                {previewing ? '계산 중...' : '수신 인원 확인'}
              </button>
              {preview && (
                <span className="text-sm font-semibold text-primary-700">
                  총 {preview.count.toLocaleString()}명에게 발송됩니다
                </span>
              )}
              {preview && preview.ids.length > 0 && (
                <button type="button" onClick={() => setShowPreviewIds((v) => !v)}
                  className="text-xs text-slate-400 underline">
                  {showPreviewIds ? '목록 숨기기' : 'ID 목록 보기'}
                </button>
              )}
            </div>
            {showPreviewIds && preview && preview.ids.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-32 overflow-y-auto p-2 bg-white text-xs font-mono text-slate-500 space-y-0.5">
                {preview.ids.map((item, i) => (
                  <div key={i}>{typeof item === 'string' ? item : item.id}</div>
                ))}
              </div>
            )}
          </div>

          {/* 노출 일정 (KST 기준) */}
          <div>
            <label className="block text-xs text-slate-500 mb-2">노출 일정 <span className="text-slate-400">(KST, 미입력 시 즉시·무제한)</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">시작 일시</label>
                <input type="datetime-local" className="input w-full text-sm"
                  value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">종료 일시</label>
                <input type="datetime-local" className="input w-full text-sm"
                  value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary text-sm px-6">
              {saving ? '저장 중...' : '+ 공지 등록'}
            </button>
          </div>
        </form>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-slate-400">등록된 알림이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} summary={`전체 ${notices.length}건`} />
          {paged.map((notice) => {
            const status = noticeStatus(notice);
            return (
              <div key={notice.id} className="card px-5 py-4 flex items-start gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${typeStyle[notice.type]}`}>
                    {typeLabel[notice.type]}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${statusBadge[status]}`}>
                    {statusLabel[status]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">{notice.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5 whitespace-pre-wrap line-clamp-2">{notice.content}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-xs text-slate-400">{new Date(notice.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                    <span className="text-xs text-slate-400">수신: {recipientLabel(notice)}</span>
                    {(notice.scheduledAt || notice.expiresAt) && (
                      <span className="text-xs text-slate-400">
                        {notice.scheduledAt && `시작: ${new Date(notice.scheduledAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`}
                        {notice.scheduledAt && notice.expiresAt && ' · '}
                        {notice.expiresAt && `종료: ${new Date(notice.expiresAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`}
                      </span>
                    )}
                    <button onClick={() => setReadersNotice(notice)}
                      className="text-xs text-primary-600 hover:underline font-medium">
                      확인 {notice.seenCount} / 대상 {notice.recipientType === 'all' ? '전체' : `${notice.recipientIds.length}명`}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => toggleActive(notice)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${notice.isActive ? 'bg-primary-50 text-primary-600 hover:bg-primary-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {notice.isActive ? '노출 끄기' : '노출 켜기'}
                  </button>
                  <button onClick={() => handleDelete(notice.id, notice.title)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">삭제</button>
                </div>
              </div>
            );
          })}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      {readersNotice && (
        <ReadersModal
          noticeId={readersNotice.id}
          noticeTitle={readersNotice.title}
          onClose={() => setReadersNotice(null)}
          isAdmin={adminUser}
        />
      )}
    </div>
  );
}
