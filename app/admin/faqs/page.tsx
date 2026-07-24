'use client';
import { useEffect, useState } from 'react';
import { FAQ_CATEGORY_ORDER, sortByFaqCategoryOrder } from '@/lib/faqLocale';

const DEFAULT_CATEGORIES = FAQ_CATEGORY_ORDER;

type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  translatedAt: string | null;
  createdAt: string;
};

export default function AdminFaqsPage() {
  const [faqs, setFaqs]       = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [saving, setSaving]   = useState(false);

  const [form, setForm] = useState({ category: DEFAULT_CATEGORIES[0], question: '', answer: '', order: '0' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm]   = useState({ category: '', question: '', answer: '', order: '0' });

  const load = () => {
    fetch('/api/faqs').then((r) => r.json()).then((d) => { setFaqs(Array.isArray(d) ? d : []); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const categories = sortByFaqCategoryOrder(Array.from(new Set([...DEFAULT_CATEGORIES, ...faqs.map((f) => f.category)])));
  const grouped = categories
    .map((cat) => ({ cat, items: faqs.filter((f) => f.category === cat) }))
    .filter((g) => g.items.length > 0 || DEFAULT_CATEGORIES.includes(g.cat));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSaving(true);
    const res = await fetch('/api/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || '오류'); return; }
    const created = await res.json();
    setFaqs((prev) => [...prev, created]);
    setForm({ category: form.category, question: '', answer: '', order: '0' });
  };

  const startEdit = (f: Faq) => {
    setEditingId(f.id);
    setEditForm({ category: f.category, question: f.question, answer: f.answer, order: String(f.order) });
  };

  const saveEdit = async (id: string) => {
    const res = await fetch(`/api/faqs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) return;
    const updated = await res.json();
    setFaqs((prev) => prev.map((f) => f.id === id ? updated : f));
    setEditingId(null);
  };

  const toggleActive = async (f: Faq) => {
    const res = await fetch(`/api/faqs/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !f.isActive }),
    });
    const updated = await res.json();
    setFaqs((prev) => prev.map((x) => x.id === f.id ? { ...x, ...updated } : x));
  };

  const handleDelete = async (id: string, question: string) => {
    if (!confirm(`"${question}" 항목을 삭제하시겠습니까?`)) return;
    await fetch(`/api/faqs/${id}`, { method: 'DELETE' });
    setFaqs((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">FAQ 관리</h1>
      <p className="text-sm text-slate-500 mb-6">
        한국어로 등록하면 6개 언어(영/베트남/태국/러시아/몽골/스페인)로 자동 번역되어 회원 FAQ 페이지에 표시됩니다.
      </p>

      {/* 작성 폼 */}
      <div className="card p-5 mb-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">새 FAQ 등록</h2>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">카테고리 *</label>
              <input className="input w-full text-sm" list="faq-categories"
                value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} required />
              <datalist id="faq-categories">
                {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">정렬순서</label>
              <input type="number" className="input w-full text-sm"
                value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">질문 *</label>
            <input className="input w-full text-sm" placeholder="예: 회원가입은 어떻게 하나요?"
              value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">답변 *</label>
            <textarea className="input w-full text-sm resize-none" rows={3}
              placeholder="회원에게 보여줄 답변을 입력하세요"
              value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} required />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary text-sm px-6">
              {saving ? '저장 중...' : '+ FAQ 등록'}
            </button>
          </div>
        </form>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">로딩 중...</div>
      ) : faqs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">등록된 FAQ가 없습니다.</div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <h3 className="text-sm font-bold text-primary-600 mb-3">{cat} <span className="text-slate-400 font-normal">({items.length})</span></h3>
              {items.length === 0 ? (
                <p className="text-xs text-slate-400">등록된 항목이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((f) => (
                    <div key={f.id} className="card px-5 py-4">
                      {editingId === f.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input className="input text-sm" list="faq-categories"
                              value={editForm.category} onChange={(e) => setEditForm((f2) => ({ ...f2, category: e.target.value }))} />
                            <input type="number" className="input text-sm"
                              value={editForm.order} onChange={(e) => setEditForm((f2) => ({ ...f2, order: e.target.value }))} />
                          </div>
                          <input className="input text-sm w-full"
                            value={editForm.question} onChange={(e) => setEditForm((f2) => ({ ...f2, question: e.target.value }))} />
                          <textarea className="input text-sm w-full resize-none" rows={3}
                            value={editForm.answer} onChange={(e) => setEditForm((f2) => ({ ...f2, answer: e.target.value }))} />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">취소</button>
                            <button onClick={() => saveEdit(f.id)} className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700">저장</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800">Q. {f.question}</p>
                            <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">A. {f.answer}</p>
                            <p className="text-xs text-slate-400 mt-1.5">
                              순서 {f.order} · {f.translatedAt ? `번역완료 (${new Date(f.translatedAt).toLocaleString('ko-KR')})` : '번역 대기중'}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => toggleActive(f)}
                              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${f.isActive ? 'bg-primary-50 text-primary-600 hover:bg-primary-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                              {f.isActive ? '노출 중' : '비노출'}
                            </button>
                            <button onClick={() => startEdit(f)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">수정</button>
                            <button onClick={() => handleDelete(f.id, f.question)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">삭제</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
