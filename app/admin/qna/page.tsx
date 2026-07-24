'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { formatDate } from '@/lib/utils';
import Pagination from '@/components/ui/Pagination';
import ImageLightbox from '@/components/ui/ImageLightbox';

const PAGE_SIZE = 50;

type QnA = {
  id: string; title: string; content: string; category: string; status: string;
  images: string[]; answer: string | null; answeredAt: string | null; createdAt: string;
  user: { name: string; email: string };
};

const CATEGORY_MAP: Record<string, string> = {
  PRODUCT: '상품', ORDER: '주문', ARRIVAL: '입고', PAYMENT: '결제', DELIVERY: '배송', OTHER: '기타',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:  { label: '답변대기', color: 'bg-yellow-100 text-yellow-700' },
  ANSWERED: { label: '답변완료', color: 'bg-green-100 text-green-700' },
  CLOSED:   { label: '종료',     color: 'bg-slate-100 text-slate-500' },
};

export default function AdminQnAPage() {
  const [list, setList]       = useState<QnA[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter]   = useState('ALL');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [page, setPage]       = useState(1);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/qna').then((r) => r.json()).then((d) => { setList(d); setLoading(false); });
  }, []);

  const handleAnswer = async (id: string) => {
    setSaving(id);
    const answer = answers[id] || '';
    await fetch(`/api/qna/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer, status: 'ANSWERED' }),
    });
    setList((prev) => prev.map((q) => q.id === id ? { ...q, answer, status: 'ANSWERED', answeredAt: new Date().toISOString() } : q));
    setSaving(null);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/qna/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setList((prev) => prev.map((q) => q.id === id ? { ...q, status } : q));
  };

  const filtered = filter === 'ALL' ? list : list.filter((q) => q.status === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [filter]);
  useEffect(() => { setPage((p) => Math.min(p, totalPages)); }, [totalPages]);

  return (
    <div>
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <h1 className="text-2xl font-bold text-slate-800 mb-6">문의 관리</h1>

      <div className="flex gap-2 mb-6">
        {['ALL', 'PENDING', 'ANSWERED', 'CLOSED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            {s === 'ALL' ? '전체' : STATUS_MAP[s].label}
            <span className="ml-1 text-xs opacity-70">{s === 'ALL' ? list.length : list.filter((q) => q.status === s).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">문의가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} summary={`전체 ${filtered.length}건`} />
          {paged.map((item) => {
            const st = STATUS_MAP[item.status];
            const isOpen = expanded === item.id;
            return (
              <div key={item.id} className="card overflow-hidden">
                <div className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(isOpen ? null : item.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge text-xs ${st.color}`}>{st.label}</span>
                      <span className="badge text-xs bg-blue-50 text-blue-600">{CATEGORY_MAP[item.category] || item.category}</span>
                      <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="font-medium text-slate-800 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.user.name} ({item.user.email})</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={item.status} onClick={(e) => e.stopPropagation()} onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
                      <option value="PENDING">답변대기</option>
                      <option value="ANSWERED">답변완료</option>
                      <option value="CLOSED">종료</option>
                    </select>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
                    {/* 문의 내용 */}
                    <div>
                      <p className="text-xs text-slate-400 mb-2">문의 내용</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg p-3 border border-slate-100">{item.content}</p>
                      {item.images.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {item.images.map((img, i) => (
                            <button key={i} type="button" onClick={(e) => { e.stopPropagation(); setLightbox(img); }}
                              className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in">
                              <Image src={img} alt="" fill className="object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 답변 입력 */}
                    <div>
                      <p className="text-xs text-slate-400 mb-2">답변 작성</p>
                      <textarea
                        className="input min-h-24 resize-none text-sm"
                        placeholder="답변을 입력하세요..."
                        defaultValue={item.answer || ''}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                      <button onClick={() => handleAnswer(item.id)} disabled={saving === item.id} className="mt-2 btn-primary text-sm py-1.5">
                        {saving === item.id ? '저장 중...' : '답변 저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
