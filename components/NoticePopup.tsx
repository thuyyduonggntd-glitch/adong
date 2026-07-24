'use client';
import { useTranslation } from 'react-i18next';
import { useNotices } from '@/hooks/useNotices';
import { localizeNotice } from '@/lib/noticeLocale';

export default function NoticePopup() {
  const { t, i18n } = useTranslation();
  const { notices, dismissNotice } = useNotices();

  const queue = notices.filter((n) => !n.seen);
  const current = queue[0];

  if (!current) return null;

  const { title, content } = localizeNotice(current, t, i18n.language);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85dvh] overflow-y-auto p-6 space-y-4 my-8 sm:my-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-primary-50 text-primary-600">
            {t(`notice.type.${current.type.toLowerCase()}`)}
          </span>
          {queue.length > 1 && (
            <span className="text-xs text-slate-400">1 / {queue.length}</span>
          )}
        </div>
        <h3 className="font-bold text-slate-800 break-words">{title}</h3>
        <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">{content}</p>

        <div className="flex justify-end">
          <button onClick={() => dismissNotice(current.id)} className="btn-primary text-sm px-6">
            {queue.length > 1 ? t('notice.next') : t('notice.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
