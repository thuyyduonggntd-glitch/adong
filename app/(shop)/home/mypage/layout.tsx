'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const tabs = [
    { href: '/home/mypage/transactions', label: t('mypage.tab.transactions') },
    { href: '/home/mypage/profile',      label: t('mypage.tab.profile') },
  ];

  if (status === 'loading') return (
    <div className="flex items-center justify-center min-h-96">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
    </div>
  );
  if (!session) { redirect('/login'); }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('mypage.title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('mypage.greeting', { name: session.user?.name })}</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-8 overflow-x-auto">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              pathname === tab.href ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
