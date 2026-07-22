'use client';
import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { formatDate } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

type QnA = { id: string; title: string; content: string; status: string; createdAt: string; answeredAt: string | null; answer: string | null; user: { name: string }; images: string[] };

export default function QnAPage() {
  const { t } = useTranslation();
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    PENDING:  { label: t('qna.status.PENDING'),  color: 'bg-yellow-100 text-yellow-700' },
    ANSWERED: { label: t('qna.status.ANSWERED'), color: 'bg-green-100 text-green-700' },
    CLOSED:   { label: t('qna.status.CLOSED'),   color: 'bg-slate-100 text-slate-500' },
  };

  const { data: session } = useSession();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [list, setList]         = useState<QnA[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title: '', content: '' });
  const [previewFiles, setPreviewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      fetch('/api/qna').then(async (r) => {
        if (r.ok) { const d = await r.json(); setList(Array.isArray(d) ? d : []); }
        setLoading(false);
      });
      fetch('/api/qna', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAnswersSeen' }),
      }).catch(() => {});
    } else {
      setLoading(false);
    }
  }, [session]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setPreviewFiles((prev) => [...prev, ...arr]);
    arr.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (idx: number) => {
    setPreviewFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) { router.push('/login'); return; }
    setSubmitting(true);

    let uploadedUrls: string[] = [];
    if (previewFiles.length > 0) {
      const fd = new FormData();
      previewFiles.forEach((f) => fd.append('files', f));
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const { urls } = await up.json();
      uploadedUrls = urls;
    }

    const res = await fetch('/api/qna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.title, content: form.content, images: uploadedUrls }),
    });

    if (res.ok) {
      const newItem = await res.json();
      setList((prev) => [{ ...newItem, user: { name: session.user?.name || '' } }, ...prev]);
      setForm({ title: '', content: '' });
      setPreviewFiles([]);
      setPreviews([]);
      setShowForm(false);
    }
    setSubmitting(false);
  };


  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">{t('nav.qna')}</h1>
        {session && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            {showForm ? t('qna.cancel') : t('qna.writeNew')}
          </button>
        )}
        {!session && (
          <Link href="/login" className="btn-primary text-sm">{t('qna.loginToWrite')}</Link>
        )}
      </div>


      {/* 작성 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 mb-6 space-y-4">
          <h2 className="font-semibold text-slate-800">{t('qna.writeFormTitle')}</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('qna.subjectLabel')}</label>
            <input className="input" placeholder={t('qna.subjectPlaceholder')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('qna.contentLabel')}</label>
            <textarea className="input min-h-32 resize-none" placeholder={t('qna.contentPlaceholder')} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
          </div>

          {/* 사진 업로드 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('qna.photoLabel')}</label>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary-400 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            >
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-400">{t('qna.photoDropHint')}</p>
              <p className="text-xs text-slate-300 mt-1">{t('qna.photoMultiHint')}</p>
            </div>

            {previews.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 group">
                    <Image src={src} alt="" fill className="object-cover" />
                    <button type="button" onClick={() => removeFile(i)} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xl font-bold">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? t('qna.submitting') : t('qna.submit')}
          </button>
        </form>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('qna.loading')}</div>
      ) : !session ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">💬</div>
          <p>{t('qna.loginRequired')}</p>
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">💬</div>
          <p>{t('qna.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((item) => {
            const st = STATUS_MAP[item.status];
            return (
              <div key={item.id} className="card overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <span className={`badge text-xs flex-shrink-0 ${st.color}`}>{st.label}</span>
                    <span className="font-semibold text-slate-800 truncate">{item.title}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{item.user.name}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{formatDate(item.createdAt)}</p>
                  </div>
                </div>

                {/* 질문 내용 */}
                <div className="px-5 py-4">
                  <p className="text-xs font-bold text-primary-600 mb-1.5">Q</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{item.content}</p>
                  {item.images && item.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.images.map((src, i) => (
                        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-100">
                          <Image src={src} alt="" fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 답변 */}
                {item.answer && (
                  <div className="px-5 py-4 bg-green-50 border-t border-green-100">
                    <p className="text-xs font-bold text-green-600 mb-1.5">A</p>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{item.answer}</p>
                    {item.answeredAt && (
                      <p className="text-xs text-slate-400 mt-2">{formatDate(item.answeredAt)}</p>
                    )}
                  </div>
                )}
                {!item.answer && (
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                    <p className="text-xs text-slate-400">{t('qna.answerPending')}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
