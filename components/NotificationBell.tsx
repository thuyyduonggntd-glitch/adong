'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotices } from '@/hooks/useNotices';
import { localizeNotice } from '@/lib/noticeLocale';

const typeStyle: Record<'MANUAL' | 'SALE' | 'CARRYOVER', string> = {
  MANUAL: 'bg-slate-100 text-slate-600',
  SALE: 'bg-red-50 text-red-600',
  CARRYOVER: 'bg-amber-50 text-amber-600',
};

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const { notices, unreadCount, markAllSeen } = useNotices();
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) markAllSeen();
      return next;
    });
  };

  return (
    <div className="relative">
      <button onClick={toggle} className="relative p-2 text-slate-600 hover:text-primary-600">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg border border-slate-100 z-50 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-700">{t('notice.bellTitle')}</div>
            {notices.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{t('notice.empty')}</p>
            ) : (
              notices.map((n) => {
                const { title, content } = localizeNotice(n, t, i18n.language);
                return (
                  <div key={n.id} className="px-4 py-3 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${typeStyle[n.type]}`}>
                        {t(`notice.type.${n.type.toLowerCase()}`)}
                      </span>
                      <p className="text-sm font-bold text-slate-800 break-words">{title}</p>
                    </div>
                    <p className="text-xs text-slate-500 whitespace-pre-wrap break-words">{content}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString('ko-KR')}</p>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
