'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeFaq, localizeFaqCategory, sortByFaqCategoryOrder } from '@/lib/faqLocale';

type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
  [key: string]: any;
};

export default function FaqPage() {
  const { t, i18n } = useTranslation();
  const [faqs, setFaqs]     = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/faqs?active=1').then((r) => r.json()).then((d) => {
      const list = Array.isArray(d) ? d : [];
      setFaqs(list);
      if (list.length > 0) setOpenCategory(sortByFaqCategoryOrder(Array.from(new Set(list.map((f: Faq) => f.category))))[0]);
      setLoading(false);
    });
  }, []);

  const categories = sortByFaqCategoryOrder(Array.from(new Set(faqs.map((f) => f.category))));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">{t('faq.title')}</h1>
      <p className="text-sm text-slate-400 mb-6">{t('faq.subtitle')}</p>

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('faq.loading')}</div>
      ) : faqs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">❓</div>
          <p>{t('faq.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const items = faqs.filter((f) => f.category === cat);
            const catOpen = openCategory === cat;
            return (
              <div key={cat} className="card overflow-hidden">
                <button
                  onClick={() => setOpenCategory(catOpen ? null : cat)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-bold text-slate-800">{localizeFaqCategory(cat, t)}</span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${catOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {catOpen && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {items.map((f) => {
                      const { question, answer } = localizeFaq(f, i18n.language);
                      const qOpen = openId === f.id;
                      return (
                        <div key={f.id}>
                          <button
                            onClick={() => setOpenId(qOpen ? null : f.id)}
                            className="w-full flex items-start justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                          >
                            <span className="text-sm font-medium text-slate-700 flex-1">
                              <span className="text-primary-500 font-bold mr-1.5">Q.</span>{question}
                            </span>
                            <svg className={`w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5 transition-transform ${qOpen ? 'rotate-180' : ''}`}
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {qOpen && (
                            <div className="px-5 pb-4 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                              <span className="text-primary-500 font-bold mr-1.5">A.</span>{answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
