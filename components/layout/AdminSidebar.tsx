'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { SUB_ADMIN_ALLOWED_PATHS } from '@/lib/adminAccess';

const menu = [
  { href: '/admin/dashboard',    label: '대시보드',    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/admin/orders',       label: '주문 관리',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { href: '/admin/cancelled',    label: '취소 상품',   icon: 'M6 18L18 6M6 6l12 12', badge: 'cancelCount' },
  { href: '/admin/products',     label: '상품 관리',   icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/admin/brands',       label: '브랜드 관리', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  { href: '/admin/notices',      label: '공지 알림',   icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { href: '/admin/shipping',     label: '배송 관리',   icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
  { href: '/admin/qna',          label: '문의',        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', badge: 'qnaCount' },
  { href: '/admin/users',        label: '회원 관리',   icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', badge: 'newUserCount' },
  { href: '/admin/transactions', label: '거래 내역',   icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isSubAdmin = role === 'SUB_ADMIN';
  const visibleMenu = isSubAdmin
    ? menu.filter((item) => SUB_ADMIN_ALLOWED_PATHS.some((p) => item.href.startsWith(p)))
    : menu;
  const homeHref = isSubAdmin ? '/admin/orders' : '/admin/dashboard';

  const [cancelCount, setCancelCount]   = useState(0);
  const [qnaCount, setQnaCount]         = useState(0);
  const [newUserCount, setNewUserCount] = useState(0);

  useEffect(() => {
    const fetchCounts = () => {
      fetch('/api/orders/items?cancelledToday=1')
        .then((r) => r.json())
        .then((d) => setCancelCount(d.count ?? 0))
        .catch(() => {});
      fetch('/api/qna?unseenCount=1')
        .then((r) => r.json())
        .then((d) => setQnaCount(d.count ?? 0))
        .catch(() => {});
      if (!isSubAdmin) {
        fetch('/api/users?newToday=1')
          .then((r) => r.json())
          .then((d) => setNewUserCount(d.count ?? 0))
          .catch(() => {});
      }
    };
    fetchCounts();
    const id = setInterval(fetchCounts, 60_000);
    return () => clearInterval(id);
  }, [pathname, isSubAdmin]);

  return (
    <aside className="w-64 min-h-screen bg-primary-900 text-white flex flex-col">
      <div className="p-6 border-b border-primary-700">
        <Link href={homeHref} className="text-xl font-bold text-primary-200">꿈비샵 관리자</Link>
        <p className="text-primary-400 text-xs mt-1">Admin Panel</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {visibleMenu.map((item) => {
          const active = pathname.startsWith(item.href);
          const count = item.badge === 'cancelCount' ? cancelCount : item.badge === 'qnaCount' ? qnaCount : item.badge === 'newUserCount' ? newUserCount : 0;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary-600 text-white' : 'text-primary-300 hover:bg-primary-700 hover:text-white'}`}>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-tight">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary-700 space-y-2">
        <Link href="/home" className="flex items-center gap-2 px-4 py-2 text-xs text-primary-400 hover:text-primary-200">← 쇼핑몰로 이동</Link>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:text-red-300">로그아웃</button>
      </div>
    </aside>
  );
}
