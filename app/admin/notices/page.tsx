'use client';
import { useEffect, useState } from 'react';

type Notice = {
  id: string;
  type: 'MANUAL' | 'SALE' | 'CARRYOVER';
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
};

const typeLabel: Record<Notice['type'], string> = {
  MANUAL: '공지',
  SALE: '세일',
  CARRYOVER: '이월',
};

const typeStyle: Record<Notice['type'], string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  SALE: 'bg-red-50 text-red-600',
  CARRYOVER: 'bg-amber-50 text-amber-600',
};

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const load = () => {
    fetch('/api/notices').then((r) => r.json()).then((d) => { setNotices(d); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaving(true);
    const res = await fetch('/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || '오류'); return; }
    const newNotice = await res.json();
    setNotices((prev) => [newNotice, ...prev]);
    setTitle(''); setContent('');
  };

  const toggleActive = async (notice: Notice) => {
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
        <form onSubmit={handleAdd} className="space-y-4">
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
          {notices.map((notice) => (
            <div key={notice.id} className="card px-5 py-4 flex items-start gap-4">
              <span className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-lg ${typeStyle[notice.type]}`}>
                {typeLabel[notice.type]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800">{notice.title}</p>
                <p className="text-sm text-slate-500 mt-0.5 whitespace-pre-wrap">{notice.content}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(notice.createdAt).toLocaleString('ko-KR')}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(notice)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${notice.isActive ? 'bg-primary-50 text-primary-600 hover:bg-primary-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {notice.isActive ? '노출 중' : '비노출'}
                </button>
                <button onClick={() => handleDelete(notice.id, notice.title)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
