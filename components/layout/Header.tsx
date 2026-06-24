'use client';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useCartStore } from '@/store/cart';
import { useState, useEffect } from 'react';

export default function Header() {
  const { data: session } = useSession();
  const count = useCartStore((s) => s.count());
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/home" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary-700">꿈비샵</span>
            <span className="text-xs text-slate-400 hidden sm:block">아동복 전문</span>
          </Link>

          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link href="/home/products?category=newborn"   className="hover:text-primary-600 transition-colors">신생아</Link>
            <Link href="/home/products?category=baby"      className="hover:text-primary-600 transition-colors">베이비</Link>
            <Link href="/home/products?category=toddler"   className="hover:text-primary-600 transition-colors">유아</Link>
            <Link href="/home/products?category=kids"      className="hover:text-primary-600 transition-colors">주니어</Link>
            <Link href="/home/products?category=accessory" className="hover:text-primary-600 transition-colors">액세서리</Link>
            <Link href="/home/products?isNew=1" className="text-primary-600 font-bold hover:text-primary-700 transition-colors">신상품</Link>
            <Link href="/home/products?isOnSale=1" className="text-red-500 font-bold hover:text-red-600 transition-colors">세일</Link>
            <Link href="/home/qna"                         className="hover:text-primary-600 transition-colors">질의응답</Link>
            <Link href="/home/mypage"                      className="hover:text-primary-600 transition-colors">마이페이지</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/home/cart" className="relative p-2 text-slate-600 hover:text-primary-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {mounted && count > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </Link>

            {session ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1 text-sm text-slate-700 hover:text-primary-600">
                  <span>{session.user?.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                    <Link href="/home/mypage" className="block px-4 py-2 text-sm text-slate-700 hover:bg-primary-50" onClick={() => setMenuOpen(false)}>마이페이지</Link>
                    <Link href="/home/qna"    className="block px-4 py-2 text-sm text-slate-700 hover:bg-primary-50" onClick={() => setMenuOpen(false)}>질의응답</Link>
                    {(session.user as any)?.role === 'ADMIN' && (
                      <Link href="/admin/dashboard" className="block px-4 py-2 text-sm text-primary-600 hover:bg-primary-50" onClick={() => setMenuOpen(false)}>관리자 페이지</Link>
                    )}
                    <hr className="my-1" />
                    <button onClick={() => { signOut({ callbackUrl: '/login' }); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">로그아웃</button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-primary text-sm py-1.5 px-4">로그인</Link>
            )}

            <button className="md:hidden p-2 text-slate-600" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 space-y-1">
            {[
              ['newborn','신생아'], ['baby','베이비'], ['toddler','유아'],
              ['kids','주니어'], ['accessory','액세서리'],
            ].map(([slug, label]) => (
              <Link key={slug} href={`/home/products?category=${slug}`} className="block px-4 py-2 text-sm text-slate-700 hover:bg-primary-50 rounded-lg" onClick={() => setMenuOpen(false)}>
                {label}
              </Link>
            ))}
            <Link href="/home/products?isNew=1"    className="block px-4 py-2 text-sm text-primary-600 font-bold hover:bg-primary-50 rounded-lg" onClick={() => setMenuOpen(false)}>신상품</Link>
            <Link href="/home/products?isOnSale=1" className="block px-4 py-2 text-sm text-red-500 font-bold hover:bg-red-50 rounded-lg" onClick={() => setMenuOpen(false)}>세일</Link>
            <Link href="/home/qna"    className="block px-4 py-2 text-sm text-slate-700 hover:bg-primary-50 rounded-lg" onClick={() => setMenuOpen(false)}>질의응답</Link>
            <Link href="/home/mypage" className="block px-4 py-2 text-sm text-slate-700 hover:bg-primary-50 rounded-lg" onClick={() => setMenuOpen(false)}>마이페이지</Link>
          </div>
        )}
      </div>
    </header>
  );
}
