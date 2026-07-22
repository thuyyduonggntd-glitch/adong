'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatDate } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export default function QnADetailPage() {
  const { t } = useTranslation();
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    PENDING:  { label: t('qna.status.PENDING'),  color: 'bg-yellow-100 text-yellow-700' },
    ANSWERED: { label: t('qna.status.ANSWERED'), color: 'bg-green-100 text-green-700' },
    CLOSED:   { label: t('qna.status.CLOSED'),   color: 'bg-slate-100 text-slate-500' },
  };

  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [qna, setQna] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/qna/${id}`).then((r) => r.json()).then((d) => { setQna(d); setLoading(false); });
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-96"><div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" /></div>;
  if (!qna || qna.error) return <div className="text-center py-20 text-slate-400">{t('qnaDetail.notFound')}</div>;

  const st = STATUS_MAP[qna.status];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button onClick={() => router.back()} className="text-sm text-primary-600 hover:underline mb-6 flex items-center gap-1">
        {t('qnaDetail.backToList')}
      </button>

      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold text-slate-800">{qna.title}</h1>
          <span className={`badge text-xs flex-shrink-0 ${st.color}`}>{st.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 mb-6">
          <span>{qna.user.name}</span>
          <span>·</span>
          <span>{formatDate(qna.createdAt)}</span>
        </div>
        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{qna.content}</p>

        {qna.images && qna.images.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {qna.images.map((img: string, i: number) => (
              <div key={i} className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-200">
                <Image src={img} alt={`attachment ${i + 1}`} fill className="object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      {qna.answer && (
        <div className="card p-6 bg-primary-50 border-primary-200 border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-primary-600 font-bold text-sm">{t('qnaDetail.answer')}</span>
            {qna.answeredAt && <span className="text-xs text-slate-400">{formatDate(qna.answeredAt)}</span>}
          </div>
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{qna.answer}</p>
        </div>
      )}
    </div>
  );
}
